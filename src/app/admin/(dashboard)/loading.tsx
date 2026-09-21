export default function AdminLoading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <div className="glass h-10 w-48 animate-pulse rounded-2xl" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="glass h-24 animate-pulse rounded-2xl" />
        ))}
      </div>
      <div className="glass h-64 animate-pulse rounded-2xl" />
      <span className="sr-only">Loading dashboard…</span>
    </div>
  );
}
