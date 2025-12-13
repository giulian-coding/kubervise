"use client";

import { formatDistanceToNow } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { ClusterEvent } from "@/lib/types/kubernetes";

interface EventsListProps {
  events: ClusterEvent[];
  className?: string;
}

export function EventsList({ events, className }: EventsListProps) {
  if (events.length === 0) {
    return (
      <div className={cn("text-center py-8 text-muted-foreground", className)}>
        No recent events
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {events.map((event) => (
        <div
          key={event.id}
          className={cn(
            "flex items-start gap-3 rounded-lg border p-3 text-sm",
            event.event_type === "Warning"
              ? "border-yellow-500/20 bg-yellow-500/5"
              : "border-border bg-card"
          )}
        >
          <div
            className={cn(
              "mt-0.5 h-2 w-2 rounded-full shrink-0",
              event.event_type === "Warning" ? "bg-yellow-500" : "bg-blue-500"
            )}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium truncate">
                {event.involved_kind}/{event.involved_name}
              </span>
              {event.involved_namespace && (
                <span className="text-xs text-muted-foreground">
                  in {event.involved_namespace}
                </span>
              )}
            </div>
            <p className="text-muted-foreground mt-0.5 line-clamp-2">
              {event.reason}: {event.message}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {event.created_at && formatDistanceToNow(new Date(event.created_at))}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
