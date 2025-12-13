# Observe Worker

Kubernetes Cluster Monitoring Agent mit FastAPI.

## Features

- Cluster Status Monitoring
- Pods, Nodes, Namespaces
- Deployments, StatefulSets, DaemonSets
- Services, Ingresses
- Jobs, CronJobs
- Real-time Event Streaming
- Automatic Supabase Sync
- Health Check Endpoints
- Async/Await Support

## Installation

### Lokal

```bash
cd observe
pip install -r requirements.txt
```

### In-Cluster Deployment (Empfohlen)

1. **Supabase Secrets konfigurieren:**

   Bearbeite `k8s/secret.yaml` und setze deine Credentials (base64-encoded):

   ```bash
   # Werte base64-encoden
   echo -n "https://xxx.supabase.co" | base64
   echo -n "your-service-role-key" | base64
   echo -n "your-cluster-uuid" | base64
   ```

2. **Mit Kustomize deployen:**

   ```bash
   kubectl apply -k k8s/
   ```

3. **Status pruefen:**

   ```bash
   kubectl -n kubervise get pods
   kubectl -n kubervise logs -f deployment/kubervise-agent
   ```

## Konfiguration

### Umgebungsvariablen

| Variable | Beschreibung | Default |
|----------|--------------|---------|
| `OBSERVE_IN_CLUSTER` | In-Cluster Modus | `false` |
| `OBSERVE_KUBECONFIG` | Pfad zur kubeconfig | `~/.kube/config` |
| `OBSERVE_SYNC_INTERVAL` | Sync-Intervall (Sekunden) | `30` |
| `OBSERVE_WATCH_EVENTS` | Event-Watching aktivieren | `true` |
| `OBSERVE_SUPABASE_URL` | Supabase URL | - |
| `OBSERVE_SUPABASE_SERVICE_KEY` | Supabase Service Key | - |
| `OBSERVE_CLUSTER_ID` | Cluster UUID in Supabase | - |

### Lokal mit .env

```bash
cp .env.example .env
# .env bearbeiten
```

## API Endpoints

### Health & Info

| Endpoint | Beschreibung |
|----------|--------------|
| `GET /` | Service Info |
| `GET /health` | Health Check |
| `POST /cluster/reconnect` | Verbindung neu herstellen |

### Cluster Ressourcen

| Endpoint | Beschreibung |
|----------|--------------|
| `GET /cluster/status` | Cluster Status und Zusammenfassung |
| `GET /cluster/summary` | Vollstaendige Cluster-Uebersicht |
| `GET /cluster/nodes` | Alle Nodes |
| `GET /cluster/namespaces` | Alle Namespaces |
| `GET /cluster/pods` | Alle Pods (optional: `?namespace=...`) |
| `GET /cluster/events` | Kubernetes Events |

### Workloads

| Endpoint | Beschreibung |
|----------|--------------|
| `GET /cluster/deployments` | Alle Deployments (optional: `?namespace=...`) |
| `GET /cluster/statefulsets` | Alle StatefulSets (optional: `?namespace=...`) |
| `GET /cluster/daemonsets` | Alle DaemonSets (optional: `?namespace=...`) |
| `GET /cluster/jobs` | Alle Jobs (optional: `?namespace=...`) |

### Networking

| Endpoint | Beschreibung |
|----------|--------------|
| `GET /cluster/services` | Alle Services (optional: `?namespace=...`) |
| `GET /cluster/ingresses` | Alle Ingresses (optional: `?namespace=...`) |

## Beispiele

```bash
# Cluster Status
curl http://localhost:8001/cluster/status

# Alle Deployments
curl http://localhost:8001/cluster/deployments

# Deployments in einem Namespace
curl http://localhost:8001/cluster/deployments?namespace=default

# Vollstaendige Zusammenfassung
curl http://localhost:8001/cluster/summary

# Pods mit Details
curl http://localhost:8001/cluster/pods?namespace=kube-system
```

## Supabase Sync

Der Agent synchronisiert automatisch folgende Ressourcen zu Supabase:

- Nodes
- Namespaces
- Pods
- Deployments
- StatefulSets
- DaemonSets
- Services
- Ingresses
- Jobs
- Events

Das Sync-Intervall kann mit `OBSERVE_SYNC_INTERVAL` konfiguriert werden.

## Kubernetes RBAC

Der Agent benoetigt lesenden Zugriff auf:

- Core API: pods, nodes, namespaces, services, events, configmaps, secrets, pvcs, pvs
- Apps API: deployments, statefulsets, daemonsets, replicasets
- Batch API: jobs, cronjobs
- Networking API: ingresses, networkpolicies
- Autoscaling API: horizontalpodautoscalers
- Metrics API: nodes, pods (optional)

Die benoetigten RBAC-Regeln sind in `k8s/serviceaccount.yaml` definiert.

## Entwicklung

```bash
# Mit Auto-Reload
uvicorn main:app --reload --port 8001

# Docker Build
docker build -t kubervise/agent:latest .

# Docker Run
docker run -p 8001:8001 \
  -e OBSERVE_KUBECONFIG=/app/kubeconfig \
  -v ~/.kube/config:/app/kubeconfig:ro \
  kubervise/agent:latest
```

## Architektur

```
+----------------+       +------------------+       +------------+
|   Kubernetes   | <---> |  Kubervise Agent | <---> |  Supabase  |
|    Cluster     |       |    (FastAPI)     |       |  Database  |
+----------------+       +------------------+       +------------+
                                 |
                                 v
                         +----------------+
                         |   Dashboard    |
                         |   (Next.js)    |
                         +----------------+
```
