"use client";

import { useState } from "react";
import { ClusterSelector } from "@/components/dashboard/cluster-selector";
import { ClusterOverview } from "@/components/dashboard/cluster-overview";

interface DashboardContentProps {
  userEmail?: string | null;
}

export function DashboardContent({ userEmail }: DashboardContentProps) {
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {/* Welcome section */}
      <div className="rounded-xl bg-muted/50 p-6">
        <h2 className="text-xl font-semibold">
          Welcome back{userEmail ? `, ${userEmail.split("@")[0]}` : ""}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Monitor your Kubernetes clusters in real-time
        </p>
      </div>

      {/* Cluster selection or overview */}
      {selectedClusterId ? (
        <div className="space-y-4">
          <button
            onClick={() => setSelectedClusterId(null)}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to clusters
          </button>
          <ClusterOverview clusterId={selectedClusterId} />
        </div>
      ) : (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Your Clusters</h3>
          <ClusterSelector
            selectedClusterId={selectedClusterId}
            onSelectCluster={setSelectedClusterId}
          />
        </div>
      )}
    </div>
  );
}
