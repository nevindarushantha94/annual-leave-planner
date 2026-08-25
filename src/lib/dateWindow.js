// Mirrors the trigger's own window calculation (leave_periods_before_write):
//   v_window_start := current_date
//   v_window_end   := (current_date + interval '3 months')::date
// This is a UI convenience only — the database remains authoritative and
// recomputes this independently on every write. Never hardcode these dates.

export function getPlanningWindow() {
  const start = startOfDay(new Date())
  const end = startOfDay(new Date())
  end.setMonth(end.getMonth() + 3)
  return { start, end }
}

export function startOfDay(d) {
  const copy = new Date(d)
  copy.setHours(0, 0, 0, 0)
  return copy
}

export function toISODate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function fromISODate(s) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function formatShort(dateLike) {
  const d = typeof dateLike === 'string' ? fromISODate(dateLike) : dateLike
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

export function formatLong(dateLike) {
  const d = typeof dateLike === 'string' ? fromISODate(dateLike) : dateLike
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function isWithinWindow(date) {
  const { start, end } = getPlanningWindow()
  const d = startOfDay(date)
  return d >= start && d <= end
}

export function dayCount(startISO, endISO) {
  const start = fromISODate(startISO)
  const end = fromISODate(endISO)
  return Math.round((end - start) / 86400000) + 1
}
