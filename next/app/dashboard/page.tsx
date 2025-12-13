import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "./logout-button";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  return (
    <div className="min-h-svh bg-background">
      <header className="border-b">
        <div className="container flex h-14 items-center justify-between px-4">
          <h1 className="text-lg font-semibold">Dashboard</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{user.email}</span>
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="container px-4 py-8">
        <div className="rounded-lg border bg-card p-6">
          <h2 className="text-xl font-semibold mb-4">Welcome!</h2>
          <p className="text-muted-foreground">
            You are now logged in. This is a protected page that only
            authenticated users can access.
          </p>

          <div className="mt-6 space-y-2">
            <h3 className="font-medium">User Info:</h3>
            <div className="rounded-md bg-muted p-4 text-sm">
              <p>
                <span className="text-muted-foreground">Email:</span> {user.email}
              </p>
              <p>
                <span className="text-muted-foreground">User ID:</span> {user.id}
              </p>
              <p>
                <span className="text-muted-foreground">Last Sign In:</span>{" "}
                {user.last_sign_in_at
                  ? new Date(user.last_sign_in_at).toLocaleString()
                  : "N/A"}
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
