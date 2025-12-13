"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Users, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createTeamAndCompleteOnboarding } from "@/lib/actions/onboarding";

interface OnboardingFormProps {
  userEmail: string;
}

export function OnboardingForm({ userEmail }: OnboardingFormProps) {
  const router = useRouter();
  const [step, setStep] = useState<"choice" | "create" | "join">("choice");
  const [teamName, setTeamName] = useState("");
  const [teamDescription, setTeamDescription] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim()) {
      setError("Team name is required");
      return;
    }

    setIsLoading(true);
    setError(null);

    const result = await createTeamAndCompleteOnboarding(
      teamName.trim(),
      teamDescription.trim() || undefined
    );

    if (result.success) {
      // Force a hard navigation to bypass cache
      window.location.href = "/dashboard";
    } else {
      setError(result.error || "Failed to create team");
      setIsLoading(false);
    }
  };

  const handleJoinTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) {
      setError("Invite code is required");
      return;
    }

    setIsLoading(true);
    setError(null);

    // TODO: Implement join team via invite code
    // For now, show error
    setError("Join via invite code coming soon");
    setIsLoading(false);
  };

  if (step === "create") {
    return (
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <button
          onClick={() => setStep("choice")}
          className="mb-4 text-sm text-muted-foreground hover:text-foreground"
        >
          &larr; Back
        </button>

        <div className="mb-6">
          <h2 className="text-xl font-semibold">Create your team</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Set up a new workspace for your organization
          </p>
        </div>

        <form onSubmit={handleCreateTeam} className="space-y-4">
          <div>
            <label htmlFor="teamName" className="block text-sm font-medium mb-1">
              Team Name
            </label>
            <Input
              id="teamName"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="Acme Inc."
              disabled={isLoading}
              autoFocus
            />
          </div>

          <div>
            <label
              htmlFor="teamDescription"
              className="block text-sm font-medium mb-1"
            >
              Description (optional)
            </label>
            <Textarea
              id="teamDescription"
              value={teamDescription}
              onChange={(e) => setTeamDescription(e.target.value)}
              placeholder="A short description of your team..."
              rows={3}
              disabled={isLoading}
            />
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Creating team...
              </>
            ) : (
              <>
                Create Team
                <ArrowRight className="ml-2 size-4" />
              </>
            )}
          </Button>
        </form>
      </div>
    );
  }

  if (step === "join") {
    return (
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <button
          onClick={() => setStep("choice")}
          className="mb-4 text-sm text-muted-foreground hover:text-foreground"
        >
          &larr; Back
        </button>

        <div className="mb-6">
          <h2 className="text-xl font-semibold">Join an existing team</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter the invite code you received
          </p>
        </div>

        <form onSubmit={handleJoinTeam} className="space-y-4">
          <div>
            <label htmlFor="inviteCode" className="block text-sm font-medium mb-1">
              Invite Code
            </label>
            <Input
              id="inviteCode"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              placeholder="Enter your invite code..."
              disabled={isLoading}
              autoFocus
            />
          </div>

          <div className="rounded-md bg-muted p-3 text-sm">
            <p className="text-muted-foreground">
              You&apos;re joining as{" "}
              <span className="font-medium text-foreground">{userEmail}</span>
            </p>
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Joining team...
              </>
            ) : (
              <>
                Join Team
                <ArrowRight className="ml-2 size-4" />
              </>
            )}
          </Button>
        </form>
      </div>
    );
  }

  // Choice step
  return (
    <div className="space-y-4">
      <button
        onClick={() => setStep("create")}
        className="w-full rounded-lg border bg-card p-6 text-left transition-colors hover:bg-accent"
      >
        <div className="flex items-start gap-4">
          <div className="rounded-lg bg-primary/10 p-3">
            <Building2 className="size-6 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold">Create a new team</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Start fresh with a new workspace for your organization
            </p>
          </div>
          <ArrowRight className="size-5 text-muted-foreground" />
        </div>
      </button>

      <button
        onClick={() => setStep("join")}
        className="w-full rounded-lg border bg-card p-6 text-left transition-colors hover:bg-accent"
      >
        <div className="flex items-start gap-4">
          <div className="rounded-lg bg-primary/10 p-3">
            <Users className="size-6 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold">Join an existing team</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Use an invite code to join your organization&apos;s workspace
            </p>
          </div>
          <ArrowRight className="size-5 text-muted-foreground" />
        </div>
      </button>

      <p className="text-center text-sm text-muted-foreground">
        You can create or join additional teams later
      </p>
    </div>
  );
}
