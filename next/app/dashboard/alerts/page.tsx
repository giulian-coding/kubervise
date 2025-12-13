"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Bell,
  RefreshCw,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  Clock,
  X,
  Filter,
  Plus,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/dashboard/page-header";
import { ProtectedPage } from "@/components/dashboard/protected-page";
import { PERMISSIONS, PermissionButton, useRBAC } from "@/lib/rbac";
import { formatDistanceToNow } from "@/lib/utils/date";
import { toast } from "sonner";

interface Alert {
  id: string;
  name: string;
  severity: "critical" | "warning" | "info";
  status: "firing" | "pending" | "resolved";
  cluster_id: string;
  cluster_name?: string;
  message: string;
  started_at: string;
  resolved_at?: string;
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { can } = useRBAC();

  const fetchAlerts = async () => {
    const supabase = createClient();
    const { data: clusters } = await supabase.from("clusters").select("id, name");

    // Simulated alerts data
    const mockAlerts: Alert[] = [];
    clusters?.forEach((cluster) => {
      mockAlerts.push(
        {
          id: `alert-${cluster.id}-1`,
          name: "HighMemoryUsage",
          severity: "warning",
          status: "firing",
          cluster_id: cluster.id,
          cluster_name: cluster.name,
          message: "Memory usage is above 85% on worker nodes",
          started_at: new Date(Date.now() - 3600000).toISOString(),
        },
        {
          id: `alert-${cluster.id}-2`,
          name: "PodCrashLooping",
          severity: "critical",
          status: "firing",
          cluster_id: cluster.id,
          cluster_name: cluster.name,
          message: "Pod backend-7d9f8b6c4-xyz99 has restarted 5 times in the last hour",
          started_at: new Date(Date.now() - 1800000).toISOString(),
        },
        {
          id: `alert-${cluster.id}-3`,
          name: "NodeNotReady",
          severity: "critical",
          status: "resolved",
          cluster_id: cluster.id,
          cluster_name: cluster.name,
          message: "Node worker-3 is not ready",
          started_at: new Date(Date.now() - 7200000).toISOString(),
          resolved_at: new Date(Date.now() - 3600000).toISOString(),
        },
        {
          id: `alert-${cluster.id}-4`,
          name: "CertificateExpiring",
          severity: "info",
          status: "pending",
          cluster_id: cluster.id,
          cluster_name: cluster.name,
          message: "TLS certificate for api.example.com expires in 14 days",
          started_at: new Date(Date.now() - 86400000).toISOString(),
        }
      );
    });

    setAlerts(mockAlerts);
    setIsLoading(false);
    setIsRefreshing(false);
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchAlerts();
  };

  const handleAcknowledge = (alertId: string) => {
    toast.success("Alert acknowledged");
  };

  const handleSilence = (alertId: string) => {
    toast.success("Alert silenced for 1 hour");
  };

  const filteredAlerts = alerts.filter((alert) => {
    const matchesSeverity = severityFilter === "all" || alert.severity === severityFilter;
    const matchesStatus = statusFilter === "all" || alert.status === statusFilter;
    return matchesSeverity && matchesStatus;
  });

  const criticalCount = alerts.filter((a) => a.severity === "critical" && a.status === "firing").length;
  const warningCount = alerts.filter((a) => a.severity === "warning" && a.status === "firing").length;
  const firingCount = alerts.filter((a) => a.status === "firing").length;

  const getSeverityIcon = (severity: Alert["severity"]) => {
    switch (severity) {
      case "critical":
        return <AlertCircle className="size-4 text-red-500" />;
      case "warning":
        return <AlertTriangle className="size-4 text-yellow-500" />;
      case "info":
        return <Bell className="size-4 text-blue-500" />;
    }
  };

  const getSeverityBadge = (severity: Alert["severity"]) => {
    const variants: Record<Alert["severity"], "destructive" | "secondary" | "outline"> = {
      critical: "destructive",
      warning: "secondary",
      info: "outline",
    };
    return <Badge variant={variants[severity]}>{severity}</Badge>;
  };

  const getStatusBadge = (status: Alert["status"]) => {
    switch (status) {
      case "firing":
        return (
          <Badge variant="destructive" className="gap-1">
            <span className="size-1.5 rounded-full bg-white animate-pulse" />
            Firing
          </Badge>
        );
      case "pending":
        return <Badge variant="secondary">Pending</Badge>;
      case "resolved":
        return (
          <Badge variant="outline" className="gap-1">
            <CheckCircle className="size-3" />
            Resolved
          </Badge>
        );
    }
  };

  return (
    <ProtectedPage permission={PERMISSIONS.MONITORING_ALERTS}>
      <PageHeader
        title="Alerts"
        description="Monitor and manage alerting rules"
        icon={Bell}
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
              permission={PERMISSIONS.SETTINGS_EDIT}
              toastMessage="You need edit permissions to create alert rules"
            >
              <Button size="sm">
                <Plus className="size-4 mr-2" />
                Create Rule
              </Button>
            </PermissionButton>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Firing</span>
            <Bell className="size-4 text-red-500" />
          </div>
          <p className="text-2xl font-bold mt-2">{firingCount}</p>
        </div>
        <div className="rounded-lg border bg-card p-4 border-red-500/30">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Critical</span>
            <AlertCircle className="size-4 text-red-500" />
          </div>
          <p className="text-2xl font-bold mt-2 text-red-500">{criticalCount}</p>
        </div>
        <div className="rounded-lg border bg-card p-4 border-yellow-500/30">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Warning</span>
            <AlertTriangle className="size-4 text-yellow-500" />
          </div>
          <p className="text-2xl font-bold mt-2 text-yellow-500">{warningCount}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Total Rules</span>
            <Bell className="size-4 text-muted-foreground" />
          </div>
          <p className="text-2xl font-bold mt-2">{alerts.length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <Select value={severityFilter} onValueChange={(v) => v && setSeverityFilter(v)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severities</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
            <SelectItem value="info">Info</SelectItem>
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={(v) => v && setStatusFilter(v)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="firing">Firing</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Alerts List */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      ) : filteredAlerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[300px] rounded-lg border bg-card">
          <Bell className="size-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">No alerts</h2>
          <p className="text-muted-foreground">
            {alerts.length > 0 ? "Try adjusting your filters" : "All systems operational"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`rounded-lg border p-4 ${
                alert.status === "firing"
                  ? alert.severity === "critical"
                    ? "border-red-500/30 bg-red-500/5"
                    : "border-yellow-500/30 bg-yellow-500/5"
                  : "bg-card"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">{getSeverityIcon(alert.severity)}</div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold">{alert.name}</span>
                      {getSeverityBadge(alert.severity)}
                      {getStatusBadge(alert.status)}
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      {alert.message}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{alert.cluster_name}</span>
                      <div className="flex items-center gap-1">
                        <Clock className="size-3" />
                        Started {formatDistanceToNow(alert.started_at)}
                      </div>
                      {alert.resolved_at && (
                        <div className="flex items-center gap-1">
                          <CheckCircle className="size-3" />
                          Resolved {formatDistanceToNow(alert.resolved_at)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {alert.status === "firing" && can(PERMISSIONS.MONITORING_ALERTS) && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAcknowledge(alert.id)}
                    >
                      Acknowledge
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSilence(alert.id)}
                    >
                      <X className="size-4 mr-1" />
                      Silence
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </ProtectedPage>
  );
}
