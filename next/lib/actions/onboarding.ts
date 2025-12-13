"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type OnboardingStatus = {
  success: boolean;
  onboarding_status?: "pending" | "completed" | "skipped";
  onboarding_completed_at?: string | null;
  has_team?: boolean;
  team_count?: number;
  error?: string;
};

export type CreateTeamResult = {
  success: boolean;
  team_id?: string;
  message?: string;
  error?: string;
};

export async function getOnboardingStatus(): Promise<OnboardingStatus> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_onboarding_status");

  if (error) {
    console.error("Error getting onboarding status:", error);
    return { success: false, error: error.message };
  }

  return data as OnboardingStatus;
}

export async function createTeamAndCompleteOnboarding(
  teamName: string,
  teamDescription?: string
): Promise<CreateTeamResult> {
  const supabase = await createClient();

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  // Try RPC first (if available)
  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "create_team_and_complete_onboarding",
    {
      p_team_name: teamName,
      p_team_description: teamDescription || null,
    }
  );

  if (!rpcError && rpcData) {
    revalidatePath("/dashboard");
    revalidatePath("/onboarding");
    return rpcData as CreateTeamResult;
  }

  // Fallback: Direct table operations if RPC doesn't exist
  console.log("RPC not available, using direct table operations:", rpcError?.message);

  try {
    // 0. Ensure profile exists (in case trigger didn't run)
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .single();

    if (!existingProfile) {
      const { error: profileCreateError } = await supabase
        .from("profiles")
        .insert({
          id: user.id,
          full_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "User",
          onboarding_status: "pending",
        });

      if (profileCreateError) {
        console.error("Error creating profile:", profileCreateError);
        // Continue anyway - maybe RLS issue
      }
    }

    // 1. Create team
    const { data: team, error: teamError } = await supabase
      .from("teams")
      .insert({
        name: teamName,
        description: teamDescription || null,
        owner_id: user.id,
      })
      .select()
      .single();

    if (teamError) {
      console.error("Error creating team:", teamError);
      return { success: false, error: teamError.message };
    }

    // 2. Get or create owner role
    let ownerRoleId: string;
    const { data: existingRole } = await supabase
      .from("team_roles")
      .select("id")
      .eq("role", "owner")
      .single();

    if (existingRole) {
      ownerRoleId = existingRole.id;
    } else {
      const { data: newRole, error: roleError } = await supabase
        .from("team_roles")
        .insert({ role: "owner", name: "Owner", permissions: ["*"] })
        .select()
        .single();

      if (roleError || !newRole) {
        console.error("Error creating role:", roleError);
        return { success: false, error: "Failed to create team role" };
      }
      ownerRoleId = newRole.id;
    }

    // 3. Create team membership
    const { error: membershipError } = await supabase
      .from("team_memberships")
      .insert({
        profile_id: user.id,
        team_id: team.id,
        role_id: ownerRoleId,
      });

    if (membershipError) {
      console.error("Error creating membership:", membershipError);
      // Don't fail - team was created
    }

    // 4. Update profile onboarding status
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        onboarding_status: "completed",
        onboarding_completed_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (profileError) {
      console.error("Error updating profile:", profileError);
      return { success: false, error: profileError.message };
    }

    revalidatePath("/dashboard");
    revalidatePath("/onboarding");

    return {
      success: true,
      team_id: team.id,
      message: "Team created and onboarding completed",
    };
  } catch (err) {
    console.error("Unexpected error:", err);
    return { success: false, error: "An unexpected error occurred" };
  }
}

export async function acceptTeamInvitation(
  token: string
): Promise<CreateTeamResult> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("accept_team_invitation", {
    p_token: token,
  });

  if (error) {
    console.error("Error accepting invitation:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard");
  revalidatePath("/onboarding");

  return data as CreateTeamResult;
}
