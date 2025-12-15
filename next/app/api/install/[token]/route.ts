import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

// This endpoint is called by the CLI installer
// When called, it creates the actual cluster and returns the installation manifest

// Get the app URL for API endpoints
function getAppUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  if (!token || token.length < 32) {
    return NextResponse.json(
      { error: "Invalid token" },
      { status: 400 }
    );
  }

  // Use service role to bypass RLS
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // First, try to find a pending onboarding with this token
  const { data: pendingOnboarding, error: pendingError } = await supabase
    .from("pending_cluster_onboarding")
    .select("*")
    .eq("install_token", token)
    .single();

  if (pendingOnboarding) {
    // Check if expired
    if (new Date(pendingOnboarding.expires_at) < new Date()) {
      // Clean up expired record
      await supabase
        .from("pending_cluster_onboarding")
        .delete()
        .eq("id", pendingOnboarding.id);

      return NextResponse.json(
        { error: "Token expired" },
        { status: 410 }
      );
    }

    // Create the actual cluster now that the agent is connecting
    const agentToken = generateToken();

    const { data: cluster, error: clusterError } = await supabase
      .from("clusters")
      .insert({
        team_id: pendingOnboarding.team_id,
        name: pendingOnboarding.name,
        description: pendingOnboarding.description,
        agent_token: agentToken,
        connection_status: "connected", // Agent is connecting now
      })
      .select()
      .single();

    if (clusterError || !cluster) {
      console.error("Error creating cluster:", clusterError);
      return NextResponse.json(
        { error: "Failed to create cluster" },
        { status: 500 }
      );
    }

    // Delete the pending onboarding record
    await supabase
      .from("pending_cluster_onboarding")
      .delete()
      .eq("id", pendingOnboarding.id);

    // Generate and return the manifest with API-based auth
    const apiUrl = getAppUrl();
    const manifest = generateInstallManifest(cluster.id, agentToken, apiUrl);

    return NextResponse.json({
      cluster_id: cluster.id,
      cluster_name: cluster.name,
      manifest: manifest,
      message: "Cluster created successfully",
    });
  }

  // Fallback: Check legacy cluster_onboarding_tokens for existing clusters
  const { data: tokenData, error: tokenError } = await supabase
    .from("cluster_onboarding_tokens")
    .select("cluster_id, expires_at, used_at")
    .eq("token", token)
    .single();

  if (tokenError || !tokenData) {
    return NextResponse.json(
      { error: "Token not found" },
      { status: 404 }
    );
  }

  // Check if token is expired
  if (new Date(tokenData.expires_at) < new Date()) {
    return NextResponse.json(
      { error: "Token expired" },
      { status: 410 }
    );
  }

  // Get cluster info
  const { data: cluster, error: clusterError } = await supabase
    .from("clusters")
    .select("id, name, agent_token")
    .eq("id", tokenData.cluster_id)
    .single();

  if (clusterError || !cluster) {
    return NextResponse.json(
      { error: "Cluster not found" },
      { status: 404 }
    );
  }

  // Generate agent token if not exists
  const agentToken = cluster.agent_token || generateToken();

  // Mark token as used and update cluster status (and agent_token if needed)
  await Promise.all([
    supabase
      .from("cluster_onboarding_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("token", token),
    supabase
      .from("clusters")
      .update({
        connection_status: "connected",
        agent_token: agentToken
      })
      .eq("id", cluster.id),
  ]);

  // Generate the manifest with API-based auth
  const apiUrl = getAppUrl();
  const manifest = generateInstallManifest(cluster.id, agentToken, apiUrl);

  return NextResponse.json({
    cluster_id: cluster.id,
    cluster_name: cluster.name,
    manifest: manifest,
  });
}

function generateToken(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 64; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

function generateInstallManifest(
  clusterId: string,
  agentToken: string,
  apiUrl: string
): string {
  return `---
apiVersion: v1
kind: Namespace
metadata:
  name: kubervise
  labels:
    app.kubernetes.io/name: kubervise
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: kubervise-agent
  namespace: kubervise
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: kubervise-agent
rules:
  - apiGroups: [""]
    resources: [pods, pods/log, nodes, namespaces, services, events, configmaps, secrets, persistentvolumeclaims, persistentvolumes]
    verbs: [get, list, watch]
  - apiGroups: ["apps"]
    resources: [deployments, statefulsets, daemonsets, replicasets]
    verbs: [get, list, watch]
  - apiGroups: ["batch"]
    resources: [jobs, cronjobs]
    verbs: [get, list, watch]
  - apiGroups: ["networking.k8s.io"]
    resources: [ingresses, networkpolicies]
    verbs: [get, list, watch]
  - apiGroups: ["autoscaling"]
    resources: [horizontalpodautoscalers]
    verbs: [get, list, watch]
  - apiGroups: ["metrics.k8s.io"]
    resources: [nodes, pods]
    verbs: [get, list]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: kubervise-agent
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: kubervise-agent
subjects:
  - kind: ServiceAccount
    name: kubervise-agent
    namespace: kubervise
---
apiVersion: v1
kind: Secret
metadata:
  name: kubervise-agent-secrets
  namespace: kubervise
type: Opaque
stringData:
  OBSERVE_API_URL: "${apiUrl}"
  OBSERVE_AGENT_TOKEN: "${agentToken}"
  OBSERVE_CLUSTER_ID: "${clusterId}"
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: kubervise-agent
  namespace: kubervise
spec:
  replicas: 1
  selector:
    matchLabels:
      app.kubernetes.io/name: kubervise-agent
  template:
    metadata:
      labels:
        app.kubernetes.io/name: kubervise-agent
    spec:
      serviceAccountName: kubervise-agent
      containers:
        - name: agent
          image: kubervise/agent:latest
          imagePullPolicy: Always
          ports:
            - containerPort: 8001
              name: http
          env:
            - name: OBSERVE_IN_CLUSTER
              value: "true"
            - name: OBSERVE_SYNC_INTERVAL
              value: "30"
            - name: OBSERVE_WATCH_EVENTS
              value: "true"
            - name: OBSERVE_API_URL
              valueFrom:
                secretKeyRef:
                  name: kubervise-agent-secrets
                  key: OBSERVE_API_URL
            - name: OBSERVE_AGENT_TOKEN
              valueFrom:
                secretKeyRef:
                  name: kubervise-agent-secrets
                  key: OBSERVE_AGENT_TOKEN
            - name: OBSERVE_CLUSTER_ID
              valueFrom:
                secretKeyRef:
                  name: kubervise-agent-secrets
                  key: OBSERVE_CLUSTER_ID
          resources:
            requests:
              cpu: 50m
              memory: 128Mi
            limits:
              cpu: 200m
              memory: 256Mi
          livenessProbe:
            httpGet:
              path: /health
              port: http
            initialDelaySeconds: 10
            periodSeconds: 30
          readinessProbe:
            httpGet:
              path: /health
              port: http
            initialDelaySeconds: 5
            periodSeconds: 10
          securityContext:
            readOnlyRootFilesystem: true
            runAsNonRoot: true
            runAsUser: 1000
            allowPrivilegeEscalation: false
`;
}
