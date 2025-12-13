-- ============================================================
-- Dashboard Stats RPC Function
-- Optimized server-side aggregation for dashboard statistics
-- Run this in Supabase SQL Editor
-- ============================================================

CREATE OR REPLACE FUNCTION get_dashboard_stats(p_team_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_result jsonb;
  v_cluster_stats jsonb;
  v_pod_stats jsonb;
  v_node_stats jsonb;
  v_alert_stats jsonb;
  v_resource_usage jsonb;
BEGIN
  -- Cluster statistics
  SELECT jsonb_build_object(
    'total', COUNT(*),
    'connected', COUNT(*) FILTER (WHERE connection_status = 'connected'),
    'disconnected', COUNT(*) FILTER (WHERE connection_status = 'disconnected'),
    'error', COUNT(*) FILTER (WHERE connection_status = 'error')
  ) INTO v_cluster_stats
  FROM clusters
  WHERE team_id = p_team_id;

  -- Pod statistics (via clusters)
  SELECT jsonb_build_object(
    'total', COUNT(*),
    'running', COUNT(*) FILTER (WHERE p.status = 'Running'),
    'pending', COUNT(*) FILTER (WHERE p.status = 'Pending'),
    'failed', COUNT(*) FILTER (WHERE p.status = 'Failed'),
    'succeeded', COUNT(*) FILTER (WHERE p.status = 'Succeeded')
  ) INTO v_pod_stats
  FROM pods p
  JOIN clusters c ON p.cluster_id = c.id
  WHERE c.team_id = p_team_id;

  -- Node statistics
  SELECT jsonb_build_object(
    'total', COUNT(*),
    'ready', COUNT(*) FILTER (WHERE n.status = 'Ready'),
    'notReady', COUNT(*) FILTER (WHERE n.status != 'Ready')
  ) INTO v_node_stats
  FROM nodes n
  JOIN clusters c ON n.cluster_id = c.id
  WHERE c.team_id = p_team_id;

  -- Alert statistics (warning events from last 24h)
  SELECT jsonb_build_object(
    'total', COUNT(*),
    'critical', COUNT(*) FILTER (WHERE
      reason LIKE '%Failed%' OR
      reason LIKE '%Error%' OR
      reason LIKE '%OOM%'
    ),
    'warning', COUNT(*) FILTER (WHERE
      reason NOT LIKE '%Failed%' AND
      reason NOT LIKE '%Error%' AND
      reason NOT LIKE '%OOM%'
    )
  ) INTO v_alert_stats
  FROM cluster_events e
  JOIN clusters c ON e.cluster_id = c.id
  WHERE c.team_id = p_team_id
    AND e.event_type = 'Warning'
    AND e.created_at > NOW() - INTERVAL '24 hours';

  -- Resource usage (from latest cluster status)
  WITH latest_status AS (
    SELECT DISTINCT ON (cs.cluster_id)
      cs.cpu_capacity,
      cs.cpu_allocatable,
      cs.memory_capacity,
      cs.memory_allocatable
    FROM cluster_status cs
    JOIN clusters c ON cs.cluster_id = c.id
    WHERE c.team_id = p_team_id
    ORDER BY cs.cluster_id, cs.recorded_at DESC
  ),
  aggregated AS (
    SELECT
      SUM(NULLIF(regexp_replace(cpu_capacity, '[^0-9.]', '', 'g'), '')::numeric) as total_cpu_cap,
      SUM(NULLIF(regexp_replace(cpu_allocatable, '[^0-9.]', '', 'g'), '')::numeric) as total_cpu_alloc,
      SUM(NULLIF(regexp_replace(memory_capacity, '[^0-9.]', '', 'g'), '')::numeric) as total_mem_cap,
      SUM(NULLIF(regexp_replace(memory_allocatable, '[^0-9.]', '', 'g'), '')::numeric) as total_mem_alloc
    FROM latest_status
  )
  SELECT jsonb_build_object(
    'cpu_percent', COALESCE(
      CASE WHEN total_cpu_cap > 0
        THEN ROUND(((total_cpu_cap - total_cpu_alloc) / total_cpu_cap * 100)::numeric)
        ELSE 0
      END, 0
    ),
    'memory_percent', COALESCE(
      CASE WHEN total_mem_cap > 0
        THEN ROUND(((total_mem_cap - total_mem_alloc) / total_mem_cap * 100)::numeric)
        ELSE 0
      END, 0
    )
  ) INTO v_resource_usage
  FROM aggregated;

  -- Build final result
  v_result := jsonb_build_object(
    'clusters', COALESCE(v_cluster_stats, '{"total":0,"connected":0,"disconnected":0,"error":0}'::jsonb),
    'pods', COALESCE(v_pod_stats, '{"total":0,"running":0,"pending":0,"failed":0,"succeeded":0}'::jsonb),
    'nodes', COALESCE(v_node_stats, '{"total":0,"ready":0,"notReady":0}'::jsonb),
    'alerts', COALESCE(v_alert_stats, '{"total":0,"critical":0,"warning":0}'::jsonb),
    'resource_usage', COALESCE(v_resource_usage, '{"cpu_percent":0,"memory_percent":0}'::jsonb)
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
