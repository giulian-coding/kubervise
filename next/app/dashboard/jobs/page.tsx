"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  GitBranch,
  RefreshCw,
  MoreHorizontal,
  Trash2,
  Play,
  CheckCircle,
  XCircle,
  Clock,
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

interface Job {
  id: string;
  name: string;
  namespace: string;
  cluster_id: string;
  cluster_name?: string;
  completions: number;
  succeeded: number;
  failed: number;
  active: number;
  status: "Running" | "Completed" | "Failed";
  created_at: string;
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { can } = useRBAC();
  const { selectedClusterId, selectedCluster, isAllClustersView } = useCluster();

  const fetchJobs = async () => {
    const supabase = createClient();

    let query = supabase.from("clusters").select("id, name");

    if (selectedClusterId) {
      query = query.eq("id", selectedClusterId);
    }

    const { data: clusters } = await query;

    // Simulated job data
    const mockJobs: Job[] = [];
    clusters?.forEach((cluster) => {
      mockJobs.push(
        {
          id: `job-${cluster.id}-1`,
          name: "database-backup",
          namespace: "default",
          cluster_id: cluster.id,
          cluster_name: cluster.name,
          completions: 1,
          succeeded: 1,
          failed: 0,
          active: 0,
          status: "Completed",
          created_at: new Date().toISOString(),
        },
        {
          id: `job-${cluster.id}-2`,
          name: "data-migration",
          namespace: "jobs",
          cluster_id: cluster.id,
          cluster_name: cluster.name,
          completions: 3,
          succeeded: 2,
          failed: 0,
          active: 1,
          status: "Running",
          created_at: new Date().toISOString(),
        }
      );
    });

    setJobs(mockJobs);
    setIsLoading(false);
    setIsRefreshing(false);
  };

  useEffect(() => {
    setIsLoading(true);
    fetchJobs();
  }, [selectedClusterId]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchJobs();
  };

  const getStatusBadge = (status: Job["status"]) => {
    switch (status) {
      case "Completed":
        return (
          <Badge variant="default" className="gap-1">
            <CheckCircle className="size-3" />
            Completed
          </Badge>
        );
      case "Running":
        return (
          <Badge variant="secondary" className="gap-1">
            <Clock className="size-3" />
            Running
          </Badge>
        );
      case "Failed":
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="size-3" />
            Failed
          </Badge>
        );
    }
  };

  const pageDescription = selectedCluster
    ? `Jobs in cluster "${selectedCluster.name}"`
    : "View batch and one-time workloads";

  return (
    <ProtectedPage permission={PERMISSIONS.WORKLOAD_VIEW}>
      <PageHeader
        title="Jobs"
        description={pageDescription}
        icon={GitBranch}
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
      ) : jobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[400px] rounded-lg border bg-card">
          <GitBranch className="size-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">No Jobs found</h2>
          <p className="text-muted-foreground mb-4">
            {selectedCluster
              ? `No Jobs in cluster "${selectedCluster.name}"`
              : "Jobs will appear here once you have connected clusters"}
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
                <TableHead>Progress</TableHead>
                <TableHead className="w-[70px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job) => (
                <TableRow key={job.id}>
                  <TableCell className="font-medium">{job.name}</TableCell>
                  <TableCell>{job.namespace}</TableCell>
                  {isAllClustersView && (
                    <TableCell>{job.cluster_name}</TableCell>
                  )}
                  <TableCell>{getStatusBadge(job.status)}</TableCell>
                  <TableCell>
                    <span className="text-sm">
                      {job.succeeded}/{job.completions} completed
                      {job.active > 0 && `, ${job.active} active`}
                      {job.failed > 0 && `, ${job.failed} failed`}
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
                        {can(PERMISSIONS.WORKLOAD_CREATE) && (
                          <DropdownMenuItem>
                            <Play className="size-4 mr-2" />
                            Run Again
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
