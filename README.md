# Annual Leave Planner — Phase 2C + 2D

Calendar UI + Apply Leave workflow + Employee Selection/Session for the
Medical & Non-Motor Claims Department. Built with React + Vite + Tailwind +
Supabase JS.

## Phase 2D: Employee Selection / Session (not authentication)

On open, employees pick their name from a searchable list (loaded live from
`employees`, no hardcoded names) and click Continue. There is no password or
email field — this is explicitly **not** an authentication system, just a way
for the app to remember who's using it for this browser tab.

- Selected employee id is stored in **sessionStorage only** (key
  `alp_current_employee_id`) — cleared automatically when the tab/browser
  session ends, never localStorage, no credentials of any kind.
- `useCurrentEmployee()` (`src/context/CurrentEmployeeContext.jsx`) is the
  single source of truth: `{ status, employees, currentEmployee,
  selectEmployee, changeEmployee, directoryError, sessionNotice }`.
  `currentEmployee` carries id, EPF, name, role, seat group, and team.
- Refreshing the page keeps the same employee (sessionStorage survives
  refresh). Opening a new tab does not carry it over (fresh sessionStorage).
- If the stored id no longer matches an active employee (removed/deactivated
  since selection), the session is cleared automatically and the person sees
  "Employee record could not be found. Please select your name again."
- **Change Employee** in the header clears the session and returns to the
  selection screen — no page reload needed.
- Leave submission always uses `currentEmployee.id` from context. There is no
  way to type or pick a different employee id in the Apply Leave drawer.

## What this does NOT include (by design, per your instructions)

- **No business-rule validation in JavaScript.** Every rule — seating-group
  conflicts, team conflicts, HOD exclusion, self-overlap, max 3 periods, the
  rolling 3-month window, and concurrency safety — lives entirely in the
  Phase 2B database trigger. This app only submits the insert and displays
  whatever the database decides.
- **No real per-employee login yet.** See "Preview mode" below.
- **No changes to Phase 2A or Phase 2B.** Nothing here touches the schema,
  the trigger, or any function.

## Setup

```bash
npm install
cp .env.example .env   # already pre-filled with your project URL + anon key
npm run dev
```

Open the printed local URL (usually `http://localhost:5173`).

To build for deployment (Vercel, Netlify, static hosting, etc.):

```bash
npm run build
```

The output lands in `dist/` — deploy that folder. Remember to set
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as environment variables on
whatever host you deploy to (not just in your local `.env`).

## Preview mode — why, and what to expect

Your existing RLS policies only grant access to the `authenticated` Postgres
role. With no real login system yet, the browser would otherwise connect as
`anon`, and even reading the calendar would fail.

To unblock this without touching RLS or the database at all, the app calls
Supabase's **anonymous sign-in** on load. This produces a real `authenticated`
session, so all the existing read policies work exactly as they are.

It deliberately does **not** unblock writes: the `leave_periods` insert
policy checks `employee_id in (select id from employees where auth_user_id =
auth.uid())`, and no employee row is linked to this throwaway anonymous
session. So:

- **Browsing the calendar, My Leave, and leave details: fully functional**,
  showing real data.
- **The name-switcher** (top right) lets you view the app "as" any of the 32
  employees — this is a stand-in for login, not real auth. It only changes
  what the UI highlights as "my leave"; it does not grant that person's
  actual write permission.
- **Clicking "Apply Leave" and submitting will currently return**: *"Leave
  requests are not enabled for this account yet"* — this is the correct,
  expected response given no real accounts exist, not a bug. Selecting a
  specific employee by name in Phase 2D does **not** change this: the
  underlying Supabase session is still the same shared anonymous session
  regardless of which name is chosen in the UI, so `auth.uid()` still matches
  no employee's `auth_user_id`. Employee Selection is a UI/session identity
  only, exactly as specified — it intentionally has no ability to grant
  itself real write access. See "Remaining limitations" below.

When you're ready for real logins (Phase 2D), each employee's Supabase Auth
account gets created and its `auth_user_id` gets set on their `employees` row.
Once that's done, the exact same "Apply Leave" flow in this app will start
succeeding for real, with zero code changes needed here — the whole app was
built against the real write path from day one, it's just currently blocked
by the intentionally-strict RLS policy, exactly as it should be.

## Phase 2E: Employee Identity Authorization (closing the RLS-write gap)

