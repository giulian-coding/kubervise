"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type CreatePendingOnboardingResult = {
  success: boolean;
  onboarding_id?: string;
  cluster_id?: string;
  agent_token?: string;
  api_url?: string;
  install_command_kubectl?: string;
  install_command_helm?: string;
  install_manifest?: string;
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
  install_command_kubectl?: string;
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

// Generate install commands for the Kubervise agent
function generateInstallCommands(
  clusterId: string,
  agentToken: string,
  apiUrl: string
): {
  kubectl: string;
  helm: string;
  manifest: string;
} {
  return {
    // Binary install - simplest option
    kubectl: `# Option 1: Download and run the agent binary (Linux)
curl -sSL ${apiUrl}/downloads/agentkubervise-linux-amd64 -o agentkubervise
chmod +x agentkubervise
./agentkubervise --api-url "${apiUrl}" --token "${agentToken}" --cluster-id "${clusterId}"

# Option 2: Run with Docker
docker run -d --name kubervise-agent \\
  -e KUBERVISE_API_URL="${apiUrl}" \\
  -e KUBERVISE_AGENT_TOKEN="${agentToken}" \\
  -e KUBERVISE_CLUSTER_ID="${clusterId}" \\
  -v ~/.kube:/root/.kube:ro \\
  kubervise/agent:latest

# Option 3: Run as systemd service (after downloading binary)
cat > /etc/systemd/system/kubervise-agent.service <<EOF
[Unit]
Description=Kubervise Agent
After=network.target

[Service]
Type=simple
ExecStart=/usr/local/bin/agentkubervise --api-url "${apiUrl}" --token "${agentToken}" --cluster-id "${clusterId}"
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
systemctl enable --now kubervise-agent`,

    // Direct run command
    helm: `# Direct command (if agent is already installed)
agentkubervise --api-url "${apiUrl}" --token "${agentToken}" --cluster-id "${clusterId}"

# Or with environment variables
export KUBERVISE_API_URL="${apiUrl}"
export KUBERVISE_AGENT_TOKEN="${agentToken}"
export KUBERVISE_CLUSTER_ID="${clusterId}"
agentkubervise`,

    // Windows install
    manifest: `# Windows Installation (PowerShell)
# 1. Download the agent
Invoke-WebRequest -Uri "${apiUrl}/downloads/agentkubervise-windows-amd64.exe" -OutFile agentkubervise.exe

# 2. Run the agent
.\\agentkubervise.exe --api-url "${apiUrl}" --token "${agentToken}" --cluster-id "${clusterId}"

# Or set environment variables and run
$env:KUBERVISE_API_URL="${apiUrl}"
$env:KUBERVISE_AGENT_TOKEN="${agentToken}"
$env:KUBERVISE_CLUSTER_ID="${clusterId}"
.\\agentkubervise.exe`,
  };
}


// Generate a secure random token
function generateAgentToken(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 64; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

/**
 * Create a new cluster and return install commands.
 * The cluster is created immediately with "pending" status.
 * Status changes to "connected" when the agent first syncs.
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
    // Generate agent token for API authentication
    const agentToken = generateAgentToken();

    // Create the cluster directly with "pending" status
    const { data: cluster, error: clusterError } = await supabase
      .from("clusters")
      .insert({
        team_id: teamId,
        name,
        description: description || null,
        connection_status: "pending",
        created_by: user.id,
        agent_token: agentToken,
      })
      .select()
      .single();

    if (clusterError || !cluster) {
      console.error("Error creating cluster:", clusterError);
      return { success: false, error: clusterError?.message || "Failed to create cluster" };
    }

    // Generate install commands with API URL and agent token
    const apiUrl = getAppUrl();
    const installCommands = generateInstallCommands(
      cluster.id,
      agentToken,
      apiUrl
    );

    return {
      success: true,
      onboarding_id: cluster.id,
      cluster_id: cluster.id,
      agent_token: agentToken,
      api_url: apiUrl,
      install_command_kubectl: installCommands.kubectl,
      install_command_helm: installCommands.helm,
      install_manifest: installCommands.manifest,
    };
  } catch (err) {
    console.error("Unexpected error:", err);
    return { success: false, error: "An unexpected error occurred" };
  }
}

/**
 * Check the connection status of a cluster.
 * The clusterId is passed directly since we create the cluster immediately.
 */
export async function checkPendingOnboardingStatus(
  clusterId: string
): Promise<PendingOnboardingStatus> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, status: "pending", error: "Not authenticated" };
  }

  // Look up the cluster directly by ID
  const { data: cluster, error } = await supabase
    .from("clusters")
    .select("id, name, connection_status")
    .eq("id", clusterId)
    .single();

  if (error || !cluster) {
    return { success: true, status: "expired" };
  }

  // Check the connection status
  if (cluster.connection_status === "connected") {
    return {
      success: true,
      status: "connected",
      cluster_id: cluster.id,
      cluster_name: cluster.name,
    };
  }

  // Still pending - waiting for agent to connect
  return { success: true, status: "pending" };
}

/**
 * Cancel a pending cluster (delete it before agent connects)
 */
export async function cancelPendingOnboarding(
  clusterId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  // Only allow deletion of clusters in "pending" status
  const { error } = await supabase
    .from("clusters")
    .delete()
    .eq("id", clusterId)
    .eq("connection_status", "pending");

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

// Get install commands for an existing cluster
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

  // Get cluster with agent_token
  const { data: cluster, error: clusterError } = await supabase
    .from("clusters")
    .select("id, name, connection_status, agent_token")
    .eq("id", clusterId)
    .single();

  if (clusterError || !cluster) {
    return { success: false, error: "Cluster not found" };
  }

  // Generate new token if not exists
  let agentToken = cluster.agent_token;
  if (!agentToken) {
    agentToken = generateAgentToken();
    await supabase
      .from("clusters")
      .update({ agent_token: agentToken })
      .eq("id", clusterId);
  }

  // Generate install commands with API URL and agent token
  const apiUrl = getAppUrl();
  const installCommands = generateInstallCommands(
    cluster.id,
    agentToken,
    apiUrl
  );

  return {
    success: true,
    cluster_id: cluster.id,
    cluster_name: cluster.name,
    connection_status: cluster.connection_status,
    install_command_kubectl: installCommands.kubectl,
    install_manifest: installCommands.manifest,
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
