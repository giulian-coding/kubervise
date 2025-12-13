 -- Step 1: Add 'contributor' to the enum type
  ALTER TYPE team_role_types ADD VALUE IF NOT EXISTS 'contributor';

  -- Step 2: Insert/Update roles with JSONB
  INSERT INTO public.team_roles (role, name, permissions)
  VALUES
    ('owner', 'Owner', '["*"]'::jsonb),
    ('admin', 'Admin', '[
      "cluster:view", "cluster:create", "cluster:edit", "cluster:delete",
      "workload:view", "workload:create", "workload:edit", "workload:delete", "workload:scale", "workload:restart",
      "pod:view", "pod:logs", "pod:exec", "pod:delete",
      "monitoring:view", "monitoring:alerts",
      "team:view", "team:invite",
      "settings:view", "settings:edit"
    ]'::jsonb),
    ('contributor', 'Contributor', '[
      "cluster:view", "cluster:edit",
      "workload:view", "workload:edit",
      "pod:view", "pod:logs",
      "monitoring:view", "monitoring:alerts",
      "team:view",
      "settings:view"
    ]'::jsonb),
    ('viewer', 'Viewer', '[
      "monitoring:view", "monitoring:alerts",
      "cluster:view",
      "pod:view", "pod:logs",
      "team:view"
    ]'::jsonb)
  ON CONFLICT (role) DO UPDATE SET
    name = EXCLUDED.name,
    permissions = EXCLUDED.permissions;

  -- Verify
  SELECT * FROM public.team_roles;