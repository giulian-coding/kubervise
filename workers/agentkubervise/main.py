"""FastAPI Worker für Kubernetes Cluster Überwachung mit API Sync"""
import asyncio
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Dict, List, Optional, Any

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from kubernetes import client, config, watch
from kubernetes.client.rest import ApiException
from pydantic import BaseModel
import logging

from config import settings

# Import sync client based on configuration
# Prefer API-based sync over legacy Supabase direct access
if settings.api_url and settings.agent_token:
    from api_client import api_sync as data_sync
    SYNC_MODE = "api"
else:
    from supabase_client import supabase_sync as data_sync
    SYNC_MODE = "supabase"

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


class DeploymentInfo(BaseModel):
    """Deployment Information Model"""
    name: str
    namespace: str
    replicas: int
    ready_replicas: int
    available_replicas: int
    strategy: str
    created: str


class StatefulSetInfo(BaseModel):
    """StatefulSet Information Model"""
    name: str
    namespace: str
    replicas: int
    ready_replicas: int
    service_name: str
    created: str


class DaemonSetInfo(BaseModel):
    """DaemonSet Information Model"""
    name: str
    namespace: str
    desired_nodes: int
    ready_nodes: int
    created: str


class ServiceInfo(BaseModel):
    """Service Information Model"""
    name: str
    namespace: str
    type: str
    cluster_ip: Optional[str]
    external_ip: Optional[str]
    ports: List[Dict]
    created: str


class IngressInfo(BaseModel):
    """Ingress Information Model"""
    name: str
    namespace: str
    ingress_class: Optional[str]
    hosts: List[str]
    tls: bool
    created: str


class JobInfo(BaseModel):
    """Job Information Model"""
    name: str
    namespace: str
    completions: int
    succeeded: int
    failed: int
    active: int
    status: str
    created: str


