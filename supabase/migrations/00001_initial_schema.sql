-- ============================================================
-- Kubervise Complete Database Schema
-- Initial Migration: Teams, Profiles, Onboarding, K8s Monitoring
-- ============================================================

-- ============================================================
-- PART 1: ENUM TYPES
-- ============================================================

-- Team role types
CREATE TYPE team_role_types AS ENUM ('owner', 'admin', 'member', 'viewer');

-- Onboarding status
CREATE TYPE onboarding_status AS ENUM ('pending', 'completed', 'skipped');

-- Invitation status
CREATE TYPE invitation_status AS ENUM ('pending', 'accepted', 'declined', 'expired');

-- Cluster connection status
CREATE TYPE cluster_connection_status AS ENUM ('connected', 'disconnected', 'error');

-- Pod status phases
CREATE TYPE pod_phase AS ENUM ('Pending', 'Running', 'Succeeded', 'Failed', 'Unknown');

-- Node status
CREATE TYPE node_status AS ENUM ('Ready', 'NotReady', 'Unknown');

-- ============================================================
-- PART 2: CORE TABLES
-- ============================================================

-- Profiles table (extends auth.users)
CREATE TABLE public.profiles (
  id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE CHECK (char_length(username) >= 3),
  full_name text,
  avatar_url text,
  onboarding_status onboarding_status DEFAULT 'pending',
  onboarding_completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT profiles_pkey PRIMARY KEY (id)
);

-- Team roles table
CREATE TABLE public.team_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  role team_role_types NOT NULL DEFAULT 'viewer',
  name text NOT NULL,
  permissions jsonb DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT team_roles_pkey PRIMARY KEY (id)
);

-- Teams table
CREATE TABLE public.teams (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE,
  description text,
  avatar_url text,
  owner_id uuid REFERENCES public.profiles(id),
  settings jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT teams_pkey PRIMARY KEY (id)
);

-- Team memberships table
CREATE TABLE public.team_memberships (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES public.team_roles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT team_memberships_pkey PRIMARY KEY (id),
  CONSTRAINT team_memberships_unique UNIQUE (profile_id, team_id)
);

-- Team invitations table
CREATE TABLE public.team_invitations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  email text NOT NULL,
  role team_role_types NOT NULL DEFAULT 'member',
  invited_by uuid NOT NULL REFERENCES public.profiles(id),
  status invitation_status NOT NULL DEFAULT 'pending',
  token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  CONSTRAINT team_invitations_pkey PRIMARY KEY (id)
);

-- Team audit log
CREATE TABLE public.team_audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id),
  action text NOT NULL,
  details jsonb DEFAULT '{}',
  ip_address inet,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT team_audit_log_pkey PRIMARY KEY (id)
);

-- ============================================================
-- PART 3: KUBERNETES MONITORING TABLES
-- ============================================================

-- Clusters table
CREATE TABLE public.clusters (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  api_endpoint text,
  connection_status cluster_connection_status NOT NULL DEFAULT 'disconnected',
  last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT clusters_pkey PRIMARY KEY (id)
);

-- Cluster status snapshots
CREATE TABLE public.cluster_status (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  cluster_id uuid NOT NULL REFERENCES public.clusters(id) ON DELETE CASCADE,
  node_count integer NOT NULL DEFAULT 0,
  pod_count integer NOT NULL DEFAULT 0,
  namespace_count integer NOT NULL DEFAULT 0,
  cpu_capacity text,
  memory_capacity text,
  cpu_allocatable text,
  memory_allocatable text,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cluster_status_pkey PRIMARY KEY (id)
);

-- Nodes table
CREATE TABLE public.nodes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  cluster_id uuid NOT NULL REFERENCES public.clusters(id) ON DELETE CASCADE,
  name text NOT NULL,
  status node_status NOT NULL DEFAULT 'Unknown',
  capacity_cpu text,
  capacity_memory text,
  allocatable_cpu text,
  allocatable_memory text,
  kubernetes_version text,
  os_image text,
  container_runtime text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nodes_pkey PRIMARY KEY (id),
  CONSTRAINT nodes_cluster_name_unique UNIQUE (cluster_id, name)
);

