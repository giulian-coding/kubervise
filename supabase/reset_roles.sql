-- ============================================================
-- RESET SCRIPT: Team Roles and Memberships
-- WARNING: This will remove all team memberships!
-- Run each section separately in Supabase SQL Editor
-- ============================================================

-- ============================================================
-- SECTION 1: Run this FIRST (in separate query)
-- ============================================================
-- Add contributor enum value if not exists
ALTER TYPE team_role_types ADD VALUE IF NOT EXISTS 'contributor';


-- ============================================================
-- SECTION 2: Run this SECOND (in separate query)
-- ============================================================

-- Step 1: Delete all team memberships (required due to foreign key)
DELETE FROM public.team_memberships;

-- Step 2: Delete all team roles
DELETE FROM public.team_roles;

-- Step 3: Insert fresh roles
INSERT INTO public.team_roles (role, name, permissions)
VALUES
  ('owner', 'Owner', '["*"]'::jsonb),
  ('admin', 'Admin', '["cluster:view", "cluster:create", "cluster:edit", "cluster:delete", "workload:view", "workload:create", "workload:edit", "workload:delete", "workload:scale", "workload:restart", "pod:view", "pod:logs", "pod:exec", "pod:delete", "monitoring:view", "monitoring:alerts", "team:view", "team:invite", "settings:view", "settings:edit"]'::jsonb),
  ('contributor', 'Contributor', '["cluster:view", "cluster:edit", "workload:view", "workload:edit", "pod:view", "pod:logs", "monitoring:view", "monitoring:alerts", "team:view", "settings:view"]'::jsonb),
  ('viewer', 'Viewer', '["monitoring:view", "monitoring:alerts", "cluster:view", "pod:view", "pod:logs", "team:view"]'::jsonb);

-- Step 4: Verify roles were created
SELECT * FROM public.team_roles;


-- ============================================================
-- SECTION 3: Run this THIRD (in separate query)
-- Re-add yourself as owner to your team(s)
-- ============================================================

-- Get your user ID and team IDs
SELECT
  p.id as profile_id,
  t.id as team_id,
  t.name as team_name,
  r.id as owner_role_id
FROM public.profiles p
CROSS JOIN public.teams t
CROSS JOIN public.team_roles r
WHERE r.role = 'owner'
LIMIT 10;

-- After running the above, use the IDs to insert your membership:
-- INSERT INTO public.team_memberships (profile_id, team_id, role_id)
-- VALUES ('YOUR_PROFILE_ID', 'YOUR_TEAM_ID', 'OWNER_ROLE_ID');
