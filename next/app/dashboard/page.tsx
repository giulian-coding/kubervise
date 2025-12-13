import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getDashboardData } from "@/lib/actions/dashboard";
import { DashboardContent } from "./dashboard-content";
import { DashboardSkeleton } from "./dashboard-skeleton";

export default async function DashboardPage() {
  const supabase = await createClient();

  // Get user's primary team
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  // Get first team membership
  const { data: membership, error: membershipError } = await supabase
    .from("team_memberships")
    .select("team_id")
    .eq("profile_id", user.id)
    .limit(1)
    .single();

  console.log("Dashboard - Team membership check:", {
    userId: user.id,
    membership,
    error: membershipError?.message,
  });

  const teamId = membership?.team_id;

  if (!teamId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of your Kubernetes clusters and resources
          </p>
        </div>
        <div className="rounded-lg border bg-card p-8 text-center">
          <p className="text-muted-foreground">
            No team found. Please complete onboarding first.
          </p>
        </div>
      </div>
    );
  }

  // Fetch dashboard data
  const dashboardData = await getDashboardData(teamId);

  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent data={dashboardData} teamId={teamId} />
    </Suspense>
  );
}
