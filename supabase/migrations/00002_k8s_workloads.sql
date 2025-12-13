-- ============================================================
-- Kubervise K8s Workloads Migration
-- Migration 00002: Deployments, StatefulSets, DaemonSets, Services, Ingresses, Jobs
-- ============================================================

-- ============================================================
-- PART 1: ENUM TYPES
-- ============================================================

-- Deployment strategy type
CREATE TYPE deployment_strategy AS ENUM ('RollingUpdate', 'Recreate');

-- Service type
CREATE TYPE service_type AS ENUM ('ClusterIP', 'NodePort', 'LoadBalancer', 'ExternalName');

-- Job completion mode
CREATE TYPE job_completion_mode AS ENUM ('NonIndexed', 'Indexed');

-- ============================================================
-- PART 2: WORKLOAD TABLES
-- ============================================================

-- Deployments table
CREATE TABLE public.deployments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  cluster_id uuid NOT NULL REFERENCES public.clusters(id) ON DELETE CASCADE,
  namespace_id uuid NOT NULL REFERENCES public.namespaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  replicas integer DEFAULT 1,
  ready_replicas integer DEFAULT 0,
  available_replicas integer DEFAULT 0,
  updated_replicas integer DEFAULT 0,
  strategy deployment_strategy DEFAULT 'RollingUpdate',
  selector jsonb DEFAULT '{}',
  labels jsonb DEFAULT '{}',
  annotations jsonb DEFAULT '{}',
  conditions jsonb DEFAULT '[]',
  k8s_created_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT deployments_pkey PRIMARY KEY (id),
  CONSTRAINT deployments_cluster_namespace_name_unique UNIQUE (cluster_id, namespace_id, name)
);

-- StatefulSets table
CREATE TABLE public.statefulsets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  cluster_id uuid NOT NULL REFERENCES public.clusters(id) ON DELETE CASCADE,
  namespace_id uuid NOT NULL REFERENCES public.namespaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  replicas integer DEFAULT 1,
  ready_replicas integer DEFAULT 0,
  current_replicas integer DEFAULT 0,
  updated_replicas integer DEFAULT 0,
  service_name text,
  pod_management_policy text DEFAULT 'OrderedReady',
  selector jsonb DEFAULT '{}',
  labels jsonb DEFAULT '{}',
  annotations jsonb DEFAULT '{}',
  volume_claim_templates jsonb DEFAULT '[]',
  conditions jsonb DEFAULT '[]',
  k8s_created_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT statefulsets_pkey PRIMARY KEY (id),
  CONSTRAINT statefulsets_cluster_namespace_name_unique UNIQUE (cluster_id, namespace_id, name)
);

-- DaemonSets table
CREATE TABLE public.daemonsets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  cluster_id uuid NOT NULL REFERENCES public.clusters(id) ON DELETE CASCADE,
  namespace_id uuid NOT NULL REFERENCES public.namespaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  desired_number_scheduled integer DEFAULT 0,
  current_number_scheduled integer DEFAULT 0,
  number_ready integer DEFAULT 0,
  number_available integer DEFAULT 0,
  number_misscheduled integer DEFAULT 0,
  update_strategy text DEFAULT 'RollingUpdate',
  selector jsonb DEFAULT '{}',
  labels jsonb DEFAULT '{}',
  annotations jsonb DEFAULT '{}',
  conditions jsonb DEFAULT '[]',
  k8s_created_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT daemonsets_pkey PRIMARY KEY (id),
  CONSTRAINT daemonsets_cluster_namespace_name_unique UNIQUE (cluster_id, namespace_id, name)
);

-- Services table
CREATE TABLE public.services (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  cluster_id uuid NOT NULL REFERENCES public.clusters(id) ON DELETE CASCADE,
  namespace_id uuid NOT NULL REFERENCES public.namespaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  service_type service_type DEFAULT 'ClusterIP',
  cluster_ip text,
  external_ips text[] DEFAULT '{}',
  load_balancer_ip text,
  ports jsonb DEFAULT '[]',
  selector jsonb DEFAULT '{}',
  labels jsonb DEFAULT '{}',
  annotations jsonb DEFAULT '{}',
  session_affinity text DEFAULT 'None',
  k8s_created_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT services_pkey PRIMARY KEY (id),
  CONSTRAINT services_cluster_namespace_name_unique UNIQUE (cluster_id, namespace_id, name)
);

