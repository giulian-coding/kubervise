"use client";

import { cn } from "@/lib/utils";
import type { ClusterConnectionStatus } from "@/lib/types/kubernetes";

interface ClusterStatusBadgeProps {
  status: ClusterConnectionStatus;
  className?: string;
}

export function ClusterStatusBadge({ status, className }: ClusterStatusBadgeProps) {
  const statusConfig = {
    connected: {
      label: "Connected",
      className: "bg-green-500/10 text-green-600 dark:text-green-400",
      dotClassName: "bg-green-500",
    },
    disconnected: {
      label: "Disconnected",
      className: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
      dotClassName: "bg-yellow-500",
    },
    error: {
      label: "Error",
      className: "bg-red-500/10 text-red-600 dark:text-red-400",
      dotClassName: "bg-red-500",
    },
  };

  const config = statusConfig[status];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        config.className,
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", config.dotClassName)} />
      {config.label}
    </span>
  );
}
