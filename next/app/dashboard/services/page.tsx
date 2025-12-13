"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Network,
  RefreshCw,
  MoreHorizontal,
  Trash2,
  Pencil,
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
import { useCluster } from "@/lib/context/cluster-context";

interface Service {
  id: string;
  name: string;
  namespace: string;
  cluster_id: string;
  cluster_name?: string;
  type: "ClusterIP" | "NodePort" | "LoadBalancer" | "ExternalName";
  cluster_ip: string;
  external_ip?: string;
  ports: { port: number; targetPort: number; protocol: string }[];
  created_at: string;
}

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { can } = useRBAC();
  const { selectedClusterId, selectedCluster, isAllClustersView } = useCluster();

  const fetchServices = async () => {
    const supabase = createClient();

    let query = supabase.from("clusters").select("id, name");

    // Filter by selected cluster if one is selected
    if (selectedClusterId) {
      query = query.eq("id", selectedClusterId);
    }

    const { data: clusters } = await query;

    // Simulated service data
    const mockServices: Service[] = [];
    clusters?.forEach((cluster) => {
      mockServices.push(
        {
          id: `svc-${cluster.id}-1`,
          name: "kubernetes",
          namespace: "default",
          cluster_id: cluster.id,
          cluster_name: cluster.name,
          type: "ClusterIP",
          cluster_ip: "10.96.0.1",
          ports: [{ port: 443, targetPort: 6443, protocol: "TCP" }],
          created_at: new Date().toISOString(),
        },
        {
          id: `svc-${cluster.id}-2`,
          name: "frontend",
          namespace: "production",
          cluster_id: cluster.id,
          cluster_name: cluster.name,
          type: "LoadBalancer",
          cluster_ip: "10.96.45.12",
          external_ip: "203.0.113.50",
          ports: [{ port: 80, targetPort: 8080, protocol: "TCP" }],
          created_at: new Date().toISOString(),
        },
        {
          id: `svc-${cluster.id}-3`,
          name: "api-gateway",
          namespace: "production",
          cluster_id: cluster.id,
          cluster_name: cluster.name,
          type: "NodePort",
          cluster_ip: "10.96.78.23",
          ports: [{ port: 8080, targetPort: 8080, protocol: "TCP" }],
          created_at: new Date().toISOString(),
        }
      );
    });

    setServices(mockServices);
    setIsLoading(false);
    setIsRefreshing(false);
  };

  useEffect(() => {
    setIsLoading(true);
    fetchServices();
  }, [selectedClusterId]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchServices();
  };

  const getTypeBadge = (type: Service["type"]) => {
    const variants: Record<Service["type"], "default" | "secondary" | "outline"> = {
      ClusterIP: "outline",
      NodePort: "secondary",
      LoadBalancer: "default",
      ExternalName: "secondary",
    };
    return <Badge variant={variants[type]}>{type}</Badge>;
  };

  const pageDescription = selectedCluster
    ? `Services in cluster "${selectedCluster.name}"`
    : "Network services exposing your applications";

  return (
    <ProtectedPage permission={PERMISSIONS.WORKLOAD_VIEW}>
      <PageHeader
        title="Services"
        description={pageDescription}
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
      ) : services.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[400px] rounded-lg border bg-card">
          <Network className="size-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">No Services found</h2>
          <p className="text-muted-foreground mb-4">
            {selectedCluster
              ? `No services in cluster "${selectedCluster.name}"`
              : "Services will appear here once you have connected clusters"}
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
                <TableHead>Type</TableHead>
                <TableHead>Cluster IP</TableHead>
                <TableHead>External IP</TableHead>
                <TableHead>Ports</TableHead>
                <TableHead className="w-[70px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {services.map((svc) => (
                <TableRow key={svc.id}>
                  <TableCell className="font-medium">{svc.name}</TableCell>
                  <TableCell>{svc.namespace}</TableCell>
                  {isAllClustersView && (
                    <TableCell>{svc.cluster_name}</TableCell>
                  )}
                  <TableCell>{getTypeBadge(svc.type)}</TableCell>
                  <TableCell>
                    <code className="text-xs bg-muted px-1 py-0.5 rounded">
                      {svc.cluster_ip}
                    </code>
                  </TableCell>
                  <TableCell>
                    {svc.external_ip ? (
                      <code className="text-xs bg-muted px-1 py-0.5 rounded">
                        {svc.external_ip}
                      </code>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">
                      {svc.ports.map((p) => `${p.port}:${p.targetPort}`).join(", ")}
                    </span>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {svc.external_ip && (
                          <DropdownMenuItem asChild>
                            <a
                              href={`http://${svc.external_ip}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Globe className="size-4 mr-2" />
                              Open External
                            </a>
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
