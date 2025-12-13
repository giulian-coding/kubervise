"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  RefreshCw,
  AlertTriangle,
  Info,
  Clock,
  Search,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { PERMISSIONS } from "@/lib/rbac";
import { useCluster } from "@/lib/context/cluster-context";
import { formatDistanceToNow } from "@/lib/utils/date";
import type { ClusterEvent } from "@/lib/types/database";

export default function EventsPage() {
  const [events, setEvents] = useState<(ClusterEvent & { cluster_name?: string })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const { selectedClusterId, selectedCluster, isAllClustersView } = useCluster();

  const fetchEvents = async () => {
    const supabase = createClient();

    let query = supabase
      .from("cluster_events")
      .select("*, clusters(name)")
      .order("created_at", { ascending: false })
      .limit(100);

    // Filter by cluster if one is selected
    if (selectedClusterId) {
      query = query.eq("cluster_id", selectedClusterId);
    }

    const { data, error } = await query;

    if (!error && data) {
      setEvents(
        data.map((e) => ({
          ...e,
          cluster_name: (e as any).clusters?.name,
        }))
      );
    }
    setIsLoading(false);
    setIsRefreshing(false);
  };

  useEffect(() => {
    setIsLoading(true);
    fetchEvents();

    const supabase = createClient();
    const channel = supabase
      .channel("events-page")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "cluster_events" },
        () => fetchEvents()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedClusterId]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchEvents();
  };

  const filteredEvents = events.filter((event) => {
    const matchesSearch =
      !searchQuery ||
      event.message?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.involved_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.reason?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType = typeFilter === "all" || event.event_type === typeFilter;

    return matchesSearch && matchesType;
  });

  const warningCount = events.filter((e) => e.event_type === "Warning").length;

  const pageDescription = selectedCluster
    ? `Events in cluster "${selectedCluster.name}"`
    : "Kubernetes events from your clusters";

  return (
    <ProtectedPage permission={PERMISSIONS.MONITORING_VIEW}>
      <PageHeader
        title="Events"
        description={pageDescription}
        icon={Activity}
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

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">
              Total Events
            </span>
            <Activity className="size-4 text-muted-foreground" />
          </div>
          <p className="text-2xl font-bold mt-2">{events.length}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">
              Warnings
            </span>
            <AlertTriangle className="size-4 text-yellow-500" />
          </div>
          <p className="text-2xl font-bold mt-2">{warningCount}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">
              Normal Events
            </span>
            <Info className="size-4 text-blue-500" />
          </div>
          <p className="text-2xl font-bold mt-2">{events.length - warningCount}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search events..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <Select value={typeFilter} onValueChange={(v) => v && setTypeFilter(v)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Event type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="Normal">Normal</SelectItem>
            <SelectItem value="Warning">Warning</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Events List */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[300px] rounded-lg border bg-card">
          <Activity className="size-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">No events found</h2>
          <p className="text-muted-foreground">
            {events.length > 0
              ? "Try adjusting your filters"
              : selectedCluster
              ? `No events in cluster "${selectedCluster.name}"`
              : "Events will appear here once clusters are connected"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredEvents.map((event) => (
            <div
              key={event.id}
              className={`rounded-lg border p-4 ${
                event.event_type === "Warning"
                  ? "border-yellow-500/30 bg-yellow-500/5"
                  : "bg-card"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-1 p-1.5 rounded-full ${
                      event.event_type === "Warning"
                        ? "bg-yellow-500/20"
                        : "bg-blue-500/20"
                    }`}
                  >
                    {event.event_type === "Warning" ? (
                      <AlertTriangle className="size-4 text-yellow-500" />
                    ) : (
                      <Info className="size-4 text-blue-500" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={event.event_type === "Warning" ? "secondary" : "outline"}>
                        {event.reason}
                      </Badge>
                      <span className="text-sm font-medium">
                        {event.involved_kind}/{event.involved_name}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{event.message}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      {isAllClustersView && <span>{event.cluster_name}</span>}
                      <span>{event.involved_namespace}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
                  <Clock className="size-3" />
                  {formatDistanceToNow(event.created_at)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </ProtectedPage>
  );
}
