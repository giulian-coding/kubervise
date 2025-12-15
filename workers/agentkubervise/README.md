# Kubervise Agent

Kubernetes Cluster Monitoring Agent for Kubervise.

## Features

- Simple CLI tool - just download and run
- Token-based authentication (no service keys exposed)
- Cross-platform: Linux, macOS, Windows
- Real-time cluster monitoring
- Automatic sync to Kubervise dashboard

## Quick Start

### Option 1: Download Binary (Recommended)

```bash
# Linux
curl -sSL https://your-kubervise-app.vercel.app/downloads/agentkubervise-linux-amd64 -o agentkubervise
chmod +x agentkubervise
./agentkubervise --api-url "https://app.kubervise.io" --token "YOUR_TOKEN" --cluster-id "YOUR_CLUSTER_ID"

# macOS
curl -sSL https://your-kubervise-app.vercel.app/downloads/agentkubervise-darwin-amd64 -o agentkubervise
chmod +x agentkubervise
./agentkubervise --api-url "https://app.kubervise.io" --token "YOUR_TOKEN" --cluster-id "YOUR_CLUSTER_ID"

# Windows (PowerShell)
Invoke-WebRequest -Uri "https://your-kubervise-app.vercel.app/downloads/agentkubervise-windows-amd64.exe" -OutFile agentkubervise.exe
.\agentkubervise.exe --api-url "https://app.kubervise.io" --token "YOUR_TOKEN" --cluster-id "YOUR_CLUSTER_ID"
```

### Option 2: Docker

```bash
docker run -d --name kubervise-agent \
  -e KUBERVISE_API_URL="https://app.kubervise.io" \
  -e KUBERVISE_AGENT_TOKEN="YOUR_TOKEN" \
  -e KUBERVISE_CLUSTER_ID="YOUR_CLUSTER_ID" \
  -v ~/.kube:/root/.kube:ro \
  kubervise/agent:latest
```

### Option 3: Run as systemd Service

```bash
# After downloading the binary to /usr/local/bin/
cat > /etc/systemd/system/kubervise-agent.service <<EOF
[Unit]
Description=Kubervise Agent
After=network.target

[Service]
Type=simple
ExecStart=/usr/local/bin/agentkubervise --api-url "https://app.kubervise.io" --token "YOUR_TOKEN" --cluster-id "YOUR_CLUSTER_ID"
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

systemctl enable --now kubervise-agent
```

## Configuration

### Command Line Options

| Option | Environment Variable | Description |
|--------|---------------------|-------------|
| `--api-url` | `KUBERVISE_API_URL` | Kubervise API URL |
| `--token` | `KUBERVISE_AGENT_TOKEN` | Agent authentication token |
| `--cluster-id` | `KUBERVISE_CLUSTER_ID` | Cluster UUID |
| `--sync-interval` | - | Sync interval in seconds (default: 30) |

### Examples

```bash
# Using command line options
./agentkubervise --api-url https://app.kubervise.io --token abc123 --cluster-id uuid

# Using environment variables
export KUBERVISE_API_URL=https://app.kubervise.io
export KUBERVISE_AGENT_TOKEN=abc123
export KUBERVISE_CLUSTER_ID=uuid
./agentkubervise
```

## Building from Source

### Requirements

- Python 3.11+
- pip

### Build Binary

```bash
cd workers/agentkubervise
pip install -r requirements.txt
pip install pyinstaller
python build.py
```

The binary will be in `dist/agentkubervise-<platform>-<arch>`.

### Build Docker Image

```bash
docker build -t kubervise/agent:latest .
```

## Kubernetes RBAC

When running inside a Kubernetes cluster, the agent needs read access to:

- Core API: pods, nodes, namespaces, services, events
- Apps API: deployments, statefulsets, daemonsets
- Batch API: jobs
- Networking API: ingresses

See `k8s/serviceaccount.yaml` for the required RBAC rules.

## Architecture

```
+----------------+       +------------------+       +------------+
|   Kubernetes   | <---> |  Kubervise Agent | <---> |  Kubervise |
|    Cluster     |       |     (CLI)        |       |    API     |
+----------------+       +------------------+       +------------+
                                                          |
                                                          v
                                                   +------------+
                                                   |  Dashboard |
                                                   +------------+
```

## Security

- The agent uses **token-based authentication** - no service keys are exposed
- Only read access to Kubernetes resources
- Data transmitted over HTTPS
- Agent token is unique per cluster

## Troubleshooting

### Agent not connecting

1. Check if the token is correct
2. Verify the API URL is reachable
3. Check network connectivity from the agent to the API

### Kubernetes access issues

1. Ensure kubeconfig is valid: `kubectl cluster-info`
2. Check RBAC permissions if running in-cluster
3. Verify the service account has the required permissions
