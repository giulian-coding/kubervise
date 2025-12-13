-- ============================================================
-- Kubervise: Reset All Data
-- This script deletes all data from tables while preserving the schema
-- Run this in Supabase SQL Editor
-- ============================================================

-- Disable triggers temporarily to avoid cascade issues
SET session_replication_role = 'replica';

-- Delete in correct order (respecting foreign keys)

-- 1. Delete K8s monitoring data
DELETE FROM public.cluster_events;
DELETE FROM public.pods;
DELETE FROM public.namespaces;
DELETE FROM public.nodes;
DELETE FROM public.cluster_status;
DELETE FROM public.clusters;

-- 2. Delete team-related data
DELETE FROM public.team_audit_log;
DELETE FROM public.team_invitations;
DELETE FROM public.team_memberships;
DELETE FROM public.teams;

-- 3. Delete profiles (this will also delete via cascade if set up)
DELETE FROM public.profiles;

-- 4. Optionally reset team_roles to defaults (uncomment if needed)
-- DELETE FROM public.team_roles;
-- INSERT INTO public.team_roles (role, name, permissions) VALUES
--   ('owner', 'Owner', '["*"]'),
--   ('admin', 'Admin', '["manage_members", "manage_clusters", "manage_settings"]'),
--   ('member', 'Member', '["view_clusters", "manage_own_clusters"]'),
--   ('viewer', 'Viewer', '["view_clusters"]');

-- Re-enable triggers
SET session_replication_role = 'origin';

-- Verify deletion
SELECT 'profiles' as table_name, COUNT(*) as count FROM public.profiles
UNION ALL
SELECT 'teams', COUNT(*) FROM public.teams
UNION ALL
SELECT 'team_memberships', COUNT(*) FROM public.team_memberships
UNION ALL
SELECT 'team_roles', COUNT(*) FROM public.team_roles
UNION ALL
SELECT 'clusters', COUNT(*) FROM public.clusters;
