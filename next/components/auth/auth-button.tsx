import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { LogoutButton } from "./logout-button";

export async function AuthButton() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return user ? (
    <div className="flex items-center gap-4">
      <span className="text-sm text-muted-foreground">{user.email}</span>
      <LogoutButton />
    </div>
  ) : (
    <div className="flex gap-2">
      <Link
        href="/auth/login"
        className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
      >
        Login
      </Link>
      <Link
        href="/auth/sign-up"
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/80 transition-colors"
      >
        Sign up
      </Link>
    </div>
  );
}