Selecting a name now does more than update the UI: `selectEmployee()` calls
`claimEmployeeIdentity()`, which invokes a `SECURITY DEFINER` Postgres
function, `claim_employee_identity` (see
`phase2c_employee_authorization.sql` — run it in the SQL Editor after Phase
2A/2B, before using this build). That function links this browser session's
real, Supabase-verified `auth.uid()` to the chosen `employees` row. The
existing Phase 2B RLS write policies check exactly that link — nothing about
them changed.

**What this actually protects against:** once a session has claimed a name,
editing `sessionStorage`'s `alp_current_employee_id` to a different
employee's UUID and submitting leave does **not** work — the insert is
rejected by RLS, because the database checks the session's real `auth.uid()`
against the `employees` table, not whatever the client claims. Verified in
`phase2c_employee_authorization_tests.sql` (Test 3).

**What this does not, and cannot, protect against:** someone deliberately
selecting a colleague's name at the picker itself. No passwordless design can
distinguish that from a legitimate selection — there's no credential proving
which physical person is clicking. This is an inherent limit of the "select
name, no password" requirement, not a gap in this implementation, and it's
stated here rather than glossed over.

**Why claims are re-claimable, not permanent:** a claim always overwrites
this session's previous claim (if any), rather than locking the browser to
the first name ever selected. Combined with moving the Supabase auth session
itself into `sessionStorage` (see `supabaseClient.js`), this means a shared
office computer, a new tab, or a new device all just work — every fresh tab
gets a fresh anonymous session, and any employee can freely (re-)claim their
name from it, with the DB link always representing the most recent
legitimate "Continue" click for that name.

## Setup (updated)

```bash
npm install
cp .env.example .env
```
Then in the Supabase SQL Editor, in order (if not already applied):
1. `phase2a_migration.sql`
2. `phase2b_migration.sql`
3. `phase2c_employee_authorization.sql` ← new
```bash
npm run dev
```

## Remaining limitations (updated)

The RLS-write gap from Phase 2C/2D is now closed for the flow this app
actually uses. What's left is the inherent one described above (no
credential distinguishes who is physically selecting a name) — not a bug,
a property of the deliberately passwordless design. If that residual gap
ever needs closing, it requires some form of real authentication, which was
explicitly ruled out for this phase.

## Project structure

```
src/
  lib/supabaseClient.js     Supabase client + anonymous preview session
  lib/leaveApi.js           Data fetching + applyLeave() + DB error → UI error mapping
  lib/dateWindow.js         3-month window calc (UI convenience; DB is authoritative)
  context/ActiveEmployeeContext.jsx   Name-switcher state
  hooks/useLeavePeriods.js  Fetch + Supabase Realtime subscription
  components/
    CalendarView.jsx        Month grid
    LeaveDrawer.jsx          "Apply Leave" side drawer
    LeaveDetailsPanel.jsx    Click-a-period detail view
    ConflictError.jsx        Renders the exact Phase 2B rejection (named conflicts, etc.)
    MyLeave.jsx              "My Leave" page
    Badges.jsx               Seat-group / Team / HOD tags (used throughout)
    NameSwitcher.jsx
    PreviewModeBanner.jsx
    EmptyState.jsx / Skeletons.jsx
  App.jsx                   Layout, tabs, filters, wiring
```

## Design notes

- Palette: deep navy primary, muted brass accent, restrained conflict-red /
  success-green — built for an internal corporate HR tool, not a consumer
  product. No gradients, minimal motion (drawer slide only).
- Every employee reference (calendar chip, leave details, My Leave) carries a
  small badge showing their physical seat group (e.g. `G3·BR`), team, or HOD
  status — so the seating/team structure from Phase 1 stays visible
  throughout the UI, not just in the database.
- Fonts: Manrope (headings), Inter (body), IBM Plex Mono (dates/codes).

## Manual test checklist (matches your Section 22)

1. Open the app → calendar loads with real `leave_periods` data (empty until
   real leave exists, or after you run/keep Phase 2B test data).
2. Switch names → "My Leave" tab reflects the selected employee.
3. Click **+ Apply Leave**, pick valid dates → submit → see the "not enabled
   yet" message (expected, see Preview mode above) rather than a crash.
4. Click an existing leave chip on the calendar → details panel opens with
   employee, period, dates, duration, and their seat/team badge.
5. Resize the browser to mobile width → calendar remains usable (smaller
   cells, chips still tappable, header wraps cleanly).
6. Filters (My Leave / My Team / All Employees) narrow what's shown on the
   calendar.
