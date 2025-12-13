"use client";

import { cn } from "@/lib/utils";
import type { PodPhase } from "@/lib/types/kubernetes";

interface PodStatusBadgeProps {
  status: PodPhase;
  className?: string;
}

export function PodStatusBadge({ status, className }: PodStatusBadgeProps) {
  const statusConfig: Record<PodPhase, { label: string; className: string }> = {
    Running: {
      label: "Running",
      className: "bg-green-500/10 text-green-600 dark:text-green-400",
    },
    Pending: {
      label: "Pending",
      className: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
    },
    Succeeded: {
      label: "Succeeded",
      className: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    },
    Failed: {
      label: "Failed",
      className: "bg-red-500/10 text-red-600 dark:text-red-400",
    },
    Unknown: {
      label: "Unknown",
      className: "bg-gray-500/10 text-gray-600 dark:text-gray-400",
    },
  };

  const config = statusConfig[status];

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}
