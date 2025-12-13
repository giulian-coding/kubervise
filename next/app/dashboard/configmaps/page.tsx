"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FileText,
  RefreshCw,
  MoreHorizontal,
  Trash2,
  Pencil,
  Plus,
  Eye,
  Copy,
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
import { PERMISSIONS, useRBAC, PermissionButton } from "@/lib/rbac";
import { toast } from "sonner";

interface ConfigMap {
  id: string;
  name: string;
  namespace: string;
  cluster_id: string;
  cluster_name?: string;
  data_count: number;
  created_at: string;
}

export default function ConfigMapsPage() {
  const [configMaps, setConfigMaps] = useState<ConfigMap[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { can } = useRBAC();

  const fetchConfigMaps = async () => {
    const supabase = createClient();
    const { data: clusters } = await supabase.from("clusters").select("id, name");

    // Simulated configmap data
    const mockConfigMaps: ConfigMap[] = [];
    clusters?.forEach((cluster) => {
      mockConfigMaps.push(
        {
          id: `cm-${cluster.id}-1`,
          name: "app-config",
          namespace: "default",
          cluster_id: cluster.id,
          cluster_name: cluster.name,
          data_count: 5,
          created_at: new Date().toISOString(),
        },
        {
          id: `cm-${cluster.id}-2`,
          name: "nginx-config",
          namespace: "ingress-nginx",
          cluster_id: cluster.id,
          cluster_name: cluster.name,
          data_count: 3,
          created_at: new Date().toISOString(),
        },
        {
          id: `cm-${cluster.id}-3`,
          name: "coredns",
          namespace: "kube-system",
          cluster_id: cluster.id,
          cluster_name: cluster.name,
          data_count: 2,
          created_at: new Date().toISOString(),
        }
      );
    });

    setConfigMaps(mockConfigMaps);
    setIsLoading(false);
    setIsRefreshing(false);
  };

  useEffect(() => {
    fetchConfigMaps();
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchConfigMaps();
  };

  const handleCopyName = (name: string) => {
    navigator.clipboard.writeText(name);
    toast.success("Copied to clipboard");
  };

  return (
    <ProtectedPage permission={PERMISSIONS.CLUSTER_VIEW}>
      <PageHeader
        title="ConfigMaps"
        description="Configuration data for your applications"
        icon={FileText}
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
              toastMessage="You need edit permissions to create ConfigMaps"
            >
              <Button size="sm">
                <Plus className="size-4 mr-2" />
                Create ConfigMap
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
      ) : configMaps.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[400px] rounded-lg border bg-card">
          <FileText className="size-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">No ConfigMaps found</h2>
          <p className="text-muted-foreground mb-4">
            ConfigMaps will appear here once you have connected clusters
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
                <TableHead>Cluster</TableHead>
                <TableHead>Data Keys</TableHead>
                <TableHead className="w-[70px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {configMaps.map((cm) => (
                <TableRow key={cm.id}>
                  <TableCell className="font-medium font-mono text-sm">
                    {cm.name}
                  </TableCell>
                  <TableCell>{cm.namespace}</TableCell>
                  <TableCell>{cm.cluster_name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{cm.data_count} keys</Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Eye className="size-4 mr-2" />
                          View Data
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleCopyName(cm.name)}>
                          <Copy className="size-4 mr-2" />
                          Copy Name
                        </DropdownMenuItem>
                        {can(PERMISSIONS.CLUSTER_EDIT) && (
                          <DropdownMenuItem>
                            <Pencil className="size-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                        )}
                        {can(PERMISSIONS.CLUSTER_DELETE) && (
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
