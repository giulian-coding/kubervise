"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Layers,
  RefreshCw,
  MoreHorizontal,
  Play,
  ArrowUpDown,
  Trash2,
  Pencil,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { toast } from "sonner";

interface Deployment {
  id: string;
  name: string;
  namespace: string;
  cluster_id: string;
  cluster_name?: string;
  replicas: number;
  ready_replicas: number;
  available_replicas: number;
  strategy: string;
  created_at: string;
}

export default function DeploymentsPage() {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { can } = useRBAC();
  const { selectedClusterId, selectedCluster, isAllClustersView } = useCluster();

  const fetchDeployments = async () => {
    const supabase = createClient();

    let query = supabase.from("clusters").select("id, name");

    // Filter by selected cluster if one is selected
    if (selectedClusterId) {
      query = query.eq("id", selectedClusterId);
    }

    const { data: clusters } = await query;

    // Simulated deployment data based on clusters
    const mockDeployments: Deployment[] = clusters?.map((cluster, idx) => ({
      id: `dep-${cluster.id}`,
      name: `deployment-${idx + 1}`,
      namespace: "default",
      cluster_id: cluster.id,
      cluster_name: cluster.name,
      replicas: 3,
      ready_replicas: 3,
      available_replicas: 3,
      strategy: "RollingUpdate",
      created_at: new Date().toISOString(),
    })) || [];

    setDeployments(mockDeployments);
    setIsLoading(false);
    setIsRefreshing(false);
  };

  useEffect(() => {
    setIsLoading(true);
    fetchDeployments();
  }, [selectedClusterId]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchDeployments();
  };

  const handleScale = async (deploymentId: string, name: string) => {
    toast.info("Scale deployment", {
      description: `Scaling ${name} - Feature coming soon`,
    });
  };

  const handleRestart = async (deploymentId: string, name: string) => {
    toast.info("Restart deployment", {
      description: `Restarting ${name} - Feature coming soon`,
    });
  };

  const getStatusBadge = (ready: number, total: number) => {
    if (ready === total && total > 0) {
      return <Badge variant="default">{ready}/{total} Ready</Badge>;
    } else if (ready > 0) {
      return <Badge variant="secondary">{ready}/{total} Ready</Badge>;
    }
    return <Badge variant="destructive">0/{total} Ready</Badge>;
  };

  const pageDescription = selectedCluster
    ? `Deployments in cluster "${selectedCluster.name}"`
    : "Manage Kubernetes deployments across all clusters";

  return (
    <ProtectedPage permission={PERMISSIONS.WORKLOAD_VIEW}>
      <PageHeader
        title="Deployments"
        description={pageDescription}
        icon={Layers}
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
      ) : deployments.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[400px] rounded-lg border bg-card">
          <Layers className="size-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">No deployments found</h2>
          <p className="text-muted-foreground mb-4">
            {selectedCluster
              ? `No deployments in cluster "${selectedCluster.name}"`
              : "Deployments will appear here once you have connected clusters"}
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
                <TableHead>Strategy</TableHead>
                <TableHead className="w-[70px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deployments.map((deployment) => (
                <TableRow key={deployment.id}>
                  <TableCell className="font-medium">{deployment.name}</TableCell>
                  <TableCell>{deployment.namespace}</TableCell>
                  {isAllClustersView && (
                    <TableCell>{deployment.cluster_name}</TableCell>
                  )}
                  <TableCell>
                    {getStatusBadge(deployment.ready_replicas, deployment.replicas)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{deployment.strategy}</Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {can(PERMISSIONS.WORKLOAD_SCALE) && (
                          <DropdownMenuItem
                            onClick={() => handleScale(deployment.id, deployment.name)}
                          >
                            <ArrowUpDown className="size-4 mr-2" />
                            Scale
                          </DropdownMenuItem>
                        )}
                        {can(PERMISSIONS.WORKLOAD_RESTART) && (
                          <DropdownMenuItem
                            onClick={() => handleRestart(deployment.id, deployment.name)}
                          >
                            <Play className="size-4 mr-2" />
                            Restart
                          </DropdownMenuItem>
                        )}
                        {can(PERMISSIONS.WORKLOAD_EDIT) && (
                          <DropdownMenuItem>
                            <Pencil className="size-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                        )}
                        {can(PERMISSIONS.WORKLOAD_DELETE) && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive">
                              <Trash2 className="size-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </>
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
