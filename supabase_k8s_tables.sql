-- Kubernetes Monitoring Tables for Kubervise
-- Run this in Supabase SQL Editor

-- Enum for cluster connection status
CREATE TYPE cluster_connection_status AS ENUM ('connected', 'disconnected', 'error');

-- Enum for pod status phases
CREATE TYPE pod_phase AS ENUM ('Pending', 'Running', 'Succeeded', 'Failed', 'Unknown');

-- Enum for node status
CREATE TYPE node_status AS ENUM ('Ready', 'NotReady', 'Unknown');

-- Clusters table - stores registered Kubernetes clusters
CREATE TABLE public.clusters (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  api_endpoint text,
  connection_status cluster_connection_status NOT NULL DEFAULT 'disconnected',
  last_seen_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT clusters_pkey PRIMARY KEY (id),
  CONSTRAINT clusters_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE
);

-- Cluster status snapshots - periodic status updates
CREATE TABLE public.cluster_status (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  cluster_id uuid NOT NULL,
  node_count integer NOT NULL DEFAULT 0,
  pod_count integer NOT NULL DEFAULT 0,
  namespace_count integer NOT NULL DEFAULT 0,
  cpu_capacity text,
  memory_capacity text,
  cpu_allocatable text,
  memory_allocatable text,
  recorded_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT cluster_status_pkey PRIMARY KEY (id),
  CONSTRAINT cluster_status_cluster_id_fkey FOREIGN KEY (cluster_id) REFERENCES public.clusters(id) ON DELETE CASCADE
);

-- Nodes table - stores node information
CREATE TABLE public.nodes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  cluster_id uuid NOT NULL,
  name text NOT NULL,
  status node_status NOT NULL DEFAULT 'Unknown',
  capacity_cpu text,
  capacity_memory text,
  allocatable_cpu text,
  allocatable_memory text,
  kubernetes_version text,
  os_image text,
  container_runtime text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT nodes_pkey PRIMARY KEY (id),
  CONSTRAINT nodes_cluster_id_fkey FOREIGN KEY (cluster_id) REFERENCES public.clusters(id) ON DELETE CASCADE,
  CONSTRAINT nodes_cluster_name_unique UNIQUE (cluster_id, name)
);

-- Namespaces table
CREATE TABLE public.namespaces (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  cluster_id uuid NOT NULL,
  name text NOT NULL,
  status text DEFAULT 'Active',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT namespaces_pkey PRIMARY KEY (id),
  CONSTRAINT namespaces_cluster_id_fkey FOREIGN KEY (cluster_id) REFERENCES public.clusters(id) ON DELETE CASCADE,
  CONSTRAINT namespaces_cluster_name_unique UNIQUE (cluster_id, name)
);

-- Pods table - stores pod information
CREATE TABLE public.pods (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  cluster_id uuid NOT NULL,
  namespace_id uuid NOT NULL,
  name text NOT NULL,
  status pod_phase NOT NULL DEFAULT 'Unknown',
  node_name text,
  pod_ip text,
  restart_count integer DEFAULT 0,
  cpu_request text,
  memory_request text,
  cpu_limit text,
  memory_limit text,
  k8s_created_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT pods_pkey PRIMARY KEY (id),
  CONSTRAINT pods_cluster_id_fkey FOREIGN KEY (cluster_id) REFERENCES public.clusters(id) ON DELETE CASCADE,
  CONSTRAINT pods_namespace_id_fkey FOREIGN KEY (namespace_id) REFERENCES public.namespaces(id) ON DELETE CASCADE,
  CONSTRAINT pods_cluster_namespace_name_unique UNIQUE (cluster_id, namespace_id, name)
);

-- Events table - stores Kubernetes events
CREATE TABLE public.cluster_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  cluster_id uuid NOT NULL,
  event_type text NOT NULL, -- 'Normal', 'Warning'
  reason text,
  message text,
  involved_kind text, -- 'Pod', 'Node', 'Deployment', etc.
  involved_name text,
  involved_namespace text,
  source_component text,
  first_seen_at timestamp with time zone,
  last_seen_at timestamp with time zone,
  count integer DEFAULT 1,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT cluster_events_pkey PRIMARY KEY (id),
  CONSTRAINT cluster_events_cluster_id_fkey FOREIGN KEY (cluster_id) REFERENCES public.clusters(id) ON DELETE CASCADE
);

