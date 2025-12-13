import { createClient } from "@/lib/supabase/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/";

  if (token_hash && type) {
    const supabase = await createClient();

    const { data, error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });

    if (!error && data.user) {
      // Check if user needs onboarding
      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_status")
        .eq("id", data.user.id)
        .single();

      // If onboarding pending, redirect to onboarding
      if (profile?.onboarding_status === "pending") {
        // Check if there's a specific redirect (like invitation)
        if (next.includes("/invite")) {
          redirect(next);
        }
        redirect("/onboarding");
      }

      redirect(next);
    } else {
      redirect(`/auth/error?error=${error?.message}`);
    }
  }

  redirect(`/auth/error?error=No token hash or type`);
}