-- Ingresses table
CREATE TABLE public.ingresses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  cluster_id uuid NOT NULL REFERENCES public.clusters(id) ON DELETE CASCADE,
  namespace_id uuid NOT NULL REFERENCES public.namespaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  ingress_class_name text,
  rules jsonb DEFAULT '[]',
  tls jsonb DEFAULT '[]',
  default_backend jsonb,
  load_balancer_ips text[] DEFAULT '{}',
  labels jsonb DEFAULT '{}',
  annotations jsonb DEFAULT '{}',
  k8s_created_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ingresses_pkey PRIMARY KEY (id),
  CONSTRAINT ingresses_cluster_namespace_name_unique UNIQUE (cluster_id, namespace_id, name)
);

-- Jobs table
CREATE TABLE public.jobs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  cluster_id uuid NOT NULL REFERENCES public.clusters(id) ON DELETE CASCADE,
  namespace_id uuid NOT NULL REFERENCES public.namespaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  completions integer DEFAULT 1,
  parallelism integer DEFAULT 1,
  active integer DEFAULT 0,
  succeeded integer DEFAULT 0,
  failed integer DEFAULT 0,
  completion_mode job_completion_mode DEFAULT 'NonIndexed',
  backoff_limit integer DEFAULT 6,
  ttl_seconds_after_finished integer,
  selector jsonb DEFAULT '{}',
  labels jsonb DEFAULT '{}',
  annotations jsonb DEFAULT '{}',
  conditions jsonb DEFAULT '[]',
  start_time timestamptz,
  completion_time timestamptz,
  k8s_created_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT jobs_pkey PRIMARY KEY (id),
  CONSTRAINT jobs_cluster_namespace_name_unique UNIQUE (cluster_id, namespace_id, name)
);

-- CronJobs table
CREATE TABLE public.cronjobs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  cluster_id uuid NOT NULL REFERENCES public.clusters(id) ON DELETE CASCADE,
  namespace_id uuid NOT NULL REFERENCES public.namespaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  schedule text NOT NULL,
  suspend boolean DEFAULT false,
  concurrency_policy text DEFAULT 'Allow',
  successful_jobs_history_limit integer DEFAULT 3,
  failed_jobs_history_limit integer DEFAULT 1,
  starting_deadline_seconds integer,
  last_schedule_time timestamptz,
  last_successful_time timestamptz,
  active_jobs integer DEFAULT 0,
  labels jsonb DEFAULT '{}',
  annotations jsonb DEFAULT '{}',
  k8s_created_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cronjobs_pkey PRIMARY KEY (id),
  CONSTRAINT cronjobs_cluster_namespace_name_unique UNIQUE (cluster_id, namespace_id, name)
);

-- ConfigMaps table
CREATE TABLE public.configmaps (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  cluster_id uuid NOT NULL REFERENCES public.clusters(id) ON DELETE CASCADE,
  namespace_id uuid NOT NULL REFERENCES public.namespaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  data_keys text[] DEFAULT '{}',
  data_count integer DEFAULT 0,
  labels jsonb DEFAULT '{}',
  annotations jsonb DEFAULT '{}',
  k8s_created_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT configmaps_pkey PRIMARY KEY (id),
  CONSTRAINT configmaps_cluster_namespace_name_unique UNIQUE (cluster_id, namespace_id, name)
);

-- Secrets metadata table (no actual secret data stored)
CREATE TABLE public.secrets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  cluster_id uuid NOT NULL REFERENCES public.clusters(id) ON DELETE CASCADE,
  namespace_id uuid NOT NULL REFERENCES public.namespaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  secret_type text DEFAULT 'Opaque',
  data_keys text[] DEFAULT '{}',
  data_count integer DEFAULT 0,
  labels jsonb DEFAULT '{}',
  annotations jsonb DEFAULT '{}',
  k8s_created_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT secrets_pkey PRIMARY KEY (id),
  CONSTRAINT secrets_cluster_namespace_name_unique UNIQUE (cluster_id, namespace_id, name)
);

