export function CalendarSkeleton() {
  return (
    <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-border bg-border">
      {Array.from({ length: 35 }).map((_, i) => (
        <div key={i} className="h-24 animate-pulse bg-surface p-2 sm:h-28">
          <div className="h-3 w-5 rounded bg-ink-faint/20" />
        </div>
      ))}
    </div>
  )
}

export function ListSkeleton({ rows = 3 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-lg border border-border bg-surface p-4">
          <div className="mb-2 h-3 w-24 rounded bg-ink-faint/20" />
          <div className="h-4 w-48 rounded bg-ink-faint/20" />
        </div>
      ))}
    </div>
  )
}
