"use client";

import { Layers, Plus } from "lucide-react";

import { useClusters } from "@/hooks/use-cluster-realtime";
import { ClusterStatusBadge } from "./cluster-status-badge";

interface ClusterSelectorProps {
  selectedClusterId: string | null;
  onSelectCluster: (clusterId: string) => void;
}

export function ClusterSelector({
  selectedClusterId,
  onSelectCluster,
}: ClusterSelectorProps) {
  const { clusters, isLoading } = useClusters();

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-24 rounded-xl border bg-card animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (clusters.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center">
        <Layers className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">No clusters configured</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Add a Kubernetes cluster to start monitoring.
        </p>
        <button className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" />
          Add Cluster
        </button>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {clusters.map((cluster) => (
        <button
          key={cluster.id}
          onClick={() => onSelectCluster(cluster.id)}
          className={`relative rounded-xl border bg-card p-4 text-left transition-all hover:border-primary/50 hover:shadow-md ${
            selectedClusterId === cluster.id
              ? "border-primary ring-2 ring-primary/20"
              : ""
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Layers className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">{cluster.name}</h3>
                {cluster.description && (
                  <p className="text-xs text-muted-foreground line-clamp-1">
                    {cluster.description}
                  </p>
                )}
              </div>
            </div>
            <ClusterStatusBadge status={cluster.connection_status} />
          </div>
        </button>
      ))}
    </div>
  );
}
