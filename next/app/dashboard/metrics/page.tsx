"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Gauge,
  RefreshCw,
  Server,
  Cpu,
  MemoryStick,
  HardDrive,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/dashboard/page-header";
import { ProtectedPage } from "@/components/dashboard/protected-page";
import { PERMISSIONS } from "@/lib/rbac";

interface ClusterMetrics {
  cluster_id: string;
  cluster_name: string;
  cpu_usage: number;
  cpu_capacity: number;
  memory_usage: number;
  memory_capacity: number;
  pod_count: number;
  pod_capacity: number;
}

export default function MetricsPage() {
  const [metrics, setMetrics] = useState<ClusterMetrics[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchMetrics = async () => {
    const supabase = createClient();
    const { data: clusters } = await supabase.from("clusters").select("id, name");

    // Simulated metrics data
    const mockMetrics: ClusterMetrics[] =
      clusters?.map((cluster) => ({
        cluster_id: cluster.id,
        cluster_name: cluster.name,
        cpu_usage: Math.random() * 8,
        cpu_capacity: 8,
        memory_usage: Math.random() * 32,
        memory_capacity: 32,
        pod_count: Math.floor(Math.random() * 100),
        pod_capacity: 110,
      })) || [];

    setMetrics(mockMetrics);
    setIsLoading(false);
    setIsRefreshing(false);
  };

  useEffect(() => {
    fetchMetrics();

    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchMetrics();
  };

  const getPercentage = (used: number, total: number) => {
    return Math.round((used / total) * 100);
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 90) return "bg-red-500";
    if (percentage >= 70) return "bg-yellow-500";
    return "bg-green-500";
  };

  return (
    <ProtectedPage permission={PERMISSIONS.MONITORING_VIEW}>
      <PageHeader
        title="Metrics"
        description="Resource utilization across your clusters"
        icon={Gauge}
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
        <div className="grid gap-6 md:grid-cols-2">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-64 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      ) : metrics.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[400px] rounded-lg border bg-card">
          <Gauge className="size-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">No metrics available</h2>
          <p className="text-muted-foreground mb-4">
            Connect a cluster to start monitoring resources
          </p>
          <Link href="/dashboard/clusters">
            <Button variant="outline">View Clusters</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Overview Stats */}
          <div className="grid gap-4 md:grid-cols-4">
            <MetricCard
              title="Total CPU Usage"
              value={`${metrics.reduce((acc, m) => acc + m.cpu_usage, 0).toFixed(1)} cores`}
              subtitle={`of ${metrics.reduce((acc, m) => acc + m.cpu_capacity, 0)} cores`}
              icon={Cpu}
              trend={Math.random() > 0.5 ? "up" : "down"}
            />
            <MetricCard
              title="Total Memory"
              value={`${metrics.reduce((acc, m) => acc + m.memory_usage, 0).toFixed(1)} GB`}
              subtitle={`of ${metrics.reduce((acc, m) => acc + m.memory_capacity, 0)} GB`}
              icon={MemoryStick}
              trend={Math.random() > 0.5 ? "up" : "down"}
            />
            <MetricCard
              title="Total Pods"
              value={metrics.reduce((acc, m) => acc + m.pod_count, 0).toString()}
              subtitle={`of ${metrics.reduce((acc, m) => acc + m.pod_capacity, 0)} capacity`}
              icon={HardDrive}
            />
            <MetricCard
              title="Clusters"
              value={metrics.length.toString()}
              subtitle="monitored"
              icon={Server}
            />
          </div>

          {/* Per-Cluster Metrics */}
          <div className="grid gap-6 md:grid-cols-2">
            {metrics.map((cluster) => (
              <div
                key={cluster.cluster_id}
                className="rounded-lg border bg-card p-6"
              >
                <div className="flex items-center gap-2 mb-6">
                  <Server className="size-5 text-primary" />
                  <h3 className="font-semibold">{cluster.cluster_name}</h3>
                </div>

                <div className="space-y-4">
                  {/* CPU */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Cpu className="size-4 text-muted-foreground" />
                        <span>CPU</span>
                      </div>
                      <span className="text-sm font-medium">
                        {cluster.cpu_usage.toFixed(1)} / {cluster.cpu_capacity} cores
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${getProgressColor(
                          getPercentage(cluster.cpu_usage, cluster.cpu_capacity)
                        )}`}
                        style={{
                          width: `${getPercentage(cluster.cpu_usage, cluster.cpu_capacity)}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Memory */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 text-sm">
                        <MemoryStick className="size-4 text-muted-foreground" />
                        <span>Memory</span>
                      </div>
                      <span className="text-sm font-medium">
                        {cluster.memory_usage.toFixed(1)} / {cluster.memory_capacity} GB
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${getProgressColor(
                          getPercentage(cluster.memory_usage, cluster.memory_capacity)
                        )}`}
                        style={{
                          width: `${getPercentage(cluster.memory_usage, cluster.memory_capacity)}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Pods */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 text-sm">
                        <HardDrive className="size-4 text-muted-foreground" />
                        <span>Pods</span>
                      </div>
                      <span className="text-sm font-medium">
                        {cluster.pod_count} / {cluster.pod_capacity}
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${getProgressColor(
                          getPercentage(cluster.pod_count, cluster.pod_capacity)
                        )}`}
                        style={{
                          width: `${getPercentage(cluster.pod_count, cluster.pod_capacity)}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </ProtectedPage>
  );
}

interface MetricCardProps {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: "up" | "down";
}

function MetricCard({ title, value, subtitle, icon: Icon, trend }: MetricCardProps) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-muted-foreground">{title}</span>
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold">{value}</span>
        {trend && (
          trend === "up" ? (
            <TrendingUp className="size-4 text-green-500" />
          ) : (
            <TrendingDown className="size-4 text-red-500" />
          )
        )}
      </div>
      <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
    </div>
  );
}
