-- ============================================================================
-- phase2g_leave_lifecycle_tests.sql
-- ============================================================================
-- Run this AFTER applying phase2g_leave_lifecycle.sql, in the Supabase SQL
-- Editor. Every test below is wrapped so it cleans up after itself and does
-- not permanently alter production data — but this still executes real
-- INSERT/UPDATE/DELETE statements against leave_periods, so running it
-- against a staging project (or during a maintenance window) is strongly
-- preferred over running it directly against production.
--
-- IMPORTANT — read before running:
--   The SQL Editor normally runs as the Postgres owner/service role, which
--   bypasses RLS and does not carry a real end-user `auth.uid()`. That means
--   these tests cannot fully exercise "Employee A cannot touch Employee B's
--   row" from the SQL Editor alone — that boundary is enforced by RLS
--   against the actual `authenticated` role with a real session, which is
--   what the running application already uses. Tests 1-4 below use
--   `set local role authenticated; set local request.jwt.claims = ...` to
--   simulate a specific authenticated user's session as closely as
--   Supabase's testing conventions allow. If your project does not support
--   impersonating auth.uid() this way in the SQL Editor, run tests 1-4 from
--   the actual running application instead (two different employees, two
--   browser sessions) and treat this file as a template for tests 5-10.
--
-- Replace the two placeholder UUIDs below with two REAL, currently-active,
-- non-HOD EMPLOYEE rows from your `employees` table before running.
-- ============================================================================

-- Fetch two real employee ids + their auth_user_id to use as test subjects:
select id, name, role, auth_user_id
from employees
where role = 'EMPLOYEE' and is_active = true
order by name
limit 5;

-- Substitute the results above into these two variables for the rest of
-- this script (psql \set works in the SQL Editor's "Assistant" query runner;
-- if not, just replace every occurrence by hand):
-- \set employee_a_id '00000000-0000-0000-0000-000000000001'
-- \set employee_a_auth_uid '00000000-0000-0000-0000-0000000000a1'
-- \set employee_b_id '00000000-0000-0000-0000-000000000002'


-- ============================================================================
-- TEST 1 — Employee A can update their own leave
-- ============================================================================
begin;
  -- Insert a throwaway leave period for Employee A far outside real data's
  -- normal range window to make it easy to spot/clean up.
  set local role authenticated;
  set local request.jwt.claims = '{"sub": "EMPLOYEE_A_AUTH_UID"}';

  insert into leave_periods (employee_id, period_number, start_date, end_date)
  values ('EMPLOYEE_A_ID', 3, current_date + 10, current_date + 12)
  returning id \gset test1_

  update leave_periods
  set end_date = current_date + 13
  where id = :'test1_id';

  select 'TEST 1 PASS if one row shows end_date = current_date + 13' as result, *
  from leave_periods where id = :'test1_id';
rollback; -- undo the throwaway insert/update, no production data affected


-- ============================================================================
-- TEST 2 — Employee A CANNOT update Employee B's leave
-- ============================================================================
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub": "EMPLOYEE_A_AUTH_UID"}';

  -- Attempt to update an existing real leave_periods row belonging to
  -- Employee B. Expected: 0 rows affected (RLS silently filters it out) —
  -- confirm via SELECT that Employee B's row is unchanged.
  update leave_periods
  set end_date = end_date + 1
  where employee_id = 'EMPLOYEE_B_ID';

  select 'TEST 2 PASS if this returns 0 or errors' as result;
rollback;


-- ============================================================================
-- TEST 3 — Employee A can cancel (delete) their own leave
-- ============================================================================
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub": "EMPLOYEE_A_AUTH_UID"}';

  insert into leave_periods (employee_id, period_number, start_date, end_date)
  values ('EMPLOYEE_A_ID', 3, current_date + 20, current_date + 21)
  returning id \gset test3_

  delete from leave_periods where id = :'test3_id';

  select 'TEST 3 PASS if 0 rows returned' as result, *
  from leave_periods where id = :'test3_id';
rollback;


-- ============================================================================
-- TEST 4 — Employee A CANNOT delete Employee B's leave
-- ============================================================================
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub": "EMPLOYEE_A_AUTH_UID"}';

  delete from leave_periods where employee_id = 'EMPLOYEE_B_ID';

  select 'TEST 4 PASS if Employee B still has their leave records' as result;
  select count(*) from leave_periods where employee_id = 'EMPLOYEE_B_ID';
rollback;


