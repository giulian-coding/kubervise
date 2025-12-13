"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import {
  LayoutDashboard,
  Server,
  Box,
  Layers,
  Network,
  Database,
  Shield,
  Settings,
  Bell,
  Activity,
  HardDrive,
  Container,
  GitBranch,
  FileText,
  Users,
  ChevronRight,
  Gauge,
  Plus,
  Lock,
  type LucideIcon,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarFooter,
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/sidebar";
import { NavUser } from "./nav-user";
import { TeamSwitcher } from "./team-switcher";
import { type Permission, PERMISSIONS, hasPermission, ROLE_DISPLAY_NAMES } from "@/lib/rbac";
import type { TeamRoleType } from "@/lib/types/database";
import { cn } from "@/lib/utils";

// Controlled collapsible wrapper to avoid Base UI warning
function ControlledCollapsible({
  children,
  initialOpen = false,
  itemKey,
}: {
  children: React.ReactNode;
  initialOpen: boolean;
  itemKey: string;
}) {
  const [isOpen, setIsOpen] = useState(initialOpen);

  // Update open state when route changes and item becomes active
  useEffect(() => {
    if (initialOpen && !isOpen) {
      setIsOpen(true);
    }
  }, [initialOpen]);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      {children}
    </Collapsible>
  );
}

interface SubNavItem {
  title: string;
  url: string;
  icon?: LucideIcon;
  permission?: Permission;
}

interface NavItem {
  title: string;
  url: string;
  icon: LucideIcon;
  isActive?: boolean;
  items?: SubNavItem[];
  permission?: Permission;
}

// Grouped navigation structure with permissions
const navigationGroups: { label: string; items: NavItem[]; permission?: Permission }[] = [
  {
    label: "Overview",
    items: [
      {
        title: "Dashboard",
        url: "/dashboard",
        icon: LayoutDashboard,
        permission: PERMISSIONS.MONITORING_VIEW,
      },
      {
        title: "Clusters",
        url: "/dashboard/clusters",
        icon: Server,
        permission: PERMISSIONS.CLUSTER_VIEW,
        items: [
          { title: "All Clusters", url: "/dashboard/clusters", permission: PERMISSIONS.CLUSTER_VIEW },
          { title: "Add Cluster", url: "/dashboard/clusters/add", icon: Plus, permission: PERMISSIONS.CLUSTER_CREATE },
        ],
      },
    ],
  },
  {
    label: "Workloads",
    permission: PERMISSIONS.WORKLOAD_VIEW,
    items: [
      {
        title: "Workloads",
        url: "/dashboard/workloads",
        icon: Box,
        permission: PERMISSIONS.WORKLOAD_VIEW,
        items: [
          { title: "Pods", url: "/dashboard/pods", icon: Box, permission: PERMISSIONS.POD_VIEW },
          { title: "Deployments", url: "/dashboard/deployments", icon: Layers, permission: PERMISSIONS.WORKLOAD_VIEW },
          { title: "StatefulSets", url: "/dashboard/statefulsets", icon: Database, permission: PERMISSIONS.WORKLOAD_VIEW },
          { title: "DaemonSets", url: "/dashboard/daemonsets", icon: Container, permission: PERMISSIONS.WORKLOAD_VIEW },
          { title: "Jobs", url: "/dashboard/jobs", icon: GitBranch, permission: PERMISSIONS.WORKLOAD_VIEW },
        ],
      },
      {
        title: "Networking",
        url: "/dashboard/networking",
        icon: Network,
        permission: PERMISSIONS.WORKLOAD_VIEW,
        items: [
          { title: "Services", url: "/dashboard/services", icon: Network, permission: PERMISSIONS.WORKLOAD_VIEW },
          { title: "Ingresses", url: "/dashboard/ingresses", icon: Network, permission: PERMISSIONS.WORKLOAD_VIEW },
        ],
      },
    ],
  },
  {
    label: "Infrastructure",
    permission: PERMISSIONS.CLUSTER_VIEW,
    items: [
      {
        title: "Nodes",
        url: "/dashboard/nodes",
        icon: HardDrive,
        permission: PERMISSIONS.CLUSTER_VIEW,
      },
      {
        title: "Namespaces",
        url: "/dashboard/namespaces",
        icon: Layers,
        permission: PERMISSIONS.CLUSTER_VIEW,
      },
      {
        title: "Config",
        url: "/dashboard/config",
        icon: FileText,
        permission: PERMISSIONS.CLUSTER_VIEW,
        items: [
          { title: "ConfigMaps", url: "/dashboard/configmaps", icon: FileText, permission: PERMISSIONS.CLUSTER_VIEW },
          { title: "Secrets", url: "/dashboard/secrets", icon: Shield, permission: PERMISSIONS.CLUSTER_VIEW },
        ],
      },
    ],
  },
  {
    label: "Observability",
    items: [
      {
        title: "Monitoring",
        url: "/dashboard/monitoring",
        icon: Gauge,
        permission: PERMISSIONS.MONITORING_VIEW,
        items: [
          { title: "Metrics", url: "/dashboard/metrics", icon: Gauge, permission: PERMISSIONS.MONITORING_VIEW },
          { title: "Logs", url: "/dashboard/logs", icon: FileText, permission: PERMISSIONS.POD_LOGS },
          { title: "Events", url: "/dashboard/events", icon: Activity, permission: PERMISSIONS.MONITORING_VIEW },
        ],
      },
      {
        title: "Alerts",
        url: "/dashboard/alerts",
        icon: Bell,
        permission: PERMISSIONS.MONITORING_ALERTS,
      },
    ],
  },
  {
    label: "Admin",
    permission: PERMISSIONS.TEAM_VIEW,
    items: [
      {
        title: "Access Control",
        url: "/dashboard/rbac",
        icon: Users,
        permission: PERMISSIONS.TEAM_CHANGE_ROLES,
      },
      {
        title: "Settings",
        url: "/dashboard/settings",
        icon: Settings,
        permission: PERMISSIONS.SETTINGS_VIEW,
      },
    ],
  },
];

