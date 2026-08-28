-- ============================================================================
-- phase2g_leave_lifecycle.sql
-- ============================================================================
-- CONTEXT (verified via live SQL Editor inspection, not assumed):
--   - leave_periods already has SELECT / INSERT / UPDATE / DELETE RLS
--     policies, each scoped to the authenticated employee (auth.uid() ->
--     employees.auth_user_id -> employees.id = leave_periods.employee_id).
--   - trg_leave_periods_validate is BEFORE INSERT OR UPDATE on leave_periods,
--     calling leave_periods_before_write(), which already enforces the
--     3-month window, max-3-periods (on INSERT), self-overlap (excluding the
--     row being edited via NEW.id), seating/team conflicts, HOD exclusion,
--     and concurrency-safe advisory locks.
--   - claim_employee_identity(uuid) is untouched by this migration.
--
-- WHY THIS MIGRATION IS NEEDED:
--   The existing UPDATE/DELETE RLS policies are correctly scoped to "your
--   own leave only" — an ADMIN/HOD calling plain `.update()`/`.delete()`
--   from the client would be blocked by that same RLS when acting on
--   ANOTHER employee's row. That's correct: we are NOT changing those
--   policies, and we are NOT introducing USING(true)/WITH CHECK(true).
--
--   Instead, this migration adds three narrow, single-purpose
--   SECURITY DEFINER functions — the same pattern already used by
--   claim_employee_identity() — that:
--     1. Resolve the caller's employee row from auth.uid() (never from any
--        client-supplied id).
--     2. Verify the caller's role is ADMIN or HOD (from employees.role,
--        server-side — never from React state, sessionStorage, or a
--        client-sent role string).
--     3. Only then perform the actual INSERT/UPDATE/DELETE, as a real SQL
--        statement against leave_periods — so the existing BEFORE
--        INSERT/UPDATE trigger still fires exactly as it does for a normal
--        employee write. Phase 2B validation is never bypassed or
--        duplicated here.
--
--   Employee self-service edit/cancel needs NO new database object: the
--   frontend can call the existing authorized `.update()`/`.delete()` path
--   directly, exactly like the existing `.insert()` path already does,
--   because the UPDATE/DELETE RLS policies already scope that correctly.
--
-- SAFETY NOTES:
--   - No service-role key. No broad RLS grants. No changes to any existing
--     policy, to claim_employee_identity(), or to the trigger/trigger
--     function.
--   - Each function has a fixed `search_path` to prevent search_path
--     hijacking, matching Postgres SECURITY DEFINER best practice.
--   - EXECUTE is revoked from PUBLIC and granted only to `authenticated`.
--   - Target leave/employee ids are accepted purely as DATA to operate on —
--     never as authorization. Authorization is derived solely from
--     auth.uid() -> employees.role, resolved inside the function.
--   - `create or replace function` keeps this idempotent/safe to re-run.
--     Nothing here uses DROP POLICY / DROP FUNCTION / DROP TRIGGER.
--
-- ROLLBACK: to remove everything this migration adds, run:
--   drop function if exists public.management_update_leave_period(uuid, date, date);
--   drop function if exists public.management_delete_leave_period(uuid);
--   drop function if exists public.management_add_leave_period(uuid, date, date);
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. management_update_leave_period
--    ADMIN/HOD only. Edits the dates of ANY employee's leave period.
--    Only start_date/end_date change — employee_id and period_number are
--    never reassigned here. Runs a real UPDATE, so the existing BEFORE
--    UPDATE trigger (self-overlap, seating/team conflicts, window, etc.)
--    still applies exactly as it does for an employee's own edit.
-- ----------------------------------------------------------------------------
create or replace function public.management_update_leave_period(
  p_leave_id uuid,
  p_start_date date,
  p_end_date date
)
returns public.leave_periods
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller_employee_id uuid;
  v_caller_role text;
  v_result public.leave_periods;
