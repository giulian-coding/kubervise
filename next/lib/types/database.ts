// Database types for Kubervise
// These types match the Supabase schema

export type ClusterConnectionStatus = "connected" | "disconnected" | "error";
export type PodPhase = "Pending" | "Running" | "Succeeded" | "Failed" | "Unknown";
export type NodeStatus = "Ready" | "NotReady" | "Unknown";
export type TeamRoleType = "owner" | "admin" | "contributor" | "viewer";
export type OnboardingStatus = "pending" | "completed" | "skipped";

// ============================================================
// Core Database Tables (stored in Supabase)
// ============================================================

export interface Profile {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  onboarding_status: OnboardingStatus;
  onboarding_completed_at: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface Team {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  avatar_url: string | null;
  owner_id: string | null;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string | null;
}

export interface TeamRole {
  id: string;
  role: TeamRoleType;
  name: string;
  permissions: string[];
  created_at: string;
}

export interface TeamMembership {
  id: string;
  profile_id: string;
  team_id: string;
  role_id: string;
  created_at: string;
}

export interface Cluster {
  id: string;
  team_id: string;
  name: string;
  description: string | null;
  api_endpoint: string | null;
  api_server_url?: string | null;
  connection_status: ClusterConnectionStatus;
  last_seen_at: string | null;
  agent_token?: string | null;
  agent_version?: string | null;
  agent_started_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClusterWithAgent extends Cluster {
  agent_token: string | null;
  agent_version: string | null;
  agent_started_at: string | null;
}

// ============================================================
// Kubernetes Object Types (stored in snapshot JSONB)
// ============================================================

export interface K8sNode {
  name: string;
  status: NodeStatus;
  roles: string[];
  capacity: {
    cpu: string;
    memory: string;
    pods: string;
  };
  allocatable: {
    cpu: string;
    memory: string;
    pods: string;
  };
  conditions: Array<{
    type: string;
    status: string;
    reason?: string;
    message?: string;
    lastTransitionTime?: string;
  }>;
  nodeInfo: {
    kubeletVersion: string;
    containerRuntimeVersion: string;
    osImage: string;
    architecture: string;
  };
  labels: Record<string, string>;
  annotations: Record<string, string>;
  createdAt: string;
}

export interface K8sNamespace {
  name: string;
  status: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  createdAt: string;
}

export interface K8sPod {
  name: string;
  namespace: string;
  phase: PodPhase;
  nodeName: string | null;
  podIP: string | null;
  hostIP: string | null;
  restartCount: number;
  containers: Array<{
    name: string;
    image: string;
    ready: boolean;
    restartCount: number;
    state: string;
  }>;
  conditions: Array<{
    type: string;
    status: string;
    reason?: string;
    message?: string;
  }>;
  resources: {
    requests: { cpu?: string; memory?: string };
    limits: { cpu?: string; memory?: string };
  };
  labels: Record<string, string>;
  annotations: Record<string, string>;
  createdAt: string;
}

export interface K8sDeployment {
  name: string;
  namespace: string;
  replicas: number;
  readyReplicas: number;
  availableReplicas: number;
  updatedReplicas: number;
  strategy: string;
  selector: Record<string, string>;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  conditions: Array<{
    type: string;
    status: string;
    reason?: string;
    message?: string;
  }>;
  createdAt: string;
}

export interface K8sStatefulSet {
  name: string;
  namespace: string;
  replicas: number;
  readyReplicas: number;
  currentReplicas: number;
  serviceName: string;
  selector: Record<string, string>;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  createdAt: string;
}

export interface K8sDaemonSet {
  name: string;
  namespace: string;
  desiredNumberScheduled: number;
  currentNumberScheduled: number;
  numberReady: number;
  numberAvailable: number;
  selector: Record<string, string>;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  createdAt: string;
}

export interface K8sService {
  name: string;
  namespace: string;
  type: "ClusterIP" | "NodePort" | "LoadBalancer" | "ExternalName";
  clusterIP: string | null;
  externalIPs: string[];
  ports: Array<{
    name?: string;
    port: number;
    targetPort: number | string;
    protocol: string;
    nodePort?: number;
  }>;
  selector: Record<string, string>;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  createdAt: string;
}

export interface K8sIngress {
  name: string;
  namespace: string;
  ingressClassName: string | null;
  rules: Array<{
    host?: string;
    paths: Array<{
      path: string;
      pathType: string;
      serviceName: string;
      servicePort: number | string;
    }>;
  }>;
  tls: Array<{
    hosts: string[];
    secretName: string;
  }>;
  loadBalancerIPs: string[];
  labels: Record<string, string>;
  annotations: Record<string, string>;
  createdAt: string;
}

export interface K8sJob {
  name: string;
  namespace: string;
  completions: number;
  parallelism: number;
  active: number;
  succeeded: number;
  failed: number;
  startTime: string | null;
  completionTime: string | null;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  createdAt: string;
}

export interface K8sCronJob {
  name: string;
  namespace: string;
  schedule: string;
  suspend: boolean;
  lastScheduleTime: string | null;
  lastSuccessfulTime: string | null;
  activeJobs: number;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  createdAt: string;
}

export interface K8sEvent {
  type: "Normal" | "Warning";
  reason: string;
  message: string;
  involvedObject: {
    kind: string;
    name: string;
    namespace?: string;
  };
  source: {
    component?: string;
    host?: string;
  };
  count: number;
  firstTimestamp: string;
  lastTimestamp: string;
}

export interface K8sConfigMap {
  name: string;
  namespace: string;
  dataKeys: string[];
  labels: Record<string, string>;
  annotations: Record<string, string>;
  createdAt: string;
}

export interface K8sSecret {
  name: string;
  namespace: string;
  type: string;
  dataKeys: string[];
  labels: Record<string, string>;
  annotations: Record<string, string>;
  createdAt: string;
}

export interface K8sPVC {
  name: string;
  namespace: string;
  phase: string;
  accessModes: string[];
  storageClassName: string | null;
  volumeName: string | null;
  requestedStorage: string | null;
  capacity: string | null;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  createdAt: string;
}

// ============================================================
// Cluster Snapshot (stored as JSONB in Supabase)
// ============================================================

export interface ClusterSnapshotData {
  // Cluster metadata
  clusterVersion: string;
  platform: string;