-- Namespaces table
CREATE TABLE public.namespaces (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  cluster_id uuid NOT NULL REFERENCES public.clusters(id) ON DELETE CASCADE,
  name text NOT NULL,
  status text DEFAULT 'Active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT namespaces_pkey PRIMARY KEY (id),
  CONSTRAINT namespaces_cluster_name_unique UNIQUE (cluster_id, name)
);

-- Pods table
CREATE TABLE public.pods (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  cluster_id uuid NOT NULL REFERENCES public.clusters(id) ON DELETE CASCADE,
  namespace_id uuid NOT NULL REFERENCES public.namespaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  status pod_phase NOT NULL DEFAULT 'Unknown',
  node_name text,
  pod_ip text,
  restart_count integer DEFAULT 0,
  cpu_request text,
  memory_request text,
  cpu_limit text,
  memory_limit text,
  k8s_created_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pods_pkey PRIMARY KEY (id),
  CONSTRAINT pods_cluster_namespace_name_unique UNIQUE (cluster_id, namespace_id, name)
);

-- Cluster events table
CREATE TABLE public.cluster_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  cluster_id uuid NOT NULL REFERENCES public.clusters(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  reason text,
  message text,
  involved_kind text,
  involved_name text,
  involved_namespace text,
  source_component text,
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  count integer DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cluster_events_pkey PRIMARY KEY (id)
);

-- ============================================================
-- PART 4: INDEXES
-- ============================================================

-- Profile indexes
CREATE INDEX idx_profiles_onboarding_status ON public.profiles(onboarding_status);

-- Team indexes
CREATE INDEX idx_teams_owner_id ON public.teams(owner_id);
CREATE INDEX idx_teams_slug ON public.teams(slug);

-- Membership indexes
CREATE INDEX idx_team_memberships_profile_id ON public.team_memberships(profile_id);
CREATE INDEX idx_team_memberships_team_id ON public.team_memberships(team_id);

-- Invitation indexes
CREATE INDEX idx_team_invitations_token ON public.team_invitations(token);
CREATE INDEX idx_team_invitations_email ON public.team_invitations(email);
CREATE INDEX idx_team_invitations_status ON public.team_invitations(status);

-- Audit log indexes
CREATE INDEX idx_team_audit_log_team_id ON public.team_audit_log(team_id);
CREATE INDEX idx_team_audit_log_created_at ON public.team_audit_log(created_at DESC);

-- Kubernetes monitoring indexes
CREATE INDEX idx_clusters_team_id ON public.clusters(team_id);
CREATE INDEX idx_cluster_status_cluster_id ON public.cluster_status(cluster_id);
CREATE INDEX idx_cluster_status_recorded_at ON public.cluster_status(recorded_at DESC);
CREATE INDEX idx_nodes_cluster_id ON public.nodes(cluster_id);
CREATE INDEX idx_namespaces_cluster_id ON public.namespaces(cluster_id);
CREATE INDEX idx_pods_cluster_id ON public.pods(cluster_id);
CREATE INDEX idx_pods_namespace_id ON public.pods(namespace_id);
CREATE INDEX idx_pods_status ON public.pods(status);
CREATE INDEX idx_cluster_events_cluster_id ON public.cluster_events(cluster_id);
CREATE INDEX idx_cluster_events_created_at ON public.cluster_events(created_at DESC);

-- ============================================================
-- PART 5: HELPER FUNCTIONS
-- ============================================================

-- Generate URL-friendly slug
CREATE OR REPLACE FUNCTION generate_team_slug(team_name text)
RETURNS text AS $$
DECLARE
  base_slug text;
  final_slug text;
  counter integer := 0;
BEGIN
  base_slug := lower(regexp_replace(team_name, '[^a-zA-Z0-9\s-]', '', 'g'));
  base_slug := regexp_replace(base_slug, '\s+', '-', 'g');
  base_slug := regexp_replace(base_slug, '-+', '-', 'g');
  base_slug := trim(both '-' from base_slug);

  IF length(base_slug) < 3 THEN
    base_slug := base_slug || '-team';
  END IF;

  final_slug := base_slug;

  WHILE EXISTS (SELECT 1 FROM public.teams WHERE slug = final_slug) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;

  RETURN final_slug;
