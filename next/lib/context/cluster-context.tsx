"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export interface Cluster {
  id: string;
  name: string;
  connection_status: "connected" | "disconnected" | "error" | "pending";
}

interface ClusterContextType {
  clusters: Cluster[];
  selectedCluster: Cluster | null;
  selectedClusterId: string | null;
  isAllClustersView: boolean;
  setSelectedCluster: (cluster: Cluster | null) => void;
  selectAllClusters: () => void;
  refreshClusters: () => Promise<void>;
  isLoading: boolean;
}

const ClusterContext = createContext<ClusterContextType | undefined>(undefined);

// Pages that should always show all clusters
const ALL_CLUSTERS_PAGES = ["/dashboard", "/dashboard/clusters"];

export function ClusterProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [selectedCluster, setSelectedClusterState] = useState<Cluster | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check if current page should show all clusters
  const isAllClustersPage = ALL_CLUSTERS_PAGES.includes(pathname);
  const clusterIdFromUrl = searchParams.get("cluster");

  // Determine if we're in "all clusters" view
  const isAllClustersView = isAllClustersPage || (!clusterIdFromUrl && !selectedCluster);

  const fetchClusters = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("clusters")
      .select("id, name, connection_status")
      .order("name");

    if (!error && data) {
      setClusters(data as Cluster[]);
      return data as Cluster[];
    }
    return [];
  }, []);

  const refreshClusters = useCallback(async () => {
    await fetchClusters();
  }, [fetchClusters]);

  // Initial load and URL sync
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      const fetchedClusters = await fetchClusters();

      // If there's a cluster ID in URL and we're not on an all-clusters page, select it
      if (clusterIdFromUrl && !isAllClustersPage) {
        const cluster = fetchedClusters.find((c) => c.id === clusterIdFromUrl);
        if (cluster) {
          setSelectedClusterState(cluster);
        }
      } else if (!isAllClustersPage && fetchedClusters.length > 0) {
        // Auto-select first cluster if not on all-clusters page
        setSelectedClusterState(fetchedClusters[0]);
        // Update URL
        const params = new URLSearchParams(searchParams.toString());
        params.set("cluster", fetchedClusters[0].id);
        router.replace(`${pathname}?${params.toString()}`);
      }

      setIsLoading(false);
    };

    init();
  }, [pathname]); // Only re-run when pathname changes

  // Subscribe to cluster changes
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("cluster-context-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "clusters",
        },
        async () => {
          const newClusters = await fetchClusters();

          // Update selected cluster if it was updated
          if (selectedCluster) {
            const updated = newClusters.find((c) => c.id === selectedCluster.id);
            if (updated) {
              setSelectedClusterState(updated);
            } else {
              // Cluster was deleted
              setSelectedClusterState(null);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchClusters, selectedCluster]);

  const setSelectedCluster = useCallback(
    (cluster: Cluster | null) => {
      setSelectedClusterState(cluster);

      if (cluster && !isAllClustersPage) {
        // Update URL with cluster ID
        const params = new URLSearchParams(searchParams.toString());
        params.set("cluster", cluster.id);
        router.push(`${pathname}?${params.toString()}`);
      }
    },
    [pathname, router, searchParams, isAllClustersPage]
  );

  const selectAllClusters = useCallback(() => {
    setSelectedClusterState(null);

    // Remove cluster param from URL
    const params = new URLSearchParams(searchParams.toString());
    params.delete("cluster");
    const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    router.push(newUrl);
  }, [pathname, router, searchParams]);

  return (
    <ClusterContext.Provider
      value={{
        clusters,
        selectedCluster: isAllClustersPage ? null : selectedCluster,
        selectedClusterId: isAllClustersPage ? null : selectedCluster?.id || null,
        isAllClustersView,
        setSelectedCluster,
        selectAllClusters,
        refreshClusters,
        isLoading,
      }}
    >
      {children}
    </ClusterContext.Provider>
  );
}

export function useCluster() {
  const context = useContext(ClusterContext);
  if (context === undefined) {
    throw new Error("useCluster must be used within a ClusterProvider");
  }
  return context;
}
