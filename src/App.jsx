import { useMemo, useState } from 'react'
import { CurrentEmployeeProvider, useCurrentEmployee } from './context/CurrentEmployeeContext'
import { useLeavePeriods } from './hooks/useLeavePeriods'
import { CalendarView } from './components/CalendarView'
import { MyLeave } from './components/MyLeave'
import { LeaveDrawer } from './components/LeaveDrawer'
import { LeaveDetailsPanel } from './components/LeaveDetailsPanel'
import { EmployeeSelectionScreen } from './components/EmployeeSelectionScreen'
import { PreviewModeBanner } from './components/PreviewModeBanner'
import { CalendarSkeleton } from './components/Skeletons'
import { EmptyState } from './components/EmptyState'
import { ContextBadges } from './components/Badges'

function Shell() {
  const { currentEmployee, employees, changeEmployee } = useCurrentEmployee()
  const { periods, loading: periodsLoading, error: periodsError, refresh } = useLeavePeriods()

  // Land directly on My Leave Planner after selecting an employee, per spec.
  const [tab, setTab] = useState('myLeave') // 'calendar' | 'myLeave'
  const [filter, setFilter] = useState('all') // 'all' | 'mine' | 'team'
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedPeriod, setSelectedPeriod] = useState(null)

  const teamPeerIds = useMemo(() => {
    if (!currentEmployee) return new Set()
    const bySeat = currentEmployee.seatGroupLabel
      ? employees.filter((e) => e.seatGroupLabel === currentEmployee.seatGroupLabel)
      : []
    const byTeam = currentEmployee.teamName
      ? employees.filter((e) => e.teamName === currentEmployee.teamName)
      : []
    const merged = bySeat.length ? bySeat : byTeam
    return new Set((merged.length ? merged : [currentEmployee]).map((e) => e.id))
  }, [currentEmployee, employees])

  const visiblePeriods = useMemo(() => {
    if (filter === 'mine') return periods.filter((p) => p.employeeId === currentEmployee?.id)
    if (filter === 'team') return periods.filter((p) => teamPeerIds.has(p.employeeId))
    return periods
  }, [periods, filter, currentEmployee, teamPeerIds])

  const myExistingPeriods = periods.filter((p) => p.employeeId === currentEmployee?.id)

  const selectedEmployeeRole = useMemo(() => {
    if (!selectedPeriod) return null
    return employees.find((e) => e.id === selectedPeriod.employeeId)?.role ?? null
  }, [selectedPeriod, employees])

  return (
    <div className="min-h-screen bg-bg">
      <PreviewModeBanner />

      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div>
            <h1 className="font-display text-lg font-bold text-ink sm:text-xl">
              Annual Leave Planner
            </h1>
            <p className="text-xs text-ink-muted">Medical &amp; Non-Motor Claims Department</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium text-ink">{currentEmployee?.name}</p>
              <div className="mt-0.5 flex items-center justify-end gap-2">
                <span className="font-mono text-xs text-ink-muted">
                  {currentEmployee?.epfNumber}
                </span>
                <ContextBadges
                  role={currentEmployee?.role}
                  seatGroupLabel={currentEmployee?.seatGroupLabel}
                  slotLabel={currentEmployee?.slotLabel}
                  teamName={currentEmployee?.teamName}
                />
              </div>
            </div>
            <button
              onClick={changeEmployee}
              className="rounded-sm border border-border px-3 py-1.5 text-sm font-medium text-ink-muted transition hover:bg-bg hover:text-ink"
            >
              Change Employee
            </button>
          </div>
        </div>

        <nav className="mx-auto flex max-w-6xl gap-1 px-4 sm:px-6">
          <TabButton active={tab === 'myLeave'} onClick={() => setTab('myLeave')}>
            My Leave
          </TabButton>
          <TabButton active={tab === 'calendar'} onClick={() => setTab('calendar')}>
            Calendar
          </TabButton>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        {periodsError && (
          <div className="mb-4 rounded-lg border border-conflict/30 bg-conflict-tint p-4 text-sm text-conflict">
            Something went wrong loading leave data: {periodsError.message}. Try refreshing the
            page.
          </div>
        )}

        {tab === 'calendar' && (
          <>
            <FilterBar filter={filter} setFilter={setFilter} />
            {periodsLoading ? (
              <CalendarSkeleton />
            ) : (
              <CalendarView
                periods={visiblePeriods}
                activeEmployeeId={currentEmployee?.id}
                filter={filter === 'mine' ? 'mine' : 'all'}
                onSelectPeriod={setSelectedPeriod}
                onApplyLeave={() => setDrawerOpen(true)}
              />
            )}
          </>
        )}

        {tab === 'myLeave' && (
          <MyLeave
            employee={currentEmployee}
            periods={periods}
            onSelectPeriod={setSelectedPeriod}
            onApplyLeave={() => setDrawerOpen(true)}
          />
        )}
      </main>

      <LeaveDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        employee={currentEmployee}
        existingPeriods={myExistingPeriods}
        onApplied={refresh}
      />

      <LeaveDetailsPanel
        period={selectedPeriod}
        employeeRole={selectedEmployeeRole}
        onClose={() => setSelectedPeriod(null)}
      />
    </div>
  )
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`border-b-2 px-3 py-2.5 text-sm font-medium transition ${
        active
          ? 'border-primary text-primary'
          : 'border-transparent text-ink-muted hover:text-ink'
      }`}
    >
      {children}
    </button>
  )
}

function FilterBar({ filter, setFilter }) {
  const options = [
    { key: 'mine', label: 'My Leave' },
    { key: 'team', label: 'My Team' },
    { key: 'all', label: 'All Employees' },
  ]
  return (
    <div className="mb-4 flex gap-2">
      {options.map((o) => (
        <button
          key={o.key}
          onClick={() => setFilter(o.key)}
          className={`rounded-sm border px-3 py-1.5 text-sm font-medium transition ${
            filter === o.key
              ? 'border-primary bg-primary-tint text-primary'
              : 'border-border bg-surface text-ink-muted hover:bg-bg'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function Gate() {
  const { status } = useCurrentEmployee()

  if (status === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg px-4">
        <p className="rounded-sm bg-conflict-tint px-4 py-3 text-sm text-conflict">
          Unable to load employee list. Please try again.
        </p>
      </div>
    )
  }

  if (status === 'loading' || status === 'needs_selection') {
    return <EmployeeSelectionScreen />
  }

  return <Shell />
}

export default function App() {
  return (
    <CurrentEmployeeProvider>
      <Gate />
    </CurrentEmployeeProvider>
  )
}
