"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { TeamRoleType } from "@/lib/types/database";
import {
  type Permission,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  getRolePermissions,
  ROLE_DISPLAY_NAMES,
} from "./permissions";

interface RBACContextValue {
  role: TeamRoleType;
  roleName: string;
  permissions: Permission[];
  can: (permission: Permission) => boolean;
  canAny: (permissions: Permission[]) => boolean;
  canAll: (permissions: Permission[]) => boolean;
  isOwner: boolean;
  isAdmin: boolean;
  isContributor: boolean;
  isViewer: boolean;
}

const RBACContext = createContext<RBACContextValue | null>(null);

interface RBACProviderProps {
  role: TeamRoleType;
  children: ReactNode;
}

export function RBACProvider({ role, children }: RBACProviderProps) {
  const value = useMemo<RBACContextValue>(
    () => ({
      role,
      roleName: ROLE_DISPLAY_NAMES[role],
      permissions: getRolePermissions(role),
      can: (permission: Permission) => hasPermission(role, permission),
      canAny: (permissions: Permission[]) => hasAnyPermission(role, permissions),
      canAll: (permissions: Permission[]) => hasAllPermissions(role, permissions),
      isOwner: role === "owner",
      isAdmin: role === "admin" || role === "owner",
      isContributor: role === "contributor" || role === "admin" || role === "owner",
      isViewer: role === "viewer",
    }),
    [role]
  );

  return <RBACContext.Provider value={value}>{children}</RBACContext.Provider>;
}

export function useRBAC(): RBACContextValue {
  const context = useContext(RBACContext);
  if (!context) {
    throw new Error("useRBAC must be used within an RBACProvider");
  }
  return context;
}

// Convenience hook for checking a single permission
export function usePermission(permission: Permission): boolean {
  const { can } = useRBAC();
  return can(permission);
}

// Convenience hook for checking multiple permissions (any)
export function useAnyPermission(permissions: Permission[]): boolean {
  const { canAny } = useRBAC();
  return canAny(permissions);
}

// Convenience hook for checking multiple permissions (all)
export function useAllPermissions(permissions: Permission[]): boolean {
  const { canAll } = useRBAC();
  return canAll(permissions);
}
