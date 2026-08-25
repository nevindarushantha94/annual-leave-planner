import { useMemo, useState } from 'react'
import { useCurrentEmployee } from '../context/CurrentEmployeeContext'
import { ListSkeleton } from './Skeletons'

export function EmployeeSelectionScreen() {
  const { employees, directoryError, sessionNotice, selectEmployee, claiming } =
    useCurrentEmployee()
  const [query, setQuery] = useState('')
  const [pendingId, setPendingId] = useState(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return employees
    return employees.filter(
      (e) => e.name.toLowerCase().includes(q) || e.epfNumber.toLowerCase().includes(q)
    )
  }, [employees, query])

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-surface p-6 sm:p-8">
        <h1 className="font-display text-xl font-bold text-ink">Annual Leave Planner</h1>
        <p className="mt-1 text-sm text-ink-muted">Please select your name to continue.</p>

        {sessionNotice && (
          <p className="mt-4 rounded-sm bg-accent-tint px-3 py-2 text-sm text-accent">
            {sessionNotice}
          </p>
        )}

        {directoryError ? (
          <p className="mt-4 rounded-sm bg-conflict-tint px-3 py-2 text-sm text-conflict">
            Unable to load employee list. Please try again.
          </p>
        ) : employees.length === 0 ? (
          <div className="mt-5">
            <ListSkeleton rows={4} />
          </div>
        ) : (
          <>
            <div className="mt-5">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search employee…"
                className="w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm text-ink outline-none transition focus:border-primary"
              />
            </div>

            <div className="mt-3 max-h-72 overflow-y-auto scrollbar-thin rounded-sm border border-border">
              {filtered.length === 0 ? (
                <p className="px-3 py-4 text-center text-sm text-ink-muted">No employees match.</p>
              ) : (
                filtered.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => setPendingId(e.id)}
                    className={`flex w-full items-center justify-between border-b border-border px-3 py-2.5 text-left transition last:border-b-0 hover:bg-bg ${
                      pendingId === e.id ? 'bg-primary-tint' : 'bg-surface'
                    }`}
                  >
                    <span className="text-sm text-ink">{e.name}</span>
                    <span className="font-mono text-xs text-ink-muted">{e.epfNumber}</span>
                  </button>
                ))
              )}
            </div>

            <button
              onClick={() => pendingId && selectEmployee(pendingId)}
              disabled={!pendingId || claiming}
              className="mt-5 w-full rounded-sm bg-primary px-4 py-2.5 text-sm font-medium text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-40"
            >
              {claiming ? 'Continuing…' : 'Continue →'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
