import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // Check onboarding status
  let { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_status")
    .eq("id", user.id)
    .single();

  // Create profile if it doesn't exist (trigger may not have run)
  if (!profile) {
    await supabase.from("profiles").insert({
      id: user.id,
      full_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "User",
      onboarding_status: "pending",
    });
    profile = { onboarding_status: "pending" as const };
  }

  // If already completed, redirect to dashboard
  if (profile?.onboarding_status === "completed") {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">
            Welcome to Kubervise
          </h1>
          <p className="mt-2 text-muted-foreground">
            Let&apos;s get you set up with your first team
          </p>
        </div>

        <OnboardingForm userEmail={user.email ?? ""} />
      </div>
    </div>
  );
}
