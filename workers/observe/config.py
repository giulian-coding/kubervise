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
    
    class Config:
        env_prefix = "OBSERVE_"
        env_file = ".env"


settings = Settings()
