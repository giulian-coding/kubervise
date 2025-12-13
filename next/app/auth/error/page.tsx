import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AuthErrorPage() {
  return (
    <div className="w-full max-w-sm space-y-6 text-center">
      <div className="flex justify-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="h-8 w-8 text-destructive" />
        </div>
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Authentication Error</h1>
        <p className="text-sm text-muted-foreground">
          Something went wrong during the authentication process. The link may
          have expired or already been used.
        </p>
      </div>

      <div className="space-y-3">
        <Link href="/auth/login">
          <Button className="w-full">Back to login</Button>
        </Link>
        <Link href="/auth/sign-up">
          <Button variant="outline" className="w-full">Create new account</Button>
        </Link>
      </div>
    </div>
  );
}
