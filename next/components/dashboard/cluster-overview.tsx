"use client";

import {
  Monitor,
  Grid3X3,
  FolderOpen,
  AlertTriangle,
  Check,
  Loader2,
  X,
} from "lucide-react";

import { useClusterRealtime } from "@/hooks/use-cluster-realtime";
import { ClusterStatsCard } from "./cluster-stats-card";
import { ClusterStatusBadge } from "./cluster-status-badge";
import { PodStatusBadge } from "./pod-status-badge";
import { EventsList } from "./events-list";
import { formatDistanceToNow } from "@/lib/utils";

interface ClusterOverviewProps {
  clusterId: string;
}

export function ClusterOverview({ clusterId }: ClusterOverviewProps) {
  const { cluster, status, nodes, pods, events, isLoading, error } =
    useClusterRealtime({ clusterId });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-lg font-medium">Error loading cluster data</p>
        <p className="text-sm text-muted-foreground">{error.message}</p>
      </div>
    );
  }

  if (!cluster) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <p className="text-lg font-medium">Cluster not found</p>
        <p className="text-sm text-muted-foreground">
          The requested cluster could not be found.
        </p>
      </div>
    );
  }

  // Calculate pod statistics
  const runningPods = pods.filter((p) => p.status === "Running").length;
  const pendingPods = pods.filter((p) => p.status === "Pending").length;
  const failedPods = pods.filter((p) => p.status === "Failed").length;
  const readyNodes = nodes.filter((n) => n.status === "Ready").length;

  return (
    <div className="space-y-6">
      {/* Cluster Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{cluster.name}</h1>
            <ClusterStatusBadge status={cluster.connection_status} />
          </div>
          {cluster.last_seen_at && (
            <p className="text-sm text-muted-foreground mt-1">
              Last updated {formatDistanceToNow(new Date(cluster.last_seen_at))}
            </p>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <ClusterStatsCard
          title="Nodes"
          value={`${readyNodes}/${nodes.length}`}
          subtitle={`${readyNodes} ready`}
          icon={Monitor}
        />
        <ClusterStatsCard
          title="Pods"
          value={pods.length}
          subtitle={status ? `${status.namespace_count} namespaces` : undefined}
          icon={Grid3X3}
        />
        <ClusterStatsCard
          title="Running"
          value={runningPods}
          subtitle={`${pendingPods} pending, ${failedPods} failed`}
          icon={Check}
        />
        <ClusterStatsCard
          title="Namespaces"
          value={status?.namespace_count || 0}
          icon={FolderOpen}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Pods Overview */}
        <div className="rounded-xl border bg-card p-6">
          <h2 className="text-lg font-semibold mb-4">Pod Status Distribution</h2>
          <div className="space-y-3">
            <PodStatusRow
              label="Running"
              count={runningPods}
              total={pods.length}
              color="bg-green-500"
            />
            <PodStatusRow
              label="Pending"
              count={pendingPods}
              total={pods.length}
              color="bg-yellow-500"
            />
            <PodStatusRow
              label="Failed"
              count={failedPods}
              total={pods.length}
              color="bg-red-500"
            />
            <PodStatusRow
              label="Succeeded"
              count={pods.filter((p) => p.status === "Succeeded").length}
              total={pods.length}
              color="bg-blue-500"
            />
          </div>
        </div>

        {/* Nodes List */}
        <div className="rounded-xl border bg-card p-6">
          <h2 className="text-lg font-semibold mb-4">Nodes</h2>
          <div className="space-y-3">
            {nodes.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No nodes found</p>
            ) : (
              nodes.map((node) => (
                <div
                  key={node.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <Monitor className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{node.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {node.kubernetes_version || "Unknown version"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {node.status === "Ready" ? (
                      <span className="flex items-center gap-1 text-green-600 dark:text-green-400 text-sm">
                        <Check className="h-4 w-4" />
                        Ready
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-red-600 dark:text-red-400 text-sm">
                        <X className="h-4 w-4" />
                        Not Ready
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Recent Events */}
      <div className="rounded-xl border bg-card p-6">
        <h2 className="text-lg font-semibold mb-4">Recent Events</h2>
        <EventsList events={events.slice(0, 10)} />
      </div>

      {/* Pods Table */}
      <div className="rounded-xl border bg-card p-6">
        <h2 className="text-lg font-semibold mb-4">Pods ({pods.length})</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left font-medium py-3 px-2">Name</th>
                <th className="text-left font-medium py-3 px-2">Namespace</th>
                <th className="text-left font-medium py-3 px-2">Status</th>
                <th className="text-left font-medium py-3 px-2">Node</th>
                <th className="text-left font-medium py-3 px-2">Restarts</th>
              </tr>
            </thead>
            <tbody>
              {pods.slice(0, 20).map((pod) => (
                <tr key={pod.id} className="border-b last:border-0">
                  <td className="py-3 px-2 font-medium">{pod.name}</td>
                  <td className="py-3 px-2 text-muted-foreground">
                    {pod.namespace?.name || "—"}
                  </td>
                  <td className="py-3 px-2">
                    <PodStatusBadge status={pod.status} />
                  </td>
                  <td className="py-3 px-2 text-muted-foreground">
                    {pod.node_name || "—"}
                  </td>
                  <td className="py-3 px-2 text-muted-foreground">
                    {pod.restart_count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {pods.length > 20 && (
            <p className="text-center text-sm text-muted-foreground py-4">
              Showing 20 of {pods.length} pods
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function PodStatusRow({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const percentage = total > 0 ? (count / total) * 100 : 0;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span>{label}</span>
        <span className="text-muted-foreground">
          {count} ({percentage.toFixed(0)}%)
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full ${color} transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
