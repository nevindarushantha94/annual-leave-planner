import { supabase } from './supabaseClient'

// ============================================================================
// EMPLOYEE IDENTITY CLAIM
// ============================================================================
// Links the current browser session's auth.uid() to the selected employee,
// via a SECURITY DEFINER database function (see
// phase2c_employee_authorization.sql). This is the ONLY thing that actually
// authorizes leave_periods writes for that employee — selecting a name in
// the UI or setting sessionStorage does nothing on its own. The database
// decides and enforces this; the frontend just asks it to.
// ============================================================================

export async function claimEmployeeIdentity(employeeId) {
  const { error } = await supabase.rpc('claim_employee_identity', {
    p_employee_id: employeeId,
  })
  if (error) throw error
}

// ============================================================================
// EMPLOYEES + SEATING/TEAM CONTEXT
// ============================================================================

export async function fetchEmployeeDirectory() {
  const { data, error } = await supabase
    .from('employees')
    .select(
      `
      id, epf_number, name, role,
      seat_positions ( grid_row, grid_col, slot_label,
        seating_groups ( group_label ) ),
      team_members ( teams ( team_name ) )
    `
    )
    .eq('is_active', true)
    .order('name')

  if (error) throw error

  return (data || []).map((e) => {
    const seat = Array.isArray(e.seat_positions) ? e.seat_positions[0] : e.seat_positions
    const teamRow = Array.isArray(e.team_members) ? e.team_members[0] : e.team_members
    return {
      id: e.id,
      epfNumber: e.epf_number,
      name: e.name,
      role: e.role,
      seatGroupLabel: seat?.seating_groups?.group_label ?? null,
      slotLabel: seat?.slot_label ?? null,
      gridRow: seat?.grid_row ?? null,
      gridCol: seat?.grid_col ?? null,
      teamName: teamRow?.teams?.team_name ?? null,
    }
  })
}

// ============================================================================
// LEAVE PERIODS
// ============================================================================

export async function fetchLeavePeriods() {
  const { data, error } = await supabase
    .from('leave_periods')
    .select(
      `
      id, employee_id, period_number, start_date, end_date, days_count, created_at,
      employees ( id, name, role, epf_number,
        seat_positions ( seating_groups ( group_label ) ),
        team_members ( teams ( team_name ) ) )
    `
    )
    .order('start_date')

  if (error) throw error

  return (data || []).map(normalizeLeaveRow)
}

function normalizeLeaveRow(row) {
  const emp = row.employees
  const seat = Array.isArray(emp?.seat_positions) ? emp.seat_positions[0] : emp?.seat_positions
  const teamRow = Array.isArray(emp?.team_members) ? emp.team_members[0] : emp?.team_members
  return {
    id: row.id,
    employeeId: row.employee_id,
    employeeName: emp?.name ?? 'Unknown',
    employeeRole: emp?.role ?? null,
    employeeEpf: emp?.epf_number ?? null,
    periodNumber: row.period_number,
    startDate: row.start_date,
    endDate: row.end_date,
    daysCount: row.days_count,
    createdAt: row.created_at,
    seatGroupLabel: seat?.seating_groups?.group_label ?? null,
    teamName: teamRow?.teams?.team_name ?? null,
  }
}

export function subscribeToLeavePeriods(onChange) {
  const channel = supabase
    .channel('leave_periods_realtime')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'leave_periods' },
      () => onChange()
    )
    .subscribe()

  return () => supabase.removeChannel(channel)
}

// ============================================================================
// APPLY LEAVE — thin submit wrapper. All business validation (seating/team
// conflicts, HOD exclusion, self-overlap, max 3 periods, 3-month window,
// concurrency safety) lives entirely in the Phase 2B trigger. This function
// does not duplicate any of that — it only submits and translates whatever
// the database decides into a structured shape the UI can render cleanly.
// ============================================================================

export async function applyLeave({ employeeId, periodNumber, startDate, endDate }) {
  const { data, error } = await supabase
    .from('leave_periods')
    .insert({
      employee_id: employeeId,
      period_number: periodNumber,
      start_date: startDate,
      end_date: endDate,
    })
    .select()
    .single()

  if (!error) {
    return { ok: true, data }
  }

  return { ok: false, error: classifyLeaveError(error) }
}

// ============================================================================
// EDIT / CANCEL — EMPLOYEE'S OWN LEAVE
// ============================================================================
// Uses the existing UPDATE/DELETE RLS policies directly (verified via live
// database inspection: both are already scoped to
// `employee_id in (select id from employees where auth_user_id = auth.uid())`,
// the same pattern as the existing INSERT policy). No new database object is
// needed for this path — the frontend just asks, and the database enforces
// ownership exactly as it already does for Add Leave. The existing
// BEFORE UPDATE trigger (leave_periods_before_write) still runs on every
// edit, so Phase 2B validation is never bypassed.
// ============================================================================

export async function updateLeave({ id, startDate, endDate }) {
  const { data, error } = await supabase
    .from('leave_periods')
    .update({ start_date: startDate, end_date: endDate })
    .eq('id', id)
    .select()
    .single()

  if (!error) return { ok: true, data }
  return { ok: false, error: classifyLeaveError(error) }
}

