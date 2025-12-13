import Link from "next/link";
import { ForgotPasswordForm } from "./forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold">Reset password</h1>
        <p className="text-sm text-muted-foreground">
          Enter your email address and we&apos;ll send you a link to reset your
          password
        </p>
      </div>

      <ForgotPasswordForm />

      <div className="text-center text-sm">
        <Link href="/auth/login" className="text-muted-foreground hover:text-primary">
          Back to login
        </Link>
      </div>
    </div>
  );
}
