import { formatLong } from '../lib/dateWindow'

const ICONS = {
  conflict: '⚠️',
  self_overlap: '⚠️',
  max_periods: 'ℹ️',
  window: 'ℹ️',
  not_linked: 'ℹ️',
  validation: '⚠️',
  unknown: '⚠️',
}

export function ConflictError({ error, onChangeDates }) {
  if (!error) return null

  return (
    <div className="rounded-lg border border-conflict/30 bg-conflict-tint p-4">
      <p className="text-sm font-semibold text-conflict">
        {ICONS[error.kind] ?? '⚠️'} {error.title}
      </p>

      {error.conflicts?.length > 0 ? (
        <ul className="mt-2 space-y-1.5">
          {error.conflicts.map((c, i) => (
            <li key={i} className="text-sm text-ink">
              <span className="font-medium">{c.employee_name}</span> is already on leave from{' '}
              <span className="font-mono text-[13px]">{formatLong(c.start_date)}</span> to{' '}
              <span className="font-mono text-[13px]">{formatLong(c.end_date)}</span>.
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1.5 text-sm text-ink">{error.message}</p>
      )}

      <p className="mt-2 text-sm text-ink-muted">Please select different dates.</p>

      <button
        onClick={onChangeDates}
        className="mt-3 rounded-sm border border-conflict/40 bg-white px-3 py-1.5 text-sm font-medium text-conflict transition hover:bg-conflict/5"
      >
        Change Dates
      </button>
    </div>
  )
}
