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
    sync_interval: int = 10  # Sekunden - wie oft Daten zu Supabase synchronisiert werden

    # Supabase Settings
    supabase_url: str = ""
    supabase_service_key: str = ""  # Service role key für Worker (bypasses RLS)
    cluster_id: str = ""  # UUID des Clusters in Supabase

    class Config:
        env_prefix = "OBSERVE_"
        env_file = ".env"


settings = Settings()
