"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Layers,
  RefreshCw,
  MoreHorizontal,
  Trash2,
  Plus,
  Box,
} from "lucide-react";
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
import { PERMISSIONS, useRBAC, PermissionButton } from "@/lib/rbac";
import { useCluster } from "@/lib/context/cluster-context";
import { getAllNamespaces, subscribeToSnapshots } from "@/lib/utils/snapshots";
import type { K8sNamespace } from "@/lib/types/database";

type NamespaceWithCluster = K8sNamespace & { cluster_id: string; cluster_name: string };

export default function NamespacesPage() {
  const [namespaces, setNamespaces] = useState<NamespaceWithCluster[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { can } = useRBAC();
  const { selectedClusterId, selectedCluster, isAllClustersView } = useCluster();

  const fetchNamespaces = async () => {
    const data = await getAllNamespaces(selectedClusterId || undefined);
    setNamespaces(data);
    setIsLoading(false);
    setIsRefreshing(false);
  };

  useEffect(() => {
    setIsLoading(true);
    fetchNamespaces();

    // Subscribe to snapshot changes
    const unsubscribe = subscribeToSnapshots(selectedClusterId, fetchNamespaces);

    return () => {
      unsubscribe();
    };
  }, [selectedClusterId]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchNamespaces();
  };

  const getStatusBadge = (status: string) => {
    if (status === "Active") {
      return <Badge variant="default">Active</Badge>;
    }
    return <Badge variant="secondary">{status}</Badge>;
  };

  const isSystemNamespace = (name: string) => {
    return ["kube-system", "kube-public", "kube-node-lease", "default"].includes(name);
  };

  const pageDescription = selectedCluster
    ? `Namespaces in cluster "${selectedCluster.name}"`
    : "Kubernetes namespaces for resource isolation";

  return (
    <ProtectedPage permission={PERMISSIONS.CLUSTER_VIEW}>
      <PageHeader
        title="Namespaces"
        description={pageDescription}
        icon={Layers}
        actions={
          <div className="flex items-center gap-2">
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
            <PermissionButton
              permission={PERMISSIONS.CLUSTER_EDIT}
              toastMessage="You need edit permissions to create namespaces"
            >
              <Button size="sm">
                <Plus className="size-4 mr-2" />
                Create Namespace
              </Button>
            </PermissionButton>
          </div>
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
      ) : namespaces.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[400px] rounded-lg border bg-card">
          <Layers className="size-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">No namespaces found</h2>
          <p className="text-muted-foreground mb-4">
            {selectedCluster
              ? `No namespaces in cluster "${selectedCluster.name}"`
              : "Namespaces will appear here once you have connected clusters"}
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
                {isAllClustersView && <TableHead>Cluster</TableHead>}
                <TableHead>Status</TableHead>
                <TableHead>Labels</TableHead>
                <TableHead className="w-[70px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {namespaces.map((ns, index) => (
                <TableRow key={`${ns.cluster_id}-${ns.name}-${index}`}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {ns.name}
                      {isSystemNamespace(ns.name) && (
                        <Badge variant="outline" className="text-xs">
                          System
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  {isAllClustersView && (
                    <TableCell>{ns.cluster_name}</TableCell>
                  )}
                  <TableCell>{getStatusBadge(ns.status)}</TableCell>
                  <TableCell>
                    {Object.keys(ns.labels || {}).length > 0 ? (
                      <div className="flex gap-1">
                        {Object.keys(ns.labels).slice(0, 2).map((key) => (
                          <Badge key={key} variant="outline" className="text-xs">
                            {key.split("/").pop()}
                          </Badge>
                        ))}
                        {Object.keys(ns.labels).length > 2 && (
                          <Badge variant="outline" className="text-xs">
                            +{Object.keys(ns.labels).length - 2}
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/dashboard/pods?namespace=${ns.name}`}>
                            <Box className="size-4 mr-2" />
                            View Pods
                          </Link>
                        </DropdownMenuItem>
                        {can(PERMISSIONS.CLUSTER_DELETE) &&
                          !isSystemNamespace(ns.name) && (
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