class ClusterWatcher:
    """Kubernetes Cluster Watcher mit Supabase Sync"""

    def __init__(self):
        self.v1: Optional[client.CoreV1Api] = None
        self.apps_v1: Optional[client.AppsV1Api] = None
        self.networking_v1: Optional[client.NetworkingV1Api] = None
        self.batch_v1: Optional[client.BatchV1Api] = None
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
            self.apps_v1 = client.AppsV1Api()
            self.networking_v1 = client.NetworkingV1Api()
            self.batch_v1 = client.BatchV1Api()
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

    # ==================== DEPLOYMENTS ====================

    async def get_deployments(self, namespace: Optional[str] = None) -> List[DeploymentInfo]:
        """Deployments abrufen"""
        if not self.connected or not self.apps_v1:
            raise HTTPException(status_code=503, detail="Nicht mit Cluster verbunden")

        try:
            if namespace:
                deployments = self.apps_v1.list_namespaced_deployment(namespace)
            else:
                deployments = self.apps_v1.list_deployment_for_all_namespaces()

            return [
                DeploymentInfo(
                    name=dep.metadata.name,
                    namespace=dep.metadata.namespace,
                    replicas=dep.spec.replicas or 0,
                    ready_replicas=dep.status.ready_replicas or 0,
                    available_replicas=dep.status.available_replicas or 0,
                    strategy=dep.spec.strategy.type if dep.spec.strategy else "RollingUpdate",
                    created=dep.metadata.creation_timestamp.isoformat()
                )
                for dep in deployments.items
            ]
        except ApiException as e:
            logger.error(f"Fehler beim Abrufen der Deployments: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    async def get_deployments_raw(self) -> List[Dict]:
        """Deployments als Dict für Supabase Sync"""
        if not self.connected or not self.apps_v1:
            return []

        try:
            deployments = self.apps_v1.list_deployment_for_all_namespaces()
            return [
                {
                    "name": dep.metadata.name,
                    "namespace": dep.metadata.namespace,
                    "replicas": dep.spec.replicas or 0,
                    "ready_replicas": dep.status.ready_replicas or 0,
                    "available_replicas": dep.status.available_replicas or 0,
                    "strategy": dep.spec.strategy.type if dep.spec.strategy else "RollingUpdate",
                    "created": dep.metadata.creation_timestamp.isoformat()
                }
                for dep in deployments.items
            ]
        except ApiException as e:
            logger.error(f"Fehler beim Abrufen der Deployments: {e}")
            return []

    # ==================== STATEFULSETS ====================

    async def get_statefulsets(self, namespace: Optional[str] = None) -> List[StatefulSetInfo]:
        """StatefulSets abrufen"""
        if not self.connected or not self.apps_v1:
            raise HTTPException(status_code=503, detail="Nicht mit Cluster verbunden")

        try:
            if namespace:
                statefulsets = self.apps_v1.list_namespaced_stateful_set(namespace)
            else:
                statefulsets = self.apps_v1.list_stateful_set_for_all_namespaces()

            return [
                StatefulSetInfo(
                    name=sts.metadata.name,
                    namespace=sts.metadata.namespace,
                    replicas=sts.spec.replicas or 0,
                    ready_replicas=sts.status.ready_replicas or 0,
                    service_name=sts.spec.service_name or "",
                    created=sts.metadata.creation_timestamp.isoformat()
                )
                for sts in statefulsets.items
            ]
        except ApiException as e:
            logger.error(f"Fehler beim Abrufen der StatefulSets: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    async def get_statefulsets_raw(self) -> List[Dict]:
        """StatefulSets als Dict für Supabase Sync"""
        if not self.connected or not self.apps_v1:
            return []

        try:
            statefulsets = self.apps_v1.list_stateful_set_for_all_namespaces()
            return [
                {
                    "name": sts.metadata.name,
                    "namespace": sts.metadata.namespace,
                    "replicas": sts.spec.replicas or 0,
                    "ready_replicas": sts.status.ready_replicas or 0,
                    "service_name": sts.spec.service_name or "",
                    "created": sts.metadata.creation_timestamp.isoformat()
                }
                for sts in statefulsets.items
            ]
        except ApiException as e:
            logger.error(f"Fehler beim Abrufen der StatefulSets: {e}")
            return []

    # ==================== DAEMONSETS ====================

    async def get_daemonsets(self, namespace: Optional[str] = None) -> List[DaemonSetInfo]:
        """DaemonSets abrufen"""
        if not self.connected or not self.apps_v1:
            raise HTTPException(status_code=503, detail="Nicht mit Cluster verbunden")

        try:
            if namespace:
                daemonsets = self.apps_v1.list_namespaced_daemon_set(namespace)
            else:
                daemonsets = self.apps_v1.list_daemon_set_for_all_namespaces()

            return [
                DaemonSetInfo(
                    name=ds.metadata.name,
                    namespace=ds.metadata.namespace,
                    desired_nodes=ds.status.desired_number_scheduled or 0,
                    ready_nodes=ds.status.number_ready or 0,
                    created=ds.metadata.creation_timestamp.isoformat()
                )
                for ds in daemonsets.items
            ]
        except ApiException as e:
            logger.error(f"Fehler beim Abrufen der DaemonSets: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    async def get_daemonsets_raw(self) -> List[Dict]:
        """DaemonSets als Dict für Supabase Sync"""
        if not self.connected or not self.apps_v1:
            return []

        try:
            daemonsets = self.apps_v1.list_daemon_set_for_all_namespaces()
            return [
                {
                    "name": ds.metadata.name,
                    "namespace": ds.metadata.namespace,
                    "desired_nodes": ds.status.desired_number_scheduled or 0,
                    "ready_nodes": ds.status.number_ready or 0,
                    "created": ds.metadata.creation_timestamp.isoformat()
                }
                for ds in daemonsets.items
            ]
        except ApiException as e:
            logger.error(f"Fehler beim Abrufen der DaemonSets: {e}")
            return []

    # ==================== SERVICES ====================

    async def get_services(self, namespace: Optional[str] = None) -> List[ServiceInfo]:
        """Services abrufen"""
        if not self.connected:
            raise HTTPException(status_code=503, detail="Nicht mit Cluster verbunden")

        try:
            if namespace:
                services = self.v1.list_namespaced_service(namespace)
            else:
                services = self.v1.list_service_for_all_namespaces()

            result = []
            for svc in services.items:
                external_ip = None
                if svc.status.load_balancer and svc.status.load_balancer.ingress:
                    ing = svc.status.load_balancer.ingress[0]
                    external_ip = ing.ip or ing.hostname

                ports = []
                if svc.spec.ports:
                    ports = [
                        {
                            "port": p.port,
                            "target_port": str(p.target_port),
                            "protocol": p.protocol,
                            "node_port": p.node_port
                        }
                        for p in svc.spec.ports
                    ]

                result.append(ServiceInfo(
                    name=svc.metadata.name,
                    namespace=svc.metadata.namespace,
                    type=svc.spec.type,
                    cluster_ip=svc.spec.cluster_ip,
                    external_ip=external_ip,
                    ports=ports,
                    created=svc.metadata.creation_timestamp.isoformat()
                ))

            return result
        except ApiException as e:
            logger.error(f"Fehler beim Abrufen der Services: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    async def get_services_raw(self) -> List[Dict]:
        """Services als Dict für Supabase Sync"""
        if not self.connected:
            return []

        try:
            services = self.v1.list_service_for_all_namespaces()
            result = []

            for svc in services.items:
                external_ip = None
                if svc.status.load_balancer and svc.status.load_balancer.ingress:
                    ing = svc.status.load_balancer.ingress[0]
                    external_ip = ing.ip or ing.hostname

                ports = []
                if svc.spec.ports:
                    ports = [
                        {
                            "port": p.port,
                            "target_port": str(p.target_port),
                            "protocol": p.protocol,
                            "node_port": p.node_port
                        }
                        for p in svc.spec.ports
                    ]

                result.append({
                    "name": svc.metadata.name,
                    "namespace": svc.metadata.namespace,
                    "type": svc.spec.type,
                    "cluster_ip": svc.spec.cluster_ip,
                    "external_ip": external_ip,
                    "ports": ports,
                    "created": svc.metadata.creation_timestamp.isoformat()
                })

            return result
        except ApiException as e:
            logger.error(f"Fehler beim Abrufen der Services: {e}")
            return []

    # ==================== INGRESSES ====================

    async def get_ingresses(self, namespace: Optional[str] = None) -> List[IngressInfo]:
        """Ingresses abrufen"""
        if not self.connected or not self.networking_v1:
            raise HTTPException(status_code=503, detail="Nicht mit Cluster verbunden")

        try:
            if namespace:
                ingresses = self.networking_v1.list_namespaced_ingress(namespace)
            else:
                ingresses = self.networking_v1.list_ingress_for_all_namespaces()

            result = []
            for ing in ingresses.items:
                hosts = []
                if ing.spec.rules:
                    hosts = [r.host for r in ing.spec.rules if r.host]

                result.append(IngressInfo(
                    name=ing.metadata.name,
                    namespace=ing.metadata.namespace,
                    ingress_class=ing.spec.ingress_class_name,
                    hosts=hosts,
                    tls=bool(ing.spec.tls),
                    created=ing.metadata.creation_timestamp.isoformat()
                ))

            return result
        except ApiException as e:
            logger.error(f"Fehler beim Abrufen der Ingresses: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    async def get_ingresses_raw(self) -> List[Dict]:
        """Ingresses als Dict für Supabase Sync"""
        if not self.connected or not self.networking_v1:
            return []

        try:
            ingresses = self.networking_v1.list_ingress_for_all_namespaces()
            result = []

            for ing in ingresses.items:
                hosts = []
                if ing.spec.rules:
                    hosts = [r.host for r in ing.spec.rules if r.host]

                address = None
                if ing.status.load_balancer and ing.status.load_balancer.ingress:
                    lb = ing.status.load_balancer.ingress[0]
                    address = lb.ip or lb.hostname

                result.append({
                    "name": ing.metadata.name,
                    "namespace": ing.metadata.namespace,
                    "ingress_class": ing.spec.ingress_class_name,
                    "hosts": hosts,
                    "tls": bool(ing.spec.tls),
                    "address": address,
                    "created": ing.metadata.creation_timestamp.isoformat()
                })

            return result
        except ApiException as e:
            logger.error(f"Fehler beim Abrufen der Ingresses: {e}")
            return []

    # ==================== JOBS ====================

    async def get_jobs(self, namespace: Optional[str] = None) -> List[JobInfo]:
        """Jobs abrufen"""
        if not self.connected or not self.batch_v1:
            raise HTTPException(status_code=503, detail="Nicht mit Cluster verbunden")

        try:
            if namespace:
                jobs = self.batch_v1.list_namespaced_job(namespace)
            else:
                jobs = self.batch_v1.list_job_for_all_namespaces()

            result = []
            for job in jobs.items:
                status = "Running"
                if job.status.succeeded and job.status.succeeded >= (job.spec.completions or 1):
                    status = "Completed"
                elif job.status.failed and job.status.failed > 0:
                    status = "Failed"

                result.append(JobInfo(
                    name=job.metadata.name,
                    namespace=job.metadata.namespace,
                    completions=job.spec.completions or 1,
                    succeeded=job.status.succeeded or 0,
                    failed=job.status.failed or 0,
                    active=job.status.active or 0,
                    status=status,
                    created=job.metadata.creation_timestamp.isoformat()
                ))

            return result
        except ApiException as e:
            logger.error(f"Fehler beim Abrufen der Jobs: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    async def get_jobs_raw(self) -> List[Dict]:
        """Jobs als Dict für Supabase Sync"""
        if not self.connected or not self.batch_v1:
            return []

        try:
            jobs = self.batch_v1.list_job_for_all_namespaces()
            result = []

            for job in jobs.items:
                status = "Running"
                if job.status.succeeded and job.status.succeeded >= (job.spec.completions or 1):
                    status = "Completed"
                elif job.status.failed and job.status.failed > 0:
                    status = "Failed"

                result.append({
                    "name": job.metadata.name,
                    "namespace": job.metadata.namespace,
                    "completions": job.spec.completions or 1,
                    "succeeded": job.status.succeeded or 0,
                    "failed": job.status.failed or 0,
                    "active": job.status.active or 0,
                    "status": status,
                    "created": job.metadata.creation_timestamp.isoformat()
                })

            return result
        except ApiException as e:
            logger.error(f"Fehler beim Abrufen der Jobs: {e}")
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

                # Event synchronisieren (nur im Legacy-Modus)
                if SYNC_MODE == "supabase" and data_sync.connected:
                    await data_sync.add_event(
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

    async def sync_data(self):
        """Periodische Synchronisation zur API/Supabase"""
        if not data_sync.connected:
            logger.warning("Sync-Client nicht verbunden, überspringe Sync")
            return

        self.syncing = True
        logger.info(f"Starte periodische Synchronisation (Modus: {SYNC_MODE})...")

        while self.syncing:
            try:
                if self.connected:
                    # Get current cluster data
                    nodes = await self.get_nodes_raw()
                    pods = await self.get_pods_raw()
                    namespaces = await self.get_namespaces_raw()
                    deployments = await self.get_deployments_raw()
                    statefulsets = await self.get_statefulsets_raw()
                    daemonsets = await self.get_daemonsets_raw()
                    services = await self.get_services_raw()
                    ingresses = await self.get_ingresses_raw()
                    jobs = await self.get_jobs_raw()

                    if SYNC_MODE == "api":
                        # API-based sync - send snapshot to Kubervise API
                        await data_sync.sync_snapshot(
                            nodes=nodes,
                            pods=pods,
                            namespaces=namespaces,
                            deployments=deployments,
                            statefulsets=statefulsets,
                            daemonsets=daemonsets,
                            services=services,
                        )
                    else:
                        # Legacy Supabase direct sync
                        # Calculate totals
                        total_cpu_capacity = ""
                        total_memory_capacity = ""

                        if nodes:
                            # Sum up CPU resources
                            cpu_cap = 0
                            for n in nodes:
                                cpu_val = n.get("capacity_cpu", "0")
                                if cpu_val and cpu_val != "N/A":
                                    try:
                                        if "m" in str(cpu_val):
                                            cpu_cap += int(str(cpu_val).replace("m", ""))
                                        else:
                                            cpu_cap += int(cpu_val) * 1000
                                    except (ValueError, TypeError):
                                        pass
                            total_cpu_capacity = f"{cpu_cap}m" if cpu_cap > 0 else None

                            # Sum up Memory resources
                            mem_cap = 0
                            for n in nodes:
                                mem_val = n.get("capacity_memory", "0")
                                if mem_val and mem_val != "N/A":
                                    try:
                                        # Convert to bytes (simplified)
                                        if "Ki" in str(mem_val):
                                            mem_cap += int(str(mem_val).replace("Ki", "")) * 1024
                                        elif "Mi" in str(mem_val):
                                            mem_cap += int(str(mem_val).replace("Mi", "")) * 1024 * 1024
                                        elif "Gi" in str(mem_val):
                                            mem_cap += int(str(mem_val).replace("Gi", "")) * 1024 * 1024 * 1024
                                    except (ValueError, TypeError):
                                        pass
                            total_memory_capacity = f"{mem_cap // (1024*1024*1024)}Gi" if mem_cap > 0 else None

                        # Sync cluster status
                        await data_sync.update_cluster_status(
                            node_count=len(nodes),
                            pod_count=len(pods),
                            namespace_count=len(namespaces),
                            cpu_capacity=total_cpu_capacity,
                            memory_capacity=total_memory_capacity
                        )

                        # Sync nodes
                        await data_sync.sync_nodes(nodes)

                        # Sync namespaces and get IDs
                        namespace_ids = await data_sync.sync_namespaces(namespaces)

                        # Sync all resources
                        await data_sync.sync_pods(pods, namespace_ids)
                        await data_sync.sync_deployments(deployments, namespace_ids)
                        await data_sync.sync_statefulsets(statefulsets, namespace_ids)
                        await data_sync.sync_daemonsets(daemonsets, namespace_ids)
                        await data_sync.sync_services(services, namespace_ids)
                        await data_sync.sync_ingresses(ingresses, namespace_ids)
                        await data_sync.sync_jobs(jobs, namespace_ids)

                    logger.info(
                        f"Sync abgeschlossen: {len(nodes)} nodes, {len(pods)} pods, "
                        f"{len(deployments)} deployments, {len(services)} services"
                    )
                else:
                    logger.warning("Kubernetes nicht verbunden, überspringe Sync")

            except Exception as e:
                logger.error(f"Fehler bei Sync: {e}")

            # Warten bis zum nächsten Sync
            await asyncio.sleep(settings.sync_interval)

        logger.info("Synchronisation gestoppt")


# Global Watcher Instanz
watcher = ClusterWatcher()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle Management"""
    # Startup
    logger.info(f"Starte Observe Worker (Sync-Modus: {SYNC_MODE})...")
    await watcher.connect()

    # Sync-Client verbinden
    if SYNC_MODE == "api":
        await data_sync.connect()
    else:
        data_sync.connect()

    # Background Tasks starten
    event_task = asyncio.create_task(watcher.watch_events())
    sync_task = asyncio.create_task(watcher.sync_data())

    yield

    # Shutdown
    logger.info("Stoppe Observe Worker...")
    watcher.watching = False
    watcher.syncing = False

    # Cluster als disconnected markieren
    await data_sync.set_disconnected()

    # API-Client schließen
    if SYNC_MODE == "api":
        await data_sync.close()

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
    version="0.3.0",
    lifespan=lifespan
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In Production einschränken
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
        "sync_connected": data_sync.connected,
        "sync_mode": SYNC_MODE,
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


@app.get("/cluster/deployments", response_model=List[DeploymentInfo])
async def get_deployments(namespace: Optional[str] = None):
    """Alle Deployments oder Deployments in einem bestimmten Namespace abrufen"""
    return await watcher.get_deployments(namespace)


@app.get("/cluster/statefulsets", response_model=List[StatefulSetInfo])
async def get_statefulsets(namespace: Optional[str] = None):
    """Alle StatefulSets abrufen"""
    return await watcher.get_statefulsets(namespace)


@app.get("/cluster/daemonsets", response_model=List[DaemonSetInfo])
async def get_daemonsets(namespace: Optional[str] = None):
    """Alle DaemonSets abrufen"""
    return await watcher.get_daemonsets(namespace)


@app.get("/cluster/services", response_model=List[ServiceInfo])
async def get_services(namespace: Optional[str] = None):
    """Alle Services abrufen"""
    return await watcher.get_services(namespace)


@app.get("/cluster/ingresses", response_model=List[IngressInfo])
async def get_ingresses(namespace: Optional[str] = None):
    """Alle Ingresses abrufen"""
    return await watcher.get_ingresses(namespace)


@app.get("/cluster/jobs", response_model=List[JobInfo])
async def get_jobs(namespace: Optional[str] = None):
    """Alle Jobs abrufen"""
    return await watcher.get_jobs(namespace)


@app.get("/cluster/summary")
async def get_cluster_summary():
    """Zusammenfassung aller Cluster-Ressourcen"""
    if not watcher.connected:
        raise HTTPException(status_code=503, detail="Nicht mit Cluster verbunden")

    try:
        nodes = await watcher.get_nodes_raw()
        pods = await watcher.get_pods_raw()
        deployments = await watcher.get_deployments_raw()
        statefulsets = await watcher.get_statefulsets_raw()
        daemonsets = await watcher.get_daemonsets_raw()
        services = await watcher.get_services_raw()
        jobs = await watcher.get_jobs_raw()
        namespaces = await watcher.get_namespaces_raw()

        return {
            "nodes": {
                "total": len(nodes),
                "ready": len([n for n in nodes if n["status"] == "Ready"]),
                "not_ready": len([n for n in nodes if n["status"] != "Ready"])
            },
            "pods": {
                "total": len(pods),
                "running": len([p for p in pods if p["status"] == "Running"]),
                "pending": len([p for p in pods if p["status"] == "Pending"]),
                "failed": len([p for p in pods if p["status"] == "Failed"])
            },
            "deployments": {
                "total": len(deployments),
                "ready": len([d for d in deployments if d["ready_replicas"] == d["replicas"]])
            },
            "statefulsets": {"total": len(statefulsets)},
            "daemonsets": {"total": len(daemonsets)},
            "services": {"total": len(services)},
            "jobs": {
                "total": len(jobs),
                "running": len([j for j in jobs if j["status"] == "Running"]),
                "completed": len([j for j in jobs if j["status"] == "Completed"]),
                "failed": len([j for j in jobs if j["status"] == "Failed"])
            },
            "namespaces": {"total": len(namespaces)},
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"Fehler beim Abrufen der Zusammenfassung: {e}")
        raise HTTPException(status_code=500, detail=str(e))


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
    if not data_sync.connected:
        raise HTTPException(status_code=503, detail="Sync-Client nicht verbunden")

    try:
        nodes = await watcher.get_nodes_raw()
        pods = await watcher.get_pods_raw()
        namespaces = await watcher.get_namespaces_raw()

        if SYNC_MODE == "api":
            await data_sync.sync_snapshot(
                nodes=nodes,
                pods=pods,
                namespaces=namespaces,
            )
        else:
            await data_sync.update_cluster_status(
                node_count=len(nodes),
                pod_count=len(pods),
                namespace_count=len(namespaces)
            )

            await data_sync.sync_nodes(nodes)
            namespace_ids = await data_sync.sync_namespaces(namespaces)
            await data_sync.sync_pods(pods, namespace_ids)

        return {
            "status": "synced",
            "sync_mode": SYNC_MODE,
            "nodes": len(nodes),
            "pods": len(pods),
            "namespaces": len(namespaces)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=settings.api_host, port=settings.api_port)
