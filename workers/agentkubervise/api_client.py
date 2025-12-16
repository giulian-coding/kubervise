"""API Client für den Observe Worker - kommuniziert über die Kubervise API"""
import logging
import httpx
from datetime import datetime
from typing import Dict, List, Optional

from config import settings

logger = logging.getLogger(__name__)


class APISync:
    """Synchronisiert Kubernetes-Daten über die Kubervise API"""

    def __init__(self):
        self.api_url = settings.api_url
        self.agent_token = settings.agent_token
        self.cluster_id = settings.cluster_id
        self.connected = False
        self._client: Optional[httpx.AsyncClient] = None

    async def connect(self) -> bool:
        """Verbindung zur API herstellen"""
        if not self.api_url or not self.agent_token or not self.cluster_id:
            logger.warning("API URL, Agent Token oder Cluster ID nicht konfiguriert")
            return False

        try:
            self._client = httpx.AsyncClient(
                base_url=self.api_url,
                headers={
                    "Authorization": f"Bearer {self.agent_token}",
                    "Content-Type": "application/json",
                },
                timeout=30.0,
            )
            self.connected = True
            logger.info(f"API Client bereit für {self.api_url}")
            return True
        except Exception as e:
            logger.error(f"Fehler beim Erstellen des API Clients: {e}")
            self.connected = False
            return False

    async def close(self):
        """Schließt die HTTP-Verbindung"""
        if self._client:
            await self._client.aclose()
            self._client = None
            self.connected = False

    async def sync_snapshot(
        self,
        nodes: List[Dict],
        pods: List[Dict],
        namespaces: List[Dict],
        deployments: List[Dict] = None,
        statefulsets: List[Dict] = None,
        daemonsets: List[Dict] = None,
        services: List[Dict] = None,
        events: List[Dict] = None,
    ) -> bool:
        """Sendet einen kompletten Cluster-Snapshot an die API"""
        if not self.connected or not self._client:
            return False

        try:
            snapshot_data = {
                "nodes": nodes,
                "pods": pods,
                "namespaces": namespaces,
                "deployments": deployments or [],
                "statefulsets": statefulsets or [],
                "daemonsets": daemonsets or [],
                "services": services or [],
                "events": events or [],
                "collected_at": datetime.utcnow().isoformat(),
            }

            response = await self._client.post(
                f"/api/clusters/{self.cluster_id}/snapshot",
                json=snapshot_data,
            )

            if response.status_code == 200:
                logger.debug("Snapshot erfolgreich synchronisiert")
                return True
            else:
                logger.error(f"Fehler beim Synchronisieren: {response.status_code} - {response.text}")
                return False

        except httpx.TimeoutException:
            logger.error("Timeout beim Synchronisieren des Snapshots")
            return False
        except Exception as e:
            logger.error(f"Fehler beim Synchronisieren des Snapshots: {e}")
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
        """Alias für sync_snapshot - sendet minimale Statusdaten"""
        # Für Kompatibilität mit dem alten Interface - sendet leere Listen
        # Die tatsächlichen Daten werden über sync_snapshot gesendet
        return True

    async def set_disconnected(self) -> bool:
        """Markiert den Agent als disconnected (wird beim Beenden aufgerufen)"""
        # Die API markiert den Cluster automatisch als disconnected wenn keine Snapshots mehr kommen
        logger.info("Agent wird beendet")
        return True


# Global instance
api_sync = APISync()
