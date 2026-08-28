import { useEffect, useMemo, useState } from 'react'
import { dayCount, formatLong, getPlanningWindow, toISODate } from '../lib/dateWindow'
import { ConflictError } from './ConflictError'

// Single drawer for both "Apply Leave" (mode='add') and "Edit Leave"
// (mode='edit'). The caller decides which authorized API path to hit via
// `onSubmit` — this component only handles the form, validation display,
// and success/error states. It never talks to Supabase directly.
export function LeaveDrawer({
  open,
  onClose,
  employee,
  existingPeriods,
  onApplied,
  mode = 'add',
  editingPeriod = null,
  onSubmit,
}) {
  const { start: windowStart, end: windowEnd } = getPlanningWindow()
  const minDate = toISODate(windowStart)
  const maxDate = toISODate(windowEnd)

  const usedPeriodNumbers = useMemo(
    () => new Set(existingPeriods.map((p) => p.periodNumber)),
    [existingPeriods]
  )
  const nextPeriodNumber =
    mode === 'edit'
      ? (editingPeriod?.periodNumber ?? null)
      : ([1, 2, 3].find((n) => !usedPeriodNumbers.has(n)) ?? null)
  const periodsUsed = existingPeriods.length

  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  useEffect(() => {
    if (open) {
      setStartDate(mode === 'edit' && editingPeriod ? editingPeriod.startDate : '')
      setEndDate(mode === 'edit' && editingPeriod ? editingPeriod.endDate : '')
      setError(null)
      setSuccess(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, editingPeriod?.id])

  if (!open) return null

  const isEdit = mode === 'edit'
  const duration = startDate && endDate && endDate >= startDate ? dayCount(startDate, endDate) : null
  const canSubmit =
    !submitting &&
    startDate &&
    endDate &&
    endDate >= startDate &&
    (isEdit ? true : !!nextPeriodNumber) &&
    employee

  async function handleSubmit(e) {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)

    const result = await onSubmit({ startDate, endDate, periodNumber: nextPeriodNumber })

    setSubmitting(false)

    if (result?.ok) {
      setSuccess({ startDate, endDate, duration, periodNumber: nextPeriodNumber })
      onApplied?.()
    } else {
      setError(result?.error ?? { title: 'Something went wrong', message: 'Please try again.', conflicts: [] })
    }
  }

  const heading = isEdit ? 'Edit Leave' : 'Apply for Leave'
  const employeeLineLabel = isEdit ? 'Editing leave for' : 'Applying as'

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-ink/30 backdrop-blur-[1px] transition-opacity"
      />
      <div className="relative flex h-full w-full max-w-md flex-col bg-surface shadow-panel transition-transform sm:w-[420px]">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-display text-base font-semibold text-ink">{heading}</h2>
          <button
            onClick={onClose}
            className="rounded-sm p-1 text-ink-muted transition hover:bg-bg hover:text-ink"
            aria-label="Close drawer"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin px-5 py-5">
          {success ? (
            <div className="rounded-lg border border-success/30 bg-success-tint p-4">
              <p className="text-sm font-semibold text-success">
                ✓ Leave Successfully {isEdit ? 'Updated' : 'Added'}
              </p>
              <p className="mt-2 text-sm text-ink">
                {formatLong(success.startDate)} → {formatLong(success.endDate)}
              </p>
              <p className="text-sm text-ink-muted">
                {success.duration} {success.duration === 1 ? 'Day' : 'Days'}
                {success.periodNumber ? ` · Period ${success.periodNumber}` : ''}
              </p>
              <button
                onClick={onClose}
                className="mt-4 rounded-sm bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-dark"
              >
                Done
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="rounded-lg bg-primary-tint px-3 py-2 text-xs text-primary">
                Planning window: {formatLong(windowStart)} → {formatLong(windowEnd)}
              </div>

              {employee && (
                <p className="text-sm text-ink-muted">
                  {employeeLineLabel} <span className="font-medium text-ink">{employee.name}</span>
                </p>
              )}

              <div>
                <label className="mb-1 block text-sm font-medium text-ink">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  min={minDate}
                  max={maxDate}
                  onChange={(e) => {
                    setStartDate(e.target.value)
                    if (endDate && endDate < e.target.value) setEndDate('')
                  }}
                  required
                  className="w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm text-ink outline-none transition focus:border-primary"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-ink">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  min={startDate || minDate}
                  max={maxDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                  disabled={!startDate}
                  className="w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm text-ink outline-none transition focus:border-primary disabled:opacity-50"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-ink">Period Number</label>
                  <div className="rounded-sm border border-border bg-bg px-3 py-2 font-mono text-sm text-ink-muted">
                    {nextPeriodNumber ? `Period ${nextPeriodNumber}` : 'None available'}
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-ink">Duration</label>
                  <div className="rounded-sm border border-border bg-bg px-3 py-2 font-mono text-sm text-ink-muted">
                    {duration ? `${duration} ${duration === 1 ? 'Day' : 'Days'}` : '—'}
                  </div>
                </div>
              </div>

              {!isEdit && (
                <p className="text-xs text-ink-muted">Leave periods used: {periodsUsed} / 3</p>
              )}

              {!isEdit && !nextPeriodNumber && (
                <p className="rounded-sm bg-accent-tint px-3 py-2 text-sm text-accent">
                  This employee already has the maximum of 3 leave periods.
                </p>
              )}

              <ConflictError error={error} onChangeDates={() => setError(null)} />

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 rounded-sm border border-border bg-surface px-4 py-2 text-sm font-medium text-ink transition hover:bg-bg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="flex-1 rounded-sm bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {submitting ? 'Submitting…' : isEdit ? 'Save Changes' : 'Apply Leave'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
