import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Separator } from "@/components/ui/separator";
import { ClusterSwitcher } from "@/components/dashboard/cluster-switcher";
import { ClusterProvider } from "@/lib/context/cluster-context";
import { getUserTeams } from "@/lib/actions/team";
import { RBACProvider } from "@/lib/rbac";
import type { TeamRoleType } from "@/lib/types/database";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // Check onboarding status
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("onboarding_status")
    .eq("id", user.id)
    .single();

  console.log("Dashboard layout - Profile check:", {
    userId: user.id,
    profile,
    error: profileError?.message
  });

  // Redirect to onboarding if not completed
  if (!profile || profile.onboarding_status !== "completed") {
    console.log("Redirecting to onboarding - status:", profile?.onboarding_status);
    redirect("/onboarding");
  }

  // Get user's teams
  const teamsResult = await getUserTeams();
  const teams = teamsResult.success ? teamsResult.teams ?? [] : [];

  // Get first team and user's role
  const firstTeam = teams[0];
  const userRole: TeamRoleType = firstTeam?.role || "viewer";

  return (
    <RBACProvider role={userRole}>
      <ClusterProvider>
        <SidebarProvider>
          <AppSidebar user={{ email: user.email ?? "", id: user.id }} teams={teams} userRole={userRole} />
          <SidebarInset>
            <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 h-4" />
              <ClusterSwitcher />
              <div className="ml-auto">
                <ThemeToggle />
              </div>
            </header>
            <main className="flex-1 p-4">
              {children}
            </main>
          </SidebarInset>
        </SidebarProvider>
      </ClusterProvider>
    </RBACProvider>
  );
}
