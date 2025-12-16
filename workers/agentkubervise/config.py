"""Konfiguration für den Observe Worker"""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application Settings"""

    # API Settings
    api_host: str = "0.0.0.0"
    api_port: int = 8001

    # Kubernetes Settings
    kubeconfig_path: str = ""  # Leer = Standard-Pfad verwenden
    in_cluster: bool = False

    # Monitoring Settings
    watch_events: bool = True
    check_interval: int = 30  # Sekunden
    sync_interval: int = 10  # Sekunden - wie oft Daten zur API synchronisiert werden

    # Kubervise API Settings (new - preferred)
    api_url: str = ""  # Kubervise API URL (e.g., https://app.kubervise.io)
    agent_token: str = ""  # Agent authentication token
    cluster_id: str = ""  # UUID des Clusters

    # Legacy Supabase Settings (deprecated - for backwards compatibility)
    supabase_url: str = ""
    supabase_service_key: str = ""

    class Config:
        env_prefix = "OBSERVE_"
        env_file = ".env"


settings = Settings()
