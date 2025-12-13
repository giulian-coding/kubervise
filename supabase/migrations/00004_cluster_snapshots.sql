-- ============================================================
-- Cluster Snapshots - Store all K8s objects as JSON snapshots
-- This replaces the individual tables (pods, nodes, namespaces, etc.)
-- ============================================================

-- Create cluster_snapshots table
CREATE TABLE IF NOT EXISTS public.cluster_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_id UUID NOT NULL REFERENCES public.clusters(id) ON DELETE CASCADE,

  -- The complete snapshot of all K8s objects as JSONB
  -- Structure: { nodes: [...], namespaces: [...], pods: [...], deployments: [...], ... }
  snapshot JSONB NOT NULL DEFAULT '{}',

  -- Metadata
  collected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Only keep the latest snapshot per cluster (can be changed if history is needed)
  CONSTRAINT unique_cluster_snapshot UNIQUE (cluster_id)
);

-- Index for fast cluster lookups
CREATE INDEX IF NOT EXISTS idx_cluster_snapshots_cluster_id ON public.cluster_snapshots(cluster_id);

-- Index for JSONB queries (GIN index for efficient JSON querying)
CREATE INDEX IF NOT EXISTS idx_cluster_snapshots_snapshot ON public.cluster_snapshots USING GIN (snapshot);

-- Enable RLS
ALTER TABLE public.cluster_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view snapshots for clusters they have access to
CREATE POLICY "Users can view snapshots for their team clusters"
  ON public.cluster_snapshots
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.clusters c
      JOIN public.team_memberships tm ON tm.team_id = c.team_id
      WHERE c.id = cluster_snapshots.cluster_id
      AND tm.profile_id = auth.uid()
    )
  );

-- RLS Policy: Service role can insert/update snapshots (for the agent)
CREATE POLICY "Service role can manage snapshots"
  ON public.cluster_snapshots
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- Drop old K8s object tables (they are replaced by snapshots)
-- ============================================================

-- Drop tables in correct order (respecting foreign keys)
DROP TABLE IF EXISTS public.cluster_events CASCADE;
DROP TABLE IF EXISTS public.pods CASCADE;
DROP TABLE IF EXISTS public.namespaces CASCADE;
DROP TABLE IF EXISTS public.nodes CASCADE;

-- Drop workload tables from 00002
DROP TABLE IF EXISTS public.deployments CASCADE;
DROP TABLE IF EXISTS public.statefulsets CASCADE;
DROP TABLE IF EXISTS public.daemonsets CASCADE;
DROP TABLE IF EXISTS public.jobs CASCADE;
DROP TABLE IF EXISTS public.cronjobs CASCADE;
DROP TABLE IF EXISTS public.services CASCADE;
DROP TABLE IF EXISTS public.ingresses CASCADE;

-- ============================================================
-- Helper function to get latest snapshot for a cluster
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_cluster_snapshot(p_cluster_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT snapshot
  FROM public.cluster_snapshots
  WHERE cluster_id = p_cluster_id
  LIMIT 1;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_cluster_snapshot(UUID) TO authenticated;
