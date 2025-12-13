export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div>
        <div className="h-8 w-32 bg-muted rounded" />
        <div className="h-4 w-64 bg-muted rounded mt-2" />
      </div>

      {/* Stats Grid Skeleton */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-lg border bg-card p-4">
            <div className="flex items-center justify-between">
              <div className="h-4 w-16 bg-muted rounded" />
              <div className="h-4 w-4 bg-muted rounded" />
            </div>
            <div className="mt-2">
              <div className="h-8 w-12 bg-muted rounded" />
              <div className="h-3 w-24 bg-muted rounded mt-2" />
            </div>
          </div>
        ))}
      </div>

      {/* Content Skeleton */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border bg-card p-6">
          <div className="h-6 w-32 bg-muted rounded mb-4" />
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-12 bg-muted rounded" />
            ))}
          </div>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <div className="h-6 w-32 bg-muted rounded mb-4" />
          <div className="h-32 bg-muted rounded" />
        </div>
      </div>
    </div>
  );
}
