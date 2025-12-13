import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingFlow } from "./onboarding-flow";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // Check if user already completed onboarding
  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_status")
    .eq("id", user.id)
    .single();

  if (profile?.onboarding_status === "completed") {
    redirect("/dashboard");
  }

  // Check if user has any team memberships
  const { data: memberships } = await supabase
    .from("team_memberships")
    .select("team_id")
    .eq("profile_id", user.id)
    .limit(1);

  if (memberships && memberships.length > 0) {
    // User has a team, mark onboarding as complete and redirect
    await supabase
      .from("profiles")
      .update({
        onboarding_status: "completed",
        onboarding_completed_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <OnboardingFlow userEmail={user.email} />
    </div>
  );
}
