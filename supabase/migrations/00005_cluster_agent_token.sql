-- Migration: Add agent_token to clusters table
-- This enables token-based authentication for the Kubervise agent
-- instead of using the Supabase Service Role Key directly

-- Add agent_token column to clusters table
ALTER TABLE public.clusters
ADD COLUMN IF NOT EXISTS agent_token text;

-- Add created_by column to track who created the cluster
ALTER TABLE public.clusters
ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id);

-- Create index for fast token lookups
CREATE INDEX IF NOT EXISTS idx_clusters_agent_token ON public.clusters(agent_token);

-- Update connection_status enum to include 'pending' status
ALTER TYPE cluster_connection_status ADD VALUE IF NOT EXISTS 'pending';
