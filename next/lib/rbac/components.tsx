"use client";

import { type ReactNode, type ReactElement, cloneElement, isValidElement } from "react";
import { toast } from "sonner";
import { useRBAC } from "./context";
import type { Permission } from "./permissions";
import { cn } from "@/lib/utils";

interface PermissionGateProps {
  permission: Permission | Permission[];
  mode?: "any" | "all";
  children: ReactNode;
  fallback?: ReactNode;
}

// Conditionally render children based on permission
export function PermissionGate({
  permission,
  mode = "any",
  children,
  fallback = null,
}: PermissionGateProps) {
  const { can, canAny, canAll } = useRBAC();

  const permissions = Array.isArray(permission) ? permission : [permission];
  const hasAccess = mode === "all" ? canAll(permissions) : canAny(permissions);

  if (!hasAccess) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

interface PermissionButtonProps {
  permission: Permission | Permission[];
  mode?: "any" | "all";
  children: ReactElement<Record<string, unknown>>;
  disabledClassName?: string;
  showToast?: boolean;
  toastMessage?: string;
}

// Wrap a button to disable and show toast on click if no permission
export function PermissionButton({
  permission,
  mode = "any",
  children,
  disabledClassName = "opacity-50 cursor-not-allowed",
  showToast = true,
  toastMessage = "You don't have permission to perform this action",
}: PermissionButtonProps) {
  const { can, canAny, canAll, roleName } = useRBAC();

  const permissions = Array.isArray(permission) ? permission : [permission];
  const hasAccess = mode === "all" ? canAll(permissions) : canAny(permissions);

  if (!isValidElement(children)) {
    return children;
  }

  if (hasAccess) {
    return children;
  }

  // Clone the element and override props for disabled state
  return cloneElement(children, {
    ...children.props,
    className: cn(children.props.className as string | undefined, disabledClassName),
    onClick: (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (showToast) {
        toast.error("Permission Denied", {
          description: `${toastMessage}. Your role: ${roleName}`,
        });
      }
    },
    "aria-disabled": true,
    disabled: true,
  });
}

interface PermissionLinkProps {
  permission: Permission | Permission[];
  mode?: "any" | "all";
  children: ReactElement<Record<string, unknown>>;
  disabledClassName?: string;
}

// Wrap a link to disable and grey out if no permission
export function PermissionLink({
  permission,
  mode = "any",
  children,
  disabledClassName = "opacity-40 pointer-events-none",
}: PermissionLinkProps) {
  const { canAny, canAll } = useRBAC();

  const permissions = Array.isArray(permission) ? permission : [permission];
  const hasAccess = mode === "all" ? canAll(permissions) : canAny(permissions);

  if (!isValidElement(children)) {
    return children;
  }

  if (hasAccess) {
    return children;
  }

  return cloneElement(children, {
    ...children.props,
    className: cn(children.props.className as string | undefined, disabledClassName),
    onClick: (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
    },
    href: undefined,
    "aria-disabled": true,
  });
}

// Higher-order component for permission checking
export function withPermission<P extends object>(
  Component: React.ComponentType<P>,
  permission: Permission | Permission[],
  mode: "any" | "all" = "any"
) {
  return function PermissionWrappedComponent(props: P) {
    return (
      <PermissionGate permission={permission} mode={mode}>
        <Component {...props} />
      </PermissionGate>
    );
  };
}
