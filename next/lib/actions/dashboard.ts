"use server";

import { createClient } from "@/lib/supabase/server";
import type {
  DashboardStats,
  RecentEvent,
  Cluster,
  ClusterStatus,
} from "@/lib/types/database";

export interface DashboardData {
  stats: DashboardStats;
  recentEvents: RecentEvent[];
  clusters: (Cluster & { latest_status: ClusterStatus | null })[];
}

export async function getDashboardData(teamId: string): Promise<DashboardData> {
  const supabase = await createClient();

  // Parallel fetch all data for efficiency
  const [clustersResult, podsResult, nodesResult, eventsResult] =
    await Promise.all([
      // Get clusters with latest status
      supabase
        .from("clusters")
        .select(
          `
          *,
          cluster_status (
            id,
            node_count,
            pod_count,
            namespace_count,
            cpu_capacity,
            memory_capacity,
            recorded_at
          )
        `
        )
        .eq("team_id", teamId)
        .order("created_at", { ascending: false }),

      // Get pod counts by status
      supabase
        .from("pods")
        .select("status, cluster_id, clusters!inner(team_id)")
        .eq("clusters.team_id", teamId),

      // Get node counts by status
      supabase
        .from("nodes")
        .select("status, cluster_id, clusters!inner(team_id)")
        .eq("clusters.team_id", teamId),

      // Get recent events
      supabase
        .from("cluster_events")
        .select(
          `
          id,
          event_type,
          reason,
          message,
          involved_kind,
          involved_name,
          created_at,
          clusters!inner (
            name,
            team_id
          )
        `
        )
        .eq("clusters.team_id", teamId)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

  // Process clusters
  const clusters = (clustersResult.data || []).map((cluster) => {
    const statusArray = cluster.cluster_status as ClusterStatus[] | null;
    const latestStatus = statusArray?.length
      ? statusArray.sort(
          (a, b) =>
            new Date(b.recorded_at).getTime() -
            new Date(a.recorded_at).getTime()
        )[0]
      : null;

    return {
      ...cluster,
      cluster_status: undefined,
      latest_status: latestStatus,
    } as Cluster & { latest_status: ClusterStatus | null };
  });

  // Calculate cluster stats
  const clusterStats = {
    total: clusters.length,
    connected: clusters.filter((c) => c.connection_status === "connected")
      .length,
    disconnected: clusters.filter((c) => c.connection_status === "disconnected")
      .length,
    error: clusters.filter((c) => c.connection_status === "error").length,
  };

  // Calculate pod stats
  const pods = podsResult.data || [];
  const podStats = {
    total: pods.length,
    running: pods.filter((p) => p.status === "Running").length,
    pending: pods.filter((p) => p.status === "Pending").length,
    failed: pods.filter((p) => p.status === "Failed").length,
    succeeded: pods.filter((p) => p.status === "Succeeded").length,
  };

  // Calculate node stats
  const nodes = nodesResult.data || [];
  const nodeStats = {
    total: nodes.length,
    ready: nodes.filter((n) => n.status === "Ready").length,
    notReady: nodes.filter((n) => n.status === "NotReady").length,
  };

  // Calculate alerts from warning events
  const events = eventsResult.data || [];
  const warningEvents = events.filter((e) => e.event_type === "Warning");
  const alertStats = {
    total: warningEvents.length,
    critical: warningEvents.filter(
      (e) =>
        e.reason?.includes("Failed") ||
        e.reason?.includes("Error") ||
        e.reason?.includes("OOM")
    ).length,
    warning: warningEvents.filter(
      (e) =>
        !e.reason?.includes("Failed") &&
        !e.reason?.includes("Error") &&
        !e.reason?.includes("OOM")
    ).length,
  };

  // Format recent events
  const recentEvents: RecentEvent[] = events.slice(0, 5).map((event) => ({
    id: event.id,
    cluster_name:
      (event.clusters as unknown as { name: string })?.name || "Unknown",
    event_type: event.event_type,
    reason: event.reason,
    message: event.message,
    involved_kind: event.involved_kind,
    involved_name: event.involved_name,
    created_at: event.created_at,
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

  const [clusterResult, nodesResult, podsResult, statusResult] =
    await Promise.all([
      supabase.from("clusters").select("*").eq("id", clusterId).single(),

      supabase
        .from("nodes")
        .select("*")
        .eq("cluster_id", clusterId)
        .order("name"),

      supabase
        .from("pods")
        .select("*, namespaces(name)")
        .eq("cluster_id", clusterId)
        .order("name"),

      supabase
        .from("cluster_status")
        .select("*")
        .eq("cluster_id", clusterId)
        .order("recorded_at", { ascending: false })
        .limit(24), // Last 24 data points for chart
    ]);

  return {
    cluster: clusterResult.data,
    nodes: nodesResult.data || [],
    pods: podsResult.data || [],
    statusHistory: statusResult.data || [],
  };
}
