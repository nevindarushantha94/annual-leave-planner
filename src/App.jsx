import { useMemo, useState } from 'react'
import { CurrentEmployeeProvider, useCurrentEmployee } from './context/CurrentEmployeeContext'
import { useLeavePeriods } from './hooks/useLeavePeriods'
import {
  applyLeave,
  deleteLeave,
  manageAddLeaveForEmployee,
  manageDeleteLeave,
  manageUpdateLeave,
  updateLeave,
} from './lib/leaveApi'
import { CalendarView } from './components/CalendarView'
import { MyLeave } from './components/MyLeave'
import { LeaveDrawer } from './components/LeaveDrawer'
import { ConfirmDialog } from './components/ConfirmDialog'
import { LeaveDetailsPanel } from './components/LeaveDetailsPanel'
import { EmployeeSelectionScreen } from './components/EmployeeSelectionScreen'
import { SeatingFloorChart } from './components/SeatingFloorChart'
import { ManagementView } from './components/ManagementView'
import { PreviewModeBanner } from './components/PreviewModeBanner'
import { CalendarSkeleton } from './components/Skeletons'
import { ContextBadges } from './components/Badges'
import { formatLong } from './lib/dateWindow'

const SEAT_GROUPS = ['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9']

// UI-only visibility. The database's `employees.role` column (ADMIN / HOD /
// EMPLOYEE) is the single source of truth here — nothing in this file ever
// checks a name or an id to decide what's shown, and every mutation below
// still goes through the database's own RLS / SECURITY DEFINER authorization
// — this is never trusted as the actual security boundary.
const MANAGEMENT_ROLES = new Set(['ADMIN', 'HOD'])

