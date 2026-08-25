import { formatLong } from '../lib/dateWindow'
import { EmptyState } from './EmptyState'

export function MyLeave({ employee, periods, onSelectPeriod, onApplyLeave }) {
  const mine = periods
    .filter((p) => p.employeeId === employee?.id)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))

  const upcoming = mine.filter((p) => p.endDate >= new Date().toISOString().slice(0, 10))
  const year = new Date().getFullYear()

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">My Leave Planner</h2>
          <p className="text-sm text-ink">{employee?.name}</p>
          <p className="font-mono text-xs text-ink-muted">
            {employee?.epfNumber} · {year}
          </p>
        </div>
        <div className="flex gap-6">
          <Stat label="Total Periods" value={`${mine.length} / 3`} />
          <Stat label="Upcoming Leave" value={upcoming.length} />
        </div>
      </div>

      {mine.length === 0 ? (
        <EmptyState
          title="No Leave Scheduled"
          message="There are currently no leave periods scheduled for this period."
          actionLabel="+ Apply Leave"
          onAction={onApplyLeave}
        />
      ) : (
        <div className="space-y-3">
          {mine.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-lg border border-border bg-surface p-4"
            >
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">
                  Period {p.periodNumber}
                </p>
                <p className="mt-1 font-mono text-sm text-ink">
                  {formatLong(p.startDate)} → {formatLong(p.endDate)}
                </p>
                <p className="text-xs text-ink-muted">
                  {p.daysCount} {p.daysCount === 1 ? 'Day' : 'Days'}
                </p>
              </div>
              <button
                onClick={() => onSelectPeriod(p)}
                className="rounded-sm border border-border px-3 py-1.5 text-sm font-medium text-ink transition hover:bg-bg"
              >
                View
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div className="text-right">
      <p className="text-xs uppercase tracking-wide text-ink-faint">{label}</p>
      <p className="font-display text-lg font-semibold text-ink">{value}</p>
    </div>
  )
}
