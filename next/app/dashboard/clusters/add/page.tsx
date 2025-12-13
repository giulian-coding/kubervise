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
  Monitor,
  Apple,
  Clock,
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
type InstallMethod = "windows" | "linux" | "mac" | "yaml";
type ConnectionStatus = "pending" | "connected" | "expired" | "checking";

interface OnboardingData {
  name: string;
  description: string;
  teamId: string;
  onboardingId?: string;
  installToken?: string;
  installCommandWindows?: string;
  installCommandLinux?: string;
  installCommandMac?: string;
  // These will be populated after agent connects
  clusterId?: string;
  clusterName?: string;
}

// Linux icon component
function LinuxIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.504 0c-.155 0-.315.008-.48.021-4.226.333-3.105 4.807-3.17 6.298-.076 1.092-.3 1.953-1.05 3.02-.885 1.051-2.127 2.75-2.716 4.521-.278.832-.41 1.684-.287 2.489a.424.424 0 00-.11.135c-.26.268-.45.6-.663.839-.199.199-.485.267-.797.4-.313.136-.658.269-.864.68-.09.189-.136.394-.132.602 0 .199.027.4.055.536.058.399.116.728.04.97-.249.68-.28 1.145-.106 1.484.174.334.535.47.94.601.81.2 1.91.135 2.774.6.926.466 1.866.67 2.616.47.526-.116.97-.464 1.208-.946.587-.003 1.23-.269 2.26-.334.699-.058 1.574.267 2.577.2.025.134.063.198.114.333l.003.003c.391.778 1.113 1.132 1.884 1.071.771-.06 1.592-.536 2.257-1.306.631-.765 1.683-1.084 2.378-1.503.348-.199.629-.469.649-.853.023-.4-.2-.811-.714-1.376v-.097l-.003-.003c-.17-.2-.25-.535-.338-.926-.085-.401-.182-.786-.492-1.046h-.003c-.059-.054-.123-.067-.188-.135a.357.357 0 00-.19-.064c.431-1.278.264-2.55-.173-3.694-.533-1.41-1.465-2.638-2.175-3.483-.796-1.005-1.576-1.957-1.56-3.368.026-2.152.236-6.133-3.544-6.139zm.529 3.405h.013c.213 0 .396.062.584.198.19.135.33.332.438.533.105.259.158.459.166.724 0-.02.006-.04.006-.06v.105a.086.086 0 01-.004-.021l-.004-.024a1.807 1.807 0 01-.15.706.953.953 0 01-.213.335.71.71 0 00-.088-.042c-.104-.045-.198-.064-.284-.133a1.312 1.312 0 00-.22-.066c.05-.06.146-.133.183-.198.053-.128.082-.264.088-.402v-.02a1.21 1.21 0 00-.061-.4c-.045-.134-.101-.2-.183-.333-.084-.066-.167-.132-.267-.132h-.016c-.093 0-.176.03-.262.132a.8.8 0 00-.205.334 1.18 1.18 0 00-.09.4v.019c.002.089.008.179.02.267-.193-.067-.438-.135-.607-.202a1.635 1.635 0 01-.018-.2v-.02a1.772 1.772 0 01.15-.768c.082-.22.232-.406.43-.533.19-.135.4-.198.629-.198zm-4.276.006c.227 0 .435.064.626.198.19.135.334.313.44.533.104.22.155.459.155.724l-.001.02v.02a1.545 1.545 0 01-.092.4.92.92 0 01-.206.334c-.083.1-.166.133-.262.133-.101 0-.184.066-.267.132a.746.746 0 00-.182.333 1.21 1.21 0 00-.062.4v.02c.006.135.035.271.09.402.034.065.13.138.18.198-.066.012-.13.023-.192.066a1.3 1.3 0 00-.218.066c-.085.069-.177.088-.282.133a.695.695 0 00-.087.042.957.957 0 01-.21-.335c-.084-.243-.118-.484-.14-.706l-.003-.024a.083.083 0 01-.004-.021v-.105c0 .02.005.04.006.06.008-.265.062-.465.166-.724a1.14 1.14 0 01.438-.533c.187-.136.373-.199.587-.199h.014z"/>
    </svg>
  );
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
        installToken: result.install_token,
        installCommandWindows: result.install_command_windows,
        installCommandLinux: result.install_command_linux,
        installCommandMac: result.install_command_mac,
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
      case "windows":
        return onboardingData.installCommandWindows || "";
      case "linux":
        return onboardingData.installCommandLinux || "";
      case "mac":
        return onboardingData.installCommandMac || "";
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
          <div className="rounded-md bg-amber-500/10 border border-amber-500/20 p-4">
            <div className="flex items-start gap-3">
              <Clock className="size-5 text-amber-500 mt-0.5" />
              <div>
                <h3 className="font-medium text-amber-600 dark:text-amber-400">
                  Cluster wird bei Verbindung erstellt
                </h3>
                <p className="text-sm text-amber-600/80 dark:text-amber-400/80 mt-1">
                  Der Cluster wird erst in Kubervise hinzugefügt, wenn der Agent erfolgreich verbunden ist.
                  Das Token ist 24 Stunden gültig.
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
                <LinuxIcon className="size-4" />
                Linux
              </button>
              <button
                onClick={() => setInstallMethod("mac")}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                  installMethod === "mac"
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted"
                }`}
              >
                <Apple className="size-4" />
                macOS
              </button>
              <button
                onClick={() => setInstallMethod("windows")}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                  installMethod === "windows"
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted"
                }`}
              >
                <Monitor className="size-4" />
                Windows
              </button>
            </div>

            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold">Quick Install</h2>
                  <p className="text-sm text-muted-foreground">
                    Run this command on a machine with kubectl access to your cluster
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

              <pre className="rounded-md border bg-muted p-4 text-sm font-mono overflow-x-auto whitespace-pre">
                {getCurrentInstallCommand()}
              </pre>

              <div className="mt-4 rounded-md bg-blue-500/10 border border-blue-500/20 p-3">
                <p className="text-sm text-blue-600 dark:text-blue-400">
                  <strong>Note:</strong> Make sure kubectl is installed and configured to access your target cluster.
                </p>
              </div>
            </div>
          </div>

          {/* What happens next */}
          <div className="rounded-md bg-green-500/10 border border-green-500/20 p-4">
            <h3 className="font-medium text-green-600 dark:text-green-400 mb-2">
              What happens after installation?
            </h3>
            <ul className="text-sm text-green-600/80 dark:text-green-400/80 space-y-1">
              <li>1. The installer fetches the configuration from our API</li>
              <li>2. Creates a <code className="bg-green-500/20 px-1 rounded">kubervise</code> namespace</li>
              <li>3. Sets up read-only RBAC permissions</li>
              <li>4. Deploys the monitoring agent</li>
              <li>5. <strong>Cluster is created</strong> and starts syncing data</li>
            </ul>
          </div>

          {/* Navigation */}
          <div className="flex justify-between">
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button onClick={() => setStep("verify")}>
              I've Installed the Agent
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
