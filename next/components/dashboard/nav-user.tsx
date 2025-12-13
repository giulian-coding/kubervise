"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ChevronUp,
  User,
  Settings,
  LogOut,
  Loader2,
  Shield,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
import { ROLE_DISPLAY_NAMES } from "@/lib/rbac";
import type { TeamRoleType } from "@/lib/types/database";

interface NavUserProps {
  user: {
    email: string;
    id: string;
  };
  userRole: TeamRoleType;
}

export function NavUser({ user, userRole }: NavUserProps) {
  const router = useRouter();
  const { state } = useSidebar();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogout = async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/auth/login");
      router.refresh();
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-accent">
                <User className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">
                  {user.email.split("@")[0]}
                </span>
                <span className="truncate text-xs text-muted-foreground flex items-center gap-1">
                  <Shield className="size-3" />
                  {ROLE_DISPLAY_NAMES[userRole]}
                </span>
              </div>
              <ChevronUp className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side={state === "collapsed" ? "right" : "top"}
            align="end"
            className="w-56"
          >
            <DropdownMenuItem onClick={() => router.push("/dashboard/settings")}>
              <Settings />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleLogout}
              disabled={isLoading}
              variant="destructive"
            >
              {isLoading ? (
                <Loader2 className="animate-spin" />
              ) : (
                <LogOut />
              )}
              {isLoading ? "Signing out..." : "Sign out"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
