#!/usr/bin/env python3
"""
Kubervise Agent CLI - Kubernetes Cluster Monitoring Agent

Usage:
    agentkubervise --api-url https://app.kubervise.io --token YOUR_TOKEN --cluster-id UUID

Or with install token (fetches config automatically):
    agentkubervise --install-token INSTALL_TOKEN
"""
import asyncio
import signal
import sys
import logging
from typing import Optional

import click
import httpx

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("agentkubervise")


class AgentConfig:
    """Agent configuration"""
    def __init__(self, api_url: str, agent_token: str, cluster_id: str):
        self.api_url = api_url.rstrip('/')
        self.agent_token = agent_token
        self.cluster_id = cluster_id
        self.sync_interval = 30
        self.watch_events = True


async def fetch_config_from_install_token(install_token: str) -> Optional[AgentConfig]:
    """Fetch agent configuration using an install token"""
    # Try common Kubervise API endpoints
    possible_urls = [
        f"https://app.kubervise.io/api/install/{install_token}",
        f"http://localhost:3000/api/install/{install_token}",
    ]

    async with httpx.AsyncClient(timeout=30.0) as client:
        for url in possible_urls:
            try:
                logger.info(f"Fetching configuration from {url}...")
                response = await client.get(url)

                if response.status_code == 200:
                    data = response.json()

                    # Extract API URL from the response or use the base URL
                    api_url = url.rsplit('/api/install', 1)[0]

                    # The manifest contains the credentials in the Secret
                    # But we also get cluster_id directly
                    if 'cluster_id' in data:
                        # Generate agent token from the install process
                        # The server should return the agent_token
                        agent_token = data.get('agent_token', install_token)

                        return AgentConfig(
                            api_url=api_url,
                            agent_token=agent_token,
                            cluster_id=data['cluster_id']
                        )

                elif response.status_code == 410:
                    logger.error("Install token has expired. Please create a new cluster.")
                    return None
                elif response.status_code == 404:
                    continue  # Try next URL

            except httpx.RequestError as e:
                logger.debug(f"Could not reach {url}: {e}")
                continue

    logger.error("Could not fetch configuration. Please provide --api-url, --token, and --cluster-id manually.")
    return None


