import { useMemo, useState } from 'react'
import { fromISODate, isWithinWindow, toISODate } from '../lib/dateWindow'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MAX_LANES = 3

function buildMonthWeeks(year, month) {
  const firstOfMonth = new Date(year, month, 1)
  const startOffset = (firstOfMonth.getDay() + 6) % 7 // Monday-first grid
  const gridStart = new Date(year, month, 1 - startOffset)

  const days = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart)
    d.setDate(gridStart.getDate() + i)
    days.push(d)
  }

  const weeks = []
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7))
  return weeks
}

// Greedy interval-scheduling lane assignment so a period keeps the same
// visual row across every week it spans (continuous bar, not a chip per day).
function assignLanes(periods) {
  const sorted = [...periods].sort((a, b) => a.startDate.localeCompare(b.startDate))
  const laneEndDates = [] // laneEndDates[i] = latest end date currently occupying lane i
  const laneOf = new Map()

  for (const p of sorted) {
    let lane = laneEndDates.findIndex((endDate) => endDate < p.startDate)
    if (lane === -1) {
      lane = laneEndDates.length
      laneEndDates.push(p.endDate)
    } else {
      laneEndDates[lane] = p.endDate
    }
    laneOf.set(p.id, lane)
  }
  return laneOf
}

export function CalendarView({
  periods,
  activeEmployeeId,
  highlightedEmployeeId,
  onSelectPeriod,
  onApplyLeave,
  hideApplyButton = false,
}) {
  const today = useMemo(() => new Date(), [])
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [selectedDate, setSelectedDate] = useState(null)

  const weeks = useMemo(() => buildMonthWeeks(cursor.getFullYear(), cursor.getMonth()), [cursor])
  const gridStartISO = toISODate(weeks[0][0])
  const gridEndISO = toISODate(weeks[weeks.length - 1][6])

  const visibleInGrid = useMemo(
    () => periods.filter((p) => p.startDate <= gridEndISO && p.endDate >= gridStartISO),
    [periods, gridStartISO, gridEndISO]
  )

  const laneOf = useMemo(() => assignLanes(visibleInGrid), [visibleInGrid])

  const monthLabel = cursor.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            className="rounded-sm border border-border bg-surface px-2.5 py-1.5 text-sm text-ink transition hover:bg-bg"
            aria-label="Previous month"
          >
            ‹
          </button>
          <span className="min-w-[11rem] text-center font-display text-base font-semibold text-ink">
            {monthLabel}
          </span>
          <button
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
            className="rounded-sm border border-border bg-surface px-2.5 py-1.5 text-sm text-ink transition hover:bg-bg"
            aria-label="Next month"
          >
            ›
          </button>
          <button
            onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))}
            className="ml-1 rounded-sm border border-border bg-surface px-3 py-1.5 text-sm text-ink-muted transition hover:bg-bg"
          >
            Today
          </button>
        </div>

        {!hideApplyButton && (
          <button
            onClick={onApplyLeave}
            className="rounded-sm bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-dark"
          >
            + Apply Leave
          </button>
        )}
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-t-lg border border-b-0 border-border bg-border text-center">
        {WEEKDAYS.map((d, i) => (
          <div
            key={d}
            className={`py-2 text-xs font-medium ${
              i >= 5 ? 'bg-bg text-ink-muted' : 'bg-primary-tint text-primary'
            }`}
          >
            {d}
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-b-lg border border-border">
        {weeks.map((week, wi) => (
          <WeekRow
            key={wi}
            week={week}
            cursor={cursor}
            today={today}
            periods={visibleInGrid}
            laneOf={laneOf}
            activeEmployeeId={activeEmployeeId}
            highlightedEmployeeId={highlightedEmployeeId}
            onSelectPeriod={onSelectPeriod}
            isLastRow={wi === weeks.length - 1}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-ink-muted">
        <LegendDot className="bg-primary" label="My leave" />
        <LegendDot className="bg-accent" label="Other employees" />
        <LegendDot className="bg-hod" label="HOD" />
        <LegendDot className="bg-primary" round label="Today" />
        <LegendDot className="border-2 border-ink bg-transparent" round label="Selected" />
        <span className="opacity-60">Dimmed dates = outside the 3-month planning window</span>
      </div>
    </div>
  )
}

function WeekRow({
  week,
  cursor,
  today,
  periods,
  laneOf,
  activeEmployeeId,
  highlightedEmployeeId,
  onSelectPeriod,
  isLastRow,
  selectedDate,
  onSelectDate,
}) {
  const weekStartISO = toISODate(week[0])
  const weekEndISO = toISODate(week[6])

  const weekPeriods = periods.filter((p) => p.startDate <= weekEndISO && p.endDate >= weekStartISO)

  const barsByLane = new Map()
  const overflowCountByDay = Array(7).fill(0)

  for (const p of weekPeriods) {
    const lane = laneOf.get(p.id) ?? 0
    const segStart = p.startDate > weekStartISO ? fromISODate(p.startDate) : week[0]
    const segEnd = p.endDate < weekEndISO ? fromISODate(p.endDate) : week[6]
    const colStart = Math.round((segStart - week[0]) / 86400000)
    const colEnd = Math.round((segEnd - week[0]) / 86400000)

    if (lane >= MAX_LANES) {
      for (let c = colStart; c <= colEnd; c++) overflowCountByDay[c] += 1
      continue
    }

    if (!barsByLane.has(lane)) barsByLane.set(lane, [])
    barsByLane.get(lane).push({
      period: p,
      colStart,
      colEnd,
      isPeriodStart: toISODate(segStart) === p.startDate,
      isPeriodEnd: toISODate(segEnd) === p.endDate,
    })
  }

  const usedLanes = Math.min(
    MAX_LANES,
    Math.max(0, ...[...barsByLane.keys()].map((l) => l + 1))
  )
  const hasOverflow = overflowCountByDay.some((c) => c > 0)

  return (
    <div className={`border-border ${isLastRow ? '' : 'border-b'}`}>
      <div className="grid grid-cols-7 gap-px bg-border">
        {week.map((day, i) => {
          const isCurrentMonth = day.getMonth() === cursor.getMonth()
          const isToday = toISODate(day) === toISODate(today)
          const isSelected = selectedDate === toISODate(day)
          const inWindow = isWithinWindow(day)
          const isWeekend = i >= 5

          return (
            <div
              key={i}
              className={`min-h-[2.25rem] px-1.5 pt-1.5 sm:min-h-[2.5rem] ${!isCurrentMonth ? 'bg-bg/60' : isWeekend ? 'bg-bg/40' : 'bg-surface'} ${
                !inWindow ? 'opacity-50' : ''
              }`}
            >
              <button
                onClick={() => onSelectDate(isSelected ? null : toISODate(day))}
                className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-sm transition ${
                  isToday
                    ? 'bg-primary font-semibold text-white'
                    : isCurrentMonth
                      ? 'text-ink-muted hover:bg-bg'
                      : 'text-ink-faint hover:bg-bg'
                } ${isSelected && !isToday ? 'ring-2 ring-ink' : ''} ${isSelected && isToday ? 'ring-2 ring-ink ring-offset-1' : ''}`}
              >
                {day.getDate()}
              </button>
            </div>
          )
        })}
      </div>

      <div
        className="grid grid-cols-7 gap-px bg-border pb-1.5"
        style={{ gridAutoRows: '22px' }}
      >
        {Array.from({ length: usedLanes }).map((_, lane) => (
          <div key={lane} className="col-span-7 grid grid-cols-7 gap-px bg-surface">
            {(barsByLane.get(lane) ?? []).map((bar, bi) => (
              <LeaveBar
                key={bi}
                bar={bar}
                isMine={bar.period.employeeId === activeEmployeeId}
                isHighlighted={highlightedEmployeeId === bar.period.employeeId}
                dimmed={!!highlightedEmployeeId && highlightedEmployeeId !== bar.period.employeeId}
                onSelectPeriod={onSelectPeriod}
              />
            ))}
          </div>
        ))}
      </div>

      {hasOverflow && (
        <div className="grid grid-cols-7 gap-px bg-surface pb-1">
          {overflowCountByDay.map((count, i) =>
            count > 0 ? (
              <p key={i} className="px-1.5 text-[10px] text-ink-muted">
                +{count} more
              </p>
            ) : (
              <div key={i} />
            )
          )}
        </div>
      )}
    </div>
  )
}

function LeaveBar({ bar, isMine, isHighlighted, dimmed, onSelectPeriod }) {
  const { period, colStart, colEnd, isPeriodStart, isPeriodEnd } = bar
  const isHod = period.employeeRole === 'HOD'

  const colorClass = isMine ? 'bg-primary text-white' : isHod ? 'bg-hod text-white' : 'bg-accent text-white'

  return (
    <button
      onClick={() => onSelectPeriod(period)}
      title={`${period.employeeName} · ${period.startDate} to ${period.endDate}`}
      className={`flex h-5 items-center truncate px-1.5 text-left text-[10.5px] font-medium transition hover:brightness-95 ${colorClass} ${
        isPeriodStart ? 'rounded-l-full' : ''
      } ${isPeriodEnd ? 'rounded-r-full' : ''} ${dimmed ? 'opacity-30' : ''} ${
        isHighlighted ? 'ring-2 ring-ink/40' : ''
      }`}
      style={{ gridColumn: `${colStart + 1} / span ${colEnd - colStart + 1}` }}
    >
      {isPeriodStart ? period.employeeName : ''}
    </button>
  )
}

function LegendDot({ className, round, label }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 ${round ? 'rounded-full' : 'rounded-sm'} ${className}`} />
      {label}
    </span>
  )
}
