import { formatLong } from '../lib/dateWindow'
import { ContextBadges } from './Badges'

export function SeatDetailsPanel({ employee, leaveInfo, isMe, onClose }) {
  if (!employee) return null

  const { period, status } = leaveInfo ?? { period: null, status: 'available' }

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-ink/30 backdrop-blur-[1px]"
      />
      <div className="relative flex h-full w-full max-w-sm flex-col bg-surface shadow-panel sm:w-[380px]">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-display text-base font-semibold text-ink">Seat Details</h2>
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
            <p className="mt-1 text-sm font-medium text-ink">
              {employee.name}
              {isMe && <span className="ml-1.5 text-xs font-normal text-primary">(You)</span>}
            </p>
            {employee.epfNumber && (
              <p className="mt-0.5 font-mono text-xs text-ink-muted">{employee.epfNumber}</p>
            )}
            <div className="mt-1.5">
              <ContextBadges
                role={employee.role}
                seatGroupLabel={employee.seatGroupLabel}
                slotLabel={employee.slotLabel}
                teamName={employee.teamName}
              />
            </div>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wide text-ink-faint">Current Status</p>
            <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-ink">
              <span
                className={`h-2 w-2 rounded-full ${
                  status === 'ongoing' ? 'bg-conflict' : status === 'upcoming' ? 'bg-accent' : 'bg-success'
                }`}
              />
              {status === 'ongoing'
                ? 'On leave now'
                : status === 'upcoming'
                  ? 'Upcoming leave'
                  : 'Available'}
            </p>
          </div>

          {period && (
            <div>
              <p className="text-xs uppercase tracking-wide text-ink-faint">Leave Period</p>
              <p className="mt-1 font-mono text-sm text-ink">
                {formatLong(period.startDate)} → {formatLong(period.endDate)}
              </p>
              <p className="mt-0.5 text-xs text-ink-muted">
                {period.daysCount} {period.daysCount === 1 ? 'Day' : 'Days'} · Period{' '}
                {period.periodNumber}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
