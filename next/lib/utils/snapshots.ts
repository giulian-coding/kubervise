import { createClient } from "@/lib/supabase/client";
import {
  ClusterSnapshot,
  ClusterSnapshotData,
  K8sNode,
  K8sPod,
  K8sDeployment,
  K8sService,
  K8sNamespace,
  K8sEvent,
  K8sStatefulSet,
  K8sDaemonSet,
  K8sJob,
  K8sCronJob,
  K8sIngress,
  DashboardStats,
} from "@/lib/types/database";

// Default empty snapshot for when no data exists
const emptySnapshot: ClusterSnapshotData = {
  clusterVersion: "",
  platform: "",
  summary: {
    nodes: 0,
    namespaces: 0,
    pods: { total: 0, running: 0, pending: 0, failed: 0 },
    deployments: { total: 0, available: 0 },
    services: 0,
    events: { normal: 0, warning: 0 },
  },
  nodes: [],
  namespaces: [],
  pods: [],
  deployments: [],
  statefulsets: [],
  daemonsets: [],
  services: [],
  ingresses: [],
  jobs: [],
  cronjobs: [],
  events: [],
  configmaps: [],
  secrets: [],
  pvcs: [],
};

// Fetch snapshot for a single cluster
export async function getClusterSnapshot(
  clusterId: string
): Promise<ClusterSnapshotData | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("cluster_snapshots")
    .select("snapshot")
    .eq("cluster_id", clusterId)
    .single();

  if (error || !data) {
    return null;
  }

  return data.snapshot as ClusterSnapshotData;
}

// Fetch snapshots for multiple clusters
export async function getClusterSnapshots(
  clusterIds?: string[]
): Promise<Map<string, ClusterSnapshotData>> {
  const supabase = createClient();

  let query = supabase.from("cluster_snapshots").select("cluster_id, snapshot");

  if (clusterIds && clusterIds.length > 0) {
    query = query.in("cluster_id", clusterIds);
  }

  const { data, error } = await query;

  const snapshots = new Map<string, ClusterSnapshotData>();

  if (!error && data) {
    data.forEach((row) => {
      snapshots.set(row.cluster_id, row.snapshot as ClusterSnapshotData);
    });
  }

  return snapshots;
}

// Get all pods across all clusters or for a specific cluster
export async function getAllPods(
  clusterId?: string
): Promise<Array<K8sPod & { cluster_id: string; cluster_name: string }>> {
  const supabase = createClient();

  let query = supabase
    .from("cluster_snapshots")
    .select("cluster_id, snapshot, clusters(name)");

  if (clusterId) {
    query = query.eq("cluster_id", clusterId);
  }

  const { data, error } = await query;

  if (error || !data) {
    return [];
  }

  const pods: Array<K8sPod & { cluster_id: string; cluster_name: string }> = [];

  data.forEach((row) => {
    const snapshot = row.snapshot as ClusterSnapshotData;
    const clusterName = (row.clusters as any)?.name || "Unknown";

    snapshot.pods?.forEach((pod) => {
      pods.push({
        ...pod,
        cluster_id: row.cluster_id,
        cluster_name: clusterName,
      });
    });
  });

  return pods;
}

// Get all nodes across all clusters or for a specific cluster
export async function getAllNodes(
  clusterId?: string
): Promise<Array<K8sNode & { cluster_id: string; cluster_name: string }>> {
  const supabase = createClient();

  let query = supabase
    .from("cluster_snapshots")
    .select("cluster_id, snapshot, clusters(name)");

  if (clusterId) {
    query = query.eq("cluster_id", clusterId);
  }

  const { data, error } = await query;

  if (error || !data) {
    return [];
  }

  const nodes: Array<K8sNode & { cluster_id: string; cluster_name: string }> = [];

  data.forEach((row) => {
    const snapshot = row.snapshot as ClusterSnapshotData;
    const clusterName = (row.clusters as any)?.name || "Unknown";

    snapshot.nodes?.forEach((node) => {
      nodes.push({
        ...node,
        cluster_id: row.cluster_id,
        cluster_name: clusterName,
      });
    });
  });

  return nodes;
}

