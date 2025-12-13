import { UpdatePasswordForm } from "./update-password-form";

export default function UpdatePasswordPage() {
  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold">Update password</h1>
        <p className="text-sm text-muted-foreground">
          Enter your new password below
        </p>
      </div>

      <UpdatePasswordForm />
    </div>
  );
}
