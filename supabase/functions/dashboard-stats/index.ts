// Supabase Edge Function: Dashboard Stats
// Efficiently aggregates dashboard statistics server-side
// Deploy with: supabase functions deploy dashboard-stats

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface DashboardStats {
  clusters: {
    total: number;
    connected: number;
    disconnected: number;
    error: number;
  };
  pods: {
    total: number;
    running: number;
    pending: number;
    failed: number;
  };
  nodes: {
    total: number;
    ready: number;
    notReady: number;
  };
  alerts: {
    total: number;
    critical: number;
    warning: number;
  };
  resource_usage: {
    cpu_percent: number;
    memory_percent: number;
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create Supabase client with user's JWT
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Get team_id from request
    const { team_id } = await req.json();
    if (!team_id) {
      return new Response(JSON.stringify({ error: "team_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use single optimized query with RPC for better performance
    // This runs server-side in Postgres, much faster than multiple queries
    const { data, error } = await supabase.rpc("get_dashboard_stats", {
      p_team_id: team_id,
    });

    if (error) {
      // Fallback to direct queries if RPC doesn't exist
      console.log("RPC not available, using direct queries:", error.message);

      const stats = await getStatsDirectly(supabase, team_id);

      return new Response(JSON.stringify(stats), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function getStatsDirectly(supabase: any, teamId: string): Promise<DashboardStats> {
  // Parallel queries for efficiency
  const [clustersRes, podsRes, nodesRes, eventsRes] = await Promise.all([
    supabase
      .from("clusters")
      .select("connection_status")
      .eq("team_id", teamId),

    supabase
      .from("pods")
      .select("status, clusters!inner(team_id)")
      .eq("clusters.team_id", teamId),

    supabase
      .from("nodes")
      .select("status, clusters!inner(team_id)")
      .eq("clusters.team_id", teamId),

    supabase
      .from("cluster_events")
      .select("event_type, reason, clusters!inner(team_id)")
      .eq("clusters.team_id", teamId)
      .eq("event_type", "Warning")
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
  ]);

  const clusters = clustersRes.data || [];
  const pods = podsRes.data || [];
  const nodes = nodesRes.data || [];
  const events = eventsRes.data || [];

  // Calculate cluster resource usage from latest status
  const { data: latestStatus } = await supabase
    .from("cluster_status")
    .select("cpu_capacity, cpu_allocatable, memory_capacity, memory_allocatable, clusters!inner(team_id)")
    .eq("clusters.team_id", teamId)
    .order("recorded_at", { ascending: false })
    .limit(1)
    .single();

  let cpuPercent = 0;
  let memoryPercent = 0;

  if (latestStatus) {
    const cpuCap = parseFloat(latestStatus.cpu_capacity || "0");
    const cpuAlloc = parseFloat(latestStatus.cpu_allocatable || "0");
    const memCap = parseFloat(latestStatus.memory_capacity || "0");
    const memAlloc = parseFloat(latestStatus.memory_allocatable || "0");

    if (cpuCap > 0) cpuPercent = Math.round(((cpuCap - cpuAlloc) / cpuCap) * 100);
    if (memCap > 0) memoryPercent = Math.round(((memCap - memAlloc) / memCap) * 100);
  }

  return {
    clusters: {
      total: clusters.length,
      connected: clusters.filter((c: any) => c.connection_status === "connected").length,
      disconnected: clusters.filter((c: any) => c.connection_status === "disconnected").length,
      error: clusters.filter((c: any) => c.connection_status === "error").length,
    },
    pods: {
      total: pods.length,
      running: pods.filter((p: any) => p.status === "Running").length,
      pending: pods.filter((p: any) => p.status === "Pending").length,
      failed: pods.filter((p: any) => p.status === "Failed").length,
    },
    nodes: {
      total: nodes.length,
      ready: nodes.filter((n: any) => n.status === "Ready").length,
      notReady: nodes.filter((n: any) => n.status !== "Ready").length,
    },
    alerts: {
      total: events.length,
      critical: events.filter((e: any) =>
        e.reason?.includes("Failed") ||
        e.reason?.includes("Error") ||
        e.reason?.includes("OOM")
      ).length,
      warning: events.filter((e: any) =>
        !e.reason?.includes("Failed") &&
        !e.reason?.includes("Error") &&
        !e.reason?.includes("OOM")
      ).length,
    },
    resource_usage: {
      cpu_percent: cpuPercent,
      memory_percent: memoryPercent,
    },
  };
}