export async function deleteLeave(id) {
  const { error } = await supabase.from('leave_periods').delete().eq('id', id)
  if (!error) return { ok: true }
  return { ok: false, error: classifyLeaveError(error) }
}

// ============================================================================
// MANAGEMENT (ADMIN/HOD) — ANOTHER EMPLOYEE'S LEAVE
// ============================================================================
// The existing UPDATE/DELETE/INSERT RLS policies are intentionally scoped to
// "your own leave only" — they correctly refuse these calls for another
// employee's row. Management actions instead go through narrow
// SECURITY DEFINER functions (see phase2g_leave_lifecycle.sql) that verify
// the caller's role server-side from `employees.role` via auth.uid() — never
// from client-supplied role/employee_id — before performing the real
// INSERT/UPDATE/DELETE. Those functions run a genuine SQL statement against
// leave_periods, so the existing trigger still fires and Phase 2B validation
// still applies exactly as it does for a normal employee write.
//
// NOTE: these three RPCs only exist in the database once
// phase2g_leave_lifecycle.sql has been run in the Supabase SQL Editor. Until
// then, calls here will fail with a "function does not exist" error, which
// is surfaced through the normal error path below rather than silently
// pretending to succeed.
// ============================================================================

export async function manageAddLeaveForEmployee({ employeeId, startDate, endDate }) {
  const { data, error } = await supabase.rpc('management_add_leave_period', {
    p_employee_id: employeeId,
    p_start_date: startDate,
    p_end_date: endDate,
  })
  if (!error) return { ok: true, data }
  return { ok: false, error: classifyLeaveError(error) }
}

export async function manageUpdateLeave({ id, startDate, endDate }) {
  const { data, error } = await supabase.rpc('management_update_leave_period', {
    p_leave_id: id,
    p_start_date: startDate,
    p_end_date: endDate,
  })
  if (!error) return { ok: true, data }
  return { ok: false, error: classifyLeaveError(error) }
}

export async function manageDeleteLeave(id) {
  const { error } = await supabase.rpc('management_delete_leave_period', { p_leave_id: id })
  if (!error) return { ok: true }
  return { ok: false, error: classifyLeaveError(error) }
}

function classifyLeaveError(error) {
  const message = error.message || 'The leave request could not be submitted.'

  // Session isn't authorized to write for this employee/record — either the
  // claim hasn't happened yet, this employee's link changed, or (for
  // management RPCs) the caller's role isn't ADMIN/HOD.
  if (error.code === '42501') {
    const isManagementAuth = /ADMIN or HOD/i.test(message)
    return {
      kind: isManagementAuth ? 'not_authorized' : 'not_linked',
      title: isManagementAuth ? 'Not authorized' : 'Session not authorized for this employee',
      message: isManagementAuth
        ? 'You are not authorized to modify this leave.'
        : 'Your session isn\'t currently linked to this employee. Please use "Change Employee" and select your name again.',
      conflicts: [],
      raw: message,
    }
  }

  // Target row no longer exists (already edited/removed elsewhere) —
  // management RPCs raise this explicitly.
  if (error.code === 'P0002') {
    return {
      kind: 'not_found',
      title: 'Leave period not found',
      message: 'This leave period no longer exists. It may have already been changed or removed.',
      conflicts: [],
      raw: message,
    }
  }

  // Management RPC not installed yet (phase2g migration not run).
  if (error.code === '42883' || /function .* does not exist/i.test(message)) {
    return {
      kind: 'not_available',
      title: 'This action isn\'t available yet',
      message: 'This action requires a database update that hasn\'t been applied yet. Please contact the administrator.',
      conflicts: [],
      raw: message,
    }
  }

  // Structured Phase 2B rejection (errcode P0001, message + optional jsonb DETAIL)
  if (error.code === 'P0001') {
    let conflicts = []
    if (error.details) {
      try {
        const parsed = JSON.parse(error.details)
        if (Array.isArray(parsed)) conflicts = parsed
      } catch {
        // DETAIL wasn't JSON (e.g. window/max-period messages don't set one) — fine.
      }
    }

    if (message.includes('already on leave')) {
      return {
        kind: 'conflict',
        title: 'Leave conflict detected',
        message,
        conflicts,
        raw: message,
      }
    }
    if (message.includes('own leave periods cannot overlap')) {
      return {
        kind: 'self_overlap',
        title: 'Your leave periods overlap',
        message,
        conflicts: [],
        raw: message,
      }
    }
    if (message.includes('maximum of 3')) {
      return {
        kind: 'max_periods',
        title: 'Maximum leave periods reached',
        message,
        conflicts: [],
        raw: message,
      }
    }
    if (message.includes('planning window')) {
      return {
        kind: 'window',
        title: 'Dates outside the planning window',
        message,
        conflicts: [],
        raw: message,
      }
    }
    return { kind: 'validation', title: 'Leave request rejected', message, conflicts, raw: message }
  }

  // Unique constraint fallback (e.g. a reused period_number)
  if (error.code === '23505') {
    return {
      kind: 'max_periods',
      title: 'Leave period slot already in use',
      message: 'That period number is already taken for this employee.',
      conflicts: [],
      raw: message,
    }
  }

  return {
    kind: 'unknown',
    title: 'Leave request could not be submitted',
    message,
    conflicts: [],
    raw: message,
  }
}