-- PersistentVolumeClaims table
CREATE TABLE public.persistent_volume_claims (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  cluster_id uuid NOT NULL REFERENCES public.clusters(id) ON DELETE CASCADE,
  namespace_id uuid NOT NULL REFERENCES public.namespaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  phase text DEFAULT 'Pending',
  access_modes text[] DEFAULT '{}',
  storage_class_name text,
  volume_name text,
  requested_storage text,
  capacity text,
  labels jsonb DEFAULT '{}',
  annotations jsonb DEFAULT '{}',
  k8s_created_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT persistent_volume_claims_pkey PRIMARY KEY (id),
  CONSTRAINT pvcs_cluster_namespace_name_unique UNIQUE (cluster_id, namespace_id, name)
);

-- ============================================================
-- PART 3: CLUSTER ONBOARDING TABLE
-- ============================================================

-- Cluster onboarding tokens for agent connection
CREATE TABLE public.cluster_onboarding_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  cluster_id uuid NOT NULL REFERENCES public.clusters(id) ON DELETE CASCADE,
  token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  used_at timestamptz,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cluster_onboarding_tokens_pkey PRIMARY KEY (id)
);

-- Add agent_token to clusters for persistent authentication
ALTER TABLE public.clusters ADD COLUMN IF NOT EXISTS agent_token text UNIQUE;
ALTER TABLE public.clusters ADD COLUMN IF NOT EXISTS agent_version text;
ALTER TABLE public.clusters ADD COLUMN IF NOT EXISTS agent_started_at timestamptz;

-- ============================================================
-- PART 4: INDEXES
-- ============================================================

-- Deployments indexes
CREATE INDEX idx_deployments_cluster_id ON public.deployments(cluster_id);
CREATE INDEX idx_deployments_namespace_id ON public.deployments(namespace_id);

-- StatefulSets indexes
CREATE INDEX idx_statefulsets_cluster_id ON public.statefulsets(cluster_id);
CREATE INDEX idx_statefulsets_namespace_id ON public.statefulsets(namespace_id);

-- DaemonSets indexes
CREATE INDEX idx_daemonsets_cluster_id ON public.daemonsets(cluster_id);
CREATE INDEX idx_daemonsets_namespace_id ON public.daemonsets(namespace_id);

-- Services indexes
CREATE INDEX idx_services_cluster_id ON public.services(cluster_id);
CREATE INDEX idx_services_namespace_id ON public.services(namespace_id);
CREATE INDEX idx_services_type ON public.services(service_type);

-- Ingresses indexes
CREATE INDEX idx_ingresses_cluster_id ON public.ingresses(cluster_id);
CREATE INDEX idx_ingresses_namespace_id ON public.ingresses(namespace_id);

-- Jobs indexes
CREATE INDEX idx_jobs_cluster_id ON public.jobs(cluster_id);
CREATE INDEX idx_jobs_namespace_id ON public.jobs(namespace_id);

-- CronJobs indexes
CREATE INDEX idx_cronjobs_cluster_id ON public.cronjobs(cluster_id);
CREATE INDEX idx_cronjobs_namespace_id ON public.cronjobs(namespace_id);

-- ConfigMaps indexes
CREATE INDEX idx_configmaps_cluster_id ON public.configmaps(cluster_id);
CREATE INDEX idx_configmaps_namespace_id ON public.configmaps(namespace_id);

-- Secrets indexes
CREATE INDEX idx_secrets_cluster_id ON public.secrets(cluster_id);
CREATE INDEX idx_secrets_namespace_id ON public.secrets(namespace_id);

-- PVCs indexes
CREATE INDEX idx_pvcs_cluster_id ON public.persistent_volume_claims(cluster_id);
CREATE INDEX idx_pvcs_namespace_id ON public.persistent_volume_claims(namespace_id);