interface NavSectionProps {
  label: string;
  items: NavItem[];
  userRole: TeamRoleType;
  groupPermission?: Permission;
}

function NavSection({ label, items, userRole, groupPermission }: NavSectionProps) {
  const pathname = usePathname();

  // Check if user can see this section at all
  const canSeeGroup = !groupPermission || hasPermission(userRole, groupPermission);

  // Filter items based on permissions (but still show disabled items)
  const visibleItems = items.filter((item) => {
    // Show all items, but some will be disabled
    return true;
  });

  if (visibleItems.length === 0) return null;

  const handleDisabledClick = (e: React.MouseEvent, itemTitle: string) => {
    e.preventDefault();
    e.stopPropagation();
    toast.error("Permission Denied", {
      description: `You don't have permission to access ${itemTitle}. Your role: ${ROLE_DISPLAY_NAMES[userRole]}`,
    });
  };

  return (
    <SidebarGroup className={cn(!canSeeGroup && "opacity-50")}>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {visibleItems.map((item) => {
            const canAccess = !item.permission || hasPermission(userRole, item.permission);
            // Special handling for exact match on /dashboard (don't match /dashboard/*)
            const isExactDashboard = item.url === "/dashboard";
            const isActive = isExactDashboard
              ? pathname === "/dashboard"
              : pathname === item.url ||
                pathname.startsWith(item.url + "/") ||
                item.items?.some((sub) => pathname === sub.url || pathname.startsWith(sub.url + "/"));

            if (item.items) {
              return (
                <ControlledCollapsible key={item.title} initialOpen={isActive ?? false} itemKey={item.title}>
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton
                        tooltip={item.title}
                        isActive={isActive}
                        className={cn(!canAccess && "opacity-50")}
                      >
                        <item.icon />
                        <span>{item.title}</span>
                        {!canAccess && <Lock className="ml-auto size-3 text-muted-foreground" />}
                        {canAccess && (
                          <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                        )}
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {item.items.map((subItem) => {
                          const SubIcon = subItem.icon;
                          const canAccessSub = !subItem.permission || hasPermission(userRole, subItem.permission);
                          const isSubActive = pathname === subItem.url || pathname.startsWith(subItem.url + "/");

                          if (!canAccessSub) {
                            return (
                              <SidebarMenuSubItem key={subItem.title}>
                                <SidebarMenuSubButton
                                  className="opacity-40 cursor-not-allowed"
                                  onClick={(e) => handleDisabledClick(e, subItem.title)}
                                >
                                  {SubIcon && <SubIcon className="size-4" />}
                                  <span>{subItem.title}</span>
                                  <Lock className="ml-auto size-3" />
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            );
                          }

                          return (
                            <SidebarMenuSubItem key={subItem.title}>
                              <SidebarMenuSubButton asChild isActive={isSubActive}>
                                <Link href={subItem.url}>
                                  {SubIcon && <SubIcon className="size-4" />}
                                  <span>{subItem.title}</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          );
                        })}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </ControlledCollapsible>
              );
            }

            if (!canAccess) {
              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    tooltip={item.title}
                    className="opacity-40 cursor-not-allowed"
                    onClick={(e) => handleDisabledClick(e, item.title)}
                  >
                    <item.icon />
                    <span>{item.title}</span>
                    <Lock className="ml-auto size-3" />
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            }

            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
                  <Link href={item.url}>
                    <item.icon />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

import type { Team } from "@/lib/actions/team";

interface AppSidebarProps {
  user: {
    email: string;
    id: string;
  };
  teams: Team[];
  userRole: TeamRoleType;
}

export function AppSidebar({ user, teams, userRole }: AppSidebarProps) {
  return (
    <Sidebar>
      <SidebarHeader>
        <TeamSwitcher teams={teams} />
      </SidebarHeader>

      <SidebarContent>
        {navigationGroups.map((group) => (
          <NavSection
            key={group.label}
            label={group.label}
            items={group.items}
            userRole={userRole}
            groupPermission={group.permission}
          />
        ))}
      </SidebarContent>

      <SidebarFooter>
        <NavUser user={user} userRole={userRole} />
      </SidebarFooter>
    </Sidebar>
  );
}
