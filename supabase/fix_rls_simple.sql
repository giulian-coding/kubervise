-- ============================================================
-- FIX RLS POLICIES - Simple Version (No Bypass)
-- Run this in Supabase SQL Editor
-- ============================================================

-- STEP 1: DROP ALL EXISTING POLICIES
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname, tablename FROM pg_policies
    WHERE tablename IN ('profiles', 'teams', 'team_memberships', 'team_roles')
    AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- Verify all dropped
SELECT tablename, policyname FROM pg_policies
WHERE tablename IN ('profiles', 'teams', 'team_memberships', 'team_roles');

-- ============================================================
-- STEP 2: CREATE NEW POLICIES
-- ============================================================

-- PROFILES: Only own profile
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_insert" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- TEAM MEMBERSHIPS: Only own memberships (no subqueries!)
CREATE POLICY "memberships_select" ON public.team_memberships
  FOR SELECT USING (profile_id = auth.uid());

CREATE POLICY "memberships_insert" ON public.team_memberships
  FOR INSERT WITH CHECK (profile_id = auth.uid());

CREATE POLICY "memberships_update" ON public.team_memberships
  FOR UPDATE USING (profile_id = auth.uid());

CREATE POLICY "memberships_delete" ON public.team_memberships
  FOR DELETE USING (profile_id = auth.uid());

-- TEAMS: Owner can always see, members see via explicit team_id query
-- Using EXISTS instead of IN to avoid recursion
CREATE POLICY "teams_select" ON public.teams
  FOR SELECT USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.team_memberships tm
      WHERE tm.team_id = teams.id
      AND tm.profile_id = auth.uid()
    )
  );

CREATE POLICY "teams_insert" ON public.teams
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "teams_update" ON public.teams
  FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "teams_delete" ON public.teams
  FOR DELETE USING (owner_id = auth.uid());

-- TEAM ROLES: Public read
CREATE POLICY "roles_select" ON public.team_roles
  FOR SELECT USING (true);

CREATE POLICY "roles_insert" ON public.team_roles
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================
-- STEP 3: ENABLE RLS
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_roles ENABLE ROW LEVEL SECURITY;

-- Verify
SELECT tablename, policyname, cmd FROM pg_policies
WHERE tablename IN ('profiles', 'teams', 'team_memberships', 'team_roles')
ORDER BY tablename;
