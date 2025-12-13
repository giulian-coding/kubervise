-- ============================================================
-- DROP ALL POLICIES - Nuclear Option
-- This drops ALL policies on the core tables
-- Run this in Supabase SQL Editor
-- ============================================================

-- First, let's see what policies exist
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE tablename IN ('profiles', 'teams', 'team_memberships', 'team_roles');

-- Drop ALL policies on profiles
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies WHERE tablename = 'profiles' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', pol.policyname);
  END LOOP;
END $$;

-- Drop ALL policies on teams
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies WHERE tablename = 'teams' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.teams', pol.policyname);
  END LOOP;
END $$;

-- Drop ALL policies on team_memberships
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies WHERE tablename = 'team_memberships' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.team_memberships', pol.policyname);
  END LOOP;
END $$;

-- Drop ALL policies on team_roles
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies WHERE tablename = 'team_roles' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.team_roles', pol.policyname);
  END LOOP;
END $$;

-- Verify all policies are gone
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE tablename IN ('profiles', 'teams', 'team_memberships', 'team_roles');

-- ============================================================
-- NOW CREATE SIMPLE POLICIES
-- ============================================================

-- PROFILES
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_insert" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- TEAM MEMBERSHIPS (simple - no recursion)
CREATE POLICY "memberships_select" ON public.team_memberships
  FOR SELECT USING (profile_id = auth.uid());

CREATE POLICY "memberships_insert" ON public.team_memberships
  FOR INSERT WITH CHECK (profile_id = auth.uid());

CREATE POLICY "memberships_update" ON public.team_memberships
  FOR UPDATE USING (profile_id = auth.uid());

CREATE POLICY "memberships_delete" ON public.team_memberships
  FOR DELETE USING (profile_id = auth.uid());

-- TEAMS (check ownership directly, no join to memberships for SELECT)
CREATE POLICY "teams_select" ON public.teams
  FOR SELECT USING (
    owner_id = auth.uid()
    OR id IN (SELECT team_id FROM public.team_memberships WHERE profile_id = auth.uid())
  );

CREATE POLICY "teams_insert" ON public.teams
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "teams_update" ON public.teams
  FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "teams_delete" ON public.teams
  FOR DELETE USING (owner_id = auth.uid());

-- TEAM ROLES (public read)
CREATE POLICY "roles_select" ON public.team_roles
  FOR SELECT USING (true);

CREATE POLICY "roles_insert" ON public.team_roles
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_roles ENABLE ROW LEVEL SECURITY;

-- Final verification
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE tablename IN ('profiles', 'teams', 'team_memberships', 'team_roles')
ORDER BY tablename, policyname;
