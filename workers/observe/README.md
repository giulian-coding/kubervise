# Observe Worker

Kubernetes Cluster Überwachungs-Worker mit FastAPI.

## Features

- 🔍 Cluster Status Überwachung
- 📊 Pod- und Node-Informationen
- 🔔 Event-Streaming
- 🏥 Health Check Endpoints
- ⚡ Async/Await Support

## Installation

```bash
cd observe
pip install -r requirements.txt
```

## Konfiguration

Kopiere `.env.example` zu `.env` und passe die Werte an:

```bash
cp .env.example .env
```

## Verwendung

### Lokal mit kubeconfig

```bash
python main.py
```

### In einem Kubernetes Cluster

```bash
# Mit Docker
docker build -t kubervise-observe .
docker run -p 8001:8001 kubervise-observe

# Mit uvicorn direkt
uvicorn main:app --host 0.0.0.0 --port 8001
```

## API Endpoints

- `GET /` - Service Info
- `GET /health` - Health Check
- `GET /cluster/status` - Cluster Status
- `GET /cluster/pods?namespace=default` - Pod Liste
- `GET /cluster/nodes` - Node Liste
- `POST /cluster/reconnect` - Verbindung neu herstellen

## Beispiel

```bash
# Status abrufen
curl http://localhost:8001/cluster/status

# Pods abrufen
curl http://localhost:8001/cluster/pods

# Pods in einem Namespace
curl http://localhost:8001/cluster/pods?namespace=default
```

## Entwicklung

```bash
# Mit Auto-Reload
uvicorn main:app --reload --port 8001
```
