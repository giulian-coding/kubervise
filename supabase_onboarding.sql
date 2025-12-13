-- ============================================================
-- Kubervise Onboarding System
-- Triggers, Functions & Edge Functions for Team Management
-- ============================================================

-- ============================================================
-- PART 1: ENUM TYPES
-- ============================================================

-- Team role types enum (if not exists)
DO $$ BEGIN
  CREATE TYPE team_role_types AS ENUM ('owner', 'admin', 'member', 'viewer');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Onboarding status enum
DO $$ BEGIN
  CREATE TYPE onboarding_status AS ENUM ('pending', 'completed', 'skipped');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Invitation status enum
DO $$ BEGIN
  CREATE TYPE invitation_status AS ENUM ('pending', 'accepted', 'declined', 'expired');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================================
-- PART 2: UPDATE EXISTING TABLES
-- ============================================================

-- Add onboarding fields to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS onboarding_status onboarding_status DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();

-- Add more fields to teams table
ALTER TABLE public.teams
ADD COLUMN IF NOT EXISTS slug text UNIQUE,
ADD COLUMN IF NOT EXISTS description text,
ADD COLUMN IF NOT EXISTS avatar_url text,
ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now(),
ADD COLUMN IF NOT EXISTS settings jsonb DEFAULT '{}';

-- Update team_roles to use the role column properly
ALTER TABLE public.team_roles
ADD COLUMN IF NOT EXISTS name text,
ADD COLUMN IF NOT EXISTS permissions jsonb DEFAULT '[]';

-- ============================================================
-- PART 3: NEW TABLES
-- ============================================================

-- Team invitations table
CREATE TABLE IF NOT EXISTS public.team_invitations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  email text NOT NULL,
  role team_role_types NOT NULL DEFAULT 'member',
  invited_by uuid NOT NULL REFERENCES public.profiles(id),
  status invitation_status NOT NULL DEFAULT 'pending',
  token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  accepted_at timestamp with time zone,
  CONSTRAINT team_invitations_pkey PRIMARY KEY (id),
  CONSTRAINT team_invitations_unique_pending UNIQUE (team_id, email, status)
);

-- Audit log for team actions
CREATE TABLE IF NOT EXISTS public.team_audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id),
  action text NOT NULL,
  details jsonb DEFAULT '{}',
  ip_address inet,
  user_agent text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT team_audit_log_pkey PRIMARY KEY (id)
);

-- ============================================================
-- PART 4: HELPER FUNCTIONS
-- ============================================================

-- Function to generate a URL-friendly slug from team name
CREATE OR REPLACE FUNCTION generate_team_slug(team_name text)
RETURNS text AS $$
DECLARE
  base_slug text;
  final_slug text;
  counter integer := 0;
BEGIN
  -- Convert to lowercase, replace spaces with hyphens, remove special chars
  base_slug := lower(regexp_replace(team_name, '[^a-zA-Z0-9\s-]', '', 'g'));
  base_slug := regexp_replace(base_slug, '\s+', '-', 'g');
  base_slug := regexp_replace(base_slug, '-+', '-', 'g');
  base_slug := trim(both '-' from base_slug);

  -- Ensure minimum length
  IF length(base_slug) < 3 THEN
    base_slug := base_slug || '-team';
  END IF;

  final_slug := base_slug;

  -- Check for uniqueness and append number if needed
  WHILE EXISTS (SELECT 1 FROM public.teams WHERE slug = final_slug) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;

  RETURN final_slug;
END;
$$ LANGUAGE plpgsql;

-- Function to check if user has specific role in team
CREATE OR REPLACE FUNCTION user_has_team_role(
  p_user_id uuid,
  p_team_id uuid,
  p_roles team_role_types[]
)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.team_memberships tm
    JOIN public.team_roles tr ON tm.role_id = tr.id
    WHERE tm.profile_id = p_user_id
    AND tm.team_id = p_team_id
    AND tr.role = ANY(p_roles)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's primary team
CREATE OR REPLACE FUNCTION get_user_primary_team(p_user_id uuid)
RETURNS uuid AS $$
DECLARE
  v_team_id uuid;
BEGIN
  -- First try to find a team where user is owner
  SELECT t.id INTO v_team_id
  FROM public.teams t
  WHERE t.owner_id = p_user_id
  ORDER BY t.created_at ASC
  LIMIT 1;

  -- If not owner of any team, get first team membership
  IF v_team_id IS NULL THEN
    SELECT tm.team_id INTO v_team_id
    FROM public.team_memberships tm
    WHERE tm.profile_id = p_user_id
    ORDER BY tm.created_at ASC
    LIMIT 1;
  END IF;

  RETURN v_team_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- PART 5: TRIGGER FUNCTIONS
-- ============================================================

-- Function: Auto-create profile when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, onboarding_status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture'),
    'pending'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Auto-generate team slug before insert
CREATE OR REPLACE FUNCTION public.handle_team_slug()
RETURNS trigger AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := generate_team_slug(NEW.name);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function: Update timestamps
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function: Create default team role and membership when team is created
CREATE OR REPLACE FUNCTION public.handle_new_team()
RETURNS trigger AS $$
DECLARE
  v_owner_role_id uuid;
