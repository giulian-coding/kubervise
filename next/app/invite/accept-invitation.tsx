"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  Check,
  Loader2,
  AlertTriangle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAcceptInvitation } from "@/hooks/use-team";

interface AcceptInvitationProps {
  token: string;
  teamName: string;
  invitedEmail: string;
  role: string;
  isLoggedIn: boolean;
  currentUserEmail?: string;
}

export function AcceptInvitation({
  token,
  teamName,
  invitedEmail,
  role,
  isLoggedIn,
  currentUserEmail,
}: AcceptInvitationProps) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const { acceptInvitation, isLoading } = useAcceptInvitation();

  const emailMismatch = isLoggedIn && currentUserEmail?.toLowerCase() !== invitedEmail.toLowerCase();

  const handleAccept = async () => {
    try {
      await acceptInvitation(token);
      setStatus("success");
      setTimeout(() => {
        router.push("/dashboard");
      }, 2000);
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Failed to accept invitation");
    }
  };

  if (status === "success") {
    return (
      <div className="w-full max-w-md text-center space-y-6">
        <div className="flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
            <Check className="h-8 w-8 text-green-500" />
          </div>
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Welcome to {teamName}!</h1>
          <p className="text-muted-foreground">
            You&apos;ve successfully joined the team. Redirecting...
          </p>
        </div>
        <div className="flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="w-full max-w-md text-center space-y-6">
        <div className="flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Users className="h-8 w-8 text-primary" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Join {teamName}</h1>
          <p className="text-muted-foreground">
            You&apos;ve been invited to join <span className="font-medium">{teamName}</span> as a{" "}
            <span className="font-medium capitalize">{role}</span>.
          </p>
        </div>

        <div className="rounded-lg bg-muted p-4 text-sm">
          <p className="text-muted-foreground">Invitation sent to:</p>
          <p className="font-medium">{invitedEmail}</p>
        </div>

        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Please sign in or create an account with this email to accept the invitation.
          </p>
          <Button
            onClick={() => router.push(`/auth/login?redirect=/invite?token=${token}`)}
            className="w-full"
            size="lg"
          >
            Sign In to Accept
          </Button>
          <Button
            onClick={() => router.push(`/auth/sign-up?redirect=/invite?token=${token}&email=${encodeURIComponent(invitedEmail)}`)}
            variant="outline"
            className="w-full"
            size="lg"
          >
            Create Account
          </Button>
        </div>
      </div>
    );
  }

  if (emailMismatch) {
    return (
      <div className="w-full max-w-md text-center space-y-6">
        <div className="flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-yellow-500/10">
            <AlertTriangle className="h-8 w-8 text-yellow-500" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Email Mismatch</h1>
          <p className="text-muted-foreground">
            This invitation was sent to a different email address.
          </p>
        </div>

        <div className="space-y-3 text-sm">
          <div className="rounded-lg bg-muted p-4">
            <p className="text-muted-foreground">Invitation for:</p>
            <p className="font-medium">{invitedEmail}</p>
          </div>
          <div className="rounded-lg bg-muted p-4">
            <p className="text-muted-foreground">You&apos;re signed in as:</p>
            <p className="font-medium">{currentUserEmail}</p>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Please sign in with the correct email address to accept this invitation.
          </p>
          <Button
            onClick={() => router.push(`/auth/login?redirect=/invite?token=${token}`)}
            className="w-full"
          >
            Sign In with Different Account
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md text-center space-y-6">
      <div className="flex justify-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <Users className="h-8 w-8 text-primary" />
        </div>
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Join {teamName}</h1>
        <p className="text-muted-foreground">
          You&apos;ve been invited to join as a{" "}
          <span className="font-medium capitalize">{role}</span>.
        </p>
      </div>

      <div className="rounded-lg bg-muted p-4 text-sm">
        <p className="text-muted-foreground">Signed in as:</p>
        <p className="font-medium">{currentUserEmail}</p>
      </div>

      {status === "error" && (
        <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {errorMessage}
        </div>
      )}

      <div className="space-y-3">
        <Button
          onClick={handleAccept}
          disabled={isLoading}
          className="w-full"
          size="lg"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Joining...
            </>
          ) : (
            "Accept Invitation"
          )}
        </Button>
        <Button
          onClick={() => router.push("/dashboard")}
          variant="outline"
          className="w-full"
          disabled={isLoading}
        >
          Decline
        </Button>
      </div>
    </div>
  );
}