  // Summary counts
  summary: {
    nodes: number;
    namespaces: number;
    pods: { total: number; running: number; pending: number; failed: number };
    deployments: { total: number; available: number };
    services: number;
    events: { normal: number; warning: number };
  };

  // All K8s objects
  nodes: K8sNode[];
  namespaces: K8sNamespace[];
  pods: K8sPod[];
  deployments: K8sDeployment[];
  statefulsets: K8sStatefulSet[];
  daemonsets: K8sDaemonSet[];
  services: K8sService[];
  ingresses: K8sIngress[];
  jobs: K8sJob[];
  cronjobs: K8sCronJob[];
  events: K8sEvent[];
  configmaps: K8sConfigMap[];
  secrets: K8sSecret[];
  pvcs: K8sPVC[];
}

export interface ClusterSnapshot {
  id: string;
  cluster_id: string;
  snapshot: ClusterSnapshotData;
  collected_at: string;
  created_at: string;
}

// ============================================================
// Dashboard aggregated types
// ============================================================

export interface DashboardStats {
  clusters: {
    total: number;
    connected: number;
    disconnected: number;
    error: number;
  };
  pods: {
    total: number;
    running: number;
    pending: number;
    failed: number;
    succeeded: number;
  };
  nodes: {
    total: number;
    ready: number;
    notReady: number;
  };
  alerts: {
    total: number;
    critical: number;
    warning: number;
  };
}

export interface RecentEvent {
  id: string;
  cluster_id: string;
  cluster_name: string;
  event_type: "Normal" | "Warning";
  reason: string | null;
  message: string | null;
  involved_kind: string | null;
  involved_name: string | null;
  involved_namespace?: string | null;
  created_at: string;
}
