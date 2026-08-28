import { formatLong, leaveTemporalStatus } from '../lib/dateWindow'
import { ContextBadges } from './Badges'

export function LeaveDetailsPanel({ period, employeeRole, onClose }) {
  if (!period) return null

  const leaveStatus = leaveTemporalStatus(period.startDate, period.endDate)

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-ink/30 backdrop-blur-[1px]"
      />
      <div className="relative flex h-full w-full max-w-sm flex-col bg-surface shadow-panel sm:w-[380px]">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-display text-base font-semibold text-ink">Leave Details</h2>
          <button
            onClick={onClose}
            className="rounded-sm p-1 text-ink-muted transition hover:bg-bg hover:text-ink"
            aria-label="Close panel"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-faint">Employee</p>
            <div className="mt-1 flex items-center gap-2">
              <p className="text-sm font-medium text-ink">{period.employeeName}</p>
            </div>
            {period.employeeEpf && (
              <p className="mt-0.5 font-mono text-xs text-ink-muted">{period.employeeEpf}</p>
            )}
            <div className="mt-1.5">
              <ContextBadges
                role={employeeRole}
                seatGroupLabel={period.seatGroupLabel}
                teamName={period.teamName}
              />
            </div>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wide text-ink-faint">Status</p>
            <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-ink">
              <span
                className={`h-2 w-2 rounded-full ${
                  leaveStatus === 'ongoing'
                    ? 'bg-conflict'
                    : leaveStatus === 'upcoming'
                      ? 'bg-accent'
                      : 'bg-ink-faint'
                }`}
              />
              {leaveStatus === 'ongoing' ? 'On leave now' : leaveStatus === 'upcoming' ? 'Upcoming leave' : 'Past leave'}
            </p>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wide text-ink-faint">Period</p>
            <p className="mt-1 text-sm text-ink">Annual Leave · Period {period.periodNumber}</p>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wide text-ink-faint">Leave Period</p>
            <p className="mt-1 font-mono text-sm text-ink">
              {formatLong(period.startDate)} → {formatLong(period.endDate)}
            </p>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wide text-ink-faint">Duration</p>
            <p className="mt-1 text-sm text-ink">
              {period.daysCount} {period.daysCount === 1 ? 'Day' : 'Days'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
