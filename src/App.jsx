import { useMemo, useState } from 'react'
import { CurrentEmployeeProvider, useCurrentEmployee } from './context/CurrentEmployeeContext'
import { useLeavePeriods } from './hooks/useLeavePeriods'
import { CalendarView } from './components/CalendarView'
import { MyLeave } from './components/MyLeave'
import { LeaveDrawer } from './components/LeaveDrawer'
import { LeaveDetailsPanel } from './components/LeaveDetailsPanel'
import { EmployeeSelectionScreen } from './components/EmployeeSelectionScreen'
import { SeatingSidebar } from './components/SeatingSidebar'
import { PreviewModeBanner } from './components/PreviewModeBanner'
import { CalendarSkeleton } from './components/Skeletons'
import { ContextBadges } from './components/Badges'

const SEAT_GROUPS = ['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9']

function Shell() {
  const { currentEmployee, employees, changeEmployee } = useCurrentEmployee()
  const { periods, loading: periodsLoading, error: periodsError, refresh } = useLeavePeriods()

  // Calendar is the primary landing screen, per the redesign brief.
  const [tab, setTab] = useState('calendar') // 'calendar' | 'myLeave'
  const [scope, setScope] = useState('all') // 'all' | 'mine' | 'team'
  const [seatGroup, setSeatGroup] = useState('ALL')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedPeriod, setSelectedPeriod] = useState(null)
  const [highlightedEmployeeId, setHighlightedEmployeeId] = useState(null)

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
    let result = periods
    if (scope === 'mine') result = result.filter((p) => p.employeeId === currentEmployee?.id)
    else if (scope === 'team') result = result.filter((p) => teamPeerIds.has(p.employeeId))
    if (seatGroup !== 'ALL') result = result.filter((p) => p.seatGroupLabel === seatGroup)
    return result
  }, [periods, scope, seatGroup, currentEmployee, teamPeerIds])

  const myExistingPeriods = periods.filter((p) => p.employeeId === currentEmployee?.id)

  const selectedEmployeeRole = useMemo(() => {
    if (!selectedPeriod) return null
    return employees.find((e) => e.id === selectedPeriod.employeeId)?.role ?? null
  }, [selectedPeriod, employees])

  function handleSelectFromSidebar(employee) {
    setHighlightedEmployeeId((current) => (current === employee.id ? null : employee.id))
    const theirCurrentOrNextPeriod = periods
      .filter((p) => p.employeeId === employee.id)
      .sort((a, b) => a.startDate.localeCompare(b.startDate))[0]
    if (theirCurrentOrNextPeriod) setSelectedPeriod(theirCurrentOrNextPeriod)
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <PreviewModeBanner />

      <header className="border-b border-border bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
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

        <nav className="flex gap-1 px-4 sm:px-6">
          <TabButton active={tab === 'calendar'} onClick={() => setTab('calendar')}>
            Calendar
          </TabButton>
          <TabButton active={tab === 'myLeave'} onClick={() => setTab('myLeave')}>
            My Leave
          </TabButton>
        </nav>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {tab === 'calendar' && (
          <SeatingSidebar
            employees={employees}
            periods={periods}
            highlightedEmployeeId={highlightedEmployeeId}
            onSelectEmployee={handleSelectFromSidebar}
          />
        )}

        <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
          <div className="mx-auto max-w-5xl">
            {periodsError && (
              <div className="mb-4 rounded-lg border border-conflict/30 bg-conflict-tint p-4 text-sm text-conflict">
                Something went wrong loading leave data: {periodsError.message}. Try refreshing
                the page.
              </div>
            )}

            {tab === 'calendar' && (
              <>
                <FilterBar
                  scope={scope}
                  setScope={setScope}
                  seatGroup={seatGroup}
                  setSeatGroup={setSeatGroup}
                />
                {periodsLoading ? (
                  <CalendarSkeleton />
                ) : (
                  <CalendarView
                    periods={visiblePeriods}
                    activeEmployeeId={currentEmployee?.id}
                    highlightedEmployeeId={highlightedEmployeeId}
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
          </div>
        </main>
      </div>

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

function FilterBar({ scope, setScope, seatGroup, setSeatGroup }) {
  const options = [
    { key: 'all', label: 'All Employees' },
    { key: 'team', label: 'My Team' },
    { key: 'mine', label: 'My Leave' },
  ]
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {options.map((o) => (
        <button
          key={o.key}
          onClick={() => setScope(o.key)}
          className={`rounded-sm border px-3 py-1.5 text-sm font-medium transition ${
            scope === o.key
              ? 'border-primary bg-primary-tint text-primary'
              : 'border-border bg-surface text-ink-muted hover:bg-bg'
          }`}
        >
          {o.label}
        </button>
      ))}

      <select
        value={seatGroup}
        onChange={(e) => setSeatGroup(e.target.value)}
        className="rounded-sm border border-border bg-surface px-2.5 py-1.5 text-sm text-ink-muted outline-none transition focus:border-primary focus:text-ink"
      >
        <option value="ALL">Seat Group: All</option>
        {SEAT_GROUPS.map((g) => (
          <option key={g} value={g}>
            Seat Group: {g}
          </option>
        ))}
      </select>
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