-- Onboarding tokens indexes
CREATE INDEX idx_cluster_onboarding_tokens_token ON public.cluster_onboarding_tokens(token);
CREATE INDEX idx_cluster_onboarding_tokens_cluster_id ON public.cluster_onboarding_tokens(cluster_id);

-- ============================================================
-- PART 5: TRIGGERS
-- ============================================================

CREATE TRIGGER update_deployments_updated_at
  BEFORE UPDATE ON public.deployments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_statefulsets_updated_at
  BEFORE UPDATE ON public.statefulsets
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_daemonsets_updated_at
  BEFORE UPDATE ON public.daemonsets
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_services_updated_at
  BEFORE UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_ingresses_updated_at
  BEFORE UPDATE ON public.ingresses
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_jobs_updated_at
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_cronjobs_updated_at
  BEFORE UPDATE ON public.cronjobs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_configmaps_updated_at
  BEFORE UPDATE ON public.configmaps
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_secrets_updated_at
  BEFORE UPDATE ON public.secrets
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_pvcs_updated_at
  BEFORE UPDATE ON public.persistent_volume_claims
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- PART 6: ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.statefulsets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daemonsets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cronjobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configmaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.persistent_volume_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cluster_onboarding_tokens ENABLE ROW LEVEL SECURITY;

-- Deployments policies
CREATE POLICY "Users can view deployments" ON public.deployments
  FOR SELECT USING (
    cluster_id IN (
      SELECT c.id FROM public.clusters c
      JOIN public.team_memberships tm ON c.team_id = tm.team_id
      WHERE tm.profile_id = auth.uid()
    )
  );

-- StatefulSets policies
CREATE POLICY "Users can view statefulsets" ON public.statefulsets
  FOR SELECT USING (
    cluster_id IN (
      SELECT c.id FROM public.clusters c
      JOIN public.team_memberships tm ON c.team_id = tm.team_id
      WHERE tm.profile_id = auth.uid()
    )
  );

-- DaemonSets policies
CREATE POLICY "Users can view daemonsets" ON public.daemonsets
  FOR SELECT USING (
    cluster_id IN (
      SELECT c.id FROM public.clusters c
      JOIN public.team_memberships tm ON c.team_id = tm.team_id
      WHERE tm.profile_id = auth.uid()
    )
  );

-- Services policies
CREATE POLICY "Users can view services" ON public.services
  FOR SELECT USING (
    cluster_id IN (
      SELECT c.id FROM public.clusters c
      JOIN public.team_memberships tm ON c.team_id = tm.team_id
      WHERE tm.profile_id = auth.uid()
    )
  );

-- Ingresses policies
CREATE POLICY "Users can view ingresses" ON public.ingresses
  FOR SELECT USING (
    cluster_id IN (
      SELECT c.id FROM public.clusters c
      JOIN public.team_memberships tm ON c.team_id = tm.team_id
      WHERE tm.profile_id = auth.uid()
    )
  );

-- Jobs policies
CREATE POLICY "Users can view jobs" ON public.jobs
  FOR SELECT USING (
    cluster_id IN (
      SELECT c.id FROM public.clusters c
      JOIN public.team_memberships tm ON c.team_id = tm.team_id
      WHERE tm.profile_id = auth.uid()
    )
  );

-- CronJobs policies
CREATE POLICY "Users can view cronjobs" ON public.cronjobs
  FOR SELECT USING (
    cluster_id IN (
      SELECT c.id FROM public.clusters c
      JOIN public.team_memberships tm ON c.team_id = tm.team_id
      WHERE tm.profile_id = auth.uid()
    )
  );

-- ConfigMaps policies
CREATE POLICY "Users can view configmaps" ON public.configmaps
  FOR SELECT USING (
    cluster_id IN (
      SELECT c.id FROM public.clusters c
      JOIN public.team_memberships tm ON c.team_id = tm.team_id
      WHERE tm.profile_id = auth.uid()
    )
  );

-- Secrets policies (metadata only)
CREATE POLICY "Users can view secrets metadata" ON public.secrets
  FOR SELECT USING (
    cluster_id IN (
      SELECT c.id FROM public.clusters c
      JOIN public.team_memberships tm ON c.team_id = tm.team_id
      WHERE tm.profile_id = auth.uid()
    )
  );

