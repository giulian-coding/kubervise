"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Server,
  ArrowRight,
  ArrowLeft,
  Check,
  Copy,
  Download,
  Terminal,
  Loader2,
  CheckCircle2,
  XCircle,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/dashboard/page-header";
import { ProtectedPage } from "@/components/dashboard/protected-page";
import { PERMISSIONS } from "@/lib/rbac";
import {
  createPendingClusterOnboarding,
  checkPendingOnboardingStatus,
  cancelPendingOnboarding,
  getUserTeams,
} from "@/lib/actions/cluster";

type Step = "info" | "install" | "verify";
type InstallMethod = "linux" | "command" | "windows";
type ConnectionStatus = "pending" | "connected" | "expired" | "checking";

interface OnboardingData {
  name: string;
  description: string;
  teamId: string;
  onboardingId?: string;
  clusterId?: string;
  installCommandKubectl?: string;
  installCommandHelm?: string;
  installManifest?: string;
  clusterName?: string;
}

export default function AddClusterPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("info");
  const [installMethod, setInstallMethod] = useState<InstallMethod>("linux");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [teams, setTeams] = useState<Array<{ id: string; name: string }>>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("pending");

  const [onboardingData, setOnboardingData] = useState<OnboardingData>({
    name: "",
    description: "",
    teamId: "",
  });

  // Fetch teams on mount
  useEffect(() => {
    async function fetchTeams() {
      const result = await getUserTeams();
      if (result.success && result.teams) {
        setTeams(result.teams);
        if (result.teams.length > 0) {
          setOnboardingData((prev) => ({ ...prev, teamId: result.teams![0].id }));
        }
      }
    }
    fetchTeams();
  }, []);

  // Check connection status when on verify step
  const checkStatus = useCallback(async () => {
    if (!onboardingData.onboardingId) return;

    setConnectionStatus("checking");
    const result = await checkPendingOnboardingStatus(onboardingData.onboardingId);

    if (result.success) {
      setConnectionStatus(result.status);

      if (result.status === "connected" && result.cluster_id) {
        setOnboardingData((prev) => ({
          ...prev,
          clusterId: result.cluster_id,
          clusterName: result.cluster_name,
        }));
      }
    }
  }, [onboardingData.onboardingId]);

  useEffect(() => {
    if (step !== "verify" || !onboardingData.onboardingId) return;

    // Initial check
    checkStatus();

    // Poll every 3 seconds
    const interval = setInterval(checkStatus, 3000);

    return () => clearInterval(interval);
  }, [step, onboardingData.onboardingId, checkStatus]);

  const handleCreateOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onboardingData.name.trim() || !onboardingData.teamId) {
      setError("Please fill in all required fields");
      return;
    }

    setIsLoading(true);
    setError(null);

    const result = await createPendingClusterOnboarding(
      onboardingData.teamId,
      onboardingData.name.trim(),
      onboardingData.description.trim() || undefined
    );

    if (result.success) {
      setOnboardingData((prev) => ({
        ...prev,
        onboardingId: result.onboarding_id,
        clusterId: result.cluster_id,
        installCommandKubectl: result.install_command_kubectl,
        installCommandHelm: result.install_command_helm,
        installManifest: result.install_manifest,
      }));
      setStep("install");
    } else {
      setError(result.error || "Failed to create onboarding");
    }

    setIsLoading(false);
  };

  const handleCancel = async () => {
    if (onboardingData.onboardingId) {
      await cancelPendingOnboarding(onboardingData.onboardingId);
    }
    router.push("/dashboard/clusters");
  };

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const getCurrentInstallCommand = () => {
    switch (installMethod) {
      case "linux":
        return onboardingData.installCommandKubectl || "";
      case "command":
        return onboardingData.installCommandHelm || "";
      case "windows":
        return onboardingData.installManifest || "";
      default:
        return "";
    }
  };

  return (
    <ProtectedPage permission={PERMISSIONS.CLUSTER_CREATE}>
      <PageHeader
        title="Add Cluster"
        description="Connect a new Kubernetes cluster to Kubervise"
        icon={Server}
      />

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-center">
          <StepIndicator
            step={1}
            label="Cluster Info"
            active={step === "info"}
            completed={step !== "info"}
          />
          <div className="w-16 h-0.5 bg-border mx-2" />
          <StepIndicator
            step={2}
            label="Install Agent"
            active={step === "install"}
            completed={step === "verify"}
          />
          <div className="w-16 h-0.5 bg-border mx-2" />
          <StepIndicator
            step={3}
            label="Verify Connection"
            active={step === "verify"}
            completed={connectionStatus === "connected"}
          />
        </div>
      </div>

      {/* Step 1: Cluster Info */}
      {step === "info" && (
        <div className="max-w-xl mx-auto">
          <div className="rounded-lg border bg-card p-6">
            <h2 className="text-lg font-semibold mb-4">Cluster Information</h2>
            <form onSubmit={handleCreateOnboarding} className="space-y-4">
              <div>
                <label htmlFor="team" className="block text-sm font-medium mb-1">
                  Team *
                </label>
                <select
                  id="team"
                  value={onboardingData.teamId}
                  onChange={(e) =>
                    setOnboardingData((prev) => ({ ...prev, teamId: e.target.value }))
                  }
                  className="w-full rounded-md border bg-background px-3 py-2"
                  disabled={isLoading}
                >
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="name" className="block text-sm font-medium mb-1">
                  Cluster Name *
                </label>
                <Input
                  id="name"
                  value={onboardingData.name}
                  onChange={(e) =>
                    setOnboardingData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="production-cluster"
                  disabled={isLoading}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  A friendly name to identify this cluster
                </p>
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium mb-1">
                  Description
                </label>
                <Textarea
                  id="description"
                  value={onboardingData.description}
                  onChange={(e) =>
                    setOnboardingData((prev) => ({ ...prev, description: e.target.value }))
                  }
                  placeholder="Main production Kubernetes cluster..."
                  rows={3}
                  disabled={isLoading}
                />
              </div>

              {error && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/dashboard/clusters")}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="size-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      Continue
                      <ArrowRight className="size-4 ml-2" />
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Step 2: Install Agent */}
      {step === "install" && (
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Important notice */}
          <div className="rounded-md bg-blue-500/10 border border-blue-500/20 p-4">
            <div className="flex items-start gap-3">
              <Server className="size-5 text-blue-500 mt-0.5" />
              <div>
                <h3 className="font-medium text-blue-600 dark:text-blue-400">
                  Deploy the Kubervise Agent
                </h3>
                <p className="text-sm text-blue-600/80 dark:text-blue-400/80 mt-1">
                  Der Cluster wurde erstellt. Führe die folgenden Befehle aus, um den Agent zu deployen.
                  Der Agent verbindet sich automatisch und beginnt mit der Synchronisation.
                </p>
              </div>
            </div>
          </div>

          {/* Installation Method Tabs */}
          <div className="rounded-lg border bg-card overflow-hidden">
            <div className="flex border-b">
              <button
                onClick={() => setInstallMethod("linux")}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                  installMethod === "linux"
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted"
                }`}
              >
                <Terminal className="size-4" />
                Linux / macOS
              </button>
              <button
                onClick={() => setInstallMethod("command")}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                  installMethod === "command"
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted"
                }`}
              >
                <Server className="size-4" />
                Direct Command
              </button>
              <button
                onClick={() => setInstallMethod("windows")}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                  installMethod === "windows"
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted"
                }`}
              >
                <Download className="size-4" />
                Windows
              </button>
            </div>

            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold">
                    {installMethod === "linux" && "Linux / macOS Installation"}
                    {installMethod === "command" && "Direct Command"}
                    {installMethod === "windows" && "Windows Installation"}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {installMethod === "linux" && "Download and run the agent binary on your Linux or macOS system"}
                    {installMethod === "command" && "Run the agent if it's already installed on your system"}
                    {installMethod === "windows" && "Download and run the agent on Windows using PowerShell"}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(getCurrentInstallCommand(), "cli")}
                >
                  {copied === "cli" ? (
                    <Check className="size-4 mr-2" />
                  ) : (
                    <Copy className="size-4 mr-2" />
                  )}
                  Copy
                </Button>
              </div>

              <pre className="rounded-md border bg-muted p-4 text-sm font-mono overflow-x-auto whitespace-pre max-h-96 overflow-y-auto">
                {getCurrentInstallCommand()}
              </pre>

              <div className="mt-4 rounded-md bg-amber-500/10 border border-amber-500/20 p-3">
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  <strong>Wichtig:</strong> Der Agent benötigt Zugriff auf deinen Kubernetes-Cluster.
                  Stelle sicher, dass eine gültige kubeconfig verfügbar ist oder der Agent im Cluster läuft.
                </p>
              </div>
            </div>
          </div>

          {/* What happens next */}
          <div className="rounded-md bg-green-500/10 border border-green-500/20 p-4">
            <h3 className="font-medium text-green-600 dark:text-green-400 mb-2">
              Was passiert nach der Installation?
            </h3>
            <ul className="text-sm text-green-600/80 dark:text-green-400/80 space-y-1">
              <li>1. Der Agent verbindet sich mit deinem Kubernetes-Cluster</li>
              <li>2. Cluster-Daten werden sicher an Kubervise übertragen</li>
              <li>3. Der Status wechselt zu <strong>"connected"</strong></li>
              <li>4. Du kannst deinen Cluster im Dashboard überwachen</li>
            </ul>
          </div>

          {/* Navigation */}
          <div className="flex justify-between">
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button onClick={() => setStep("verify")}>
              Agent wurde deployt
              <ArrowRight className="size-4 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Verify Connection */}
      {step === "verify" && (
        <div className="max-w-xl mx-auto">
          <div className="rounded-lg border bg-card p-6">
            <h2 className="text-lg font-semibold mb-4">Verify Connection</h2>

            <div className="flex flex-col items-center py-8">
              {connectionStatus === "checking" && (
                <>
                  <Loader2 className="size-16 text-primary animate-spin mb-4" />
                  <p className="text-lg font-medium">Checking connection...</p>
                  <p className="text-sm text-muted-foreground">
                    Waiting for the agent to connect
                  </p>
                </>
              )}

              {connectionStatus === "connected" && (
                <>
                  <CheckCircle2 className="size-16 text-green-500 mb-4" />
                  <p className="text-lg font-medium text-green-600">
                    Successfully Connected!
                  </p>
                  <p className="text-sm text-muted-foreground mb-2">
                    Cluster "{onboardingData.clusterName || onboardingData.name}" was created
                  </p>
                  <p className="text-sm text-muted-foreground mb-6">
                    Your cluster is now being monitored
                  </p>
                  <Button onClick={() => router.push(`/dashboard/clusters`)}>
                    View Clusters
                    <ArrowRight className="size-4 ml-2" />
                  </Button>
                </>
              )}

              {connectionStatus === "pending" && (
                <>
                  <div className="size-16 rounded-full border-4 border-yellow-500 flex items-center justify-center mb-4">
                    <RefreshCw className="size-8 text-yellow-500 animate-spin" />
                  </div>
                  <p className="text-lg font-medium">Waiting for Agent Connection</p>
                  <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">
                    Run the installer and the agent will connect automatically.
                    The cluster will be created once connected.
                  </p>
                  <div className="rounded-md bg-muted p-3 mb-4 w-full text-center">
                    <code className="text-sm">kubectl -n kubervise get pods</code>
                  </div>
                  <div className="flex gap-3">
                    <Button variant="outline" onClick={() => setStep("install")}>
                      <ArrowLeft className="size-4 mr-2" />
                      Back
                    </Button>
                    <Button variant="outline" onClick={handleCancel}>
                      Cancel
                    </Button>
                  </div>
                </>
              )}

              {connectionStatus === "expired" && (
                <>
                  <XCircle className="size-16 text-red-500 mb-4" />
                  <p className="text-lg font-medium text-red-600">Token Expired</p>
                  <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">
                    The installation token has expired. Please start again.
                  </p>
                  <Button onClick={() => router.push("/dashboard/clusters/add")}>
                    Start Over
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </ProtectedPage>
  );
}

function StepIndicator({
  step,
  label,
  active,
  completed,
}: {
  step: number;
  label: string;
  active: boolean;
  completed: boolean;
}) {
  return (
    <div className="flex flex-col items-center">
      <div
        className={`size-10 rounded-full flex items-center justify-center text-sm font-medium ${
          completed
            ? "bg-primary text-primary-foreground"
            : active
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground"
        }`}
      >
        {completed ? <Check className="size-5" /> : step}
      </div>
      <span
        className={`mt-2 text-sm ${
          active || completed ? "text-foreground font-medium" : "text-muted-foreground"
        }`}
      >
        {label}
      </span>
    </div>
  );
}
