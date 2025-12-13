"use client";

import { type ReactNode } from "react";
import { Shield, Lock } from "lucide-react";
import { useRBAC, type Permission, ROLE_DISPLAY_NAMES } from "@/lib/rbac";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface ProtectedPageProps {
  children: ReactNode;
  permission: Permission | Permission[];
  mode?: "any" | "all";
  title?: string;
  description?: string;
}

export function ProtectedPage({
  children,
  permission,
  mode = "any",
  title = "Access Denied",
  description = "You don't have permission to view this page.",
}: ProtectedPageProps) {
  const { can, canAny, canAll, role } = useRBAC();

  const permissions = Array.isArray(permission) ? permission : [permission];
  const hasAccess = mode === "all" ? canAll(permissions) : canAny(permissions);

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="rounded-full bg-muted p-4 mb-4">
          <Lock className="size-8 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-bold mb-2">{title}</h1>
        <p className="text-muted-foreground mb-4 max-w-md">
          {description}
        </p>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Shield className="size-4" />
          <span>Your role: {ROLE_DISPLAY_NAMES[role]}</span>
        </div>
        <Link href="/dashboard">
          <Button>Back to Dashboard</Button>
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
