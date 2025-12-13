import Link from "next/link";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SignUpSuccessPage() {
  return (
    <div className="w-full max-w-sm space-y-6 text-center">
      <div className="flex justify-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <Mail className="h-8 w-8 text-primary" />
        </div>
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Check your email</h1>
        <p className="text-sm text-muted-foreground">
          We&apos;ve sent you a confirmation link. Please check your email to
          verify your account.
        </p>
      </div>

      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Didn&apos;t receive the email? Check your spam folder or try again.
        </p>
        <Link href="/auth/login">
          <Button variant="outline" className="w-full">Back to login</Button>
        </Link>
      </div>
    </div>
  );
}
