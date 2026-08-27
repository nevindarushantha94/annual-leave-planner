import { useMemo, useState } from 'react'
import { SeatDetailsPanel } from './SeatDetailsPanel'

function currentOrNextLeave(employeeId, periods) {
  const todayISO = new Date().toISOString().slice(0, 10)
  const forEmployee = periods
    .filter((p) => p.employeeId === employeeId)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))

  const ongoing = forEmployee.find((p) => p.startDate <= todayISO && p.endDate >= todayISO)
  if (ongoing) return { period: ongoing, status: 'ongoing' }

  const upcoming = forEmployee.find((p) => p.startDate > todayISO)
  if (upcoming) return { period: upcoming, status: 'upcoming' }

  return { period: null, status: 'available' }
}

// Normalizes grid_row/grid_col into a compact 1-based grid per group, so
// gaps in the underlying seat data don't leave large empty tracks.
function layoutGroup(members) {
  const withPos = members.filter((m) => m.gridRow != null && m.gridCol != null)
  const withoutPos = members.filter((m) => m.gridRow == null || m.gridCol == null)

  if (withPos.length === 0) {
    // No positional data at all — fall back to a simple flowing row.
    return { cells: members.map((m, i) => ({ employee: m, row: 1, col: i + 1 })), rows: 1, cols: members.length || 1 }
  }

  const rows = [...new Set(withPos.map((m) => m.gridRow))].sort((a, b) => a - b)
  const cols = [...new Set(withPos.map((m) => m.gridCol))].sort((a, b) => a - b)
  const rowIndex = new Map(rows.map((r, i) => [r, i + 1]))
  const colIndex = new Map(cols.map((c, i) => [c, i + 1]))

  const cells = withPos.map((m) => ({
    employee: m,
    row: rowIndex.get(m.gridRow),
    col: colIndex.get(m.gridCol),
  }))

  // Any members missing a grid position get appended as an extra row.
  withoutPos.forEach((m, i) => {
    cells.push({ employee: m, row: rows.length + 1, col: i + 1 })
  })

  return {
    cells,
    rows: rows.length + (withoutPos.length > 0 ? 1 : 0),
    cols: Math.max(cols.length, withoutPos.length, 1),
  }
}

function SeatDesk({ employee, leaveInfo, isMe, isHighlighted, onClick }) {
  const { status } = leaveInfo
  const dotClass =
    status === 'ongoing' ? 'bg-conflict' : status === 'upcoming' ? 'bg-accent' : 'bg-success'

  return (
    <button
      onClick={() => onClick(employee)}
      title={employee.name}
      className={`flex h-16 w-24 flex-col justify-between rounded-md border-2 px-2 py-1.5 text-left transition sm:h-[4.5rem] sm:w-28 ${
        isMe
          ? 'border-primary bg-primary-tint'
          : isHighlighted
            ? 'border-accent bg-accent-tint'
            : status === 'ongoing'
              ? 'border-conflict/30 bg-conflict-tint hover:border-conflict/60'
              : 'border-border bg-surface hover:border-primary/40 hover:bg-bg'
      }`}
    >
      <span className="flex items-center justify-between">
        <span className="truncate text-[11px] font-semibold text-ink">
          {employee.name.split(' ')[0]}
        </span>
        <span className={`h-2 w-2 flex-shrink-0 rounded-full ${dotClass}`} />
      </span>
      <span className="truncate font-mono text-[10px] text-ink-muted">{employee.epfNumber}</span>
    </button>
  )
}

function SeatingIsland({ groupLabel, members, periods, activeEmployeeId, highlightedEmployeeId, onSelectSeat }) {
  const { cells, rows, cols } = useMemo(() => layoutGroup(members), [members])

  return (
    <div className="flex-shrink-0 rounded-xl border border-border bg-bg/60 p-3">
      <p className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
        {groupLabel}
      </p>
      <div
        className="grid gap-2"
        style={{
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${rows}, auto)`,
        }}
      >
        {cells.map(({ employee, row, col }) => (
          <div key={employee.id} style={{ gridRow: row, gridColumn: col }}>
            <SeatDesk
              employee={employee}
              leaveInfo={currentOrNextLeave(employee.id, periods)}
              isMe={employee.id === activeEmployeeId}
              isHighlighted={employee.id === highlightedEmployeeId}
              onClick={onSelectSeat}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

export function SeatingFloorChart({ employees, periods, activeEmployeeId, highlightedEmployeeId, onHighlightEmployee }) {
  const [panelEmployee, setPanelEmployee] = useState(null)

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
    return {
      sortedGroups: [...byGroup.entries()].sort((a, b) => a[0].localeCompare(b[0])),
      standalone,
    }
  }, [employees])

  function handleSelectSeat(employee) {
    setPanelEmployee(employee)
    onHighlightEmployee?.(employee.id)
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">Seating Arrangement</h2>
          <p className="text-sm text-ink-muted">
            Tap a seat to see who sits there and whether they&apos;re on leave.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-xs text-ink-muted">
          <LegendDot className="bg-success" label="Available" />
          <LegendDot className="bg-accent" label="Upcoming leave" />
          <LegendDot className="bg-conflict" label="On leave now" />
        </div>
      </div>

      <div className="space-y-5 overflow-x-auto pb-2">
        <div className="flex flex-wrap items-start gap-4">
          {groups.sortedGroups.map(([groupLabel, members]) => (
            <SeatingIsland
              key={groupLabel}
              groupLabel={groupLabel}
              members={members}
              periods={periods}
              activeEmployeeId={activeEmployeeId}
              highlightedEmployeeId={highlightedEmployeeId}
              onSelectSeat={handleSelectSeat}
            />
          ))}
        </div>

        {groups.standalone.length > 0 && (
          <SeatingIsland
            groupLabel="Other"
            members={groups.standalone}
            periods={periods}
            activeEmployeeId={activeEmployeeId}
            highlightedEmployeeId={highlightedEmployeeId}
            onSelectSeat={handleSelectSeat}
          />
        )}

        {employees.length === 0 && (
          <p className="rounded-lg border border-dashed border-border bg-surface px-6 py-10 text-center text-sm text-ink-muted">
            No seating data available yet.
          </p>
        )}
      </div>

      <SeatDetailsPanel
        employee={panelEmployee}
        leaveInfo={panelEmployee ? currentOrNextLeave(panelEmployee.id, periods) : null}
        isMe={panelEmployee?.id === activeEmployeeId}
        onClose={() => setPanelEmployee(null)}
      />
    </div>
  )
}

function LegendDot({ className, label }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded-full ${className}`} />
      {label}
    </span>
  )
}
