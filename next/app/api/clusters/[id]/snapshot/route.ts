import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { ClusterSnapshotData } from "@/lib/types/database";

// POST /api/clusters/[id]/snapshot
// Called by the Kubervise agent to submit a cluster snapshot
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: clusterId } = await params;

  // Validate cluster ID
  if (!clusterId) {
    return NextResponse.json(
      { error: "Cluster ID is required" },
      { status: 400 }
    );
  }

  // Get authorization header (agent token)
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "Authorization token required" },
      { status: 401 }
    );
  }
  const agentToken = authHeader.slice(7);

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

  // Verify the cluster exists and the agent token matches
  const { data: cluster, error: clusterError } = await supabase
    .from("clusters")
    .select("id, agent_token")
    .eq("id", clusterId)
    .single();

  if (clusterError || !cluster) {
    return NextResponse.json(
      { error: "Cluster not found" },
      { status: 404 }
    );
  }

  if (cluster.agent_token !== agentToken) {
    return NextResponse.json(
      { error: "Invalid agent token" },
      { status: 403 }
    );
  }

  // Parse the snapshot data
  let snapshotData: ClusterSnapshotData;
  try {
    snapshotData = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  // Validate required fields
  if (!snapshotData.nodes || !snapshotData.pods) {
    return NextResponse.json(
      { error: "Snapshot must include nodes and pods arrays" },
      { status: 400 }
    );
  }

  // Upsert the snapshot (insert or update if exists)
  const { error: snapshotError } = await supabase
    .from("cluster_snapshots")
    .upsert(
      {
        cluster_id: clusterId,
        snapshot: snapshotData,
        collected_at: new Date().toISOString(),
      },
      {
        onConflict: "cluster_id",
      }
    );

  if (snapshotError) {
    console.error("Error saving snapshot:", snapshotError);
    return NextResponse.json(
      { error: "Failed to save snapshot" },
      { status: 500 }
    );
  }

  // Update cluster last_seen_at and connection_status
  await supabase
    .from("clusters")
    .update({
      last_seen_at: new Date().toISOString(),
      connection_status: "connected",
    })
    .eq("id", clusterId);

  return NextResponse.json({
    success: true,
    message: "Snapshot saved successfully",
    collected_at: new Date().toISOString(),
  });
}

// GET /api/clusters/[id]/snapshot
// Get the latest snapshot for a cluster (for debugging/testing)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: clusterId } = await params;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data: snapshot, error } = await supabase
    .from("cluster_snapshots")
    .select("*")
    .eq("cluster_id", clusterId)
    .single();

  if (error || !snapshot) {
    return NextResponse.json(
      { error: "Snapshot not found" },
      { status: 404 }
    );
  }

  return NextResponse.json(snapshot);
}
