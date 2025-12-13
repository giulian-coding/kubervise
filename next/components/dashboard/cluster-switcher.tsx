"use client";

import { ChevronsUpDown, Server, Check, Plus, Circle, Layers } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useCluster, type Cluster } from "@/lib/context/cluster-context";
import Link from "next/link";

export function ClusterSwitcher() {
  const {
    clusters,
    selectedCluster,
    isAllClustersView,
    setSelectedCluster,
    selectAllClusters,
    isLoading,
  } = useCluster();

  const getStatusColor = (status: Cluster["connection_status"]) => {
    switch (status) {
      case "connected":
        return "text-green-500";
      case "disconnected":
        return "text-yellow-500";
      case "error":
        return "text-red-500";
      default:
        return "text-muted-foreground";
    }
  };

  const getStatusDot = (status: Cluster["connection_status"]) => {
    switch (status) {
      case "connected":
        return "bg-green-500";
      case "disconnected":
        return "bg-yellow-500";
      case "error":
        return "bg-red-500";
      default:
        return "bg-muted-foreground";
    }
  };

  if (isLoading) {
    return (
      <Button variant="outline" className="gap-2 min-w-[200px] justify-between" disabled>
        <div className="flex items-center gap-2">
          <Server className="size-4" />
          <span className="text-muted-foreground">Loading...</span>
        </div>
        <ChevronsUpDown className="size-4 opacity-50" />
      </Button>
    );
  }

  if (clusters.length === 0) {
    return (
      <Link href="/dashboard/clusters/add">
        <Button variant="outline" size="sm" className="gap-2">
          <Plus className="size-4" />
          Add Cluster
        </Button>
      </Link>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2 min-w-[200px] justify-between">
          <div className="flex items-center gap-2">
            {isAllClustersView ? (
              <>
                <Layers className="size-4" />
                <span>All Clusters</span>
              </>
            ) : (
              <>
                <Server className="size-4" />
                <span className="truncate max-w-[120px]">
                  {selectedCluster?.name || "Select Cluster"}
                </span>
                {selectedCluster && (
                  <Circle
                    className={`size-2 fill-current ${getStatusColor(selectedCluster.connection_status)}`}
                  />
                )}
              </>
            )}
          </div>
          <ChevronsUpDown className="size-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[240px]">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Clusters</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />

        {/* All Clusters Option */}
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={selectAllClusters} className="cursor-pointer">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <Layers className="size-4" />
                <span>All Clusters</span>
              </div>
              {isAllClustersView && <Check className="size-4" />}
            </div>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        {/* Individual Clusters */}
        <DropdownMenuGroup>
          {clusters.map((cluster) => (
            <DropdownMenuItem
              key={cluster.id}
              onClick={() => setSelectedCluster(cluster)}
              className="cursor-pointer"
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <div className={`size-2 rounded-full ${getStatusDot(cluster.connection_status)}`} />
                  <span className="truncate">{cluster.name}</span>
                </div>
                {!isAllClustersView && selectedCluster?.id === cluster.id && (
                  <Check className="size-4" />
                )}
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link href="/dashboard/clusters/add" className="cursor-pointer">
              <Plus className="size-4 mr-2" />
              Add Cluster
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
