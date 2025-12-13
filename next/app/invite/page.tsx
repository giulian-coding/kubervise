import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AcceptInvitation } from "./accept-invitation";

interface InvitePageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function InvitePage({ searchParams }: InvitePageProps) {
  const params = await searchParams;
  const token = params.token;

  if (!token) {
    redirect("/auth/login");
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Fetch invitation details
  const { data: invitation } = await supabase
    .from("team_invitations")
    .select(`
      *,
      teams(name, slug)
    `)
    .eq("token", token)
    .single();

  if (!invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md text-center space-y-4">
          <h1 className="text-2xl font-bold">Invalid Invitation</h1>
          <p className="text-muted-foreground">
            This invitation link is invalid or has expired.
          </p>
          <a
            href="/auth/login"
            className="inline-block mt-4 text-primary hover:underline"
          >
            Go to Login
          </a>
        </div>
      </div>
    );
  }

  // Check if invitation is expired
  if (new Date(invitation.expires_at) < new Date()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md text-center space-y-4">
          <h1 className="text-2xl font-bold">Invitation Expired</h1>
          <p className="text-muted-foreground">
            This invitation has expired. Please ask the team admin to send a new one.
          </p>
          <a
            href="/auth/login"
            className="inline-block mt-4 text-primary hover:underline"
          >
            Go to Login
          </a>
        </div>
      </div>
    );
  }

  // Check if already accepted
  if (invitation.status !== "pending") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md text-center space-y-4">
          <h1 className="text-2xl font-bold">Invitation Already Used</h1>
          <p className="text-muted-foreground">
            This invitation has already been {invitation.status}.
          </p>
          <a
            href="/dashboard"
            className="inline-block mt-4 text-primary hover:underline"
          >
            Go to Dashboard
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <AcceptInvitation
        token={token}
        teamName={invitation.teams?.name || "Unknown Team"}
        invitedEmail={invitation.email}
        role={invitation.role}
        isLoggedIn={!!user}
        currentUserEmail={user?.email}
      />
    </div>
  );
}
