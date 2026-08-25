import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { claimEmployeeIdentity, fetchEmployeeDirectory } from '../lib/leaveApi'
import { ensureSession } from '../lib/supabaseClient'

// ============================================================================
// EMPLOYEE SELECTION / SESSION
// ============================================================================
// This is deliberately NOT an authentication system — there is no password,
// no email, no server-verified human identity. It's a UI/session convenience
// so a known department member can pick their name once per browser tab.
//
// What IS real security: every selection is backed by claimEmployeeIdentity(),
// which links this browser session's Supabase-verified auth.uid() to the
// chosen employee via a database function (phase2c_employee_authorization.sql).
// The Phase 2B trigger and RLS policies use that link — not sessionStorage,
// not React state — to decide whether a leave write is authorized. Editing
// sessionStorage by hand does not change who this session is allowed to
// write leave for; only a fresh, successful claim does that. See the SQL
// migration's comments for what this design does and does not protect
// against.
//
// The selected employee id is cached in sessionStorage purely so the UI can
// display "who am I" instantly without a round trip — it is never trusted
// as authorization by itself.
// ============================================================================

const CurrentEmployeeContext = createContext(null)

const SESSION_KEY = 'alp_current_employee_id'

export function CurrentEmployeeProvider({ children }) {
  const [employees, setEmployees] = useState([])
  const [currentEmployeeId, setCurrentEmployeeId] = useState(
    () => sessionStorage.getItem(SESSION_KEY) || null
  )
  const [directoryLoading, setDirectoryLoading] = useState(true)
  const [directoryError, setDirectoryError] = useState(null)
  const [sessionNotice, setSessionNotice] = useState(null)
  const [claiming, setClaiming] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await ensureSession()
        const list = await fetchEmployeeDirectory()
        if (cancelled) return
        setEmployees(list)

        const storedId = sessionStorage.getItem(SESSION_KEY)
        if (!storedId) {
          setCurrentEmployeeId(null)
          return
        }

        const stillValid = list.some((e) => e.id === storedId)
        if (!stillValid) {
          sessionStorage.removeItem(SESSION_KEY)
          setSessionNotice('Employee record could not be found. Please select your name again.')
          setCurrentEmployeeId(null)
          return
        }

        // Re-assert the claim on restore (e.g. after a page refresh). This is
        // an idempotent no-op if this session already holds this employee's
        // link — it's here so the DB link and the UI's cached selection can
        // never silently drift apart.
        try {
          await claimEmployeeIdentity(storedId)
          setCurrentEmployeeId(storedId)
        } catch {
          sessionStorage.removeItem(SESSION_KEY)
          setSessionNotice('Your session could not be re-authorized. Please select your name again.')
          setCurrentEmployeeId(null)
        }
      } catch (e) {
        if (!cancelled) setDirectoryError(e)
      } finally {
        if (!cancelled) setDirectoryLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const selectEmployee = useCallback(async (employeeId) => {
    setClaiming(true)
    setSessionNotice(null)
    try {
      await claimEmployeeIdentity(employeeId)
      sessionStorage.setItem(SESSION_KEY, employeeId)
      setCurrentEmployeeId(employeeId)
    } catch (e) {
      setSessionNotice(
        'Could not select this employee right now. Please try again, or contact the administrator if this continues.'
      )
      console.error('claimEmployeeIdentity failed:', e.message)
    } finally {
      setClaiming(false)
    }
  }, [])

  const changeEmployee = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY)
    setSessionNotice(null)
    setCurrentEmployeeId(null)
  }, [])

  const currentEmployee = useMemo(
    () => employees.find((e) => e.id === currentEmployeeId) ?? null,
    [employees, currentEmployeeId]
  )

  // 'loading' | 'needs_selection' | 'ready' | 'error'
  const status = directoryError
    ? 'error'
    : directoryLoading
      ? 'loading'
      : currentEmployee
        ? 'ready'
        : 'needs_selection'

  const value = {
    status,
    employees,
    currentEmployee,
    selectEmployee,
    changeEmployee,
    directoryError,
    sessionNotice,
    claiming,
  }

  return (
    <CurrentEmployeeContext.Provider value={value}>{children}</CurrentEmployeeContext.Provider>
  )
}

export function useCurrentEmployee() {
  const ctx = useContext(CurrentEmployeeContext)
  if (!ctx) throw new Error('useCurrentEmployee must be used within CurrentEmployeeProvider')
  return ctx
}
