"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Shield,
  RefreshCw,
  MoreHorizontal,
  Trash2,
  Pencil,
  Plus,
  Eye,
  EyeOff,
  Copy,
  Key,
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

interface Secret {
  id: string;
  name: string;
  namespace: string;
  cluster_id: string;
  cluster_name?: string;
  type: string;
  data_count: number;
  created_at: string;
}

export default function SecretsPage() {
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { can } = useRBAC();

  const fetchSecrets = async () => {
    const supabase = createClient();
    const { data: clusters } = await supabase.from("clusters").select("id, name");

    // Simulated secret data
    const mockSecrets: Secret[] = [];
    clusters?.forEach((cluster) => {
      mockSecrets.push(
        {
          id: `secret-${cluster.id}-1`,
          name: "app-secrets",
          namespace: "default",
          cluster_id: cluster.id,
          cluster_name: cluster.name,
          type: "Opaque",
          data_count: 3,
          created_at: new Date().toISOString(),
        },
        {
          id: `secret-${cluster.id}-2`,
          name: "tls-cert",
          namespace: "ingress-nginx",
          cluster_id: cluster.id,
          cluster_name: cluster.name,
          type: "kubernetes.io/tls",
          data_count: 2,
          created_at: new Date().toISOString(),
        },
        {
          id: `secret-${cluster.id}-3`,
          name: "docker-registry",
          namespace: "default",
          cluster_id: cluster.id,
          cluster_name: cluster.name,
          type: "kubernetes.io/dockerconfigjson",
          data_count: 1,
          created_at: new Date().toISOString(),
        },
        {
          id: `secret-${cluster.id}-4`,
          name: "default-token",
          namespace: "default",
          cluster_id: cluster.id,
          cluster_name: cluster.name,
          type: "kubernetes.io/service-account-token",
          data_count: 3,
          created_at: new Date().toISOString(),
        }
      );
    });

    setSecrets(mockSecrets);
    setIsLoading(false);
    setIsRefreshing(false);
  };

  useEffect(() => {
    fetchSecrets();
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchSecrets();
  };

  const handleCopyName = (name: string) => {
    navigator.clipboard.writeText(name);
    toast.success("Copied to clipboard");
  };

  const getTypeBadge = (type: string) => {
    const shortType = type.replace("kubernetes.io/", "");
    const variants: Record<string, "default" | "secondary" | "outline"> = {
      Opaque: "default",
      tls: "secondary",
      dockerconfigjson: "secondary",
      "service-account-token": "outline",
    };
    return <Badge variant={variants[shortType] || "outline"}>{shortType}</Badge>;
  };

  return (
    <ProtectedPage permission={PERMISSIONS.CLUSTER_VIEW}>
      <PageHeader
        title="Secrets"
        description="Sensitive configuration data for your applications"
        icon={Shield}
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
              toastMessage="You need edit permissions to create Secrets"
            >
              <Button size="sm">
                <Plus className="size-4 mr-2" />
                Create Secret
              </Button>
            </PermissionButton>
          </div>
        }
      />

      <div className="mb-6 p-4 rounded-lg border border-yellow-500/20 bg-yellow-500/10">
        <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
          <Shield className="size-4" />
          <span className="text-sm font-medium">
            Secret values are hidden for security. Only metadata is displayed.
          </span>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-lg border">
          <div className="p-4 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-muted rounded animate-pulse" />
            ))}
          </div>
        </div>
      ) : secrets.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[400px] rounded-lg border bg-card">
          <Shield className="size-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">No Secrets found</h2>
          <p className="text-muted-foreground mb-4">
            Secrets will appear here once you have connected clusters
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
                <TableHead>Type</TableHead>
                <TableHead>Data Keys</TableHead>
                <TableHead className="w-[70px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {secrets.map((secret) => (
                <TableRow key={secret.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Key className="size-4 text-muted-foreground" />
                      <span className="font-mono text-sm">{secret.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>{secret.namespace}</TableCell>
                  <TableCell>{secret.cluster_name}</TableCell>
                  <TableCell>{getTypeBadge(secret.type)}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{secret.data_count} keys</Badge>
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
                          View Keys
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleCopyName(secret.name)}>
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