// Get all deployments across all clusters or for a specific cluster
export async function getAllDeployments(
  clusterId?: string
): Promise<Array<K8sDeployment & { cluster_id: string; cluster_name: string }>> {
  const supabase = createClient();

  let query = supabase
    .from("cluster_snapshots")
    .select("cluster_id, snapshot, clusters(name)");

  if (clusterId) {
    query = query.eq("cluster_id", clusterId);
  }

  const { data, error } = await query;

  if (error || !data) {
    return [];
  }

  const deployments: Array<K8sDeployment & { cluster_id: string; cluster_name: string }> = [];

  data.forEach((row) => {
    const snapshot = row.snapshot as ClusterSnapshotData;
    const clusterName = (row.clusters as any)?.name || "Unknown";

    snapshot.deployments?.forEach((deployment) => {
      deployments.push({
        ...deployment,
        cluster_id: row.cluster_id,
        cluster_name: clusterName,
      });
    });
  });

  return deployments;
}

// Get all services across all clusters or for a specific cluster
export async function getAllServices(
  clusterId?: string
): Promise<Array<K8sService & { cluster_id: string; cluster_name: string }>> {
  const supabase = createClient();

  let query = supabase
    .from("cluster_snapshots")
    .select("cluster_id, snapshot, clusters(name)");

  if (clusterId) {
    query = query.eq("cluster_id", clusterId);
  }

  const { data, error } = await query;

  if (error || !data) {
    return [];
  }

  const services: Array<K8sService & { cluster_id: string; cluster_name: string }> = [];

  data.forEach((row) => {
    const snapshot = row.snapshot as ClusterSnapshotData;
    const clusterName = (row.clusters as any)?.name || "Unknown";

    snapshot.services?.forEach((service) => {
      services.push({
        ...service,
        cluster_id: row.cluster_id,
        cluster_name: clusterName,
      });
    });
  });

  return services;
}

// Get all namespaces across all clusters or for a specific cluster
export async function getAllNamespaces(
  clusterId?: string
): Promise<Array<K8sNamespace & { cluster_id: string; cluster_name: string }>> {
  const supabase = createClient();

  let query = supabase
    .from("cluster_snapshots")
    .select("cluster_id, snapshot, clusters(name)");

  if (clusterId) {
    query = query.eq("cluster_id", clusterId);
  }

  const { data, error } = await query;

  if (error || !data) {
    return [];
  }

  const namespaces: Array<K8sNamespace & { cluster_id: string; cluster_name: string }> = [];

  data.forEach((row) => {
    const snapshot = row.snapshot as ClusterSnapshotData;
    const clusterName = (row.clusters as any)?.name || "Unknown";

    snapshot.namespaces?.forEach((namespace) => {
      namespaces.push({
        ...namespace,
        cluster_id: row.cluster_id,
        cluster_name: clusterName,
      });
    });
  });

  return namespaces;
}

// Get all events across all clusters or for a specific cluster
export async function getAllEvents(
  clusterId?: string
): Promise<Array<K8sEvent & { cluster_id: string; cluster_name: string }>> {
  const supabase = createClient();

  let query = supabase
    .from("cluster_snapshots")
    .select("cluster_id, snapshot, clusters(name)");

  if (clusterId) {
    query = query.eq("cluster_id", clusterId);
  }

  const { data, error } = await query;

  if (error || !data) {
    return [];
  }

  const events: Array<K8sEvent & { cluster_id: string; cluster_name: string }> = [];

  data.forEach((row) => {
    const snapshot = row.snapshot as ClusterSnapshotData;
    const clusterName = (row.clusters as any)?.name || "Unknown";

    snapshot.events?.forEach((event) => {
      events.push({
        ...event,
        cluster_id: row.cluster_id,
        cluster_name: clusterName,
      });
    });
  });

  // Sort by lastTimestamp descending
  events.sort((a, b) =>
    new Date(b.lastTimestamp).getTime() - new Date(a.lastTimestamp).getTime()
  );

  return events;
}

