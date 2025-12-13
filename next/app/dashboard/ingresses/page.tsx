"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Network,
  RefreshCw,
  MoreHorizontal,
  Trash2,
  Pencil,
  ExternalLink,
  Lock,
  Globe,
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

interface IngressRule {
  host: string;
  paths: { path: string; backend: string }[];
}

interface Ingress {
  id: string;
  name: string;
  namespace: string;
  cluster_id: string;
  cluster_name?: string;
  class: string;
  rules: IngressRule[];
  tls: boolean;
  address?: string;
  created_at: string;
}

export default function IngressesPage() {
  const [ingresses, setIngresses] = useState<Ingress[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { can } = useRBAC();

  const fetchIngresses = async () => {
    const supabase = createClient();
    const { data: clusters } = await supabase.from("clusters").select("id, name");

    // Simulated ingress data
    const mockIngresses: Ingress[] = [];
    clusters?.forEach((cluster) => {
      mockIngresses.push(
        {
          id: `ing-${cluster.id}-1`,
          name: "main-ingress",
          namespace: "production",
          cluster_id: cluster.id,
          cluster_name: cluster.name,
          class: "nginx",
          rules: [
            {
              host: "app.example.com",
              paths: [{ path: "/", backend: "frontend:80" }],
            },
            {
              host: "api.example.com",
              paths: [{ path: "/", backend: "api-gateway:8080" }],
            },
          ],
          tls: true,
          address: "203.0.113.100",
          created_at: new Date().toISOString(),
        },
        {
          id: `ing-${cluster.id}-2`,
          name: "monitoring-ingress",
          namespace: "monitoring",
          cluster_id: cluster.id,
          cluster_name: cluster.name,
          class: "nginx",
          rules: [
            {
              host: "grafana.example.com",
              paths: [{ path: "/", backend: "grafana:3000" }],
            },
          ],
          tls: true,
          address: "203.0.113.100",
          created_at: new Date().toISOString(),
        }
      );
    });

    setIngresses(mockIngresses);
    setIsLoading(false);
    setIsRefreshing(false);
  };

  useEffect(() => {
    fetchIngresses();
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchIngresses();
  };

  return (
    <ProtectedPage permission={PERMISSIONS.WORKLOAD_VIEW}>
      <PageHeader
        title="Ingresses"
        description="HTTP routing and load balancing for services"
        icon={Network}
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
      ) : ingresses.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[400px] rounded-lg border bg-card">
          <Network className="size-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">No Ingresses found</h2>
          <p className="text-muted-foreground mb-4">
            Ingresses will appear here once you have connected clusters
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
                <TableHead>Class</TableHead>
                <TableHead>Hosts</TableHead>
                <TableHead>TLS</TableHead>
                <TableHead>Address</TableHead>
                <TableHead className="w-[70px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ingresses.map((ing) => (
                <TableRow key={ing.id}>
                  <TableCell className="font-medium">{ing.name}</TableCell>
                  <TableCell>{ing.namespace}</TableCell>
                  <TableCell>{ing.cluster_name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{ing.class}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {ing.rules.map((rule) => (
                        <a
                          key={rule.host}
                          href={`${ing.tls ? "https" : "http"}://${rule.host}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline flex items-center gap-1"
                        >
                          {rule.host}
                          <ExternalLink className="size-3" />
                        </a>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    {ing.tls ? (
                      <Badge variant="default" className="gap-1">
                        <Lock className="size-3" />
                        Enabled
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Disabled</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {ing.address ? (
                      <code className="text-xs bg-muted px-1 py-0.5 rounded">
                        {ing.address}
                      </code>
                    ) : (
                      <span className="text-muted-foreground text-sm">Pending</span>
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
