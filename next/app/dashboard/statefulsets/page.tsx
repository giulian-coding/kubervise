"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Database,
  RefreshCw,
  MoreHorizontal,
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

interface StatefulSet {
  id: string;
  name: string;
  namespace: string;
  cluster_id: string;
  cluster_name?: string;
  replicas: number;
  ready_replicas: number;
  service_name: string;
  created_at: string;
}

export default function StatefulSetsPage() {
  const [statefulSets, setStatefulSets] = useState<StatefulSet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { can } = useRBAC();
  const { selectedClusterId, selectedCluster, isAllClustersView } = useCluster();

  const fetchStatefulSets = async () => {
    const supabase = createClient();

    let query = supabase.from("clusters").select("id, name");

    if (selectedClusterId) {
      query = query.eq("id", selectedClusterId);
    }

    const { data: clusters } = await query;

    // Simulated statefulset data
    const mockStatefulSets: StatefulSet[] = [];
    clusters?.forEach((cluster) => {
      mockStatefulSets.push({
        id: `sts-${cluster.id}-1`,
        name: "postgres",
        namespace: "database",
        cluster_id: cluster.id,
        cluster_name: cluster.name,
        replicas: 3,
        ready_replicas: 3,
        service_name: "postgres-headless",
        created_at: new Date().toISOString(),
      });
    });

    setStatefulSets(mockStatefulSets);
    setIsLoading(false);
    setIsRefreshing(false);
  };

  useEffect(() => {
    setIsLoading(true);
    fetchStatefulSets();
  }, [selectedClusterId]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchStatefulSets();
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
    ? `StatefulSets in cluster "${selectedCluster.name}"`
    : "Manage stateful applications with persistent storage";

  return (
    <ProtectedPage permission={PERMISSIONS.WORKLOAD_VIEW}>
      <PageHeader
        title="StatefulSets"
        description={pageDescription}
        icon={Database}
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
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-12 bg-muted rounded animate-pulse" />
            ))}
          </div>
        </div>
      ) : statefulSets.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[400px] rounded-lg border bg-card">
          <Database className="size-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">No StatefulSets found</h2>
          <p className="text-muted-foreground mb-4">
            {selectedCluster
              ? `No StatefulSets in cluster "${selectedCluster.name}"`
              : "StatefulSets will appear here once you have connected clusters"}
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
                <TableHead>Service</TableHead>
                <TableHead className="w-[70px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {statefulSets.map((sts) => (
                <TableRow key={sts.id}>
                  <TableCell className="font-medium">{sts.name}</TableCell>
                  <TableCell>{sts.namespace}</TableCell>
                  {isAllClustersView && (
                    <TableCell>{sts.cluster_name}</TableCell>
                  )}
                  <TableCell>
                    {getStatusBadge(sts.ready_replicas, sts.replicas)}
                  </TableCell>
                  <TableCell>
                    <code className="text-xs bg-muted px-1 py-0.5 rounded">
                      {sts.service_name}
                    </code>
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
                          <DropdownMenuItem>
                            <ArrowUpDown className="size-4 mr-2" />
                            Scale
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