begin
  select id, role
    into v_caller_employee_id, v_caller_role
  from public.employees
  where auth_user_id = auth.uid();

  if v_caller_employee_id is null then
    raise exception 'Caller is not linked to an employee record'
      using errcode = '42501';
  end if;

  if v_caller_role not in ('ADMIN', 'HOD') then
    raise exception 'Only ADMIN or HOD may edit another employee''s leave'
      using errcode = '42501';
  end if;

  update public.leave_periods
  set start_date = p_start_date,
      end_date = p_end_date
  where id = p_leave_id
  returning * into v_result;

  if v_result.id is null then
    raise exception 'Leave period not found'
      using errcode = 'P0002';
  end if;

  return v_result;
end;
$$;

revoke all on function public.management_update_leave_period(uuid, date, date) from public;
grant execute on function public.management_update_leave_period(uuid, date, date) to authenticated;

-- ----------------------------------------------------------------------------
-- 2. management_delete_leave_period
--    ADMIN/HOD only. Deletes ANY employee's leave period. Hard delete, per
--    explicit instruction (no status/cancellation column exists, and none
--    is introduced by this migration). The UI must clearly label this
--    action "Delete", not "Cancel".
-- ----------------------------------------------------------------------------
create or replace function public.management_delete_leave_period(
  p_leave_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller_employee_id uuid;
  v_caller_role text;
  v_deleted_count int;
begin
  select id, role
    into v_caller_employee_id, v_caller_role
  from public.employees
  where auth_user_id = auth.uid();

  if v_caller_employee_id is null then
    raise exception 'Caller is not linked to an employee record'
      using errcode = '42501';
  end if;

  if v_caller_role not in ('ADMIN', 'HOD') then
    raise exception 'Only ADMIN or HOD may delete another employee''s leave'
      using errcode = '42501';
  end if;

  delete from public.leave_periods where id = p_leave_id;
  get diagnostics v_deleted_count = row_count;

  if v_deleted_count = 0 then
    raise exception 'Leave period not found'
      using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.management_delete_leave_period(uuid) from public;
grant execute on function public.management_delete_leave_period(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 3. management_add_leave_period
--    ADMIN/HOD only. Adds a new leave period on behalf of ANY employee.
--    Computes the next free period_number (1-3) for that employee
--    server-side. Runs a real INSERT, so the existing BEFORE INSERT
--    trigger (window, max-3, conflicts, etc.) still applies exactly as it
--    does for an employee's own Apply Leave.
-- ----------------------------------------------------------------------------
create or replace function public.management_add_leave_period(
  p_employee_id uuid,
  p_start_date date,
  p_end_date date
)
returns public.leave_periods
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller_employee_id uuid;
  v_caller_role text;
  v_next_period_number int;
  v_result public.leave_periods;
begin
  select id, role
    into v_caller_employee_id, v_caller_role
  from public.employees
  where auth_user_id = auth.uid();

  if v_caller_employee_id is null then
    raise exception 'Caller is not linked to an employee record'
      using errcode = '42501';
  end if;

  if v_caller_role not in ('ADMIN', 'HOD') then
    raise exception 'Only ADMIN or HOD may add leave on behalf of another employee'
      using errcode = '42501';
  end if;

  select min(n) into v_next_period_number
  from unnest(array[1, 2, 3]) as n
  where n not in (
    select period_number from public.leave_periods where employee_id = p_employee_id
  );

  if v_next_period_number is null then
    raise exception 'This employee already has the maximum of 3 leave periods'
      using errcode = 'P0001';
  end if;

  insert into public.leave_periods (employee_id, period_number, start_date, end_date)
  values (p_employee_id, v_next_period_number, p_start_date, p_end_date)
  returning * into v_result;

  return v_result;
end;
$$;

revoke all on function public.management_add_leave_period(uuid, date, date) from public;
grant execute on function public.management_add_leave_period(uuid, date, date) to authenticated;

commit;

-- ============================================================================
-- Nothing above touches: claim_employee_identity(), the existing INSERT /
-- UPDATE / DELETE / SELECT RLS policies on leave_periods, or
-- trg_leave_periods_validate / leave_periods_before_write(). Employee
-- self-service Add/Edit/Delete continue to use those existing, already-
-- verified paths directly — no function call needed for those.
-- ============================================================================
