"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Server,
  Plus,
  RefreshCw,
  MoreHorizontal,
  Pencil,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/dashboard/page-header";
import { ProtectedPage } from "@/components/dashboard/protected-page";
import {
  PERMISSIONS,
  PermissionButton,
  PermissionGate,
  useRBAC,
} from "@/lib/rbac";
import type { Cluster } from "@/lib/types/database";

export default function ClustersPage() {
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { can } = useRBAC();

  const fetchClusters = async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("clusters")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setClusters(data);
    }
    setIsLoading(false);
    setIsRefreshing(false);
  };

  useEffect(() => {
    fetchClusters();

    // Set up realtime subscription
    const supabase = createClient();
    const channel = supabase
      .channel("clusters-page")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "clusters" },
        () => fetchClusters()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchClusters();
  };

  const handleDelete = async (clusterId: string) => {
    if (!confirm("Are you sure you want to delete this cluster?")) return;

    const supabase = createClient();
    await supabase.from("clusters").delete().eq("id", clusterId);
    fetchClusters();
  };

  return (
    <ProtectedPage permission={PERMISSIONS.CLUSTER_VIEW}>
      <PageHeader
        title="Clusters"
        description="Manage your Kubernetes clusters"
        icon={Server}
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
              permission={PERMISSIONS.CLUSTER_CREATE}
              toastMessage="Only owners and admins can add clusters"
            >
              <Link href="/dashboard/clusters/add">
                <Button size="sm">
                  <Plus className="size-4 mr-2" />
                  Add Cluster
                </Button>
              </Link>
            </PermissionButton>
          </div>
        }
      />

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="rounded-lg border bg-card p-6 animate-pulse"
            >
              <div className="h-6 bg-muted rounded w-1/2 mb-4" />
              <div className="h-4 bg-muted rounded w-3/4 mb-2" />
              <div className="h-4 bg-muted rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : clusters.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[400px] rounded-lg border bg-card">
          <Server className="size-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">No clusters yet</h2>
          <p className="text-muted-foreground mb-4">
            Connect your first Kubernetes cluster to get started
          </p>
          <PermissionButton
            permission={PERMISSIONS.CLUSTER_CREATE}
            toastMessage="Only owners and admins can add clusters"
          >
            <Link href="/dashboard/clusters/add">
              <Button>
                <Plus className="size-4 mr-2" />
                Add Cluster
              </Button>
            </Link>
          </PermissionButton>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {clusters.map((cluster) => (
            <div
              key={cluster.id}
              className="rounded-lg border bg-card p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`size-3 rounded-full ${
                      cluster.connection_status === "connected"
                        ? "bg-green-500"
                        : cluster.connection_status === "error"
                        ? "bg-red-500"
                        : "bg-yellow-500"
                    }`}
                  />
                  <h3 className="font-semibold">{cluster.name}</h3>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-8">
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link href={`/dashboard/clusters/${cluster.id}`}>
                        <ExternalLink className="size-4 mr-2" />
                        View Details
                      </Link>
                    </DropdownMenuItem>
                    {can(PERMISSIONS.CLUSTER_EDIT) && (
                      <DropdownMenuItem asChild>
                        <Link href={`/dashboard/clusters/${cluster.id}/edit`}>
                          <Pencil className="size-4 mr-2" />
                          Edit
                        </Link>
                      </DropdownMenuItem>
                    )}
                    {can(PERMISSIONS.CLUSTER_DELETE) && (
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => handleDelete(cluster.id)}
                      >
                        <Trash2 className="size-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <span className="capitalize">{cluster.connection_status}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">API Server</span>
                  <span className="truncate max-w-[180px]">
                    {cluster.api_endpoint || "Agent-based"}
                  </span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t">
                <Link href={`/dashboard/clusters/${cluster.id}`}>
                  <Button variant="outline" size="sm" className="w-full">
                    View Cluster
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </ProtectedPage>
  );
}