async def run_agent(config: AgentConfig):
    """Run the Kubervise agent"""
    from kubernetes import client as k8s_client, config as k8s_config
    from kubernetes.client.rest import ApiException

    logger.info("=" * 60)
    logger.info("  Kubervise Agent")
    logger.info("=" * 60)
    logger.info(f"  API URL:    {config.api_url}")
    logger.info(f"  Cluster ID: {config.cluster_id}")
    logger.info(f"  Sync:       every {config.sync_interval}s")
    logger.info("=" * 60)

    # Connect to Kubernetes
    try:
        try:
            k8s_config.load_incluster_config()
            logger.info("Connected to Kubernetes (in-cluster)")
        except k8s_config.ConfigException:
            k8s_config.load_kube_config()
            logger.info("Connected to Kubernetes (kubeconfig)")
    except Exception as e:
        logger.error(f"Failed to connect to Kubernetes: {e}")
        logger.error("Make sure you're running inside a cluster or have a valid kubeconfig")
        sys.exit(1)

    v1 = k8s_client.CoreV1Api()
    apps_v1 = k8s_client.AppsV1Api()

    # Create HTTP client for API
    http_client = httpx.AsyncClient(
        base_url=config.api_url,
        headers={
            "Authorization": f"Bearer {config.agent_token}",
            "Content-Type": "application/json",
        },
        timeout=30.0,
    )

    running = True

    def signal_handler(signum, frame):
        nonlocal running
        logger.info("Shutdown signal received...")
        running = False

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    logger.info("Agent started. Press Ctrl+C to stop.")

    while running:
        try:
            # Collect cluster data
            nodes_data = []
            pods_data = []
            namespaces_data = []
            deployments_data = []
            services_data = []

            # Get nodes
            try:
                nodes = v1.list_node()
                for node in nodes.items:
                    status = "Unknown"
                    for condition in node.status.conditions:
                        if condition.type == "Ready":
                            status = "Ready" if condition.status == "True" else "NotReady"

                    node_info = node.status.node_info
                    nodes_data.append({
                        "name": node.metadata.name,
                        "status": status,
                        "capacity_cpu": node.status.capacity.get("cpu", "N/A"),
                        "capacity_memory": node.status.capacity.get("memory", "N/A"),
                        "allocatable_cpu": node.status.allocatable.get("cpu", "N/A"),
                        "allocatable_memory": node.status.allocatable.get("memory", "N/A"),
                        "kubernetes_version": node_info.kubelet_version if node_info else None,
                        "os_image": node_info.os_image if node_info else None,
                        "container_runtime": node_info.container_runtime_version if node_info else None,
                    })
            except ApiException as e:
                logger.warning(f"Could not list nodes: {e.reason}")

            # Get namespaces
            try:
                namespaces = v1.list_namespace()
                for ns in namespaces.items:
                    namespaces_data.append({
                        "name": ns.metadata.name,
                        "status": ns.status.phase if ns.status else "Active",
                    })
            except ApiException as e:
                logger.warning(f"Could not list namespaces: {e.reason}")

            # Get pods
            try:
                pods = v1.list_pod_for_all_namespaces()
                for pod in pods.items:
                    restart_count = 0
                    if pod.status.container_statuses:
                        restart_count = sum(cs.restart_count for cs in pod.status.container_statuses)

                    pods_data.append({
                        "name": pod.metadata.name,
                        "namespace": pod.metadata.namespace,
                        "status": pod.status.phase,
                        "node": pod.spec.node_name,
                        "pod_ip": pod.status.pod_ip,
                        "restart_count": restart_count,
                        "created": pod.metadata.creation_timestamp.isoformat() if pod.metadata.creation_timestamp else None,
                    })
            except ApiException as e:
                logger.warning(f"Could not list pods: {e.reason}")

            # Get deployments
            try:
                deployments = apps_v1.list_deployment_for_all_namespaces()
                for dep in deployments.items:
                    deployments_data.append({
                        "name": dep.metadata.name,
                        "namespace": dep.metadata.namespace,
                        "replicas": dep.spec.replicas or 0,
                        "ready_replicas": dep.status.ready_replicas or 0,
                        "available_replicas": dep.status.available_replicas or 0,
                    })
            except ApiException as e:
                logger.warning(f"Could not list deployments: {e.reason}")

            # Get services
            try:
                services = v1.list_service_for_all_namespaces()
                for svc in services.items:
                    services_data.append({
                        "name": svc.metadata.name,
                        "namespace": svc.metadata.namespace,
                        "type": svc.spec.type,
                        "cluster_ip": svc.spec.cluster_ip,
                    })
            except ApiException as e:
                logger.warning(f"Could not list services: {e.reason}")

            # Build snapshot
            snapshot = {
                "nodes": nodes_data,
                "pods": pods_data,
                "namespaces": namespaces_data,
                "deployments": deployments_data,
                "services": services_data,
                "statefulsets": [],
                "daemonsets": [],
                "events": [],
            }

            # Send to API
            try:
                response = await http_client.post(
                    f"/api/clusters/{config.cluster_id}/snapshot",
                    json=snapshot,
                )

                if response.status_code == 200:
                    logger.info(
                        f"Sync OK: {len(nodes_data)} nodes, {len(pods_data)} pods, "
                        f"{len(deployments_data)} deployments"
                    )
                elif response.status_code == 403:
                    logger.error("Authentication failed. Check your agent token.")
                elif response.status_code == 404:
                    logger.error("Cluster not found. Check your cluster ID.")
                else:
                    logger.warning(f"Sync failed: {response.status_code} - {response.text}")

            except httpx.RequestError as e:
                logger.warning(f"Could not reach API: {e}")

        except Exception as e:
            logger.error(f"Error during sync: {e}")

        # Wait for next sync
        for _ in range(config.sync_interval):
            if not running:
                break
            await asyncio.sleep(1)

    await http_client.aclose()
    logger.info("Agent stopped.")


@click.command()
@click.option('--api-url', envvar='KUBERVISE_API_URL', help='Kubervise API URL')
@click.option('--token', envvar='KUBERVISE_AGENT_TOKEN', help='Agent authentication token')
@click.option('--cluster-id', envvar='KUBERVISE_CLUSTER_ID', help='Cluster ID (UUID)')
@click.option('--install-token', envvar='KUBERVISE_INSTALL_TOKEN', help='Install token (fetches config automatically)')
@click.option('--sync-interval', default=30, help='Sync interval in seconds (default: 30)')
@click.version_option(version='1.0.0')
def main(api_url: Optional[str], token: Optional[str], cluster_id: Optional[str],
         install_token: Optional[str], sync_interval: int):
    """
    Kubervise Agent - Kubernetes Cluster Monitoring

    Connect your Kubernetes cluster to Kubervise for monitoring and observability.

    \b
    Examples:
        # Using direct configuration:
        agentkubervise --api-url https://app.kubervise.io --token abc123 --cluster-id uuid

        # Using install token (auto-configure):
        agentkubervise --install-token YOUR_INSTALL_TOKEN

        # Using environment variables:
        export KUBERVISE_API_URL=https://app.kubervise.io
        export KUBERVISE_AGENT_TOKEN=abc123
        export KUBERVISE_CLUSTER_ID=uuid
        agentkubervise
    """

    config = None

    # Try install token first
    if install_token:
        logger.info("Fetching configuration using install token...")
        config = asyncio.run(fetch_config_from_install_token(install_token))
        if not config:
            sys.exit(1)

    # Otherwise use direct configuration
    elif api_url and token and cluster_id:
        config = AgentConfig(
            api_url=api_url,
            agent_token=token,
            cluster_id=cluster_id
        )

    else:
        click.echo("Error: Please provide either --install-token or all of --api-url, --token, --cluster-id")
        click.echo("\nRun 'agentkubervise --help' for more information.")
        sys.exit(1)

    config.sync_interval = sync_interval

    # Run the agent
    asyncio.run(run_agent(config))


if __name__ == '__main__':
    main()
