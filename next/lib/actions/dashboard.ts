"use server";

import { createClient } from "@/lib/supabase/server";
import type {
  DashboardStats,
  RecentEvent,
  Cluster,
  ClusterSnapshotData,
} from "@/lib/types/database";

// Snapshot summary for cluster overview
interface ClusterSnapshotSummary {
  nodes: number;
  pods: number;
  namespaces: number;
}

export interface DashboardData {
  stats: DashboardStats;
  recentEvents: RecentEvent[];
  clusters: (Cluster & { snapshot_summary: ClusterSnapshotSummary | null })[];
}

export async function getDashboardData(teamId: string): Promise<DashboardData> {
  const supabase = await createClient();

  // Parallel fetch clusters and snapshots
  const [clustersResult, snapshotsResult] = await Promise.all([
    // Get clusters
    supabase
      .from("clusters")
      .select("*")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false }),

    // Get snapshots with cluster info
    supabase
      .from("cluster_snapshots")
      .select("cluster_id, snapshot, clusters!inner(name, team_id)")
      .eq("clusters.team_id", teamId),
  ]);

  // Build snapshot map
  const snapshotMap = new Map<string, ClusterSnapshotData>();
  const clusterNames = new Map<string, string>();

  (snapshotsResult.data || []).forEach((row) => {
    snapshotMap.set(row.cluster_id, row.snapshot as ClusterSnapshotData);
    clusterNames.set(row.cluster_id, (row.clusters as any)?.name || "Unknown");
  });

  // Process clusters with snapshot summaries
  const clusters = (clustersResult.data || []).map((cluster) => {
    const snapshot = snapshotMap.get(cluster.id);
    const summary: ClusterSnapshotSummary | null = snapshot
      ? {
          nodes: snapshot.summary?.nodes || snapshot.nodes?.length || 0,
          pods: snapshot.summary?.pods?.total || snapshot.pods?.length || 0,
          namespaces: snapshot.summary?.namespaces || snapshot.namespaces?.length || 0,
        }
      : null;

    return {
      ...cluster,
      snapshot_summary: summary,
    } as Cluster & { snapshot_summary: ClusterSnapshotSummary | null };
  });

  // Calculate cluster stats
  const clusterStats = {
    total: clusters.length,
    connected: clusters.filter((c) => c.connection_status === "connected").length,
    disconnected: clusters.filter((c) => c.connection_status === "disconnected").length,
    error: clusters.filter((c) => c.connection_status === "error").length,
  };

  // Aggregate stats from all snapshots
  let podStats = { total: 0, running: 0, pending: 0, failed: 0, succeeded: 0 };
  let nodeStats = { total: 0, ready: 0, notReady: 0 };
  let alertStats = { total: 0, critical: 0, warning: 0 };
  const allEvents: Array<{ event: ClusterSnapshotData["events"][0]; cluster_id: string; cluster_name: string }> = [];

  snapshotMap.forEach((snapshot, clusterId) => {
    const clusterName = clusterNames.get(clusterId) || "Unknown";

    // Pod stats
    if (snapshot.summary?.pods) {
      podStats.total += snapshot.summary.pods.total;
      podStats.running += snapshot.summary.pods.running;
      podStats.pending += snapshot.summary.pods.pending;
      podStats.failed += snapshot.summary.pods.failed;
    } else if (snapshot.pods) {
      podStats.total += snapshot.pods.length;
      podStats.running += snapshot.pods.filter((p) => p.phase === "Running").length;
      podStats.pending += snapshot.pods.filter((p) => p.phase === "Pending").length;
      podStats.failed += snapshot.pods.filter((p) => p.phase === "Failed").length;
      podStats.succeeded += snapshot.pods.filter((p) => p.phase === "Succeeded").length;
    }

    // Node stats
    if (snapshot.nodes) {
      nodeStats.total += snapshot.nodes.length;
      nodeStats.ready += snapshot.nodes.filter((n) => n.status === "Ready").length;
      nodeStats.notReady += snapshot.nodes.filter((n) => n.status !== "Ready").length;
    }

    // Events - collect for sorting
    if (snapshot.events) {
      snapshot.events.forEach((event) => {
        allEvents.push({ event, cluster_id: clusterId, cluster_name: clusterName });

        if (event.type === "Warning") {
          alertStats.total++;
          if (["Failed", "FailedScheduling", "Unhealthy", "BackOff", "OOMKilled"].includes(event.reason)) {
            alertStats.critical++;
          } else {
            alertStats.warning++;
          }
        }
      });
    }
  });

  // Sort events by timestamp and take most recent 5
  allEvents.sort((a, b) =>
    new Date(b.event.lastTimestamp).getTime() - new Date(a.event.lastTimestamp).getTime()
  );

  const recentEvents: RecentEvent[] = allEvents.slice(0, 5).map((item, index) => ({
    id: `${item.cluster_id}-${item.event.involvedObject.kind}-${item.event.involvedObject.name}-${index}`,
    cluster_id: item.cluster_id,
    cluster_name: item.cluster_name,
    event_type: item.event.type,
    reason: item.event.reason,
    message: item.event.message,
    involved_kind: item.event.involvedObject.kind,
    involved_name: item.event.involvedObject.name,
    involved_namespace: item.event.involvedObject.namespace || null,
    created_at: item.event.lastTimestamp,
  }));

  return {
    stats: {
      clusters: clusterStats,
      pods: podStats,
      nodes: nodeStats,
      alerts: alertStats,
    },
    recentEvents,
    clusters,
  };
}

export async function getClusterDetails(clusterId: string) {
  const supabase = await createClient();

  const [clusterResult, snapshotResult] = await Promise.all([
    supabase.from("clusters").select("*").eq("id", clusterId).single(),

    supabase
      .from("cluster_snapshots")
      .select("snapshot, collected_at")
      .eq("cluster_id", clusterId)
      .single(),
  ]);

  const snapshot = snapshotResult.data?.snapshot as ClusterSnapshotData | null;

  return {
    cluster: clusterResult.data,
    snapshot: snapshot,
    collectedAt: snapshotResult.data?.collected_at || null,
  };
}
