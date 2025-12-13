// Kubernetes monitoring types

export type ClusterConnectionStatus = "connected" | "disconnected" | "error";
export type PodPhase = "Pending" | "Running" | "Succeeded" | "Failed" | "Unknown";
export type NodeStatus = "Ready" | "NotReady" | "Unknown";

export interface Cluster {
  id: string;
  team_id: string;
  name: string;
  description: string | null;
  api_endpoint: string | null;
  connection_status: ClusterConnectionStatus;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClusterStatus {
  id: string;
  cluster_id: string;
  node_count: number;
  pod_count: number;
  namespace_count: number;
  cpu_capacity: string | null;
  memory_capacity: string | null;
  cpu_allocatable: string | null;
  memory_allocatable: string | null;
  recorded_at: string;
}

export interface Node {
  id: string;
  cluster_id: string;
  name: string;
  status: NodeStatus;
  capacity_cpu: string | null;
  capacity_memory: string | null;
  allocatable_cpu: string | null;
  allocatable_memory: string | null;
  kubernetes_version: string | null;
  os_image: string | null;
  container_runtime: string | null;
  created_at: string;
  updated_at: string;
}

export interface Namespace {
  id: string;
  cluster_id: string;
  name: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Pod {
  id: string;
  cluster_id: string;
  namespace_id: string;
  name: string;
  status: PodPhase;
  node_name: string | null;
  pod_ip: string | null;
  restart_count: number;
  cpu_request: string | null;
  memory_request: string | null;
  cpu_limit: string | null;
  memory_limit: string | null;
  k8s_created_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  namespace?: Namespace;
}

export interface ClusterEvent {
  id: string;
  cluster_id: string;
  event_type: string;
  reason: string | null;
  message: string | null;
  involved_kind: string | null;
  involved_name: string | null;
  involved_namespace: string | null;
  source_component: string | null;
  first_seen_at: string | null;
  last_seen_at: string | null;
  count: number;
  created_at: string;
}

// Dashboard summary types
export interface ClusterSummary {
  cluster: Cluster;
  latestStatus: ClusterStatus | null;
  nodeCount: number;
  podCount: number;
  runningPods: number;
  pendingPods: number;
  failedPods: number;
  recentEvents: ClusterEvent[];
}
