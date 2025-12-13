"use server";

import { createClient } from "@/lib/supabase/server";

import type { TeamRoleType } from "@/lib/types/database";

export type Team = {
  team_id: string;
  team_name: string;
  team_slug: string | null;
  team_avatar_url: string | null;
  role: TeamRoleType;
  is_owner: boolean;
};

export type GetTeamsResult = {
  success: boolean;
  teams?: Team[];
  error?: string;
};

export async function getUserTeams(): Promise<GetTeamsResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  // Try RPC first
  const { data: rpcData, error: rpcError } = await supabase.rpc("get_user_teams", {
    p_user_id: user.id,
  });

  if (!rpcError && rpcData) {
    return { success: true, teams: rpcData as Team[] };
  }

  // Fallback: Direct table query
  console.log("RPC not available, using direct query:", rpcError?.message);

  const { data, error } = await supabase
    .from("team_memberships")
    .select(`
      team_id,
      teams:team_id (
        id,
        name,
        slug,
        avatar_url,
        owner_id
      ),
      team_roles:role_id (
        role
      )
    `)
    .eq("profile_id", user.id);

  if (error) {
    console.error("Error getting user teams:", error);
    return { success: false, error: error.message };
  }

  // Transform data to match Team type
  const teams: Team[] = (data || []).map((membership) => {
    const team = membership.teams as unknown as { id: string; name: string; slug: string | null; avatar_url: string | null; owner_id: string } | null;
    const roleData = membership.team_roles as unknown as { role: string } | null;

    return {
      team_id: team?.id || membership.team_id,
      team_name: team?.name || "Unknown Team",
      team_slug: team?.slug || null,
      team_avatar_url: team?.avatar_url || null,
      role: (roleData?.role || "member") as Team["role"],
      is_owner: team?.owner_id === user.id,
    };
  });

  return { success: true, teams };
}

export async function getTeamById(teamId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("teams")
    .select("*")
    .eq("id", teamId)
    .single();

  if (error) {
    console.error("Error getting team:", error);
    return null;
  }

  return data;
}

export async function updateTeam(
  teamId: string,
  updates: { name?: string; description?: string; avatar_url?: string }
) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("teams")
    .update(updates)
    .eq("id", teamId)
    .select()
    .single();

  if (error) {
    console.error("Error updating team:", error);
    return { success: false, error: error.message };
  }

  return { success: true, team: data };
}
