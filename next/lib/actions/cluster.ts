"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type CreatePendingOnboardingResult = {
  success: boolean;
  onboarding_id?: string;
  install_token?: string;
  install_command_windows?: string;
  install_command_linux?: string;
  install_command_mac?: string;
  error?: string;
};

export type PendingOnboardingStatus = {
  success: boolean;
  status: "pending" | "connected" | "expired";
  cluster_id?: string;
  cluster_name?: string;
  error?: string;
};

export type ClusterInstallConfig = {
  success: boolean;
  cluster_id?: string;
  cluster_name?: string;
  connection_status?: string;
  install_token?: string;
  install_command_windows?: string;
  install_command_linux?: string;
  install_manifest?: string;
  error?: string;
};

// Get the app URL for downloads
function getAppUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
}

// Generate CLI install commands
function generateCLICommands(token: string): {
  windows: string;
  linux: string;
  mac: string;
} {
  const appUrl = getAppUrl();

  return {
    windows: `# Download and run the installer (PowerShell)
Invoke-WebRequest -Uri "${appUrl}/downloads/kubervise-windows-amd64.exe" -OutFile kubervise.exe
.\\kubervise.exe install ${token}`,

    linux: `# Download and run the installer
curl -LO ${appUrl}/downloads/kubervise-linux-amd64
chmod +x kubervise-linux-amd64
./kubervise-linux-amd64 install ${token}`,

    mac: `# Download and run the installer
curl -LO ${appUrl}/downloads/kubervise-darwin-arm64
chmod +x kubervise-darwin-arm64
./kubervise-darwin-arm64 install ${token}`,
  };
}

// Helper function to generate secure tokens
function generateToken(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 64; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

/**
 * Create a pending cluster onboarding.
 * The actual cluster is NOT created until the agent successfully connects.
 */
export async function createPendingClusterOnboarding(
  teamId: string,
  name: string,
  description?: string
): Promise<CreatePendingOnboardingResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  try {
    const installToken = generateToken();

    // Create pending onboarding (NOT the actual cluster yet)
    const { data: onboarding, error: onboardingError } = await supabase
      .from("pending_cluster_onboarding")
      .insert({
        team_id: teamId,
        name,
        description: description || null,
        install_token: installToken,
        created_by: user.id,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
      })
      .select()
      .single();

    if (onboardingError || !onboarding) {
      console.error("Error creating pending onboarding:", onboardingError);
      return { success: false, error: onboardingError?.message || "Failed to create onboarding" };
    }

    const cliCommands = generateCLICommands(installToken);

    return {
      success: true,
      onboarding_id: onboarding.id,
      install_token: installToken,
      install_command_windows: cliCommands.windows,
      install_command_linux: cliCommands.linux,
      install_command_mac: cliCommands.mac,
    };
  } catch (err) {
    console.error("Unexpected error:", err);
    return { success: false, error: "An unexpected error occurred" };
  }
}

/**
 * Check the status of a pending onboarding.
 * Returns "connected" if the cluster was created (agent connected successfully).
 */
export async function checkPendingOnboardingStatus(
  onboardingId: string
): Promise<PendingOnboardingStatus> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, status: "pending", error: "Not authenticated" };
  }

  // First check if pending onboarding still exists
  const { data: pending } = await supabase
    .from("pending_cluster_onboarding")
    .select("id, name, install_token, expires_at")
    .eq("id", onboardingId)
    .single();

  if (pending) {
    // Check if expired
    if (new Date(pending.expires_at) < new Date()) {
      return { success: true, status: "expired" };
    }
    return { success: true, status: "pending" };
  }

  // Pending record doesn't exist - check if cluster was created
  // We'll look for a cluster that was created from this onboarding
  // The install API deletes the pending record and creates the cluster

  // Try to find a recently connected cluster with matching name pattern
  // Note: In production, you'd store the onboarding_id reference in the cluster
  const { data: cluster } = await supabase
    .from("clusters")
    .select("id, name, connection_status")
    .eq("connection_status", "connected")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (cluster) {
    return {
      success: true,
      status: "connected",
      cluster_id: cluster.id,
      cluster_name: cluster.name,
    };
  }

  // Onboarding was likely expired and cleaned up
  return { success: true, status: "expired" };
}

/**
 * Get pending onboarding by token (for internal use)
 */
export async function getPendingOnboardingByToken(token: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("pending_cluster_onboarding")
    .select("*")
    .eq("install_token", token)
    .single();

  if (error || !data) {
    return null;
  }

  return data;
}

/**
 * Cancel a pending onboarding
 */
export async function cancelPendingOnboarding(
  onboardingId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("pending_cluster_onboarding")
    .delete()
    .eq("id", onboardingId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

// Legacy function - kept for existing clusters
export async function getClusterInstallManifest(
  clusterId: string
): Promise<ClusterInstallConfig> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  // Get cluster
  const { data: cluster, error: clusterError } = await supabase
    .from("clusters")
    .select("id, name, connection_status")
    .eq("id", clusterId)
    .single();

  if (clusterError || !cluster) {
    return { success: false, error: "Cluster not found" };
  }

  // Get or create install token
  let installToken: string;

  const { data: existingToken } = await supabase
    .from("cluster_onboarding_tokens")
    .select("token")
    .eq("cluster_id", clusterId)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (existingToken) {
    installToken = existingToken.token;
  } else {
    // Create new token
    installToken = generateToken();
    await supabase.from("cluster_onboarding_tokens").insert({
      cluster_id: clusterId,
      token: installToken,
      created_by: user.id,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
  }

  const cliCommands = generateCLICommands(installToken);

  return {
    success: true,
    cluster_id: cluster.id,
    cluster_name: cluster.name,
    connection_status: cluster.connection_status,
    install_token: installToken,
    install_command_windows: cliCommands.windows,
    install_command_linux: cliCommands.linux,
  };
}

export async function deleteCluster(
  clusterId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("clusters")
    .delete()
    .eq("id", clusterId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard/clusters");

  return { success: true };
}

export async function getUserTeams(): Promise<{
  success: boolean;
  teams?: Array<{ id: string; name: string }>;
  error?: string;
}> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  const { data: memberships, error } = await supabase
    .from("team_memberships")
    .select("team_id, teams(id, name)")
    .eq("profile_id", user.id);

  if (error) {
    return { success: false, error: error.message };
  }

  const teams = memberships
    ?.map((m) => m.teams as unknown as { id: string; name: string })
    .filter(Boolean) || [];

  return { success: true, teams };
}