-- Create indexes for better query performance
CREATE INDEX idx_cluster_status_cluster_id ON public.cluster_status(cluster_id);
CREATE INDEX idx_cluster_status_recorded_at ON public.cluster_status(recorded_at DESC);
CREATE INDEX idx_nodes_cluster_id ON public.nodes(cluster_id);
CREATE INDEX idx_namespaces_cluster_id ON public.namespaces(cluster_id);
CREATE INDEX idx_pods_cluster_id ON public.pods(cluster_id);
CREATE INDEX idx_pods_namespace_id ON public.pods(namespace_id);
CREATE INDEX idx_pods_status ON public.pods(status);
CREATE INDEX idx_cluster_events_cluster_id ON public.cluster_events(cluster_id);
CREATE INDEX idx_cluster_events_created_at ON public.cluster_events(created_at DESC);
CREATE INDEX idx_clusters_team_id ON public.clusters(team_id);

-- Enable Row Level Security
ALTER TABLE public.clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cluster_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.namespaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cluster_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only see clusters from their teams
CREATE POLICY "Users can view their team clusters" ON public.clusters
  FOR SELECT USING (
    team_id IN (
      SELECT team_id FROM public.team_memberships
      WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert clusters for their teams" ON public.clusters
  FOR INSERT WITH CHECK (
    team_id IN (
      SELECT team_id FROM public.team_memberships
      WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their team clusters" ON public.clusters
  FOR UPDATE USING (
    team_id IN (
      SELECT team_id FROM public.team_memberships
      WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their team clusters" ON public.clusters
  FOR DELETE USING (
    team_id IN (
      SELECT team_id FROM public.team_memberships
      WHERE profile_id = auth.uid()
    )
  );

-- Cluster status policies (via cluster -> team)
CREATE POLICY "Users can view cluster status" ON public.cluster_status
  FOR SELECT USING (
    cluster_id IN (
      SELECT c.id FROM public.clusters c
      JOIN public.team_memberships tm ON c.team_id = tm.team_id
      WHERE tm.profile_id = auth.uid()
    )
  );

-- Nodes policies
CREATE POLICY "Users can view nodes" ON public.nodes
  FOR SELECT USING (
    cluster_id IN (
      SELECT c.id FROM public.clusters c
      JOIN public.team_memberships tm ON c.team_id = tm.team_id
      WHERE tm.profile_id = auth.uid()
    )
  );

-- Namespaces policies
CREATE POLICY "Users can view namespaces" ON public.namespaces
  FOR SELECT USING (
    cluster_id IN (
      SELECT c.id FROM public.clusters c
      JOIN public.team_memberships tm ON c.team_id = tm.team_id
      WHERE tm.profile_id = auth.uid()
    )
  );

-- Pods policies
CREATE POLICY "Users can view pods" ON public.pods
  FOR SELECT USING (
    cluster_id IN (
      SELECT c.id FROM public.clusters c
      JOIN public.team_memberships tm ON c.team_id = tm.team_id
      WHERE tm.profile_id = auth.uid()
    )
  );

-- Events policies
CREATE POLICY "Users can view events" ON public.cluster_events
  FOR SELECT USING (
    cluster_id IN (
      SELECT c.id FROM public.clusters c
      JOIN public.team_memberships tm ON c.team_id = tm.team_id
      WHERE tm.profile_id = auth.uid()
    )
  );

-- Service role policies for the worker (bypasses RLS, uses service_role key)
-- The worker will use the service_role key to write data

-- Enable Realtime for tables that need live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.clusters;
ALTER PUBLICATION supabase_realtime ADD TABLE public.cluster_status;
ALTER PUBLICATION supabase_realtime ADD TABLE public.nodes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pods;
ALTER PUBLICATION supabase_realtime ADD TABLE public.cluster_events;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_clusters_updated_at BEFORE UPDATE ON public.clusters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_nodes_updated_at BEFORE UPDATE ON public.nodes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_namespaces_updated_at BEFORE UPDATE ON public.namespaces
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pods_updated_at BEFORE UPDATE ON public.pods
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to clean up old status records (keep last 24 hours)
CREATE OR REPLACE FUNCTION cleanup_old_cluster_status()
RETURNS void AS $$
BEGIN
  DELETE FROM public.cluster_status
  WHERE recorded_at < now() - INTERVAL '24 hours';
END;
$$ language 'plpgsql';

-- Function to clean up old events (keep last 7 days)
CREATE OR REPLACE FUNCTION cleanup_old_events()
RETURNS void AS $$
BEGIN
  DELETE FROM public.cluster_events
  WHERE created_at < now() - INTERVAL '7 days';
END;
$$ language 'plpgsql';
