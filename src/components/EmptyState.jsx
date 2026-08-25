export function EmptyState({ title, message, actionLabel, onAction }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-surface px-6 py-14 text-center">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary-tint">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-primary">
          <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
          <path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </div>
      <h3 className="font-display text-sm font-semibold text-ink">{title}</h3>
      <p className="mt-1 max-w-xs text-sm text-ink-muted">{message}</p>
      {actionLabel && (
        <button
          onClick={onAction}
          className="mt-4 rounded-sm bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-dark"
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}
