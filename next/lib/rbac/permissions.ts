import type { TeamRoleType } from "@/lib/types/database";

// All available permissions in the system
export const PERMISSIONS = {
  // Cluster management
  CLUSTER_VIEW: "cluster:view",
  CLUSTER_CREATE: "cluster:create",
  CLUSTER_EDIT: "cluster:edit",
  CLUSTER_DELETE: "cluster:delete",

  // Workload management
  WORKLOAD_VIEW: "workload:view",
  WORKLOAD_CREATE: "workload:create",
  WORKLOAD_EDIT: "workload:edit",
  WORKLOAD_DELETE: "workload:delete",
  WORKLOAD_SCALE: "workload:scale",
  WORKLOAD_RESTART: "workload:restart",

  // Pod management
  POD_VIEW: "pod:view",
  POD_LOGS: "pod:logs",
  POD_EXEC: "pod:exec",
  POD_DELETE: "pod:delete",

  // Monitoring
  MONITORING_VIEW: "monitoring:view",
  MONITORING_ALERTS: "monitoring:alerts",

  // Team management
  TEAM_VIEW: "team:view",
  TEAM_EDIT: "team:edit",
  TEAM_INVITE: "team:invite",
  TEAM_REMOVE_MEMBER: "team:remove_member",
  TEAM_CHANGE_ROLES: "team:change_roles",

  // Settings
  SETTINGS_VIEW: "settings:view",
  SETTINGS_EDIT: "settings:edit",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

// Role permission mappings
export const ROLE_PERMISSIONS: Record<TeamRoleType, Permission[]> = {
  owner: Object.values(PERMISSIONS), // Owner has all permissions

  admin: [
    // Cluster management
    PERMISSIONS.CLUSTER_VIEW,
    PERMISSIONS.CLUSTER_CREATE,
    PERMISSIONS.CLUSTER_EDIT,
    PERMISSIONS.CLUSTER_DELETE,

    // Workload management
    PERMISSIONS.WORKLOAD_VIEW,
    PERMISSIONS.WORKLOAD_CREATE,
    PERMISSIONS.WORKLOAD_EDIT,
    PERMISSIONS.WORKLOAD_DELETE,
    PERMISSIONS.WORKLOAD_SCALE,
    PERMISSIONS.WORKLOAD_RESTART,

    // Pod management
    PERMISSIONS.POD_VIEW,
    PERMISSIONS.POD_LOGS,
    PERMISSIONS.POD_EXEC,
    PERMISSIONS.POD_DELETE,

    // Monitoring
    PERMISSIONS.MONITORING_VIEW,
    PERMISSIONS.MONITORING_ALERTS,

    // Team management (limited)
    PERMISSIONS.TEAM_VIEW,
    PERMISSIONS.TEAM_INVITE,

    // Settings
    PERMISSIONS.SETTINGS_VIEW,
    PERMISSIONS.SETTINGS_EDIT,
  ],

  contributor: [
    // Cluster management (read-only + edit)
    PERMISSIONS.CLUSTER_VIEW,
    PERMISSIONS.CLUSTER_EDIT,

    // Workload management (edit only, no deploy/delete)
    PERMISSIONS.WORKLOAD_VIEW,
    PERMISSIONS.WORKLOAD_EDIT,

    // Pod management (view + logs only)
    PERMISSIONS.POD_VIEW,
    PERMISSIONS.POD_LOGS,

    // Monitoring
    PERMISSIONS.MONITORING_VIEW,
    PERMISSIONS.MONITORING_ALERTS,

    // Team (view only)
    PERMISSIONS.TEAM_VIEW,

    // Settings (view only)
    PERMISSIONS.SETTINGS_VIEW,
  ],

  viewer: [
    // Monitoring only
    PERMISSIONS.MONITORING_VIEW,
    PERMISSIONS.MONITORING_ALERTS,

    // Limited views
    PERMISSIONS.CLUSTER_VIEW,
    PERMISSIONS.POD_VIEW,
    PERMISSIONS.POD_LOGS,
    PERMISSIONS.TEAM_VIEW,
  ],
};

// Check if a role has a specific permission
export function hasPermission(role: TeamRoleType, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

// Check if a role has any of the specified permissions
export function hasAnyPermission(role: TeamRoleType, permissions: Permission[]): boolean {
  return permissions.some((permission) => hasPermission(role, permission));
}

// Check if a role has all of the specified permissions
export function hasAllPermissions(role: TeamRoleType, permissions: Permission[]): boolean {
  return permissions.every((permission) => hasPermission(role, permission));
}

// Get all permissions for a role
export function getRolePermissions(role: TeamRoleType): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

// Role hierarchy for display and comparison
export const ROLE_HIERARCHY: TeamRoleType[] = ["owner", "admin", "contributor", "viewer"];

// Role display names
export const ROLE_DISPLAY_NAMES: Record<TeamRoleType, string> = {
  owner: "Owner",
  admin: "Admin",
  contributor: "Contributor",
  viewer: "Viewer",
};

// Role descriptions
export const ROLE_DESCRIPTIONS: Record<TeamRoleType, string> = {
  owner: "Full access to all features and team management",
  admin: "Manage clusters, workloads, and invite team members",
  contributor: "Edit configurations and view resources (no deploy/delete)",
  viewer: "View monitoring dashboards and logs only",
};