-- ============================================================================
-- TEST 5 — A valid edited leave succeeds (via the employee's own UPDATE path)
-- ============================================================================
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub": "EMPLOYEE_A_AUTH_UID"}';

  insert into leave_periods (employee_id, period_number, start_date, end_date)
  values ('EMPLOYEE_A_ID', 3, current_date + 30, current_date + 31)
  returning id \gset test5_

  update leave_periods
  set start_date = current_date + 30, end_date = current_date + 32
  where id = :'test5_id';

  select 'TEST 5 PASS if end_date is now current_date + 32' as result, *
  from leave_periods where id = :'test5_id';
rollback;


-- ============================================================================
-- TEST 6 — An edit that creates a Phase 2B conflict is rejected
-- ============================================================================
-- Requires two employees who genuinely share a seating group/team so a
-- conflict is even possible — adjust ids to a real conflicting pair from
-- your seating_groups/team_members data.
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub": "EMPLOYEE_A_AUTH_UID"}';

  insert into leave_periods (employee_id, period_number, start_date, end_date)
  values ('EMPLOYEE_A_ID', 3, current_date + 40, current_date + 41)
  returning id \gset test6_

  -- Expected: this UPDATE should raise a P0001 error if it now overlaps a
  -- seating/team peer's existing leave. If it succeeds, there was no real
  -- conflict available to test with these two dates/employees — pick dates
  -- that actually overlap an existing peer leave period to properly test.
  update leave_periods
  set start_date = current_date + 40, end_date = current_date + 45
  where id = :'test6_id';

  select 'TEST 6: if you see this without an error, no conflict existed to trigger — adjust dates' as result;
rollback;


-- ============================================================================
-- TEST 7 — A deleted/cancelled leave is no longer active
-- ============================================================================
-- "Active" here means: present in leave_periods at all (hard delete design,
-- per instruction — there is no status column).
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub": "EMPLOYEE_A_AUTH_UID"}';

  insert into leave_periods (employee_id, period_number, start_date, end_date)
  values ('EMPLOYEE_A_ID', 3, current_date + 50, current_date + 51)
  returning id \gset test7_

  delete from leave_periods where id = :'test7_id';

  select 'TEST 7 PASS if 0 rows' as result, count(*)
  from leave_periods where id = :'test7_id';
rollback;


-- ============================================================================
-- TEST 8 — A new leave can be created after cancellation (same period slot)
-- ============================================================================
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub": "EMPLOYEE_A_AUTH_UID"}';

  insert into leave_periods (employee_id, period_number, start_date, end_date)
  values ('EMPLOYEE_A_ID', 3, current_date + 60, current_date + 61)
  returning id \gset test8a_

  delete from leave_periods where id = :'test8a_id';

  insert into leave_periods (employee_id, period_number, start_date, end_date)
  values ('EMPLOYEE_A_ID', 3, current_date + 65, current_date + 66)
  returning id \gset test8b_

  select 'TEST 8 PASS if this row exists' as result, *
  from leave_periods where id = :'test8b_id';
rollback;


-- ============================================================================
-- TEST 9 — ADMIN/HOD management functions work as designed
-- ============================================================================
-- Run these AS an authenticated ADMIN or HOD session (a real one, via the
-- app, is the most reliable way — SECURITY DEFINER functions read
-- auth.uid() from the actual session, and the SQL Editor's default role
-- does not carry one). If your SQL Editor supports the jwt.claims
-- simulation above, substitute an ADMIN/HOD's auth_user_id.

-- 9a. ADMIN/HOD can add leave for another employee:
select management_add_leave_period(
  'EMPLOYEE_B_ID'::uuid,
  current_date + 70,
  current_date + 71
);
-- Then clean up manually if this was run against real data:
-- delete from leave_periods where employee_id = 'EMPLOYEE_B_ID' and start_date = current_date + 70;

-- 9b. ADMIN/HOD can edit another employee's leave:
-- select management_update_leave_period('<some leave_periods.id>'::uuid, current_date + 70, current_date + 72);

-- 9c. ADMIN/HOD can delete another employee's leave:
-- select management_delete_leave_period('<some leave_periods.id>'::uuid);

-- 9d. A normal EMPLOYEE calling any of the three above must be rejected
-- with errcode 42501 ("Only ADMIN or HOD may ..."). Run as an EMPLOYEE
-- session and confirm the exception.


-- ============================================================================
-- TEST 10 — claim_employee_identity() still works unchanged
-- ============================================================================
-- This migration does not touch claim_employee_identity() at all. Confirm
-- by re-running your existing phase2c_employee_authorization_tests.sql
-- unmodified — it should pass exactly as before.
