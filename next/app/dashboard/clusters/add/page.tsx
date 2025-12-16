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
  Loader2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Monitor,
  Container,
  Apple,
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
type InstallMethod = "linux" | "macos" | "windows" | "docker" | null;
type ConnectionStatus = "pending" | "connected" | "expired" | "checking";

interface OnboardingData {
  name: string;
  description: string;
  teamId: string;
  onboardingId?: string;
  clusterId?: string;
  agentToken?: string;
  apiUrl?: string;
  clusterName?: string;
}

export default function AddClusterPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("info");
  const [installMethod, setInstallMethod] = useState<InstallMethod>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [teams, setTeams] = useState<Array<{ id: string; name: string }>>([]);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("pending");

  const [onboardingData, setOnboardingData] = useState<OnboardingData>({
    name: "",
    description: "",
    teamId: "",
  });

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

  const checkStatus = useCallback(async () => {
    if (!onboardingData.onboardingId) return;

    setConnectionStatus("checking");
    const result = await checkPendingOnboardingStatus(
      onboardingData.onboardingId
    );

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

    checkStatus();
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
        agentToken: result.agent_token,
        apiUrl: result.api_url,
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

  const getDownloadUrl = (platform: "linux" | "macos" | "windows") => {
    const base = onboardingData.apiUrl || "";
    const files = {
      linux: "agentkubervise-linux-amd64",
      macos: "agentkubervise-darwin-amd64",
      windows: "agentkubervise-windows-amd64.exe",
    };
    return `${base}/downloads/${files[platform]}`;
  };

  const getRunCommand = (platform: "linux" | "macos" | "windows") => {
    const binary = platform === "windows" ? "agentkubervise.exe" : "./agentkubervise";
    return `${binary} --api-url "${onboardingData.apiUrl}" --token "${onboardingData.agentToken}" --cluster-id "${onboardingData.clusterId}"`;
  };

  const getDockerCommand = () => {
    return `docker run -d \\
  -e KUBERVISE_API_URL="${onboardingData.apiUrl}" \\
  -e KUBERVISE_AGENT_TOKEN="${onboardingData.agentToken}" \\
  -e KUBERVISE_CLUSTER_ID="${onboardingData.clusterId}" \\
  -v ~/.kube:/root/.kube:ro \\
  kubervise/agent:latest`;
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = (platform: "linux" | "macos" | "windows") => {
    window.open(getDownloadUrl(platform), "_blank");
    setInstallMethod(platform);
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
            label="Verify"
            active={step === "verify"}
            completed={connectionStatus === "connected"}
          />
        </div>
      </div>

      {/* Step 1: Cluster Info */}
      {step === "info" && (
        <div className="max-w-xl mx-auto">
          <div className="rounded-xl border bg-card p-6">
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
                    setOnboardingData((prev) => ({
                      ...prev,
                      teamId: e.target.value,
                    }))
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
                    setOnboardingData((prev) => ({
                      ...prev,
                      name: e.target.value,
                    }))
                  }
                  placeholder="production-cluster"
                  disabled={isLoading}
                />
              </div>

              <div>
                <label
                  htmlFor="description"
                  className="block text-sm font-medium mb-1"
                >
                  Description
                </label>
                <Textarea
                  id="description"
                  value={onboardingData.description}
                  onChange={(e) =>
                    setOnboardingData((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Optional description..."
                  rows={2}
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
                    <Loader2 className="size-4 animate-spin" />
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

      {/* Step 2: Install Agent - Card Selection */}
      {step === "install" && (
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Download Cards */}
          <div>
            <h2 className="text-lg font-semibold mb-4 text-center">
              Download Agent
            </h2>
            <div className="grid gap-4 md:grid-cols-3">
              <InstallCard
                icon={<Monitor className="size-8" />}
                title="Linux"
                subtitle="amd64"
                selected={installMethod === "linux"}
                onClick={() => handleDownload("linux")}
              />
              <InstallCard
                icon={<Apple className="size-8" />}
                title="macOS"
                subtitle="amd64"
                selected={installMethod === "macos"}
                onClick={() => handleDownload("macos")}
              />
              <InstallCard
                icon={
                  <svg className="size-8" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801" />
                  </svg>
                }
                title="Windows"
                subtitle="amd64"
                selected={installMethod === "windows"}
                onClick={() => handleDownload("windows")}
              />
            </div>
          </div>

          {/* Docker Option */}
          <div>
            <h2 className="text-lg font-semibold mb-4 text-center">
              Or use Docker
            </h2>
            <div
              onClick={() => setInstallMethod("docker")}
              className={`cursor-pointer rounded-xl border-2 p-6 transition-all hover:border-primary/50 hover:bg-muted/50 ${
                installMethod === "docker"
                  ? "border-primary bg-primary/5"
                  : "border-border"
              }`}
            >
              <div className="flex items-center gap-4">
                <div
                  className={`flex size-14 items-center justify-center rounded-xl ${
                    installMethod === "docker"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  <Container className="size-7" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">Docker</h3>
                  <p className="text-sm text-muted-foreground">
                    kubervise/agent:latest
                  </p>
                </div>
                {installMethod === "docker" && (
                  <Check className="size-5 text-primary" />
                )}
              </div>
            </div>
          </div>

          {/* Command Display (shown after selection) */}
          {installMethod && (
            <div className="rounded-xl border bg-card p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">
                  {installMethod === "docker" ? "Docker Command" : "Run Command"}
                </h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    copyToClipboard(
                      installMethod === "docker"
                        ? getDockerCommand()
                        : getRunCommand(installMethod as "linux" | "macos" | "windows")
                    )
                  }
                >
                  {copied ? (
                    <Check className="size-4 mr-1" />
                  ) : (
                    <Copy className="size-4 mr-1" />
                  )}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
              <pre className="rounded-lg bg-muted p-4 text-sm font-mono overflow-x-auto">
                {installMethod === "docker"
                  ? getDockerCommand()
                  : getRunCommand(installMethod as "linux" | "macos" | "windows")}
              </pre>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button onClick={() => setStep("verify")} disabled={!installMethod}>
              Continue
              <ArrowRight className="size-4 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Verify Connection */}
      {step === "verify" && (
        <div className="max-w-xl mx-auto">
          <div className="rounded-xl border bg-card p-8">
            <div className="flex flex-col items-center py-8">
              {connectionStatus === "checking" && (
                <>
                  <Loader2 className="size-16 text-primary animate-spin mb-4" />
                  <p className="text-lg font-medium">Checking connection...</p>
                </>
              )}

              {connectionStatus === "connected" && (
                <>
                  <CheckCircle2 className="size-20 text-green-500 mb-4" />
                  <p className="text-xl font-semibold text-green-600 mb-2">
                    Connected!
                  </p>
                  <p className="text-muted-foreground mb-6">
                    {onboardingData.clusterName || onboardingData.name}
                  </p>
                  <Button onClick={() => router.push(`/dashboard/clusters`)}>
                    View Clusters
                    <ArrowRight className="size-4 ml-2" />
                  </Button>
                </>
              )}

              {connectionStatus === "pending" && (
                <>
                  <div className="size-20 rounded-full border-4 border-dashed border-yellow-500 flex items-center justify-center mb-4 animate-pulse">
                    <RefreshCw className="size-10 text-yellow-500" />
                  </div>
                  <p className="text-lg font-medium mb-2">Waiting for Agent</p>
                  <p className="text-sm text-muted-foreground text-center mb-6">
                    Start the agent to establish connection
                  </p>
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
                  <XCircle className="size-20 text-red-500 mb-4" />
                  <p className="text-lg font-medium text-red-600 mb-2">
                    Token Expired
                  </p>
                  <p className="text-sm text-muted-foreground mb-6">
                    Please start the process again
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
        className={`size-10 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
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

function InstallCard({
  icon,
  title,
  subtitle,
  selected,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`group cursor-pointer rounded-xl border-2 p-6 text-center transition-all hover:border-primary/50 hover:bg-muted/50 ${
        selected ? "border-primary bg-primary/5" : "border-border"
      }`}
    >
      <div
        className={`mx-auto mb-4 flex size-16 items-center justify-center rounded-xl transition-colors ${
          selected
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
        }`}
      >
        {icon}
      </div>
      <h3 className="font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">{subtitle}</p>
      <div className="mt-4 flex items-center justify-center gap-2 text-sm text-primary">
        <Download className="size-4" />
        Download
      </div>
      {selected && (
        <div className="mt-2 flex items-center justify-center text-sm text-primary">
          <Check className="size-4 mr-1" />
          Downloaded
        </div>
      )}
    </div>
  );
}
