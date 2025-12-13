"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  FileText,
  RefreshCw,
  Download,
  Search,
  Filter,
  ChevronDown,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/dashboard/page-header";
import { ProtectedPage } from "@/components/dashboard/protected-page";
import { PERMISSIONS } from "@/lib/rbac";

interface LogEntry {
  timestamp: string;
  level: "info" | "warn" | "error" | "debug";
  pod: string;
  container: string;
  message: string;
}

export default function LogsPage() {
  const searchParams = useSearchParams();
  const podId = searchParams.get("pod");

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCluster, setSelectedCluster] = useState<string>("all");
  const [selectedLevels, setSelectedLevels] = useState<string[]>(["info", "warn", "error"]);
  const [clusters, setClusters] = useState<{ id: string; name: string }[]>([]);

  const fetchLogs = async () => {
    const supabase = createClient();

    // Fetch clusters for filter
    const { data: clusterData } = await supabase.from("clusters").select("id, name");
    if (clusterData) setClusters(clusterData);

    // Simulated log data
    const mockLogs: LogEntry[] = [
      {
        timestamp: new Date().toISOString(),
        level: "info",
        pod: "frontend-7d9f8b6c4-abc12",
        container: "nginx",
        message: "Starting nginx server on port 8080",
      },
      {
        timestamp: new Date(Date.now() - 1000).toISOString(),
        level: "info",
        pod: "api-gateway-5c8d7b6a9-def34",
        container: "api",
        message: "Connected to database successfully",
      },
      {
        timestamp: new Date(Date.now() - 2000).toISOString(),
        level: "warn",
        pod: "worker-6b7c8d9e0-ghi56",
        container: "worker",
        message: "High memory usage detected: 85%",
      },
      {
        timestamp: new Date(Date.now() - 3000).toISOString(),
        level: "error",
        pod: "backend-4a5b6c7d8-jkl78",
        container: "app",
        message: "Failed to connect to redis: connection refused",
      },
      {
        timestamp: new Date(Date.now() - 4000).toISOString(),
        level: "info",
        pod: "frontend-7d9f8b6c4-abc12",
        container: "nginx",
        message: "Health check passed",
      },
      {
        timestamp: new Date(Date.now() - 5000).toISOString(),
        level: "debug",
        pod: "api-gateway-5c8d7b6a9-def34",
        container: "api",
        message: "Processing request GET /api/users",
      },
      {
        timestamp: new Date(Date.now() - 6000).toISOString(),
        level: "info",
        pod: "scheduler-3d4e5f6g7-mno90",
        container: "scheduler",
        message: "Job batch-process-123 completed successfully",
      },
      {
        timestamp: new Date(Date.now() - 7000).toISOString(),
        level: "warn",
        pod: "backend-4a5b6c7d8-jkl78",
        container: "app",
        message: "Slow query detected: 2.3s",
      },
      {
        timestamp: new Date(Date.now() - 8000).toISOString(),
        level: "error",
        pod: "worker-6b7c8d9e0-ghi56",
        container: "worker",
        message: "Task processing failed: timeout after 30s",
      },
      {
        timestamp: new Date(Date.now() - 9000).toISOString(),
        level: "info",
        pod: "frontend-7d9f8b6c4-abc12",
        container: "nginx",
        message: "Request completed: 200 OK",
      },
    ];

    setLogs(mockLogs);
    setIsLoading(false);
    setIsRefreshing(false);
  };

  useEffect(() => {
    fetchLogs();

    // Auto-refresh every 5 seconds
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchLogs();
  };

  const handleDownload = () => {
    const logText = filteredLogs
      .map((log) => `${log.timestamp} [${log.level.toUpperCase()}] ${log.pod}/${log.container}: ${log.message}`)
      .join("\n");

    const blob = new Blob([logText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `logs-${new Date().toISOString()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      !searchQuery ||
      log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.pod.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesLevel = selectedLevels.includes(log.level);
    return matchesSearch && matchesLevel;
  });

  const getLevelColor = (level: LogEntry["level"]) => {
    switch (level) {
      case "error":
        return "text-red-500";
      case "warn":
        return "text-yellow-500";
      case "info":
        return "text-blue-500";
      case "debug":
        return "text-gray-500";
    }
  };

  const toggleLevel = (level: string) => {
    setSelectedLevels((prev) =>
      prev.includes(level) ? prev.filter((l) => l !== level) : [...prev, level]
    );
  };

  return (
    <ProtectedPage permission={PERMISSIONS.POD_LOGS}>
      <PageHeader
        title="Logs"
        description="View container logs from your pods"
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
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download className="size-4 mr-2" />
              Download
            </Button>
          </div>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search logs..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <Select value={selectedCluster} onValueChange={(v) => v && setSelectedCluster(v)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select cluster" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Clusters</SelectItem>
            {clusters.map((cluster) => (
              <SelectItem key={cluster.id} value={cluster.id}>
                {cluster.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="default">
              <Filter className="size-4 mr-2" />
              Log Levels
              <ChevronDown className="size-4 ml-2" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuCheckboxItem
              checked={selectedLevels.includes("error")}
              onCheckedChange={() => toggleLevel("error")}
            >
              <span className="text-red-500 mr-2">ERROR</span>
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={selectedLevels.includes("warn")}
              onCheckedChange={() => toggleLevel("warn")}
            >
              <span className="text-yellow-500 mr-2">WARN</span>
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={selectedLevels.includes("info")}
              onCheckedChange={() => toggleLevel("info")}
            >
              <span className="text-blue-500 mr-2">INFO</span>
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={selectedLevels.includes("debug")}
              onCheckedChange={() => toggleLevel("debug")}
            >
              <span className="text-gray-500 mr-2">DEBUG</span>
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Log viewer */}
      {isLoading ? (
        <div className="rounded-lg border bg-card p-4">
          <div className="space-y-2">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="h-6 bg-muted rounded animate-pulse" />
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="bg-muted/50 px-4 py-2 border-b">
            <span className="text-sm text-muted-foreground">
              Showing {filteredLogs.length} log entries
            </span>
          </div>
          <div className="font-mono text-sm max-h-[600px] overflow-auto">
            {filteredLogs.length > 0 ? (
              filteredLogs.map((log, index) => (
                <div
                  key={index}
                  className="px-4 py-2 hover:bg-muted/50 border-b last:border-b-0"
                >
                  <div className="flex items-start gap-4">
                    <span className="text-muted-foreground text-xs whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    <span
                      className={`text-xs font-semibold uppercase w-12 ${getLevelColor(
                        log.level
                      )}`}
                    >
                      {log.level}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {log.pod}/{log.container}
                    </span>
                    <span className="flex-1 break-all">{log.message}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex items-center justify-center h-48 text-muted-foreground">
                No logs matching your filters
              </div>
            )}
          </div>
        </div>
      )}
    </ProtectedPage>
  );
}
