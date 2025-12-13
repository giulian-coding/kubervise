"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  HardDrive,
  RefreshCw,
  MoreHorizontal,
  Info,
  Cpu,
  MemoryStick,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/dashboard/page-header";
import { ProtectedPage } from "@/components/dashboard/protected-page";
import { PERMISSIONS } from "@/lib/rbac";
import { useCluster } from "@/lib/context/cluster-context";
import { getAllNodes, subscribeToSnapshots } from "@/lib/utils/snapshots";
import type { K8sNode } from "@/lib/types/database";

type NodeWithCluster = K8sNode & { cluster_id: string; cluster_name: string };

export default function NodesPage() {
  const [nodes, setNodes] = useState<NodeWithCluster[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { selectedClusterId, selectedCluster, isAllClustersView } = useCluster();

  const fetchNodes = async () => {
    const data = await getAllNodes(selectedClusterId || undefined);
    setNodes(data);
    setIsLoading(false);
    setIsRefreshing(false);
  };

  useEffect(() => {
    setIsLoading(true);
    fetchNodes();

    // Subscribe to snapshot changes
    const unsubscribe = subscribeToSnapshots(selectedClusterId, fetchNodes);

    return () => {
      unsubscribe();
    };
  }, [selectedClusterId]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchNodes();
  };

  const getStatusBadge = (status: string) => {
    if (status === "Ready") {
      return <Badge variant="default">Ready</Badge>;
    }
    return <Badge variant="destructive">{status}</Badge>;
  };

  const pageDescription = selectedCluster
    ? `Nodes in cluster "${selectedCluster.name}"`
    : "Kubernetes nodes across all clusters";

  return (
    <ProtectedPage permission={PERMISSIONS.CLUSTER_VIEW}>
      <PageHeader
        title="Nodes"
        description={pageDescription}
        icon={HardDrive}
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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-48 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      ) : nodes.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[400px] rounded-lg border bg-card">
          <HardDrive className="size-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">No nodes found</h2>
          <p className="text-muted-foreground mb-4">
            {selectedCluster
              ? `No nodes in cluster "${selectedCluster.name}"`
              : "Nodes will appear here once you have connected clusters"}
          </p>
          <Link href="/dashboard/clusters">
            <Button variant="outline">View Clusters</Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {nodes.map((node, index) => (
            <div
              key={`${node.cluster_id}-${node.name}-${index}`}
              className="rounded-lg border bg-card p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold">{node.name}</h3>
                  {isAllClustersView && (
                    <p className="text-sm text-muted-foreground">
                      {node.cluster_name}
                    </p>
                  )}
                  {node.roles.length > 0 && (
                    <div className="flex gap-1 mt-1">
                      {node.roles.map((role) => (
                        <Badge key={role} variant="outline" className="text-xs">
                          {role}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(node.status)}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-8">
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <Info className="size-4 mr-2" />
                        View Details
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Cpu className="size-4" />
                    <span>CPU</span>
                  </div>
                  <span>{node.capacity.cpu || "N/A"}</span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MemoryStick className="size-4" />
                    <span>Memory</span>
                  </div>
                  <span>{node.capacity.memory || "N/A"}</span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Activity className="size-4" />
                    <span>Version</span>
                  </div>
                  <span>{node.nodeInfo.kubeletVersion || "N/A"}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </ProtectedPage>
  );
}
