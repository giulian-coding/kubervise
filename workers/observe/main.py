"""FastAPI Worker für Kubernetes Cluster Überwachung"""
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
    """Kubernetes Cluster Watcher"""
    
    def __init__(self):
        self.v1 = None
        self.connected = False
        self.watching = False
        
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
    
    async def watch_events(self):
        """Kubernetes Events überwachen (Background Task)"""
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
                logger.info(
                    f"Event: {event['type']} - {event_obj.involved_object.kind}/"
                    f"{event_obj.involved_object.name} in {event_obj.involved_object.namespace}: "
                    f"{event_obj.message}"
                )
        except Exception as e:
            logger.error(f"Fehler bei Event-Überwachung: {e}")
        finally:
            w.stop()
            self.watching = False


# Global Watcher Instanz
watcher = ClusterWatcher()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle Management"""
    # Startup
    logger.info("Starte Observe Worker...")
    await watcher.connect()
    
    # Background Task für Event-Überwachung starten
    asyncio.create_task(watcher.watch_events())
    
    yield
    
    # Shutdown
    logger.info("Stoppe Observe Worker...")
    watcher.watching = False


# FastAPI App erstellen
app = FastAPI(
    title="Kubervise Observe Worker",
    description="Kubernetes Cluster Überwachungs-Worker",
    version="0.1.0",
    lifespan=lifespan
)


@app.get("/")
async def root():
    """Root Endpoint"""
    return {
        "service": "Kubervise Observe Worker",
        "version": "0.1.0",
        "status": "running"
    }


@app.get("/health")
async def health():
    """Health Check"""
    return {
        "status": "healthy",
        "connected": watcher.connected,
        "watching": watcher.watching,
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
