# Kubervise

**Kubernetes observability made simple.** A modern dashboard for monitoring and managing your Kubernetes clusters with real-time visibility into pods, deployments, nodes, and more.

![Next.js](https://img.shields.io/badge/Next.js-16-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Python](https://img.shields.io/badge/Python-3.11+-green)
![License](https://img.shields.io/badge/License-MIT-yellow)

## Overview

Kubervise provides a user-friendly web dashboard for Kubernetes cluster monitoring. It features:

- **Real-time Monitoring** - Live updates on pods, deployments, nodes, and cluster events
- **Multi-cluster Support** - Manage multiple Kubernetes clusters from a single dashboard
- **Team Collaboration** - Role-based access control with team management
- **Easy Setup** - Simple agent installation with no complex configuration

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Web Browser   │────▶│  Next.js App    │────▶│    Supabase     │
│   (Dashboard)   │     │  (Frontend)     │     │  (Auth & DB)    │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                                                         ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Kubernetes    │◀────│  Kubervise      │────▶│   API Routes    │
│   Cluster       │     │  Agent          │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Tech Stack

### Frontend
- **Framework:** Next.js 16 with App Router
- **UI:** React 19, Tailwind CSS, shadcn/ui
- **Auth & Database:** Supabase
- **Language:** TypeScript

### Agent
- **Language:** Python 3.11+
- **Framework:** FastAPI
- **Kubernetes Client:** kubernetes-client v31

### Installer
- **Language:** Go

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- A Supabase project
- Access to a Kubernetes cluster (for agent)

### Frontend Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/giulian-coding/kubervise.git
   cd kubervise/next
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   ```bash
   cp .env.example .env.local
   ```

   Edit `.env.local` with your Supabase credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

4. Run database migrations (see `supabase/migrations/`)

5. Start the development server:
   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) in your browser.

### Agent Installation

The Kubervise agent runs in your Kubernetes cluster and syncs data to the dashboard.

#### Option 1: Pre-built Binary

Download from the [releases page](https://github.com/giulian-coding/kubervise/releases) and run:

```bash
./agentkubervise \
  --api-url https://your-kubervise-instance.com \
  --token YOUR_AGENT_TOKEN \
  --cluster-id YOUR_CLUSTER_UUID
```

#### Option 2: Docker

```bash
docker run -d --name kubervise-agent \
  -e KUBERVISE_API_URL="https://your-kubervise-instance.com" \
  -e KUBERVISE_AGENT_TOKEN="YOUR_TOKEN" \
  -e KUBERVISE_CLUSTER_ID="YOUR_CLUSTER_UUID" \
  -v ~/.kube:/root/.kube:ro \
  kubervise/agent:latest
```

#### Option 3: Kubernetes Deployment

Apply the manifests in `workers/agentkubervise/k8s/`:

```bash
kubectl apply -k workers/agentkubervise/k8s/
```

#### Option 4: Build from Source

```bash
cd workers/agentkubervise
pip install -r requirements.txt
pip install pyinstaller
python build.py
```

## Project Structure

```
kubervise/
├── next/                      # Web application
│   ├── app/                   # Next.js App Router pages
│   │   ├── dashboard/         # Dashboard routes
│   │   ├── auth/              # Authentication pages
│   │   ├── onboarding/        # Cluster setup wizard
│   │   └── api/               # API routes
│   ├── components/            # React components
│   ├── lib/                   # Utilities and actions
│   └── public/                # Static assets
│
├── workers/agentkubervise/    # Kubernetes monitoring agent
│   ├── main.py                # Agent core (FastAPI)
│   ├── cli.py                 # CLI interface
│   ├── k8s/                   # Kubernetes manifests
│   └── Dockerfile             # Container image
│
├── installer/                 # Go-based CLI installer
│   └── main.go
│
└── supabase/                  # Database configuration
    └── migrations/            # SQL migrations
```

## Dashboard Features

| Feature | Description |
|---------|-------------|
| **Clusters** | Manage multiple clusters, view connection status |
| **Pods** | Monitor pod status, namespace, node assignment |
| **Deployments** | Track replicas, rollout status, strategy |
| **Nodes** | View capacity, allocatable resources |
| **Services** | List services with types and endpoints |
| **Ingresses** | View ingress configuration |
| **ConfigMaps** | Browse configuration data |
| **Secrets** | Manage secrets (masked values) |
| **Events** | Real-time cluster events |
| **Namespaces** | Namespace management |
| **RBAC** | Role-based access policies |
| **Alerts** | Alerting interface |
| **Logs** | Log aggregation view |
| **Metrics** | Metrics dashboard |

## Configuration

### Frontend Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | Yes |
| `NEXT_PUBLIC_APP_URL` | Application URL | No |

### Agent Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OBSERVE_API_URL` | Kubervise API endpoint | - |
| `OBSERVE_AGENT_TOKEN` | Agent authentication token | - |
| `OBSERVE_CLUSTER_ID` | Cluster UUID | - |
| `OBSERVE_IN_CLUSTER` | Running inside Kubernetes | `false` |
| `OBSERVE_KUBECONFIG_PATH` | Path to kubeconfig | Default location |
| `OBSERVE_CHECK_INTERVAL` | Sync interval (seconds) | `30` |

## Team & RBAC

Kubervise supports team-based access control with the following roles:

| Role | Permissions |
|------|-------------|
| **Owner** | Full access, manage team settings |
| **Admin** | Manage clusters and members |
| **Contributor** | View and modify resources |
| **Viewer** | Read-only access |

## Development

### Frontend Commands

```bash
cd next

# Development
npm run dev

# Build
npm run build

# Production
npm start

# Lint
npm run lint
```

### Agent Commands

```bash
cd workers/agentkubervise

# Install dependencies
pip install -r requirements.txt

# Run locally
python cli.py --api-url URL --token TOKEN --cluster-id UUID

# Build binary
python build.py
```

## CI/CD

The project uses GitHub Actions for continuous integration:

- **Agent Build** (`.github/workflows/build-agent.yml`)
  - Triggers on `agent-v*` tags
  - Builds cross-platform binaries (Linux, macOS, Windows)
  - Pushes Docker image to Docker Hub
  - Uploads artifacts to GitHub Releases

## Database Schema

Key tables in Supabase:

- `profiles` - User information
- `teams` - Team/organization data
- `team_memberships` - User-team relationships
- `clusters` - Kubernetes cluster metadata
- `cluster_snapshots` - Point-in-time cluster state
- `cluster_agent_tokens` - Agent authentication

See `supabase/migrations/` for the complete schema.

## Security

- **Authentication:** Supabase Auth with secure session management
- **Agent Auth:** Token-based authentication (unique per cluster)
- **RBAC:** Row-level security in Supabase
- **Agent Access:** Read-only Kubernetes API access

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- [GitHub Issues](https://github.com/giulian-coding/kubervise/issues) - Bug reports and feature requests