function Shell() {
  const { currentEmployee, employees, changeEmployee } = useCurrentEmployee()
  const { periods, loading: periodsLoading, error: periodsError, refresh } = useLeavePeriods()

  // Calendar is the primary landing screen, per the redesign brief.
  const [tab, setTab] = useState('calendar') // 'calendar' | 'seating' | 'myLeave' | 'management'
  const [scope, setScope] = useState('all') // 'all' | 'mine' | 'team'
  const [seatGroup, setSeatGroup] = useState('ALL')
  const [selectedPeriod, setSelectedPeriod] = useState(null)
  const [highlightedEmployeeId, setHighlightedEmployeeId] = useState(null)

  // --- Leave lifecycle drawer state -----------------------------------
  // One drawer instance serves three flows: an employee applying for their
  // own leave, an employee (or ADMIN/HOD) editing an existing leave period,
  // and ADMIN/HOD adding leave on behalf of another employee. Which
  // authorized API function gets called is decided here, never inside the
  // drawer itself.
  const [applyOpen, setApplyOpen] = useState(false)
  const [editingPeriod, setEditingPeriod] = useState(null)
  const [manageAddTarget, setManageAddTarget] = useState(null)

  // --- Delete confirmation state ---------------------------------------
  const [confirmDeletePeriod, setConfirmDeletePeriod] = useState(null)
  const [deleteSubmitting, setDeleteSubmitting] = useState(false)
  const [deleteError, setDeleteError] = useState(null)

  const canManage = MANAGEMENT_ROLES.has(currentEmployee?.role)

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

  // --- Resolve which flow the drawer is currently serving ---------------
  const drawerOpen = applyOpen || !!editingPeriod || !!manageAddTarget

  function closeDrawer() {
    setApplyOpen(false)
    setEditingPeriod(null)
    setManageAddTarget(null)
  }

  let drawerMode = 'add'
  let drawerEmployee = currentEmployee
  let drawerExistingPeriods = myExistingPeriods
  let drawerOnSubmit = ({ startDate, endDate, periodNumber }) =>
    applyLeave({ employeeId: currentEmployee?.id, periodNumber, startDate, endDate })

  if (editingPeriod) {
    drawerMode = 'edit'
    const isOwn = editingPeriod.employeeId === currentEmployee?.id
    drawerEmployee = isOwn
      ? currentEmployee
      : (employees.find((e) => e.id === editingPeriod.employeeId) ?? null)
    drawerExistingPeriods = periods.filter((p) => p.employeeId === editingPeriod.employeeId)
    drawerOnSubmit = ({ startDate, endDate }) =>
      isOwn
        ? updateLeave({ id: editingPeriod.id, startDate, endDate })
        : manageUpdateLeave({ id: editingPeriod.id, startDate, endDate })
  } else if (manageAddTarget) {
    drawerMode = 'add'
    drawerEmployee = manageAddTarget
    drawerExistingPeriods = periods.filter((p) => p.employeeId === manageAddTarget.id)
    drawerOnSubmit = ({ startDate, endDate }) =>
      manageAddLeaveForEmployee({ employeeId: manageAddTarget.id, startDate, endDate })
  }

  function openApplyDrawer() {
    setApplyOpen(true)
  }

  function openEditDrawer(period) {
    setEditingPeriod(period)
  }

  function openManageAddDrawer(targetEmployee) {
    setManageAddTarget(targetEmployee)
  }

  function requestDelete(period) {
    setDeleteError(null)
    setConfirmDeletePeriod(period)
  }

  async function confirmDelete() {
    if (!confirmDeletePeriod) return
    setDeleteSubmitting(true)
    setDeleteError(null)

    const isOwn = confirmDeletePeriod.employeeId === currentEmployee?.id
    const result = isOwn
      ? await deleteLeave(confirmDeletePeriod.id)
      : await manageDeleteLeave(confirmDeletePeriod.id)

    setDeleteSubmitting(false)

    if (result.ok) {
      setConfirmDeletePeriod(null)
      refresh()
    } else {
      setDeleteError(result.error?.message ?? 'Unable to delete this leave. Please try again.')
    }
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

        <nav className="flex flex-wrap gap-1 px-4 sm:px-6">
          <TabButton active={tab === 'calendar'} onClick={() => setTab('calendar')}>
            Calendar
          </TabButton>
          <TabButton active={tab === 'myLeave'} onClick={() => setTab('myLeave')}>
            My Leave
          </TabButton>
          <TabButton active={tab === 'seating'} onClick={() => setTab('seating')}>
            Seating
          </TabButton>
          {canManage && (
            <TabButton
              active={tab === 'management'}
              onClick={() => setTab('management')}
              accent
            >
              Management
            </TabButton>
          )}
        </nav>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-6xl">
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
                  onApplyLeave={openApplyDrawer}
                />
              )}
            </>
          )}

          {tab === 'myLeave' && (
            <MyLeave
              employee={currentEmployee}
              periods={periods}
              onSelectPeriod={setSelectedPeriod}
              onApplyLeave={openApplyDrawer}
              onEditPeriod={openEditDrawer}
              onDeletePeriod={requestDelete}
            />
          )}

          {tab === 'seating' && (
            <SeatingFloorChart
              employees={employees}
              periods={periods}
              activeEmployeeId={currentEmployee?.id}
              highlightedEmployeeId={highlightedEmployeeId}
              onHighlightEmployee={setHighlightedEmployeeId}
            />
          )}

          {tab === 'management' && canManage && (
            <ManagementView
              role={currentEmployee?.role}
              employees={employees}
              periods={periods}
              activeEmployeeId={currentEmployee?.id}
              highlightedEmployeeId={highlightedEmployeeId}
              onHighlightEmployee={setHighlightedEmployeeId}
              onSelectPeriod={setSelectedPeriod}
              onEditPeriod={openEditDrawer}
              onDeletePeriod={requestDelete}
              onAddForEmployee={openManageAddDrawer}
            />
          )}
        </div>
      </main>

      <LeaveDrawer
        open={drawerOpen}
        onClose={closeDrawer}
        employee={drawerEmployee}
        existingPeriods={drawerExistingPeriods}
        mode={drawerMode}
        editingPeriod={editingPeriod}
        onSubmit={drawerOnSubmit}
        onApplied={refresh}
      />

      <ConfirmDialog
        open={!!confirmDeletePeriod}
        title="Delete this leave period?"
        message={
          confirmDeletePeriod
            ? `${confirmDeletePeriod.employeeName} — ${formatLong(confirmDeletePeriod.startDate)} → ${formatLong(confirmDeletePeriod.endDate)}. This cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        submitting={deleteSubmitting}
        error={deleteError}
        onCancel={() => setConfirmDeletePeriod(null)}
        onConfirm={confirmDelete}
      />

      <LeaveDetailsPanel
        period={selectedPeriod}
        employeeRole={selectedEmployeeRole}
        onClose={() => setSelectedPeriod(null)}
      />
    </div>
  )
}

function TabButton({ active, onClick, children, accent = false }) {
  return (
    <button
      onClick={onClick}
      className={`border-b-2 px-3 py-2.5 text-sm font-medium transition ${
        active
          ? accent
            ? 'border-hod text-hod'
            : 'border-primary text-primary'
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