// Get all statefulsets
export async function getAllStatefulSets(
  clusterId?: string
): Promise<Array<K8sStatefulSet & { cluster_id: string; cluster_name: string }>> {
  const supabase = createClient();

  let query = supabase
    .from("cluster_snapshots")
    .select("cluster_id, snapshot, clusters(name)");

  if (clusterId) {
    query = query.eq("cluster_id", clusterId);
  }

  const { data, error } = await query;

  if (error || !data) {
    return [];
  }

  const statefulsets: Array<K8sStatefulSet & { cluster_id: string; cluster_name: string }> = [];

  data.forEach((row) => {
    const snapshot = row.snapshot as ClusterSnapshotData;
    const clusterName = (row.clusters as any)?.name || "Unknown";

    snapshot.statefulsets?.forEach((ss) => {
      statefulsets.push({
        ...ss,
        cluster_id: row.cluster_id,
        cluster_name: clusterName,
      });
    });
  });

  return statefulsets;
}

// Get all daemonsets
export async function getAllDaemonSets(
  clusterId?: string
): Promise<Array<K8sDaemonSet & { cluster_id: string; cluster_name: string }>> {
  const supabase = createClient();

  let query = supabase
    .from("cluster_snapshots")
    .select("cluster_id, snapshot, clusters(name)");

  if (clusterId) {
    query = query.eq("cluster_id", clusterId);
  }

  const { data, error } = await query;

  if (error || !data) {
    return [];
  }

  const daemonsets: Array<K8sDaemonSet & { cluster_id: string; cluster_name: string }> = [];

  data.forEach((row) => {
    const snapshot = row.snapshot as ClusterSnapshotData;
    const clusterName = (row.clusters as any)?.name || "Unknown";

    snapshot.daemonsets?.forEach((ds) => {
      daemonsets.push({
        ...ds,
        cluster_id: row.cluster_id,
        cluster_name: clusterName,
      });
    });
  });

  return daemonsets;
}

// Get all jobs
export async function getAllJobs(
  clusterId?: string
): Promise<Array<K8sJob & { cluster_id: string; cluster_name: string }>> {
  const supabase = createClient();

  let query = supabase
    .from("cluster_snapshots")
    .select("cluster_id, snapshot, clusters(name)");

  if (clusterId) {
    query = query.eq("cluster_id", clusterId);
  }

  const { data, error } = await query;

  if (error || !data) {
    return [];
  }

  const jobs: Array<K8sJob & { cluster_id: string; cluster_name: string }> = [];

  data.forEach((row) => {
    const snapshot = row.snapshot as ClusterSnapshotData;
    const clusterName = (row.clusters as any)?.name || "Unknown";

    snapshot.jobs?.forEach((job) => {
      jobs.push({
        ...job,
        cluster_id: row.cluster_id,
        cluster_name: clusterName,
      });
    });
  });

  return jobs;
}

// Get all cronjobs
export async function getAllCronJobs(
  clusterId?: string
): Promise<Array<K8sCronJob & { cluster_id: string; cluster_name: string }>> {
  const supabase = createClient();

  let query = supabase
    .from("cluster_snapshots")
    .select("cluster_id, snapshot, clusters(name)");

  if (clusterId) {
    query = query.eq("cluster_id", clusterId);
  }

  const { data, error } = await query;

  if (error || !data) {
    return [];
  }

  const cronjobs: Array<K8sCronJob & { cluster_id: string; cluster_name: string }> = [];

  data.forEach((row) => {
    const snapshot = row.snapshot as ClusterSnapshotData;
    const clusterName = (row.clusters as any)?.name || "Unknown";

    snapshot.cronjobs?.forEach((cj) => {
      cronjobs.push({
        ...cj,
        cluster_id: row.cluster_id,
        cluster_name: clusterName,
      });
    });
  });

  return cronjobs;
}

