import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/auth/logout-button";
import { redirect } from "next/navigation";

export default async function ProtectedPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="flex flex-col items-center gap-4">
        <h1 className="text-2xl font-bold">Protected Page</h1>
        <p className="text-muted-foreground">
          Welcome, {user.email}!
        </p>
        <p className="text-sm text-muted-foreground">
          This page is only accessible to authenticated users.
        </p>
        <LogoutButton />
      </div>
    </div>
  );
}
