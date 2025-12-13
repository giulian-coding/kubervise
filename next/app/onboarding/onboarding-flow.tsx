"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Layers,
  Users,
  ArrowRight,
  Check,
  Loader2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateTeam } from "@/hooks/use-team";

interface OnboardingFlowProps {
  userEmail?: string;
}

type Step = "welcome" | "create-team" | "complete";

export function OnboardingFlow({ userEmail }: OnboardingFlowProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("welcome");
  const [teamName, setTeamName] = useState("");
  const [teamDescription, setTeamDescription] = useState("");
  const { createTeam, isLoading, error } = useCreateTeam();

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!teamName.trim()) return;

    try {
      await createTeam(teamName, teamDescription || undefined);
      setStep("complete");
      // Redirect after short delay to show success
      setTimeout(() => {
        router.push("/dashboard");
      }, 2000);
    } catch {
      // Error is handled by the hook
    }
  };

  return (
    <div className="w-full max-w-md">
      {step === "welcome" && (
        <div className="text-center space-y-6">
          <div className="flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary">
              <Layers className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Welcome to Kubervise</h1>
            <p className="text-muted-foreground">
              {userEmail && (
                <span className="block text-sm mb-2">
                  Signed in as <span className="font-medium">{userEmail}</span>
                </span>
              )}
              Let&apos;s get you set up with your first team to start monitoring
              your Kubernetes clusters.
            </p>
          </div>

          <div className="space-y-3 pt-4">
            <Button
              onClick={() => setStep("create-team")}
              className="w-full"
              size="lg"
            >
              <Users className="mr-2 h-5 w-5" />
              Create a Team
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>

            <p className="text-xs text-muted-foreground">
              Teams help you organize clusters and collaborate with your colleagues.
            </p>
          </div>
        </div>
      )}

      {step === "create-team" && (
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold">Create Your Team</h1>
            <p className="text-muted-foreground">
              Give your team a name. You can invite members later.
            </p>
          </div>

          <form onSubmit={handleCreateTeam} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="teamName">Team Name</Label>
              <Input
                id="teamName"
                placeholder="e.g., My Company, DevOps Team"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                disabled={isLoading}
                required
                minLength={2}
                maxLength={50}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="teamDescription">
                Description <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="teamDescription"
                placeholder="What does this team do?"
                value={teamDescription}
                onChange={(e) => setTeamDescription(e.target.value)}
                disabled={isLoading}
                maxLength={200}
              />
            </div>

            {error && (
              <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                {error.message}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep("welcome")}
                disabled={isLoading}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                type="submit"
                disabled={isLoading || !teamName.trim()}
                className="flex-1"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    Create Team
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      )}

      {step === "complete" && (
        <div className="text-center space-y-6">
          <div className="flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
              <Check className="h-8 w-8 text-green-500" />
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold">You&apos;re All Set!</h1>
            <p className="text-muted-foreground">
              Your team <span className="font-medium">{teamName}</span> has been
              created. Redirecting you to the dashboard...
            </p>
          </div>

          <div className="flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </div>
      )}
    </div>
  );
}
