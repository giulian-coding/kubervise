"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  Cluster,
  ClusterStatus,
  Node,
  Pod,
  ClusterEvent,
  Namespace,
} from "@/lib/types/kubernetes";

interface UseClusterRealtimeOptions {
  clusterId: string;
}

interface ClusterRealtimeData {
  cluster: Cluster | null;
  status: ClusterStatus | null;
  nodes: Node[];
  pods: Pod[];
  namespaces: Namespace[];
  events: ClusterEvent[];
  isLoading: boolean;
  error: Error | null;
}

export function useClusterRealtime({ clusterId }: UseClusterRealtimeOptions): ClusterRealtimeData {
  const [cluster, setCluster] = useState<Cluster | null>(null);
  const [status, setStatus] = useState<ClusterStatus | null>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [pods, setPods] = useState<Pod[]>([]);
  const [namespaces, setNamespaces] = useState<Namespace[]>([]);
  const [events, setEvents] = useState<ClusterEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const supabase = createClient();

  // Initial data fetch
  const fetchInitialData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch cluster
      const { data: clusterData, error: clusterError } = await supabase
        .from("clusters")
        .select("*")
        .eq("id", clusterId)
        .single();

      if (clusterError) throw clusterError;
      setCluster(clusterData);

      // Fetch latest status
      const { data: statusData, error: statusError } = await supabase
        .from("cluster_status")
        .select("*")
        .eq("cluster_id", clusterId)
        .order("recorded_at", { ascending: false })
        .limit(1)
        .single();

      if (!statusError) setStatus(statusData);

      // Fetch nodes
      const { data: nodesData, error: nodesError } = await supabase
        .from("nodes")
        .select("*")
        .eq("cluster_id", clusterId)
        .order("name");

      if (nodesError) throw nodesError;
      setNodes(nodesData || []);

      // Fetch namespaces
      const { data: namespacesData, error: namespacesError } = await supabase
        .from("namespaces")
        .select("*")
        .eq("cluster_id", clusterId)
        .order("name");

      if (namespacesError) throw namespacesError;
      setNamespaces(namespacesData || []);

      // Fetch pods with namespace info
      const { data: podsData, error: podsError } = await supabase
        .from("pods")
        .select("*, namespace:namespaces(*)")
        .eq("cluster_id", clusterId)
        .order("name");

      if (podsError) throw podsError;
      setPods(podsData || []);

      // Fetch recent events
      const { data: eventsData, error: eventsError } = await supabase
        .from("cluster_events")
        .select("*")
        .eq("cluster_id", clusterId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (eventsError) throw eventsError;
      setEvents(eventsData || []);

    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch cluster data"));
    } finally {
      setIsLoading(false);
    }
  }, [clusterId, supabase]);

  useEffect(() => {
    fetchInitialData();

    // Set up realtime subscriptions
    const channel = supabase
      .channel(`cluster-${clusterId}`)
      // Cluster updates
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "clusters",
          filter: `id=eq.${clusterId}`,
        },
        (payload) => {
          if (payload.eventType === "UPDATE" || payload.eventType === "INSERT") {
            setCluster(payload.new as Cluster);
          }
        }
      )
      // Status updates
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "cluster_status",
          filter: `cluster_id=eq.${clusterId}`,
        },
        (payload) => {
          setStatus(payload.new as ClusterStatus);
        }
      )
      // Node updates
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "nodes",
          filter: `cluster_id=eq.${clusterId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setNodes((prev) => [...prev, payload.new as Node]);
          } else if (payload.eventType === "UPDATE") {
            setNodes((prev) =>
              prev.map((n) => (n.id === payload.new.id ? (payload.new as Node) : n))
            );
          } else if (payload.eventType === "DELETE") {
            setNodes((prev) => prev.filter((n) => n.id !== payload.old.id));
          }
        }
      )
      // Pod updates
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "pods",
          filter: `cluster_id=eq.${clusterId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setPods((prev) => [...prev, payload.new as Pod]);
          } else if (payload.eventType === "UPDATE") {
            setPods((prev) =>
              prev.map((p) => (p.id === payload.new.id ? (payload.new as Pod) : p))
            );
          } else if (payload.eventType === "DELETE") {
            setPods((prev) => prev.filter((p) => p.id !== payload.old.id));
          }
        }
      )
      // Event updates (new events)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "cluster_events",
          filter: `cluster_id=eq.${clusterId}`,
        },
        (payload) => {
          setEvents((prev) => [payload.new as ClusterEvent, ...prev.slice(0, 49)]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clusterId, fetchInitialData, supabase]);

  return {
    cluster,
    status,
    nodes,
    pods,
    namespaces,
    events,
    isLoading,
    error,
  };
}

// Hook for fetching list of clusters for the current user
export function useClusters() {
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const supabase = createClient();

  const fetchClusters = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data, error: fetchError } = await supabase
        .from("clusters")
        .select("*")
        .order("name");

      if (fetchError) throw fetchError;
      setClusters(data || []);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch clusters"));
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchClusters();

    // Subscribe to cluster changes
    const channel = supabase
      .channel("clusters-list")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "clusters",
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setClusters((prev) => [...prev, payload.new as Cluster]);
          } else if (payload.eventType === "UPDATE") {
            setClusters((prev) =>
              prev.map((c) => (c.id === payload.new.id ? (payload.new as Cluster) : c))
            );
          } else if (payload.eventType === "DELETE") {
            setClusters((prev) => prev.filter((c) => c.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchClusters, supabase]);

  return { clusters, isLoading, error, refetch: fetchClusters };
}
