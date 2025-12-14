"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type CreatePendingOnboardingResult = {
  success: boolean;
  onboarding_id?: string;
  cluster_id?: string;
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

// Generate kubectl install commands for the Kubernetes agent
function generateInstallCommands(
  clusterId: string,
  supabaseUrl: string,
  supabaseServiceKey: string
): {
  kubectl: string;
  helm: string;
  manifest: string;
} {
  // Base64 encode the values for Kubernetes secrets
  const supabaseUrlB64 = Buffer.from(supabaseUrl).toString("base64");
  const supabaseKeyB64 = Buffer.from(supabaseServiceKey).toString("base64");
  const clusterIdB64 = Buffer.from(clusterId).toString("base64");

  return {
    kubectl: `# 1. Create namespace (idempotent - ignores if exists)
kubectl create namespace kubervise --dry-run=client -o yaml | kubectl apply -f -

# 2. Create/Update secret with credentials
kubectl apply -f - <<EOF
apiVersion: v1
kind: Secret
metadata:
  name: kubervise-agent-secrets
  namespace: kubervise
  labels:
    app.kubernetes.io/name: kubervise
    app.kubernetes.io/component: agent
type: Opaque
stringData:
  OBSERVE_SUPABASE_URL: "${supabaseUrl}"
  OBSERVE_SUPABASE_SERVICE_KEY: "${supabaseServiceKey}"
  OBSERVE_CLUSTER_ID: "${clusterId}"
EOF

# 3. Apply the agent manifests (creates or updates)
# WICHTIG: Ersetze YOUR_GITHUB_USERNAME mit deinem GitHub Username
kubectl apply -f https://raw.githubusercontent.com/YOUR_GITHUB_USERNAME/kubervise/main/workers/observe/k8s/serviceaccount.yaml
kubectl apply -f https://raw.githubusercontent.com/YOUR_GITHUB_USERNAME/kubervise/main/workers/observe/k8s/deployment.yaml

# 4. Restart deployment to pick up secret changes (if updating)
kubectl -n kubervise rollout restart deployment/kubervise-agent 2>/dev/null || true

# 5. Verify deployment
kubectl -n kubervise get pods -w`,

    helm: `# Coming soon: Helm chart installation
helm repo add kubervise https://charts.kubervise.io
helm upgrade --install kubervise-agent kubervise/agent \\
  --namespace kubervise \\
  --create-namespace \\
  --set supabase.url="${supabaseUrl}" \\
  --set supabase.serviceKey="${supabaseServiceKey}" \\
  --set cluster.id="${clusterId}"`,

    manifest: `# Save this as kubervise-secret.yaml and apply with: kubectl apply -f kubervise-secret.yaml
# This is idempotent - safe to run multiple times
apiVersion: v1
kind: Secret
metadata:
  name: kubervise-agent-secrets
  namespace: kubervise
  labels:
    app.kubernetes.io/name: kubervise
    app.kubernetes.io/component: agent
type: Opaque
data:
  OBSERVE_SUPABASE_URL: ${supabaseUrlB64}
  OBSERVE_SUPABASE_SERVICE_KEY: ${supabaseKeyB64}
  OBSERVE_CLUSTER_ID: ${clusterIdB64}`,
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

  // Get Supabase credentials from environment
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Missing Supabase environment variables");
    return { success: false, error: "Server configuration error" };
  }

  try {
    // Create the cluster directly with "pending" status
    const { data: cluster, error: clusterError } = await supabase
      .from("clusters")
      .insert({
        team_id: teamId,
        name,
        description: description || null,
        connection_status: "pending",
        created_by: user.id,
      })
      .select()
      .single();

    if (clusterError || !cluster) {
      console.error("Error creating cluster:", clusterError);
      return { success: false, error: clusterError?.message || "Failed to create cluster" };
    }

    // Generate install commands with cluster ID
    const installCommands = generateInstallCommands(
      cluster.id,
      supabaseUrl,
      supabaseServiceKey
    );

    return {
      success: true,
      onboarding_id: cluster.id,
      cluster_id: cluster.id,
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