// Get all ingresses
export async function getAllIngresses(
  clusterId?: string
): Promise<Array<K8sIngress & { cluster_id: string; cluster_name: string }>> {
  const supabase = createClient();

  let query = supabase
    .from("cluster_snapshots")
    .select("cluster_id, snapshot, clusters(name)");

  if (clusterId) {
    query = query.eq("cluster_id", clusterId);
  }

  const { data, error } = await query;

  if (error || !data) {
    return [];
  }

  const ingresses: Array<K8sIngress & { cluster_id: string; cluster_name: string }> = [];

  data.forEach((row) => {
    const snapshot = row.snapshot as ClusterSnapshotData;
    const clusterName = (row.clusters as any)?.name || "Unknown";

    snapshot.ingresses?.forEach((ingress) => {
      ingresses.push({
        ...ingress,
        cluster_id: row.cluster_id,
        cluster_name: clusterName,
      });
    });
  });

  return ingresses;
}

// Get aggregated dashboard stats from all snapshots
export async function getDashboardStats(): Promise<DashboardStats> {
  const supabase = createClient();

  // Get cluster counts
  const { data: clusters } = await supabase
    .from("clusters")
    .select("id, connection_status");

  const clusterStats = {
    total: clusters?.length || 0,
    connected: clusters?.filter((c) => c.connection_status === "connected").length || 0,
    disconnected: clusters?.filter((c) => c.connection_status === "disconnected").length || 0,
    error: clusters?.filter((c) => c.connection_status === "error").length || 0,
  };

  // Get snapshot summaries
  const { data: snapshots } = await supabase
    .from("cluster_snapshots")
    .select("snapshot");

  let podStats = { total: 0, running: 0, pending: 0, failed: 0, succeeded: 0 };
  let nodeStats = { total: 0, ready: 0, notReady: 0 };
  let eventStats = { total: 0, critical: 0, warning: 0 };

  snapshots?.forEach((row) => {
    const snapshot = row.snapshot as ClusterSnapshotData;

    // Pod stats from summary
    if (snapshot.summary?.pods) {
      podStats.total += snapshot.summary.pods.total;
      podStats.running += snapshot.summary.pods.running;
      podStats.pending += snapshot.summary.pods.pending;
      podStats.failed += snapshot.summary.pods.failed;
    }

    // Node stats
    if (snapshot.nodes) {
      nodeStats.total += snapshot.nodes.length;
      nodeStats.ready += snapshot.nodes.filter((n) => n.status === "Ready").length;
      nodeStats.notReady += snapshot.nodes.filter((n) => n.status !== "Ready").length;
    }

    // Event stats
    if (snapshot.events) {
      eventStats.total += snapshot.events.length;
      eventStats.warning += snapshot.events.filter((e) => e.type === "Warning").length;
      // Consider critical = Warning events with certain reasons
      eventStats.critical += snapshot.events.filter(
        (e) => e.type === "Warning" &&
        ["Failed", "FailedScheduling", "Unhealthy", "BackOff"].includes(e.reason)
      ).length;
    }
  });

  return {
    clusters: clusterStats,
    pods: podStats,
    nodes: nodeStats,
    alerts: eventStats,
  };
}

// Subscribe to snapshot changes for real-time updates
export function subscribeToSnapshots(
  clusterId: string | null,
  callback: () => void
) {
  const supabase = createClient();

  let channel = supabase.channel("snapshot-changes");

  if (clusterId) {
    channel = channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "cluster_snapshots",
        filter: `cluster_id=eq.${clusterId}`,
      },
      callback
    );
  } else {
    channel = channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "cluster_snapshots",
      },
      callback
    );
  }

  channel.subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