END;
$$ LANGUAGE plpgsql;

-- Check if user has specific role in team
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

-- Get user's primary team
CREATE OR REPLACE FUNCTION get_user_primary_team(p_user_id uuid)
RETURNS uuid AS $$
DECLARE
  v_team_id uuid;
BEGIN
  SELECT t.id INTO v_team_id
  FROM public.teams t
  WHERE t.owner_id = p_user_id
  ORDER BY t.created_at ASC
  LIMIT 1;

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

-- Get user's teams with role
CREATE OR REPLACE FUNCTION get_user_teams(p_user_id uuid)
RETURNS TABLE (
  team_id uuid,
  team_name text,
  team_slug text,
  team_avatar_url text,
  role team_role_types,
  is_owner boolean
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id as team_id,
    t.name as team_name,
    t.slug as team_slug,
    t.avatar_url as team_avatar_url,
    tr.role as role,
    (t.owner_id = p_user_id) as is_owner
  FROM public.team_memberships tm
  JOIN public.teams t ON tm.team_id = t.id
  JOIN public.team_roles tr ON tm.role_id = tr.id
  WHERE tm.profile_id = p_user_id
  ORDER BY (t.owner_id = p_user_id) DESC, t.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- PART 6: TRIGGER FUNCTIONS
-- ============================================================

-- Auto-create profile when user signs up
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

-- Generate team slug before insert
CREATE OR REPLACE FUNCTION public.handle_team_slug()
RETURNS trigger AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := generate_team_slug(NEW.name);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update timestamps
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create default team role and membership when team is created
CREATE OR REPLACE FUNCTION public.handle_new_team()
RETURNS trigger AS $$
DECLARE
  v_owner_role_id uuid;
BEGIN
  -- Get owner role id
  SELECT id INTO v_owner_role_id
  FROM public.team_roles
  WHERE role = 'owner'
  LIMIT 1;

  -- Create owner role if not exists
  IF v_owner_role_id IS NULL THEN
    INSERT INTO public.team_roles (role, name, permissions)
    VALUES ('owner', 'Owner', '["*"]')
    RETURNING id INTO v_owner_role_id;
  END IF;

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

-- Audit team membership changes
CREATE OR REPLACE FUNCTION public.handle_team_membership_change()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.team_audit_log (team_id, user_id, action, details)
    VALUES (NEW.team_id, NEW.profile_id, 'member_added', jsonb_build_object('role_id', NEW.role_id));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.team_audit_log (team_id, user_id, action, details)
    VALUES (NEW.team_id, NEW.profile_id, 'member_role_changed',
      jsonb_build_object('old_role_id', OLD.role_id, 'new_role_id', NEW.role_id));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.team_audit_log (team_id, user_id, action, details)
    VALUES (OLD.team_id, OLD.profile_id, 'member_removed', jsonb_build_object('role_id', OLD.role_id));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- PART 7: ONBOARDING FUNCTIONS (called via RPC)
-- ============================================================

-- Create team and complete onboarding
CREATE OR REPLACE FUNCTION public.create_team_and_complete_onboarding(
  p_team_name text,
  p_team_description text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_user_id uuid;
  v_team_id uuid;
  v_profile record;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Check current onboarding status
  SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id;
  IF v_profile IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Profile not found');
  END IF;

  IF v_profile.onboarding_status = 'completed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Onboarding already completed');
  END IF;

  -- Create team
  INSERT INTO public.teams (name, description, owner_id)
  VALUES (p_team_name, p_team_description, v_user_id)
  RETURNING id INTO v_team_id;

  -- Mark onboarding as completed
  UPDATE public.profiles
  SET
    onboarding_status = 'completed',
    onboarding_completed_at = now()
  WHERE id = v_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'team_id', v_team_id,
    'message', 'Team created and onboarding completed'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get user onboarding status
CREATE OR REPLACE FUNCTION public.get_onboarding_status()
RETURNS jsonb AS $$
DECLARE
  v_user_id uuid;
  v_profile record;
  v_team_count integer;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id;
  IF v_profile IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Profile not found');
  END IF;

  SELECT COUNT(*) INTO v_team_count
  FROM public.team_memberships
  WHERE profile_id = v_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'onboarding_status', v_profile.onboarding_status,
    'onboarding_completed_at', v_profile.onboarding_completed_at,
    'has_team', v_team_count > 0,
    'team_count', v_team_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Accept team invitation
CREATE OR REPLACE FUNCTION public.accept_team_invitation(p_token text)
RETURNS jsonb AS $$
DECLARE
  v_invitation record;
  v_role_id uuid;
  v_user_id uuid;
  v_user_email text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Get user email
  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;

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
  IF v_user_email != v_invitation.email THEN
    RETURN jsonb_build_object('success', false, 'error', 'Email does not match invitation');
  END IF;

  -- Get role id
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
  ON CONFLICT (profile_id, team_id) DO NOTHING;

  -- Update invitation status
  UPDATE public.team_invitations
  SET status = 'accepted', accepted_at = now()
  WHERE id = v_invitation.id;

  -- Complete onboarding if pending
  UPDATE public.profiles
  SET
    onboarding_status = 'completed',
    onboarding_completed_at = COALESCE(onboarding_completed_at, now())
  WHERE id = v_user_id AND onboarding_status = 'pending';

  RETURN jsonb_build_object(
    'success', true,
    'team_id', v_invitation.team_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- PART 8: TRIGGERS
-- ============================================================

-- Create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Generate slug before team insert
CREATE TRIGGER on_team_slug
  BEFORE INSERT ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.handle_team_slug();

-- Handle new team setup
CREATE TRIGGER on_team_created
  AFTER INSERT ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_team();

-- Update timestamps
CREATE TRIGGER on_team_updated
  BEFORE UPDATE ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER on_profile_updated
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_clusters_updated_at
  BEFORE UPDATE ON public.clusters
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_nodes_updated_at
  BEFORE UPDATE ON public.nodes
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_namespaces_updated_at
  BEFORE UPDATE ON public.namespaces
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_pods_updated_at
  BEFORE UPDATE ON public.pods
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Audit membership changes
CREATE TRIGGER on_team_membership_change
  AFTER INSERT OR UPDATE OR DELETE ON public.team_memberships
  FOR EACH ROW EXECUTE FUNCTION public.handle_team_membership_change();

-- ============================================================
-- PART 9: ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cluster_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.namespaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cluster_events ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

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
CREATE POLICY "Users can view their teams" ON public.teams
  FOR SELECT USING (
    id IN (SELECT team_id FROM public.team_memberships WHERE profile_id = auth.uid())
  );

CREATE POLICY "Users can create teams" ON public.teams
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Team owners and admins can update" ON public.teams
  FOR UPDATE USING (
    user_has_team_role(auth.uid(), id, ARRAY['owner', 'admin']::team_role_types[])
  );

CREATE POLICY "Only team owners can delete" ON public.teams
  FOR DELETE USING (owner_id = auth.uid());

-- Team memberships policies
CREATE POLICY "Users can view team memberships" ON public.team_memberships
  FOR SELECT USING (
    team_id IN (SELECT team_id FROM public.team_memberships WHERE profile_id = auth.uid())
  );

CREATE POLICY "Owners and admins can manage memberships" ON public.team_memberships
  FOR ALL USING (
    user_has_team_role(auth.uid(), team_id, ARRAY['owner', 'admin']::team_role_types[])
  );

-- Team roles policies
CREATE POLICY "Anyone can view roles" ON public.team_roles
  FOR SELECT USING (true);

-- Team invitations policies
CREATE POLICY "Users can view invitations for their teams" ON public.team_invitations
  FOR SELECT USING (
    team_id IN (SELECT team_id FROM public.team_memberships WHERE profile_id = auth.uid())
    OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

CREATE POLICY "Owners and admins can create invitations" ON public.team_invitations
  FOR INSERT WITH CHECK (
    user_has_team_role(auth.uid(), team_id, ARRAY['owner', 'admin']::team_role_types[])
  );

CREATE POLICY "Owners and admins can update invitations" ON public.team_invitations
  FOR UPDATE USING (
    user_has_team_role(auth.uid(), team_id, ARRAY['owner', 'admin']::team_role_types[])
  );

-- Audit log policies
CREATE POLICY "Users can view audit logs for their teams" ON public.team_audit_log
  FOR SELECT USING (
    team_id IN (SELECT team_id FROM public.team_memberships WHERE profile_id = auth.uid())
  );

-- Clusters policies
CREATE POLICY "Users can view their team clusters" ON public.clusters
  FOR SELECT USING (
    team_id IN (SELECT team_id FROM public.team_memberships WHERE profile_id = auth.uid())
  );

CREATE POLICY "Users can insert clusters for their teams" ON public.clusters
  FOR INSERT WITH CHECK (
    team_id IN (SELECT team_id FROM public.team_memberships WHERE profile_id = auth.uid())
  );

CREATE POLICY "Users can update their team clusters" ON public.clusters
  FOR UPDATE USING (
    team_id IN (SELECT team_id FROM public.team_memberships WHERE profile_id = auth.uid())
  );

CREATE POLICY "Users can delete their team clusters" ON public.clusters
  FOR DELETE USING (
    team_id IN (SELECT team_id FROM public.team_memberships WHERE profile_id = auth.uid())
  );

-- Cluster related tables policies (via cluster -> team)
CREATE POLICY "Users can view cluster status" ON public.cluster_status
  FOR SELECT USING (
    cluster_id IN (
      SELECT c.id FROM public.clusters c
      JOIN public.team_memberships tm ON c.team_id = tm.team_id
      WHERE tm.profile_id = auth.uid()
    )
  );

CREATE POLICY "Users can view nodes" ON public.nodes
  FOR SELECT USING (
    cluster_id IN (
      SELECT c.id FROM public.clusters c
      JOIN public.team_memberships tm ON c.team_id = tm.team_id
      WHERE tm.profile_id = auth.uid()
    )
  );

CREATE POLICY "Users can view namespaces" ON public.namespaces
  FOR SELECT USING (
    cluster_id IN (
      SELECT c.id FROM public.clusters c
      JOIN public.team_memberships tm ON c.team_id = tm.team_id
      WHERE tm.profile_id = auth.uid()
    )
  );

CREATE POLICY "Users can view pods" ON public.pods
  FOR SELECT USING (
    cluster_id IN (
      SELECT c.id FROM public.clusters c
      JOIN public.team_memberships tm ON c.team_id = tm.team_id
      WHERE tm.profile_id = auth.uid()
    )
  );

CREATE POLICY "Users can view events" ON public.cluster_events
  FOR SELECT USING (
    cluster_id IN (
      SELECT c.id FROM public.clusters c
      JOIN public.team_memberships tm ON c.team_id = tm.team_id
      WHERE tm.profile_id = auth.uid()
    )
  );

-- ============================================================
-- PART 10: REALTIME
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.clusters;
ALTER PUBLICATION supabase_realtime ADD TABLE public.cluster_status;
ALTER PUBLICATION supabase_realtime ADD TABLE public.nodes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pods;
ALTER PUBLICATION supabase_realtime ADD TABLE public.cluster_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.teams;
ALTER PUBLICATION supabase_realtime ADD TABLE public.team_memberships;

-- ============================================================
-- PART 11: DEFAULT DATA
-- ============================================================

INSERT INTO public.team_roles (role, name, permissions) VALUES
  ('owner', 'Owner', '["*"]'),
  ('admin', 'Admin', '["manage_members", "manage_clusters", "manage_settings"]'),
  ('member', 'Member', '["view_clusters", "manage_own_clusters"]'),
  ('viewer', 'Viewer', '["view_clusters"]')
ON CONFLICT DO NOTHING;
