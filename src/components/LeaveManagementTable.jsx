import { useMemo, useState } from 'react'
import { formatLong, leaveTemporalStatus, toISODate } from '../lib/dateWindow'
import { exportLeaveReportToExcel } from '../lib/exportLeaveReport'

const STATUS_OPTIONS = [
  { key: 'all', label: 'All Statuses' },
  { key: 'ongoing', label: 'On Leave Now' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'past', label: 'Completed' },
]

const STATUS_BADGE = {
  ongoing: 'bg-conflict-tint text-conflict',
  upcoming: 'bg-accent-tint text-accent',
  past: 'bg-ink-faint/10 text-ink-muted',
}

const STATUS_LABEL = {
  ongoing: 'On Leave Now',
  upcoming: 'Upcoming',
  past: 'Completed',
}

const emptyFilters = {
  query: '',
  employeeId: 'ALL',
  status: 'all',
  seatGroup: 'ALL',
  team: 'ALL',
  dateFrom: '',
  dateTo: '',
}

export function LeaveManagementTable({
  employees,
  periods,
  onViewPeriod,
  onViewOnCalendar,
  onEditPeriod,
  onDeletePeriod,
  onAddForEmployee,
}) {
  const [filters, setFilters] = useState(emptyFilters)
  const [exporting, setExporting] = useState(false)

  const seatGroups = useMemo(
    () => [...new Set(employees.map((e) => e.seatGroupLabel).filter(Boolean))].sort(),
    [employees]
  )
  const teams = useMemo(
    () => [...new Set(employees.map((e) => e.teamName).filter(Boolean))].sort(),
    [employees]
  )

  const rows = useMemo(() => {
    const todayISO = toISODate(new Date())
    return periods.map((p) => ({ ...p, status: leaveTemporalStatus(p.startDate, p.endDate, todayISO) }))
  }, [periods])

  const filteredRows = useMemo(() => {
    const q = filters.query.trim().toLowerCase()
    return rows.filter((r) => {
      if (q) {
        const matches =
          r.employeeName.toLowerCase().includes(q) ||
          (r.employeeEpf ?? '').toLowerCase().includes(q)
        if (!matches) return false
      }
      if (filters.employeeId !== 'ALL' && r.employeeId !== filters.employeeId) return false
      if (filters.status !== 'all' && r.status !== filters.status) return false
      if (filters.seatGroup !== 'ALL' && r.seatGroupLabel !== filters.seatGroup) return false
      if (filters.team !== 'ALL' && r.teamName !== filters.team) return false
      if (filters.dateFrom && r.endDate < filters.dateFrom) return false
      if (filters.dateTo && r.startDate > filters.dateTo) return false
      return true
    })
  }, [rows, filters])

  const summary = useMemo(() => {
    const todayISO = toISODate(new Date())
    const onLeaveNow = new Set(
      rows.filter((r) => r.status === 'ongoing').map((r) => r.employeeId)
    ).size
    const upcoming = rows.filter((r) => r.status === 'upcoming').length
    return {
      total: rows.length,
      onLeaveNow,
      upcoming,
      filtered: filteredRows.length,
      todayISO,
    }
  }, [rows, filteredRows])

  function updateFilter(key, value) {
    setFilters((f) => ({ ...f, [key]: value }))
  }

  async function handleExport() {
    setExporting(true)
    try {
      await exportLeaveReportToExcel(filteredRows)
    } finally {
      setExporting(false)
    }
  }

  const hasActiveFilters = JSON.stringify(filters) !== JSON.stringify(emptyFilters)

  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryStat label="Total Records" value={summary.total} />
        <SummaryStat label="On Leave Now" value={summary.onLeaveNow} accent="conflict" />
        <SummaryStat label="Upcoming" value={summary.upcoming} accent="accent" />
        <SummaryStat label="Filtered Results" value={summary.filtered} accent="primary" />
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface p-3">
        <div className="min-w-[180px] flex-1">
          <label className="mb-1 block text-xs font-medium text-ink-muted">Search</label>
          <input
            type="text"
            value={filters.query}
            onChange={(e) => updateFilter('query', e.target.value)}
            placeholder="Employee name or EPF…"
            className="w-full rounded-sm border border-border bg-surface px-2.5 py-1.5 text-sm text-ink outline-none transition focus:border-primary"
          />
        </div>

        <FilterSelect
          label="Employee"
          value={filters.employeeId}
          onChange={(v) => updateFilter('employeeId', v)}
          options={[{ value: 'ALL', label: 'All Employees' }, ...employees.map((e) => ({ value: e.id, label: e.name }))]}
        />

        <FilterSelect
          label="Status"
          value={filters.status}
          onChange={(v) => updateFilter('status', v)}
          options={STATUS_OPTIONS.map((s) => ({ value: s.key, label: s.label }))}
        />

        {seatGroups.length > 0 && (
          <FilterSelect
            label="Seating Group"
            value={filters.seatGroup}
            onChange={(v) => updateFilter('seatGroup', v)}
            options={[{ value: 'ALL', label: 'All Groups' }, ...seatGroups.map((g) => ({ value: g, label: g }))]}
          />
        )}

        {teams.length > 0 && (
          <FilterSelect
            label="Team"
            value={filters.team}
            onChange={(v) => updateFilter('team', v)}
            options={[{ value: 'ALL', label: 'All Teams' }, ...teams.map((t) => ({ value: t, label: t }))]}
          />
        )}

        <div>
          <label className="mb-1 block text-xs font-medium text-ink-muted">From</label>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => updateFilter('dateFrom', e.target.value)}
            className="rounded-sm border border-border bg-surface px-2.5 py-1.5 text-sm text-ink outline-none transition focus:border-primary"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-muted">To</label>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => updateFilter('dateTo', e.target.value)}
            className="rounded-sm border border-border bg-surface px-2.5 py-1.5 text-sm text-ink outline-none transition focus:border-primary"
          />
        </div>

        {hasActiveFilters && (
          <button
            onClick={() => setFilters(emptyFilters)}
            className="rounded-sm border border-border px-3 py-1.5 text-sm font-medium text-ink-muted transition hover:bg-bg hover:text-ink"
          >
            Clear Filters
          </button>
        )}

        <button
          onClick={() => {
            const target = employees.find((e) => e.id === filters.employeeId)
            if (target) onAddForEmployee(target)
          }}
          disabled={filters.employeeId === 'ALL'}
          title={
            filters.employeeId === 'ALL'
              ? 'Select a specific employee above to add leave on their behalf'
              : undefined
          }
          className="rounded-sm border border-primary/30 bg-primary-tint px-3 py-1.5 text-sm font-medium text-primary transition hover:bg-primary-tint/70 disabled:cursor-not-allowed disabled:opacity-40"
        >
          + Add Leave
        </button>

        <button
          onClick={handleExport}
          disabled={filteredRows.length === 0 || exporting}
          className="ml-auto rounded-sm bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-40"
        >
          {exporting ? 'Preparing…' : 'Download Excel'}
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-bg text-xs uppercase tracking-wide text-ink-faint">
              <th className="px-3 py-2.5 font-medium">Employee</th>
              <th className="px-3 py-2.5 font-medium">EPF</th>
              <th className="px-3 py-2.5 font-medium">Leave Period</th>
              <th className="px-3 py-2.5 font-medium">Days</th>
              <th className="px-3 py-2.5 font-medium">Status</th>
              <th className="px-3 py-2.5 font-medium">Team / Group</th>
              <th className="px-3 py-2.5 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center text-sm text-ink-muted">
                  No leave records match the current filters.
                </td>
              </tr>
            ) : (
              filteredRows.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-b-0 hover:bg-bg/60">
                  <td className="px-3 py-2.5">
                    <p className="font-medium text-ink">{r.employeeName}</p>
                    {r.employeeRole === 'HOD' && (
                      <span className="font-mono text-[11px] text-hod">HOD</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs text-ink-muted">
                    {r.employeeEpf ?? '—'}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs text-ink">
                    {formatLong(r.startDate)} → {formatLong(r.endDate)}
                  </td>
                  <td className="px-3 py-2.5 text-ink">{r.daysCount}</td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`inline-flex rounded-sm px-1.5 py-0.5 text-[11px] font-medium ${STATUS_BADGE[r.status]}`}
                    >
                      {STATUS_LABEL[r.status]}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-ink-muted">
                    {[r.teamName, r.seatGroupLabel].filter(Boolean).join(' · ') || '—'}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        onClick={() => onViewPeriod(r)}
                        className="rounded-sm border border-border px-2 py-1 text-xs font-medium text-ink transition hover:bg-bg"
                      >
                        View
                      </button>
                      <button
                        onClick={() => onViewOnCalendar(r)}
                        className="rounded-sm border border-border px-2 py-1 text-xs font-medium text-ink transition hover:bg-bg"
                      >
                        View on Calendar
                      </button>
                      <button
                        onClick={() => onEditPeriod(r)}
                        className="rounded-sm border border-border px-2 py-1 text-xs font-medium text-ink transition hover:bg-bg"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => onDeletePeriod(r)}
                        className="rounded-sm border border-conflict/30 px-2 py-1 text-xs font-medium text-conflict transition hover:bg-conflict-tint"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SummaryStat({ label, value, accent }) {
  const accentClass =
    accent === 'conflict'
      ? 'text-conflict'
      : accent === 'accent'
        ? 'text-accent'
        : accent === 'primary'
          ? 'text-primary'
          : 'text-ink'
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <p className="text-xs uppercase tracking-wide text-ink-faint">{label}</p>
      <p className={`mt-1 font-display text-xl font-semibold ${accentClass}`}>{value}</p>
    </div>
  )
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-ink-muted">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-sm border border-border bg-surface px-2.5 py-1.5 text-sm text-ink outline-none transition focus:border-primary"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}
