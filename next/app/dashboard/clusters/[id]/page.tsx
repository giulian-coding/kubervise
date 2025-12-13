"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Server,
  RefreshCw,
  Pencil,
  Trash2,
  HardDrive,
  Box,
  Activity,
  AlertTriangle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/dashboard/page-header";
import { ProtectedPage } from "@/components/dashboard/protected-page";
import { PERMISSIONS, PermissionButton } from "@/lib/rbac";
import { getClusterSnapshot, subscribeToSnapshots } from "@/lib/utils/snapshots";
import { toast } from "sonner";
import type { Cluster, ClusterSnapshotData, K8sNode, K8sPod, K8sEvent } from "@/lib/types/database";

export default function ClusterDetailPage() {
  const params = useParams();
  const router = useRouter();
  const clusterId = params.id as string;

  const [cluster, setCluster] = useState<Cluster | null>(null);
  const [snapshot, setSnapshot] = useState<ClusterSnapshotData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchData = async () => {
    const supabase = createClient();

    // Fetch cluster info
    const { data: clusterData } = await supabase
      .from("clusters")
      .select("*")
      .eq("id", clusterId)
      .single();

    if (clusterData) setCluster(clusterData);

    // Fetch snapshot
    const snapshotData = await getClusterSnapshot(clusterId);
    setSnapshot(snapshotData);

    setIsLoading(false);
    setIsRefreshing(false);
  };

  useEffect(() => {
    fetchData();

    // Subscribe to cluster changes
    const supabase = createClient();
    const clusterChannel = supabase
      .channel(`cluster-${clusterId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "clusters", filter: `id=eq.${clusterId}` },
        () => fetchData()
      )
      .subscribe();

    // Subscribe to snapshot changes
    const unsubscribeSnapshots = subscribeToSnapshots(clusterId, fetchData);

    return () => {
      supabase.removeChannel(clusterChannel);
      unsubscribeSnapshots();
    };
  }, [clusterId]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchData();
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this cluster? This action cannot be undone.")) return;

    const supabase = createClient();
    const { error } = await supabase.from("clusters").delete().eq("id", clusterId);

    if (error) {
      toast.error("Failed to delete cluster");
    } else {
      toast.success("Cluster deleted");
      router.push("/dashboard/clusters");
    }
  };

  if (isLoading) {
    return (
      <ProtectedPage permission={PERMISSIONS.CLUSTER_VIEW}>
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-4 bg-muted rounded w-1/2" />
          <div className="grid gap-4 md:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-muted rounded" />
            ))}
          </div>
        </div>
      </ProtectedPage>
    );
  }

  if (!cluster) {
    return (
      <ProtectedPage permission={PERMISSIONS.CLUSTER_VIEW}>
        <div className="flex flex-col items-center justify-center min-h-[400px]">
          <Server className="size-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Cluster not found</h2>
          <Link href="/dashboard/clusters">
            <Button>Back to Clusters</Button>
          </Link>
        </div>
      </ProtectedPage>
    );
  }

  // Extract data from snapshot
  const nodes: K8sNode[] = snapshot?.nodes || [];
  const pods: K8sPod[] = snapshot?.pods || [];
  const events: K8sEvent[] = snapshot?.events || [];

  const runningPods = pods.filter((p) => p.phase === "Running").length;
  const pendingPods = pods.filter((p) => p.phase === "Pending").length;
  const failedPods = pods.filter((p) => p.phase === "Failed").length;
  const readyNodes = nodes.filter((n) => n.status === "Ready").length;
  const warningEvents = events.filter((e) => e.type === "Warning").length;

  return (
    <ProtectedPage permission={PERMISSIONS.CLUSTER_VIEW}>
      <PageHeader
        title={cluster.name}
        description={cluster.api_endpoint || cluster.description || "Kubernetes Cluster"}
        icon={Server}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={`size-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <PermissionButton
              permission={PERMISSIONS.CLUSTER_EDIT}
              toastMessage="Only owners and admins can edit clusters"
            >
              <Link href={`/dashboard/clusters/${clusterId}/edit`}>
                <Button variant="outline" size="sm">
                  <Pencil className="size-4 mr-2" />
                  Edit
                </Button>
              </Link>
            </PermissionButton>
            <PermissionButton
              permission={PERMISSIONS.CLUSTER_DELETE}
              toastMessage="Only owners can delete clusters"
            >
              <Button variant="destructive" size="sm" onClick={handleDelete}>
                <Trash2 className="size-4 mr-2" />
                Delete
              </Button>
            </PermissionButton>
          </div>
        }
      />

      {/* Status Badge */}
      <div className="flex items-center gap-2 mb-6">
        <div
          className={`size-3 rounded-full ${
            cluster.connection_status === "connected"
              ? "bg-green-500"
              : cluster.connection_status === "error"
              ? "bg-red-500"
              : "bg-yellow-500"
          }`}
        />
        <span className="text-sm capitalize">{cluster.connection_status}</span>
        {snapshot && (
          <span className="text-xs text-muted-foreground ml-2">
            v{snapshot.clusterVersion || "unknown"}
          </span>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <StatCard
          title="Nodes"
          value={nodes.length.toString()}
          description={`${readyNodes} ready`}
          icon={HardDrive}
        />
        <StatCard
          title="Pods"
          value={pods.length.toString()}
          description={`${runningPods} running, ${pendingPods} pending`}
          icon={Box}
          variant={failedPods > 0 ? "warning" : "default"}
        />
        <StatCard
          title="Events"
          value={events.length.toString()}
          description="Recent events"
          icon={Activity}
        />
        <StatCard
          title="Warnings"
          value={warningEvents.toString()}
          description="Warning events"
          icon={AlertTriangle}
          variant={warningEvents > 0 ? "warning" : "default"}
        />
      </div>

      {/* Nodes and Events */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border bg-card p-6">
          <h2 className="text-lg font-semibold mb-4">Nodes</h2>
          {nodes.length > 0 ? (
            <div className="space-y-3">
              {nodes.map((node, index) => (
                <div
                  key={`${node.name}-${index}`}
                  className="flex items-center justify-between p-3 rounded-md bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`size-2 rounded-full ${
                        node.status === "Ready" ? "bg-green-500" : "bg-yellow-500"
                      }`}
                    />
                    <span className="font-medium">{node.name}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">{node.status}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">No nodes found</p>
          )}
        </div>

        <div className="rounded-lg border bg-card p-6">
          <h2 className="text-lg font-semibold mb-4">Recent Events</h2>
          {events.length > 0 ? (
            <div className="space-y-3">
              {events.slice(0, 5).map((event, index) => (
                <div
                  key={`${event.involvedObject.kind}-${event.involvedObject.name}-${index}`}
                  className={`p-3 rounded-md ${
                    event.type === "Warning" ? "bg-yellow-500/10" : "bg-muted/50"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">
                      {event.involvedObject.kind}/{event.involvedObject.name}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {event.reason}: {event.message}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">No recent events</p>
          )}
        </div>
      </div>
    </ProtectedPage>
  );
}

interface StatCardProps {
  title: string;
  value: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  variant?: "default" | "warning" | "error";
}

function StatCard({ title, value, description, icon: Icon, variant = "default" }: StatCardProps) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">{title}</span>
        <Icon
          className={`size-4 ${
            variant === "error"
              ? "text-red-500"
              : variant === "warning"
              ? "text-yellow-500"
              : "text-muted-foreground"
          }`}
        />
      </div>
      <div className="mt-2">
        <span className="text-2xl font-bold">{value}</span>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </div>
    </div>
  );
}
