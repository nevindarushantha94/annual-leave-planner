import { useEffect, useMemo, useState } from 'react'
import { formatShort } from '../lib/dateWindow'

const SIDEBAR_KEY = 'alp_sidebar_open'

function useSidebarOpen() {
  const [open, setOpen] = useState(() => sessionStorage.getItem(SIDEBAR_KEY) !== 'closed')
  useEffect(() => {
    sessionStorage.setItem(SIDEBAR_KEY, open ? 'open' : 'closed')
  }, [open])
  return [open, setOpen]
}

function currentLeaveFor(employeeId, periods) {
  const todayISO = new Date().toISOString().slice(0, 10)
  return (
    periods.find(
      (p) => p.employeeId === employeeId && p.startDate <= todayISO && p.endDate >= todayISO
    ) ?? null
  )
}

function EmployeeCard({ employee, periods, highlighted, onClick }) {
  const onLeave = currentLeaveFor(employee.id, periods)

  return (
    <button
      onClick={() => onClick(employee)}
      className={`w-full rounded-sm border px-2.5 py-2 text-left transition ${
        highlighted
          ? 'border-primary bg-primary-tint'
          : 'border-border bg-surface hover:bg-bg'
      }`}
    >
      <p className="truncate text-xs font-medium text-ink">{employee.name}</p>
      <p className="font-mono text-[11px] text-ink-muted">{employee.epfNumber}</p>
      <p
        className={`mt-1 flex items-center gap-1 text-[11px] ${
          onLeave ? 'text-conflict' : 'text-success'
        }`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${onLeave ? 'bg-conflict' : 'bg-success'}`} />
        {onLeave ? (
          <span>
            On Leave · {formatShort(onLeave.startDate)}–{formatShort(onLeave.endDate)}
          </span>
        ) : (
          'Available'
        )}
      </p>
    </button>
  )
}

export function SeatingSidebar({ employees, periods, highlightedEmployeeId, onSelectEmployee }) {
  const [open, setOpen] = useSidebarOpen()

  const groups = useMemo(() => {
    const byGroup = new Map()
    const standalone = []
    for (const e of employees) {
      if (e.seatGroupLabel) {
        if (!byGroup.has(e.seatGroupLabel)) byGroup.set(e.seatGroupLabel, [])
        byGroup.get(e.seatGroupLabel).push(e)
      } else {
        standalone.push(e)
      }
    }
    const sortedGroups = [...byGroup.entries()].sort((a, b) => a[0].localeCompare(b[0]))
    return { sortedGroups, standalone }
  }, [employees])

  if (!open) {
    return (
      <div className="flex w-11 flex-shrink-0 flex-col items-center border-r border-border bg-surface py-3">
        <button
          onClick={() => setOpen(true)}
          className="rounded-sm p-1.5 text-ink-muted transition hover:bg-bg hover:text-ink"
          aria-label="Expand seating arrangement"
          title="Seating Arrangement"
        >
          <ChairIcon />
        </button>
      </div>
    )
  }

  return (
    <div className="flex w-64 flex-shrink-0 flex-col border-r border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-3 py-3">
        <h2 className="font-display text-sm font-semibold text-ink">Seating Arrangement</h2>
        <button
          onClick={() => setOpen(false)}
          className="rounded-sm p-1 text-ink-muted transition hover:bg-bg hover:text-ink"
          aria-label="Collapse seating arrangement"
        >
          ‹
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto scrollbar-thin px-3 py-3">
        {groups.sortedGroups.map(([groupLabel, members]) => (
          <div key={groupLabel}>
            <p className="mb-1.5 font-mono text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
              {groupLabel}
            </p>
            <div className="space-y-1.5">
              {members.map((e) => (
                <EmployeeCard
                  key={e.id}
                  employee={e}
                  periods={periods}
                  highlighted={highlightedEmployeeId === e.id}
                  onClick={onSelectEmployee}
                />
              ))}
            </div>
          </div>
        ))}

        {groups.standalone.length > 0 && (
          <div>
            <p className="mb-1.5 font-mono text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
              Standalone
            </p>
            <div className="space-y-1.5">
              {groups.standalone.map((e) => (
                <EmployeeCard
                  key={e.id}
                  employee={e}
                  periods={periods}
                  highlighted={highlightedEmployeeId === e.id}
                  onClick={onSelectEmployee}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ChairIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M6 4h12M7 4v9h10V4M7 13l-1.5 7M17 13l1.5 7M9 13v4h6v-4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
