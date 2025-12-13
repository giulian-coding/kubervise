"use client";

import * as React from "react";
import { ChevronsUpDown, Plus, Gauge, Check } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import type { Team } from "@/lib/actions/team";

interface TeamSwitcherProps {
  teams: Team[];
}

function getRoleBadge(role: Team["role"]): string {
  switch (role) {
    case "owner":
      return "Owner";
    case "admin":
      return "Admin";
    case "contributor":
      return "Contributor";
    case "viewer":
      return "Viewer";
    default:
      return role;
  }
}

export function TeamSwitcher({ teams }: TeamSwitcherProps) {
  const { state } = useSidebar();
  const [activeTeam, setActiveTeam] = React.useState<Team | null>(
    teams.length > 0 ? teams[0] : null
  );

  if (!activeTeam) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" disabled>
            <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-muted">
              <Gauge className="size-4" />
            </div>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-semibold text-muted-foreground">
                No team
              </span>
              <span className="truncate text-xs text-muted-foreground">
                Create a team to get started
              </span>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Gauge className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">
                  {activeTeam.team_name}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {getRoleBadge(activeTeam.role)}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--trigger-width] min-w-56 rounded-lg"
            align="start"
            side={state === "collapsed" ? "right" : "bottom"}
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Your Teams
              </DropdownMenuLabel>
              {teams.map((team) => (
                <DropdownMenuItem
                  key={team.team_id}
                  onClick={() => setActiveTeam(team)}
                  className="gap-2 p-2"
                >
                  <div className="flex size-6 items-center justify-center rounded-sm border">
                    <Gauge className="size-4 shrink-0" />
                  </div>
                  <span className="flex-1 truncate">{team.team_name}</span>
                  {team.team_id === activeTeam.team_id && (
                    <Check className="size-4 text-primary" />
                  )}
                  <span className="text-xs text-muted-foreground">
                    {getRoleBadge(team.role)}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 p-2">
              <div className="flex size-6 items-center justify-center rounded-md border bg-background">
                <Plus className="size-4" />
              </div>
              <span className="text-muted-foreground">Create new team</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
