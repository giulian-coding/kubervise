"""FastAPI Worker für Kubernetes Cluster Überwachung mit Supabase Sync"""
import asyncio
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Dict, List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from kubernetes import client, config, watch
from kubernetes.client.rest import ApiException
from pydantic import BaseModel
import logging

from config import settings
from supabase_client import supabase_sync

# Logging konfigurieren
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class ClusterStatus(BaseModel):
    """Cluster Status Model"""
    connected: bool
    nodes: int
    pods: int
    namespaces: int
    last_check: str


class PodInfo(BaseModel):
    """Pod Information Model"""
    name: str
    namespace: str
    status: str
    node: Optional[str]
    created: str


class NodeInfo(BaseModel):
    """Node Information Model"""
    name: str
    status: str
    capacity_cpu: str
    capacity_memory: str
    allocatable_cpu: str
    allocatable_memory: str


class ClusterWatcher:
    """Kubernetes Cluster Watcher mit Supabase Sync"""

    def __init__(self):
        self.v1 = None
        self.connected = False
        self.watching = False
        self.syncing = False

    async def connect(self):
        """Verbindung zum Kubernetes Cluster herstellen"""
        try:
            # Versuche in-cluster config, dann kubeconfig
            try:
                config.load_incluster_config()
                logger.info("Verbunden mit in-cluster Kubernetes config")
            except config.ConfigException:
                config.load_kube_config()
                logger.info("Verbunden mit lokaler kubeconfig")

            self.v1 = client.CoreV1Api()
            self.connected = True
            return True
        except Exception as e:
            logger.error(f"Fehler bei Kubernetes Verbindung: {e}")
            self.connected = False
            return False

    async def get_cluster_status(self) -> ClusterStatus:
        """Cluster Status abrufen"""
        if not self.connected:
            raise HTTPException(status_code=503, detail="Nicht mit Cluster verbunden")

        try:
            nodes = self.v1.list_node()
            pods = self.v1.list_pod_for_all_namespaces()
            namespaces = self.v1.list_namespace()

            return ClusterStatus(
                connected=True,
                nodes=len(nodes.items),
                pods=len(pods.items),
                namespaces=len(namespaces.items),
                last_check=datetime.utcnow().isoformat()
            )
        except ApiException as e:
            logger.error(f"Fehler beim Abrufen des Cluster Status: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    async def get_pods(self, namespace: Optional[str] = None) -> List[PodInfo]:
        """Pods abrufen"""
        if not self.connected:
            raise HTTPException(status_code=503, detail="Nicht mit Cluster verbunden")

        try:
            if namespace:
                pods = self.v1.list_namespaced_pod(namespace)
            else:
                pods = self.v1.list_pod_for_all_namespaces()

            return [
                PodInfo(
                    name=pod.metadata.name,
                    namespace=pod.metadata.namespace,
                    status=pod.status.phase,
                    node=pod.spec.node_name,
                    created=pod.metadata.creation_timestamp.isoformat()
                )
                for pod in pods.items
            ]
        except ApiException as e:
            logger.error(f"Fehler beim Abrufen der Pods: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    async def get_pods_raw(self, namespace: Optional[str] = None) -> List[Dict]:
        """Pods als Dict für Supabase Sync"""
        if not self.connected:
            return []

        try:
            if namespace:
                pods = self.v1.list_namespaced_pod(namespace)
            else:
                pods = self.v1.list_pod_for_all_namespaces()

            pod_list = []
            for pod in pods.items:
                restart_count = 0
                if pod.status.container_statuses:
                    restart_count = sum(
                        cs.restart_count for cs in pod.status.container_statuses
                    )

                pod_list.append({
                    "name": pod.metadata.name,
                    "namespace": pod.metadata.namespace,
                    "status": pod.status.phase,
                    "node": pod.spec.node_name,
                    "pod_ip": pod.status.pod_ip,
                    "restart_count": restart_count,
                    "created": pod.metadata.creation_timestamp.isoformat()
                })

            return pod_list
        except ApiException as e:
            logger.error(f"Fehler beim Abrufen der Pods: {e}")
            return []

    async def get_nodes(self) -> List[NodeInfo]:
        """Nodes abrufen"""
        if not self.connected:
            raise HTTPException(status_code=503, detail="Nicht mit Cluster verbunden")

        try:
            nodes = self.v1.list_node()

            node_list = []
            for node in nodes.items:
                status = "Unknown"
                for condition in node.status.conditions:
                    if condition.type == "Ready":
                        status = "Ready" if condition.status == "True" else "NotReady"

                node_list.append(NodeInfo(
                    name=node.metadata.name,
                    status=status,
                    capacity_cpu=node.status.capacity.get("cpu", "N/A"),
                    capacity_memory=node.status.capacity.get("memory", "N/A"),
                    allocatable_cpu=node.status.allocatable.get("cpu", "N/A"),
                    allocatable_memory=node.status.allocatable.get("memory", "N/A")
                ))

            return node_list
        except ApiException as e:
            logger.error(f"Fehler beim Abrufen der Nodes: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    async def get_nodes_raw(self) -> List[Dict]:
        """Nodes als Dict für Supabase Sync"""
        if not self.connected:
            return []

        try:
            nodes = self.v1.list_node()

            node_list = []
            for node in nodes.items:
                status = "Unknown"
                for condition in node.status.conditions:
                    if condition.type == "Ready":
                        status = "Ready" if condition.status == "True" else "NotReady"

                node_info = node.status.node_info
                node_list.append({
                    "name": node.metadata.name,
                    "status": status,
                    "capacity_cpu": node.status.capacity.get("cpu", "N/A"),
                    "capacity_memory": node.status.capacity.get("memory", "N/A"),
                    "allocatable_cpu": node.status.allocatable.get("cpu", "N/A"),
                    "allocatable_memory": node.status.allocatable.get("memory", "N/A"),
                    "kubernetes_version": node_info.kubelet_version if node_info else None,
                    "os_image": node_info.os_image if node_info else None,
                    "container_runtime": node_info.container_runtime_version if node_info else None
                })

            return node_list
        except ApiException as e:
            logger.error(f"Fehler beim Abrufen der Nodes: {e}")
            return []

    async def get_namespaces_raw(self) -> List[Dict]:
        """Namespaces als Dict für Supabase Sync"""
        if not self.connected:
            return []

        try:
            namespaces = self.v1.list_namespace()
            return [
                {
                    "name": ns.metadata.name,
                    "status": ns.status.phase if ns.status else "Active"
                }
                for ns in namespaces.items
            ]
        except ApiException as e:
            logger.error(f"Fehler beim Abrufen der Namespaces: {e}")
            return []

    async def watch_events(self):
        """Kubernetes Events überwachen und zu Supabase synchronisieren"""
        if not self.connected:
            logger.warning("Nicht mit Cluster verbunden, kann Events nicht überwachen")
            return

        self.watching = True
        w = watch.Watch()

        try:
            logger.info("Starte Event-Überwachung...")
            for event in w.stream(self.v1.list_event_for_all_namespaces, timeout_seconds=0):
                if not self.watching:
                    break

                event_obj = event['object']
                event_type = event_obj.type or "Normal"

                logger.info(
                    f"Event: {event['type']} - {event_obj.involved_object.kind}/"
                    f"{event_obj.involved_object.name} in {event_obj.involved_object.namespace}: "
                    f"{event_obj.message}"
                )

                # Event zu Supabase synchronisieren
                if supabase_sync.connected:
                    await supabase_sync.add_event(
                        event_type=event_type,
                        reason=event_obj.reason or "",
                        message=event_obj.message or "",
                        involved_kind=event_obj.involved_object.kind,
                        involved_name=event_obj.involved_object.name,
                        involved_namespace=event_obj.involved_object.namespace,
                        source_component=event_obj.source.component if event_obj.source else None
                    )
        except Exception as e:
            logger.error(f"Fehler bei Event-Überwachung: {e}")
        finally:
            w.stop()
            self.watching = False

    async def sync_to_supabase(self):
        """Periodische Synchronisation zu Supabase"""
        if not supabase_sync.connected:
            logger.warning("Supabase nicht verbunden, überspringe Sync")
            return

        self.syncing = True
        logger.info("Starte periodische Supabase-Synchronisation...")

        while self.syncing:
            try:
                if self.connected:
                    # Get current cluster data
                    nodes = await self.get_nodes_raw()
                    pods = await self.get_pods_raw()
                    namespaces = await self.get_namespaces_raw()

                    # Calculate totals
                    total_cpu_capacity = ""
                    total_memory_capacity = ""
                    total_cpu_allocatable = ""
                    total_memory_allocatable = ""

                    if nodes:
                        # Sum up resources (simplified - assumes all in same unit)
                        cpu_cap = sum(
                            int(n["capacity_cpu"].replace("m", "")) if "m" in n.get("capacity_cpu", "0")
                            else int(n.get("capacity_cpu", "0")) * 1000
                            for n in nodes if n.get("capacity_cpu", "N/A") != "N/A"
                        )
                        total_cpu_capacity = f"{cpu_cap}m"

                    # Sync cluster status
                    await supabase_sync.update_cluster_status(
                        node_count=len(nodes),
                        pod_count=len(pods),
                        namespace_count=len(namespaces),
                        cpu_capacity=total_cpu_capacity if total_cpu_capacity else None,
                        memory_capacity=total_memory_capacity if total_memory_capacity else None
                    )

                    # Sync nodes
                    await supabase_sync.sync_nodes(nodes)

                    # Sync namespaces and get IDs
                    namespace_ids = await supabase_sync.sync_namespaces(namespaces)

                    # Sync pods
                    await supabase_sync.sync_pods(pods, namespace_ids)

                    logger.info(
                        f"Sync abgeschlossen: {len(nodes)} nodes, {len(pods)} pods, "
                        f"{len(namespaces)} namespaces"
                    )
                else:
                    logger.warning("Kubernetes nicht verbunden, überspringe Sync")

            except Exception as e:
                logger.error(f"Fehler bei Supabase Sync: {e}")

            # Warten bis zum nächsten Sync
            await asyncio.sleep(settings.sync_interval)

        logger.info("Supabase-Synchronisation gestoppt")


# Global Watcher Instanz
watcher = ClusterWatcher()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle Management"""
    # Startup
    logger.info("Starte Observe Worker...")
    await watcher.connect()

    # Supabase verbinden
    supabase_sync.connect()

    # Background Tasks starten
    event_task = asyncio.create_task(watcher.watch_events())
    sync_task = asyncio.create_task(watcher.sync_to_supabase())

    yield

    # Shutdown
    logger.info("Stoppe Observe Worker...")
    watcher.watching = False
    watcher.syncing = False

    # Cluster als disconnected markieren
    await supabase_sync.set_disconnected()

    # Tasks beenden
    event_task.cancel()
    sync_task.cancel()

    try:
        await event_task
    except asyncio.CancelledError:
        pass

    try:
        await sync_task
    except asyncio.CancelledError:
        pass


# FastAPI App erstellen
app = FastAPI(
    title="Kubervise Observe Worker",
    description="Kubernetes Cluster Überwachungs-Worker mit Supabase Sync",
    version="0.2.0",
    lifespan=lifespan
)


@app.get("/")
async def root():
    """Root Endpoint"""
    return {
        "service": "Kubervise Observe Worker",
        "version": "0.2.0",
        "status": "running"
    }


@app.get("/health")
async def health():
    """Health Check"""
    return {
        "status": "healthy",
        "kubernetes_connected": watcher.connected,
        "supabase_connected": supabase_sync.connected,
        "watching_events": watcher.watching,
        "syncing": watcher.syncing,
        "timestamp": datetime.utcnow().isoformat()
    }


@app.get("/cluster/status", response_model=ClusterStatus)
async def get_cluster_status():
    """Cluster Status abrufen"""
    return await watcher.get_cluster_status()


@app.get("/cluster/pods", response_model=List[PodInfo])
async def get_pods(namespace: Optional[str] = None):
    """Alle Pods oder Pods in einem bestimmten Namespace abrufen"""
    return await watcher.get_pods(namespace)


@app.get("/cluster/nodes", response_model=List[NodeInfo])
async def get_nodes():
    """Alle Nodes abrufen"""
    return await watcher.get_nodes()


@app.post("/cluster/reconnect")
async def reconnect():
    """Verbindung zum Cluster neu herstellen"""
    success = await watcher.connect()
    if success:
        return {"status": "connected"}
    else:
        raise HTTPException(status_code=503, detail="Verbindung fehlgeschlagen")


@app.post("/sync/trigger")
async def trigger_sync():
    """Manuelle Synchronisation auslösen"""
    if not supabase_sync.connected:
        raise HTTPException(status_code=503, detail="Supabase nicht verbunden")

    try:
        nodes = await watcher.get_nodes_raw()
        pods = await watcher.get_pods_raw()
        namespaces = await watcher.get_namespaces_raw()

        await supabase_sync.update_cluster_status(
            node_count=len(nodes),
            pod_count=len(pods),
            namespace_count=len(namespaces)
        )

        await supabase_sync.sync_nodes(nodes)
        namespace_ids = await supabase_sync.sync_namespaces(namespaces)
        await supabase_sync.sync_pods(pods, namespace_ids)

        return {
            "status": "synced",
            "nodes": len(nodes),
            "pods": len(pods),
            "namespaces": len(namespaces)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=settings.api_host, port=settings.api_port)
