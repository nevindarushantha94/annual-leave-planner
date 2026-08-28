import { useState } from 'react'
import { CalendarView } from './CalendarView'
import { SeatingFloorChart } from './SeatingFloorChart'
import { LeaveManagementTable } from './LeaveManagementTable'

const SECTIONS = [
  { key: 'leave', label: 'Leave Management' },
  { key: 'calendar', label: 'Calendar' },
  { key: 'seating', label: 'Seating' },
  { key: 'reports', label: 'Reports' },
]

function ComingSoon({ title, description }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-surface px-6 py-14 text-center">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-hod-tint">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-hod">
          <path
            d="M12 8v4l2.5 2.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <h3 className="font-display text-sm font-semibold text-ink">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-ink-muted">{description}</p>
    </div>
  )
}

export function ManagementView({
  role,
  employees,
  periods,
  activeEmployeeId,
  highlightedEmployeeId,
  onHighlightEmployee,
  onSelectPeriod,
  onEditPeriod,
  onDeletePeriod,
  onAddForEmployee,
}) {
  const [section, setSection] = useState('leave')
  const [calendarFocus, setCalendarFocus] = useState(null) // { date, token }

  function handleViewOnCalendar(period) {
    setCalendarFocus({ date: period.startDate, token: Date.now() })
    onHighlightEmployee?.(period.employeeId)
    setSection('calendar')
  }

  return (
    <div className="rounded-xl border border-hod/25 bg-hod-tint/40">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hod/20 px-4 py-3 sm:px-5">
        <div>
          <h2 className="font-display text-base font-semibold text-hod">
            Management {role === 'HOD' ? '· HOD' : '· Admin'}
          </h2>
          <p className="text-xs text-ink-muted">
            Department-wide leave oversight. Edits and cancellations here are enforced server-side
            for {role === 'HOD' ? 'HOD' : 'Admin'} accounts — the database is the final authority.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-hod/20 px-3 sm:px-4">
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            onClick={() => setSection(s.key)}
            className={`rounded-t-md border-b-2 px-3 py-2.5 text-sm font-medium transition ${
              section === s.key
                ? 'border-hod text-hod'
                : 'border-transparent text-ink-muted hover:text-ink'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="p-4 sm:p-5">
        {section === 'leave' && (
          <LeaveManagementTable
            employees={employees}
            periods={periods}
            onViewPeriod={onSelectPeriod}
            onViewOnCalendar={handleViewOnCalendar}
            onEditPeriod={onEditPeriod}
            onDeletePeriod={onDeletePeriod}
            onAddForEmployee={onAddForEmployee}
          />
        )}

        {section === 'calendar' && (
          <div className="rounded-lg bg-surface p-3 sm:p-4">
            <CalendarView
              key={calendarFocus?.token ?? 'default'}
              periods={periods}
              activeEmployeeId={activeEmployeeId}
              highlightedEmployeeId={highlightedEmployeeId}
              onSelectPeriod={onSelectPeriod}
              onApplyLeave={() => {}}
              hideApplyButton
              focusDate={calendarFocus?.date}
            />
          </div>
        )}

        {section === 'seating' && (
          <div className="rounded-lg bg-surface p-3 sm:p-4">
            <SeatingFloorChart
              employees={employees}
              periods={periods}
              activeEmployeeId={activeEmployeeId}
              highlightedEmployeeId={highlightedEmployeeId}
              onHighlightEmployee={onHighlightEmployee}
            />
          </div>
        )}

        {section === 'reports' && (
          <ComingSoon
            title="Reports"
            description="The Leave Management tab above already covers filtered search, summary metrics and Excel export. Additional trend/analytics reporting is planned for a future phase."
          />
        )}
      </div>
    </div>
  )
}