-- PVCs policies
CREATE POLICY "Users can view pvcs" ON public.persistent_volume_claims
  FOR SELECT USING (
    cluster_id IN (
      SELECT c.id FROM public.clusters c
      JOIN public.team_memberships tm ON c.team_id = tm.team_id
      WHERE tm.profile_id = auth.uid()
    )
  );

-- Onboarding tokens policies
CREATE POLICY "Users can view their cluster onboarding tokens" ON public.cluster_onboarding_tokens
  FOR SELECT USING (
    cluster_id IN (
      SELECT c.id FROM public.clusters c
      JOIN public.team_memberships tm ON c.team_id = tm.team_id
      WHERE tm.profile_id = auth.uid()
    )
  );

CREATE POLICY "Users can create onboarding tokens" ON public.cluster_onboarding_tokens
  FOR INSERT WITH CHECK (
    cluster_id IN (
      SELECT c.id FROM public.clusters c
      JOIN public.team_memberships tm ON c.team_id = tm.team_id
      WHERE tm.profile_id = auth.uid()
    )
  );

-- ============================================================
-- PART 7: SERVICE ROLE POLICIES (for agent sync)
-- ============================================================

-- Allow service role to manage all workload data
CREATE POLICY "Service role can manage deployments" ON public.deployments
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage statefulsets" ON public.statefulsets
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage daemonsets" ON public.daemonsets
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage services" ON public.services
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage ingresses" ON public.ingresses
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage jobs" ON public.jobs
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage cronjobs" ON public.cronjobs
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage configmaps" ON public.configmaps
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage secrets" ON public.secrets
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage pvcs" ON public.persistent_volume_claims
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage nodes" ON public.nodes
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage namespaces" ON public.namespaces
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage pods" ON public.pods
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage cluster_events" ON public.cluster_events
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage cluster_status" ON public.cluster_status
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage clusters" ON public.clusters
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- PART 8: HELPER FUNCTIONS
-- ============================================================

-- Create cluster with onboarding token
CREATE OR REPLACE FUNCTION public.create_cluster_with_token(
  p_team_id uuid,
  p_name text,
  p_description text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_user_id uuid;
  v_cluster_id uuid;
  v_token text;
  v_agent_token text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Check user is member of team
  IF NOT EXISTS (
    SELECT 1 FROM public.team_memberships
    WHERE profile_id = v_user_id AND team_id = p_team_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not a team member');
  END IF;

  -- Generate agent token
  v_agent_token := encode(gen_random_bytes(32), 'hex');

  -- Create cluster
  INSERT INTO public.clusters (team_id, name, description, agent_token)
  VALUES (p_team_id, p_name, p_description, v_agent_token)
  RETURNING id INTO v_cluster_id;

  -- Create onboarding token
  INSERT INTO public.cluster_onboarding_tokens (cluster_id, created_by)
  VALUES (v_cluster_id, v_user_id)
  RETURNING token INTO v_token;

  RETURN jsonb_build_object(
    'success', true,
    'cluster_id', v_cluster_id,
    'onboarding_token', v_token,
    'agent_token', v_agent_token
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get cluster installation config
CREATE OR REPLACE FUNCTION public.get_cluster_install_config(p_cluster_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_user_id uuid;
  v_cluster record;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Get cluster with team check
  SELECT c.* INTO v_cluster
  FROM public.clusters c
  JOIN public.team_memberships tm ON c.team_id = tm.team_id
  WHERE c.id = p_cluster_id AND tm.profile_id = v_user_id;

  IF v_cluster IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cluster not found');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'cluster_id', v_cluster.id,
    'cluster_name', v_cluster.name,
    'agent_token', v_cluster.agent_token,
    'connection_status', v_cluster.connection_status
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- PART 9: REALTIME
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.deployments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.statefulsets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.daemonsets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.services;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ingresses;
ALTER PUBLICATION supabase_realtime ADD TABLE public.jobs;
