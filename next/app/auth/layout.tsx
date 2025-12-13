export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-svh flex items-center justify-center bg-background p-4">
      {children}
    </div>
  );
}
