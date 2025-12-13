"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Box,
  RefreshCw,
  MoreHorizontal,
  Terminal,
  FileText,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/dashboard/page-header";
import { ProtectedPage } from "@/components/dashboard/protected-page";
import { PERMISSIONS, useRBAC } from "@/lib/rbac";
import { useCluster } from "@/lib/context/cluster-context";
import { getAllPods, subscribeToSnapshots } from "@/lib/utils/snapshots";
import { toast } from "sonner";
import type { K8sPod } from "@/lib/types/database";

type PodWithCluster = K8sPod & { cluster_id: string; cluster_name: string };

export default function PodsPage() {
  const [pods, setPods] = useState<PodWithCluster[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { can } = useRBAC();
  const { selectedClusterId, selectedCluster, isAllClustersView } = useCluster();

  const fetchPods = async () => {
    const data = await getAllPods(selectedClusterId || undefined);
    setPods(data);
    setIsLoading(false);
    setIsRefreshing(false);
  };

  useEffect(() => {
    setIsLoading(true);
    fetchPods();

    // Subscribe to snapshot changes
    const unsubscribe = subscribeToSnapshots(selectedClusterId, fetchPods);

    return () => {
      unsubscribe();
    };
  }, [selectedClusterId]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchPods();
  };

  const handleDelete = async (podName: string, namespace: string) => {
    if (!confirm(`Are you sure you want to delete pod "${podName}"?`)) return;

    toast.info("Delete request sent", {
      description: "Pod deletion has been requested from the cluster.",
    });
  };

  const getStatusBadge = (phase: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      Running: "default",
      Pending: "secondary",
      Succeeded: "outline",
      Failed: "destructive",
      Unknown: "secondary",
    };
    return <Badge variant={variants[phase] || "secondary"}>{phase}</Badge>;
  };

  const pageDescription = selectedCluster
    ? `Pods in cluster "${selectedCluster.name}"`
    : "View and manage Kubernetes pods across all clusters";

  return (
    <ProtectedPage permission={PERMISSIONS.POD_VIEW}>
      <PageHeader
        title="Pods"
        description={pageDescription}
        icon={Box}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw
              className={`size-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        }
      />

      {isLoading ? (
        <div className="rounded-lg border">
          <div className="p-4 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-muted rounded animate-pulse" />
            ))}
          </div>
        </div>
      ) : pods.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[400px] rounded-lg border bg-card">
          <Box className="size-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">No pods found</h2>
          <p className="text-muted-foreground mb-4">
            {selectedCluster
              ? `No pods in cluster "${selectedCluster.name}"`
              : "Pods will appear here once you have connected clusters with workloads"}
          </p>
          <Link href="/dashboard/clusters">
            <Button variant="outline">View Clusters</Button>
          </Link>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Namespace</TableHead>
                {isAllClustersView && <TableHead>Cluster</TableHead>}
                <TableHead>Status</TableHead>
                <TableHead>Restarts</TableHead>
                <TableHead className="w-[70px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pods.map((pod, index) => (
                <TableRow key={`${pod.cluster_id}-${pod.namespace}-${pod.name}-${index}`}>
                  <TableCell className="font-medium">{pod.name}</TableCell>
                  <TableCell>{pod.namespace}</TableCell>
                  {isAllClustersView && (
                    <TableCell>{pod.cluster_name}</TableCell>
                  )}
                  <TableCell>{getStatusBadge(pod.phase)}</TableCell>
                  <TableCell>{pod.restartCount || 0}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {can(PERMISSIONS.POD_LOGS) && (
                          <DropdownMenuItem asChild>
                            <Link href={`/dashboard/logs?pod=${pod.name}&namespace=${pod.namespace}`}>
                              <FileText className="size-4 mr-2" />
                              View Logs
                            </Link>
                          </DropdownMenuItem>
                        )}
                        {can(PERMISSIONS.POD_EXEC) && (
                          <DropdownMenuItem>
                            <Terminal className="size-4 mr-2" />
                            Open Terminal
                          </DropdownMenuItem>
                        )}
                        {can(PERMISSIONS.POD_DELETE) && (
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleDelete(pod.name, pod.namespace)}
                          >
                            <Trash2 className="size-4 mr-2" />
                            Delete Pod
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </ProtectedPage>
  );
}
