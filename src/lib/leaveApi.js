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
      employees ( id, name, role,
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

function classifyLeaveError(error) {
  const message = error.message || 'The leave request could not be submitted.'

  // Session isn't authorized to write for this employee — either the claim
  // hasn't happened yet, or (rare) this employee's link changed since. Not
  // an expected steady-state error anymore now that claiming exists, but
  // still handled cleanly rather than showing a raw Postgres message.
  if (error.code === '42501') {
    return {
      kind: 'not_linked',
      title: 'Session not authorized for this employee',
      message:
        'Your session isn\'t currently linked to this employee. Please use "Change Employee" and select your name again.',
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
