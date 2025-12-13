-- ============================================================
-- Kubervise Pending Cluster Onboarding Migration
-- Migration 00003: Store pending cluster info until agent connects
-- ============================================================

-- Pending cluster onboarding table
-- Stores cluster info temporarily until the agent successfully connects
CREATE TABLE public.pending_cluster_onboarding (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  install_token text NOT NULL UNIQUE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pending_cluster_onboarding_pkey PRIMARY KEY (id)
);

-- Index for fast token lookup
CREATE INDEX pending_cluster_onboarding_token_idx ON public.pending_cluster_onboarding(install_token);

-- Index for cleanup of expired entries
CREATE INDEX pending_cluster_onboarding_expires_idx ON public.pending_cluster_onboarding(expires_at);

-- ============================================================
-- RLS POLICIES
-- ============================================================

ALTER TABLE public.pending_cluster_onboarding ENABLE ROW LEVEL SECURITY;

-- Users can view their own pending onboardings
CREATE POLICY "Users can view own pending onboardings"
  ON public.pending_cluster_onboarding
  FOR SELECT
  USING (created_by = auth.uid());

-- Users can create pending onboardings for teams they belong to
CREATE POLICY "Users can create pending onboardings"
  ON public.pending_cluster_onboarding
  FOR INSERT
  WITH CHECK (
    created_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.team_memberships
      WHERE team_id = pending_cluster_onboarding.team_id
      AND profile_id = auth.uid()
    )
  );

-- Users can delete their own pending onboardings
CREATE POLICY "Users can delete own pending onboardings"
  ON public.pending_cluster_onboarding
  FOR DELETE
  USING (created_by = auth.uid());

-- Service role has full access (for API endpoints)
CREATE POLICY "Service role has full access to pending onboardings"
  ON public.pending_cluster_onboarding
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- CLEANUP FUNCTION
-- ============================================================

-- Function to clean up expired pending onboardings
CREATE OR REPLACE FUNCTION cleanup_expired_pending_onboardings()
RETURNS void AS $$
BEGIN
  DELETE FROM public.pending_cluster_onboarding
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
