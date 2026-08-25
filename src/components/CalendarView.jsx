import { useMemo, useState } from 'react'
import { fromISODate, isWithinWindow, toISODate } from '../lib/dateWindow'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function buildMonthGrid(year, month) {
  const firstOfMonth = new Date(year, month, 1)
  const startOffset = (firstOfMonth.getDay() + 6) % 7 // Monday-first grid
  const gridStart = new Date(year, month, 1 - startOffset)

  const days = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart)
    d.setDate(gridStart.getDate() + i)
    days.push(d)
  }
  return days
}

export function CalendarView({ periods, activeEmployeeId, filter, onSelectPeriod, onApplyLeave }) {
  const today = useMemo(() => new Date(), [])
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))

  const days = useMemo(() => buildMonthGrid(cursor.getFullYear(), cursor.getMonth()), [cursor])

  const periodsByDate = useMemo(() => {
    const map = new Map()
    for (const p of periods) {
      if (filter === 'mine' && p.employeeId !== activeEmployeeId) continue
      let cursorDate = fromISODate(p.startDate)
      const end = fromISODate(p.endDate)
      while (cursorDate <= end) {
        const key = toISODate(cursorDate)
        if (!map.has(key)) map.set(key, [])
        map.get(key).push(p)
        cursorDate = new Date(cursorDate.getFullYear(), cursorDate.getMonth(), cursorDate.getDate() + 1)
      }
    }
    return map
  }, [periods, filter, activeEmployeeId])

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
          <span className="min-w-[10rem] text-center font-display text-sm font-semibold text-ink">
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

        <button
          onClick={onApplyLeave}
          className="rounded-sm bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-dark"
        >
          + Apply Leave
        </button>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-px overflow-hidden rounded-t-lg border border-b-0 border-border bg-border text-center">
        {WEEKDAYS.map((d) => (
          <div key={d} className="bg-primary-tint py-2 text-xs font-medium text-primary">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-b-lg border border-border bg-border">
        {days.map((day) => {
          const key = toISODate(day)
          const isCurrentMonth = day.getMonth() === cursor.getMonth()
          const isToday = key === toISODate(today)
          const inWindow = isWithinWindow(day)
          const dayPeriods = periodsByDate.get(key) ?? []

          return (
            <div
              key={key}
              className={`min-h-[6rem] bg-surface p-1.5 sm:min-h-[7rem] ${
                !isCurrentMonth ? 'bg-bg/60' : ''
              } ${!inWindow ? 'opacity-50' : ''}`}
            >
              <div className="mb-1 flex items-center justify-between">
                <span
                  className={`text-xs ${
                    isToday
                      ? 'flex h-5 w-5 items-center justify-center rounded-full bg-primary font-medium text-white'
                      : isCurrentMonth
                        ? 'text-ink-muted'
                        : 'text-ink-faint'
                  }`}
                >
                  {day.getDate()}
                </span>
              </div>

              <div className="space-y-1">
                {dayPeriods.slice(0, 3).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => onSelectPeriod(p)}
                    className={`block w-full truncate rounded-sm px-1.5 py-0.5 text-left text-[11px] font-medium transition hover:brightness-95 ${
                      p.employeeId === activeEmployeeId
                        ? 'bg-primary/90 text-white'
                        : 'bg-accent-tint text-accent'
                    }`}
                    title={`${p.employeeName} · ${p.startDate} to ${p.endDate}`}
                  >
                    {p.employeeId === activeEmployeeId ? 'My leave' : p.employeeName}
                  </button>
                ))}
                {dayPeriods.length > 3 && (
                  <p className="px-1.5 text-[11px] text-ink-muted">+{dayPeriods.length - 3} more</p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-ink-muted">
        <LegendDot className="bg-primary/90" label="My leave" />
        <LegendDot className="bg-accent-tint border border-accent/40" label="Other employees" />
        <LegendDot className="bg-primary" round label="Today" />
        <span className="opacity-50">Dimmed = outside 3-month planning window</span>
      </div>
    </div>
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
