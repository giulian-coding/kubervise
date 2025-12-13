"""Supabase Client für den Observe Worker"""
import logging
from datetime import datetime
from typing import Dict, List, Optional
from supabase import create_client, Client

from config import settings

logger = logging.getLogger(__name__)


class SupabaseSync:
    """Synchronisiert Kubernetes-Daten mit Supabase"""

    def __init__(self):
        self.client: Optional[Client] = None
        self.connected = False
        self.cluster_id = settings.cluster_id

    def connect(self) -> bool:
        """Verbindung zu Supabase herstellen"""
        if not settings.supabase_url or not settings.supabase_service_key:
            logger.warning("Supabase URL oder Service Key nicht konfiguriert")
            return False

        try:
            self.client = create_client(
                settings.supabase_url,
                settings.supabase_service_key
            )
            self.connected = True
            logger.info("Verbunden mit Supabase")
            return True
        except Exception as e:
            logger.error(f"Fehler bei Supabase Verbindung: {e}")
            self.connected = False
            return False

    async def update_cluster_status(
        self,
        node_count: int,
        pod_count: int,
        namespace_count: int,
        cpu_capacity: str = None,
        memory_capacity: str = None,
        cpu_allocatable: str = None,
        memory_allocatable: str = None
    ) -> bool:
        """Cluster-Status in Supabase aktualisieren"""
        if not self.connected or not self.client:
            return False

        try:
            # Update cluster connection status
            self.client.table("clusters").update({
                "connection_status": "connected",
                "last_seen_at": datetime.utcnow().isoformat()
            }).eq("id", self.cluster_id).execute()

            # Insert status snapshot
            self.client.table("cluster_status").insert({
                "cluster_id": self.cluster_id,
                "node_count": node_count,
                "pod_count": pod_count,
                "namespace_count": namespace_count,
                "cpu_capacity": cpu_capacity,
                "memory_capacity": memory_capacity,
                "cpu_allocatable": cpu_allocatable,
                "memory_allocatable": memory_allocatable,
                "recorded_at": datetime.utcnow().isoformat()
            }).execute()

            logger.debug(f"Cluster Status aktualisiert: {node_count} nodes, {pod_count} pods")
            return True
        except Exception as e:
            logger.error(f"Fehler beim Aktualisieren des Cluster Status: {e}")
            return False

    async def sync_nodes(self, nodes: List[Dict]) -> bool:
        """Nodes zu Supabase synchronisieren"""
        if not self.connected or not self.client:
            return False

        try:
            for node in nodes:
                # Upsert node
                self.client.table("nodes").upsert({
                    "cluster_id": self.cluster_id,
                    "name": node["name"],
                    "status": node["status"],
                    "capacity_cpu": node.get("capacity_cpu"),
                    "capacity_memory": node.get("capacity_memory"),
                    "allocatable_cpu": node.get("allocatable_cpu"),
                    "allocatable_memory": node.get("allocatable_memory"),
                    "kubernetes_version": node.get("kubernetes_version"),
                    "os_image": node.get("os_image"),
                    "container_runtime": node.get("container_runtime"),
                    "updated_at": datetime.utcnow().isoformat()
                }, on_conflict="cluster_id,name").execute()

            logger.debug(f"{len(nodes)} Nodes synchronisiert")
            return True
        except Exception as e:
            logger.error(f"Fehler beim Synchronisieren der Nodes: {e}")
            return False

    async def sync_namespaces(self, namespaces: List[Dict]) -> Dict[str, str]:
        """Namespaces zu Supabase synchronisieren und IDs zurückgeben"""
        namespace_ids = {}
        if not self.connected or not self.client:
            return namespace_ids

        try:
            for ns in namespaces:
                result = self.client.table("namespaces").upsert({
                    "cluster_id": self.cluster_id,
                    "name": ns["name"],
                    "status": ns.get("status", "Active"),
                    "updated_at": datetime.utcnow().isoformat()
                }, on_conflict="cluster_id,name").execute()

                if result.data:
                    namespace_ids[ns["name"]] = result.data[0]["id"]

            # Fetch all namespace IDs for this cluster
            result = self.client.table("namespaces").select("id, name").eq(
                "cluster_id", self.cluster_id
            ).execute()

            for ns in result.data:
                namespace_ids[ns["name"]] = ns["id"]

            logger.debug(f"{len(namespaces)} Namespaces synchronisiert")
            return namespace_ids
        except Exception as e:
            logger.error(f"Fehler beim Synchronisieren der Namespaces: {e}")
            return namespace_ids

    async def sync_pods(self, pods: List[Dict], namespace_ids: Dict[str, str]) -> bool:
        """Pods zu Supabase synchronisieren"""
        if not self.connected or not self.client:
            return False

        try:
            # Get current pods from DB to detect deleted ones
            existing_result = self.client.table("pods").select("id, name, namespace_id").eq(
                "cluster_id", self.cluster_id
            ).execute()

            existing_pods = {
                (p["namespace_id"], p["name"]): p["id"]
                for p in existing_result.data
            }
            current_pods = set()

            for pod in pods:
                namespace_id = namespace_ids.get(pod["namespace"])
                if not namespace_id:
                    continue

                current_pods.add((namespace_id, pod["name"]))

                self.client.table("pods").upsert({
                    "cluster_id": self.cluster_id,
                    "namespace_id": namespace_id,
                    "name": pod["name"],
                    "status": pod["status"],
                    "node_name": pod.get("node"),
                    "pod_ip": pod.get("pod_ip"),
                    "restart_count": pod.get("restart_count", 0),
                    "k8s_created_at": pod.get("created"),
                    "updated_at": datetime.utcnow().isoformat()
                }, on_conflict="cluster_id,namespace_id,name").execute()

            # Delete pods that no longer exist
            deleted_pods = set(existing_pods.keys()) - current_pods
            for ns_id, pod_name in deleted_pods:
                pod_id = existing_pods[(ns_id, pod_name)]
                self.client.table("pods").delete().eq("id", pod_id).execute()

            logger.debug(f"{len(pods)} Pods synchronisiert, {len(deleted_pods)} gelöscht")
            return True
        except Exception as e:
            logger.error(f"Fehler beim Synchronisieren der Pods: {e}")
            return False

    async def add_event(
        self,
        event_type: str,
        reason: str,
        message: str,
        involved_kind: str,
        involved_name: str,
        involved_namespace: str = None,
        source_component: str = None
    ) -> bool:
        """Kubernetes Event zu Supabase hinzufügen"""
        if not self.connected or not self.client:
            return False

        try:
            self.client.table("cluster_events").insert({
                "cluster_id": self.cluster_id,
                "event_type": event_type,
                "reason": reason,
                "message": message,
                "involved_kind": involved_kind,
                "involved_name": involved_name,
                "involved_namespace": involved_namespace,
                "source_component": source_component,
                "first_seen_at": datetime.utcnow().isoformat(),
                "last_seen_at": datetime.utcnow().isoformat()
            }).execute()

            logger.debug(f"Event hinzugefügt: {involved_kind}/{involved_name} - {reason}")
            return True
        except Exception as e:
            logger.error(f"Fehler beim Hinzufügen des Events: {e}")
            return False

    async def sync_deployments(self, deployments: List[Dict], namespace_ids: Dict[str, str]) -> bool:
        """Deployments zu Supabase synchronisieren"""
        if not self.connected or not self.client:
            return False

        try:
            for dep in deployments:
                namespace_id = namespace_ids.get(dep["namespace"])
                if not namespace_id:
                    continue

                self.client.table("deployments").upsert({
                    "cluster_id": self.cluster_id,
                    "namespace_id": namespace_id,
                    "name": dep["name"],
                    "replicas": dep["replicas"],
                    "ready_replicas": dep["ready_replicas"],
                    "available_replicas": dep["available_replicas"],
                    "strategy": dep["strategy"],
                    "k8s_created_at": dep["created"],
                    "updated_at": datetime.utcnow().isoformat()
                }, on_conflict="cluster_id,namespace_id,name").execute()

            logger.debug(f"{len(deployments)} Deployments synchronisiert")
            return True
        except Exception as e:
            logger.error(f"Fehler beim Synchronisieren der Deployments: {e}")
            return False

    async def sync_statefulsets(self, statefulsets: List[Dict], namespace_ids: Dict[str, str]) -> bool:
        """StatefulSets zu Supabase synchronisieren"""
        if not self.connected or not self.client:
            return False

        try:
            for sts in statefulsets:
                namespace_id = namespace_ids.get(sts["namespace"])
                if not namespace_id:
                    continue

                self.client.table("statefulsets").upsert({
                    "cluster_id": self.cluster_id,
                    "namespace_id": namespace_id,
                    "name": sts["name"],
                    "replicas": sts["replicas"],
                    "ready_replicas": sts["ready_replicas"],
                    "service_name": sts["service_name"],
                    "k8s_created_at": sts["created"],
                    "updated_at": datetime.utcnow().isoformat()
                }, on_conflict="cluster_id,namespace_id,name").execute()

            logger.debug(f"{len(statefulsets)} StatefulSets synchronisiert")
            return True
        except Exception as e:
            logger.error(f"Fehler beim Synchronisieren der StatefulSets: {e}")
            return False

    async def sync_daemonsets(self, daemonsets: List[Dict], namespace_ids: Dict[str, str]) -> bool:
        """DaemonSets zu Supabase synchronisieren"""
        if not self.connected or not self.client:
            return False

        try:
            for ds in daemonsets:
                namespace_id = namespace_ids.get(ds["namespace"])
                if not namespace_id:
                    continue

                self.client.table("daemonsets").upsert({
                    "cluster_id": self.cluster_id,
                    "namespace_id": namespace_id,
                    "name": ds["name"],
                    "desired_nodes": ds["desired_nodes"],
                    "ready_nodes": ds["ready_nodes"],
                    "k8s_created_at": ds["created"],
                    "updated_at": datetime.utcnow().isoformat()
                }, on_conflict="cluster_id,namespace_id,name").execute()

            logger.debug(f"{len(daemonsets)} DaemonSets synchronisiert")
            return True
        except Exception as e:
            logger.error(f"Fehler beim Synchronisieren der DaemonSets: {e}")
            return False

    async def sync_services(self, services: List[Dict], namespace_ids: Dict[str, str]) -> bool:
        """Services zu Supabase synchronisieren"""
        if not self.connected or not self.client:
            return False

        try:
            for svc in services:
                namespace_id = namespace_ids.get(svc["namespace"])
                if not namespace_id:
                    continue

                self.client.table("services").upsert({
                    "cluster_id": self.cluster_id,
                    "namespace_id": namespace_id,
                    "name": svc["name"],
                    "type": svc["type"],
                    "cluster_ip": svc["cluster_ip"],
                    "external_ip": svc["external_ip"],
                    "ports": svc["ports"],
                    "k8s_created_at": svc["created"],
                    "updated_at": datetime.utcnow().isoformat()
                }, on_conflict="cluster_id,namespace_id,name").execute()

            logger.debug(f"{len(services)} Services synchronisiert")
            return True
        except Exception as e:
            logger.error(f"Fehler beim Synchronisieren der Services: {e}")
            return False

    async def sync_ingresses(self, ingresses: List[Dict], namespace_ids: Dict[str, str]) -> bool:
        """Ingresses zu Supabase synchronisieren"""
        if not self.connected or not self.client:
            return False

        try:
            for ing in ingresses:
                namespace_id = namespace_ids.get(ing["namespace"])
                if not namespace_id:
                    continue

                self.client.table("ingresses").upsert({
                    "cluster_id": self.cluster_id,
                    "namespace_id": namespace_id,
                    "name": ing["name"],
                    "ingress_class": ing["ingress_class"],
                    "hosts": ing["hosts"],
                    "tls": ing["tls"],
                    "address": ing["address"],
                    "k8s_created_at": ing["created"],
                    "updated_at": datetime.utcnow().isoformat()
                }, on_conflict="cluster_id,namespace_id,name").execute()

            logger.debug(f"{len(ingresses)} Ingresses synchronisiert")
            return True
        except Exception as e:
            logger.error(f"Fehler beim Synchronisieren der Ingresses: {e}")
            return False

    async def sync_jobs(self, jobs: List[Dict], namespace_ids: Dict[str, str]) -> bool:
        """Jobs zu Supabase synchronisieren"""
        if not self.connected or not self.client:
            return False

        try:
            for job in jobs:
                namespace_id = namespace_ids.get(job["namespace"])
                if not namespace_id:
                    continue

                self.client.table("jobs").upsert({
                    "cluster_id": self.cluster_id,
                    "namespace_id": namespace_id,
                    "name": job["name"],
                    "completions": job["completions"],
                    "succeeded": job["succeeded"],
                    "failed": job["failed"],
                    "active": job["active"],
                    "status": job["status"],
                    "k8s_created_at": job["created"],
                    "updated_at": datetime.utcnow().isoformat()
                }, on_conflict="cluster_id,namespace_id,name").execute()

            logger.debug(f"{len(jobs)} Jobs synchronisiert")
            return True
        except Exception as e:
            logger.error(f"Fehler beim Synchronisieren der Jobs: {e}")
            return False

    async def set_disconnected(self) -> bool:
        """Cluster als disconnected markieren"""
        if not self.connected or not self.client:
            return False

        try:
            self.client.table("clusters").update({
                "connection_status": "disconnected"
            }).eq("id", self.cluster_id).execute()

            logger.info("Cluster als disconnected markiert")
            return True
        except Exception as e:
            logger.error(f"Fehler beim Markieren als disconnected: {e}")
            return False


# Global instance
supabase_sync = SupabaseSync()