BEGIN
  -- Create owner role for this team
  INSERT INTO public.team_roles (role, name, permissions)
  VALUES ('owner', 'Owner', '["*"]')
  RETURNING id INTO v_owner_role_id;

  -- Add creator as owner
  IF NEW.owner_id IS NOT NULL THEN
    INSERT INTO public.team_memberships (profile_id, team_id, role_id)
    VALUES (NEW.owner_id, NEW.id, v_owner_role_id);

    -- Log the team creation
    INSERT INTO public.team_audit_log (team_id, user_id, action, details)
    VALUES (NEW.id, NEW.owner_id, 'team_created', jsonb_build_object('team_name', NEW.name));
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Handle team membership changes (audit logging)
CREATE OR REPLACE FUNCTION public.handle_team_membership_change()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.team_audit_log (team_id, user_id, action, details)
    VALUES (
      NEW.team_id,
      NEW.profile_id,
      'member_added',
      jsonb_build_object('role_id', NEW.role_id)
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.team_audit_log (team_id, user_id, action, details)
    VALUES (
      NEW.team_id,
      NEW.profile_id,
      'member_role_changed',
      jsonb_build_object('old_role_id', OLD.role_id, 'new_role_id', NEW.role_id)
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.team_audit_log (team_id, user_id, action, details)
    VALUES (
      OLD.team_id,
      OLD.profile_id,
      'member_removed',
      jsonb_build_object('role_id', OLD.role_id)
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Handle invitation acceptance
CREATE OR REPLACE FUNCTION public.accept_team_invitation(p_token text)
RETURNS jsonb AS $$
DECLARE
  v_invitation record;
  v_role_id uuid;
  v_user_id uuid;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Find the invitation
  SELECT * INTO v_invitation
  FROM public.team_invitations
  WHERE token = p_token
  AND status = 'pending'
  AND expires_at > now();

  IF v_invitation IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired invitation');
  END IF;

  -- Check if user email matches invitation
  IF (SELECT email FROM auth.users WHERE id = v_user_id) != v_invitation.email THEN
    RETURN jsonb_build_object('success', false, 'error', 'Email does not match invitation');
  END IF;

  -- Get or create role
  SELECT id INTO v_role_id
  FROM public.team_roles
  WHERE role = v_invitation.role
  LIMIT 1;

  IF v_role_id IS NULL THEN
    INSERT INTO public.team_roles (role, name)
    VALUES (v_invitation.role, initcap(v_invitation.role::text))
    RETURNING id INTO v_role_id;
  END IF;

  -- Add user to team
  INSERT INTO public.team_memberships (profile_id, team_id, role_id)
  VALUES (v_user_id, v_invitation.team_id, v_role_id)
  ON CONFLICT DO NOTHING;

  -- Update invitation status
  UPDATE public.team_invitations
  SET status = 'accepted', accepted_at = now()
  WHERE id = v_invitation.id;

  RETURN jsonb_build_object(
    'success', true,
    'team_id', v_invitation.team_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Complete onboarding
CREATE OR REPLACE FUNCTION public.complete_onboarding(p_team_name text DEFAULT NULL)
RETURNS jsonb AS $$
DECLARE
  v_user_id uuid;
  v_team_id uuid;
  v_has_team boolean;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Check if user already has a team
  SELECT EXISTS (
    SELECT 1 FROM public.team_memberships WHERE profile_id = v_user_id
  ) INTO v_has_team;

  -- Create team if name provided and user has no team
  IF p_team_name IS NOT NULL AND NOT v_has_team THEN
    INSERT INTO public.teams (name, owner_id)
    VALUES (p_team_name, v_user_id)
    RETURNING id INTO v_team_id;
  ELSE
    v_team_id := get_user_primary_team(v_user_id);
  END IF;

  -- Mark onboarding as completed
  UPDATE public.profiles
  SET
    onboarding_status = 'completed',
    onboarding_completed_at = now()
  WHERE id = v_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'team_id', v_team_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- PART 6: CREATE TRIGGERS
-- ============================================================

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_team_created ON public.teams;
DROP TRIGGER IF EXISTS on_team_slug ON public.teams;
DROP TRIGGER IF EXISTS on_team_updated ON public.teams;
DROP TRIGGER IF EXISTS on_profile_updated ON public.profiles;
DROP TRIGGER IF EXISTS on_team_membership_change ON public.team_memberships;

-- Trigger: Create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger: Generate slug before team insert
CREATE TRIGGER on_team_slug
  BEFORE INSERT ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.handle_team_slug();

-- Trigger: Handle new team setup
CREATE TRIGGER on_team_created
  AFTER INSERT ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_team();

-- Trigger: Update timestamps on teams
CREATE TRIGGER on_team_updated
  BEFORE UPDATE ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Trigger: Update timestamps on profiles
CREATE TRIGGER on_profile_updated
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Trigger: Audit team membership changes
CREATE TRIGGER on_team_membership_change
  AFTER INSERT OR UPDATE OR DELETE ON public.team_memberships
  FOR EACH ROW EXECUTE FUNCTION public.handle_team_membership_change();

-- ============================================================
-- PART 7: ROW LEVEL SECURITY POLICIES
-- ============================================================

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_audit_log ENABLE ROW LEVEL SECURITY;

-- Profiles policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can view team members profiles" ON public.profiles;
CREATE POLICY "Users can view team members profiles" ON public.profiles
  FOR SELECT USING (
    id IN (
      SELECT tm2.profile_id
      FROM public.team_memberships tm1
      JOIN public.team_memberships tm2 ON tm1.team_id = tm2.team_id
      WHERE tm1.profile_id = auth.uid()
    )
  );

-- Teams policies
DROP POLICY IF EXISTS "Users can view their teams" ON public.teams;
CREATE POLICY "Users can view their teams" ON public.teams
  FOR SELECT USING (
    id IN (
      SELECT team_id FROM public.team_memberships WHERE profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create teams" ON public.teams;
CREATE POLICY "Users can create teams" ON public.teams
  FOR INSERT WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Team owners and admins can update" ON public.teams;
CREATE POLICY "Team owners and admins can update" ON public.teams
  FOR UPDATE USING (
    user_has_team_role(auth.uid(), id, ARRAY['owner', 'admin']::team_role_types[])
  );

DROP POLICY IF EXISTS "Only team owners can delete" ON public.teams;
CREATE POLICY "Only team owners can delete" ON public.teams
  FOR DELETE USING (owner_id = auth.uid());

-- Team memberships policies
DROP POLICY IF EXISTS "Users can view team memberships" ON public.team_memberships;
CREATE POLICY "Users can view team memberships" ON public.team_memberships
  FOR SELECT USING (
    team_id IN (
      SELECT team_id FROM public.team_memberships WHERE profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Owners and admins can manage memberships" ON public.team_memberships;
CREATE POLICY "Owners and admins can manage memberships" ON public.team_memberships
  FOR ALL USING (
    user_has_team_role(auth.uid(), team_id, ARRAY['owner', 'admin']::team_role_types[])
  );

-- Team roles policies
DROP POLICY IF EXISTS "Anyone can view roles" ON public.team_roles;
CREATE POLICY "Anyone can view roles" ON public.team_roles
  FOR SELECT USING (true);

-- Team invitations policies
DROP POLICY IF EXISTS "Users can view invitations for their teams" ON public.team_invitations;
CREATE POLICY "Users can view invitations for their teams" ON public.team_invitations
  FOR SELECT USING (
    team_id IN (
      SELECT team_id FROM public.team_memberships WHERE profile_id = auth.uid()
    )
    OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Owners and admins can create invitations" ON public.team_invitations;
CREATE POLICY "Owners and admins can create invitations" ON public.team_invitations
  FOR INSERT WITH CHECK (
    user_has_team_role(auth.uid(), team_id, ARRAY['owner', 'admin']::team_role_types[])
  );

DROP POLICY IF EXISTS "Owners and admins can update invitations" ON public.team_invitations;
CREATE POLICY "Owners and admins can update invitations" ON public.team_invitations
  FOR UPDATE USING (
    user_has_team_role(auth.uid(), team_id, ARRAY['owner', 'admin']::team_role_types[])
  );

-- Audit log policies
DROP POLICY IF EXISTS "Users can view audit logs for their teams" ON public.team_audit_log;
CREATE POLICY "Users can view audit logs for their teams" ON public.team_audit_log
  FOR SELECT USING (
    team_id IN (
      SELECT team_id FROM public.team_memberships WHERE profile_id = auth.uid()
    )
  );

-- ============================================================
-- PART 8: INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_profiles_onboarding_status ON public.profiles(onboarding_status);
CREATE INDEX IF NOT EXISTS idx_teams_owner_id ON public.teams(owner_id);
CREATE INDEX IF NOT EXISTS idx_teams_slug ON public.teams(slug);
CREATE INDEX IF NOT EXISTS idx_team_invitations_token ON public.team_invitations(token);
CREATE INDEX IF NOT EXISTS idx_team_invitations_email ON public.team_invitations(email);
CREATE INDEX IF NOT EXISTS idx_team_invitations_status ON public.team_invitations(status);
CREATE INDEX IF NOT EXISTS idx_team_audit_log_team_id ON public.team_audit_log(team_id);
CREATE INDEX IF NOT EXISTS idx_team_audit_log_created_at ON public.team_audit_log(created_at DESC);

-- ============================================================
-- PART 9: INSERT DEFAULT ROLES
-- ============================================================

INSERT INTO public.team_roles (role, name, permissions) VALUES
  ('owner', 'Owner', '["*"]'),
  ('admin', 'Admin', '["manage_members", "manage_clusters", "manage_settings"]'),
  ('member', 'Member', '["view_clusters", "manage_own_clusters"]'),
  ('viewer', 'Viewer', '["view_clusters"]')
ON CONFLICT DO NOTHING;
