"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Server,
  Box,
  Activity,
  AlertTriangle,
  HardDrive,
  Clock,
  Plus,
  RefreshCw,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { DashboardData } from "@/lib/actions/dashboard";
import type { DashboardStats, RecentEvent } from "@/lib/types/database";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "@/lib/utils/date";
import { useRBAC, PERMISSIONS, PermissionButton, PermissionGate } from "@/lib/rbac";

interface DashboardContentProps {
  data: DashboardData;
  teamId: string;
}

export function DashboardContent({ data, teamId }: DashboardContentProps) {
  const [stats, setStats] = useState<DashboardStats>(data.stats);
  const [events, setEvents] = useState<RecentEvent[]>(data.recentEvents);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Set up realtime subscriptions
  useEffect(() => {
    const supabase = createClient();

    // Subscribe to cluster changes
    const clustersChannel = supabase
      .channel("clusters-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "clusters",
          filter: `team_id=eq.${teamId}`,
        },
        () => {
          // Refresh stats on cluster change
          refreshStats();
        }
      )
      .subscribe();

    // Subscribe to pod changes
    const podsChannel = supabase
      .channel("pods-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "pods",
        },
        () => {
          refreshStats();
        }
      )
      .subscribe();

    // Subscribe to events
    const eventsChannel = supabase
      .channel("events-changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "cluster_events",
        },
        (payload) => {
          // Add new event to the list
          const newEvent = payload.new as RecentEvent;
          setEvents((prev) => [newEvent, ...prev].slice(0, 5));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(clustersChannel);
      supabase.removeChannel(podsChannel);
      supabase.removeChannel(eventsChannel);
    };
  }, [teamId]);

  const refreshStats = async () => {
    setIsRefreshing(true);
    try {
      const supabase = createClient();

      // Try to use RPC function for optimized stats
      const { data: rpcData, error } = await supabase.rpc("get_dashboard_stats", {
        p_team_id: teamId,
      });

      if (!error && rpcData) {
        setStats(rpcData as DashboardStats);
      }
    } catch (err) {
      console.error("Error refreshing stats:", err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const hasData =
    stats.clusters.total > 0 ||
    stats.pods.total > 0 ||
    stats.nodes.total > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of your Kubernetes clusters and resources
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={refreshStats}
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
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Clusters"
          value={stats.clusters.total.toString()}
          description={
            stats.clusters.total > 0
              ? `${stats.clusters.connected} connected, ${stats.clusters.disconnected} disconnected`
              : "No clusters yet"
          }
          icon={Server}
          variant={stats.clusters.error > 0 ? "warning" : "default"}
        />
        <StatCard
          title="Pods"
          value={stats.pods.total.toString()}
          description={
            stats.pods.total > 0
              ? `${stats.pods.running} running, ${stats.pods.pending} pending`
              : "No pods yet"
          }
          icon={Box}
          variant={stats.pods.failed > 0 ? "warning" : "default"}
        />
        <StatCard
          title="Nodes"
          value={stats.nodes.total.toString()}
          description={
            stats.nodes.total > 0
              ? `${stats.nodes.ready} ready, ${stats.nodes.notReady} not ready`
              : "No nodes yet"
          }
          icon={HardDrive}
          variant={stats.nodes.notReady > 0 ? "warning" : "default"}
        />
        <StatCard
          title="Alerts"
          value={stats.alerts.total.toString()}
          description={
            stats.alerts.total > 0
              ? `${stats.alerts.critical} critical, ${stats.alerts.warning} warning`
              : "No alerts"
          }
          icon={AlertTriangle}
          variant={stats.alerts.critical > 0 ? "error" : stats.alerts.warning > 0 ? "warning" : "default"}
        />
      </div>

      {/* Content sections */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Recent Events */}
        <div className="rounded-lg border bg-card p-6">
          <h2 className="text-lg font-semibold mb-4">Recent Events</h2>
          {events.length > 0 ? (
            <div className="space-y-3">
              {events.map((event) => (
                <EventItem key={event.id} event={event} />
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Activity className="size-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                {hasData
                  ? "No recent events"
                  : "Add a cluster to see events"}
              </p>
            </div>
          )}
        </div>

        {/* Cluster Overview */}
        <div className="rounded-lg border bg-card p-6">
          <h2 className="text-lg font-semibold mb-4">Clusters</h2>
          {data.clusters.length > 0 ? (
            <div className="space-y-3">
              {data.clusters.slice(0, 5).map((cluster) => (
                <Link
                  key={cluster.id}
                  href={`/dashboard/clusters/${cluster.id}`}
                  className="flex items-center justify-between p-3 rounded-md hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`size-2 rounded-full ${
                        cluster.connection_status === "connected"
                          ? "bg-green-500"
                          : cluster.connection_status === "error"
                          ? "bg-red-500"
                          : "bg-yellow-500"
                      }`}
                    />
                    <div>
                      <p className="font-medium">{cluster.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {cluster.latest_status
                          ? `${cluster.latest_status.node_count} nodes, ${cluster.latest_status.pod_count} pods`
                          : "No data yet"}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground capitalize">
                    {cluster.connection_status}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Server className="size-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground mb-4">
                No clusters connected yet
              </p>
              <PermissionButton
                permission={PERMISSIONS.CLUSTER_CREATE}
                toastMessage="Only owners and admins can add clusters"
              >
                <Link href="/dashboard/clusters/add">
                  <Button variant="outline" size="sm">
                    <Plus className="size-4 mr-2" />
                    Add your first cluster
                  </Button>
                </Link>
              </PermissionButton>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  variant?: "default" | "warning" | "error";
}

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  variant = "default",
}: StatCardProps) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">
          {title}
        </span>
        <Icon
          className={`size-4 ${
            variant === "error"
              ? "text-red-500"
              : variant === "warning"
              ? "text-yellow-500"
              : "text-muted-foreground"
          }`}
        />
      </div>
      <div className="mt-2">
        <span className="text-2xl font-bold">{value}</span>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </div>
    </div>
  );
}

function EventItem({ event }: { event: RecentEvent }) {
  const isWarning = event.event_type === "Warning";

  return (
    <div
      className={`flex items-start gap-3 p-3 rounded-md ${
        isWarning ? "bg-yellow-500/10" : "bg-muted/50"
      }`}
    >
      <div
        className={`mt-0.5 size-2 rounded-full shrink-0 ${
          isWarning ? "bg-yellow-500" : "bg-blue-500"
        }`}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">
            {event.involved_kind}/{event.involved_name}
          </span>
          <span className="text-xs text-muted-foreground">
            {event.cluster_name}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">
          {event.reason}: {event.message}
        </p>
      </div>
      <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
        <Clock className="size-3" />
        {formatDistanceToNow(event.created_at)}
      </div>
    </div>
  );
}
