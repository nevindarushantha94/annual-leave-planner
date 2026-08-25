import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // eslint-disable-next-line no-console
  console.error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and fill them in.'
  )
}

// ----------------------------------------------------------------------------
// AUTH SESSION STORAGE: sessionStorage, not the client default (localStorage)
// ----------------------------------------------------------------------------
// This makes the underlying Supabase auth session (and therefore the
// employee identity claimed against it — see leaveApi.js /
// claim_employee_identity) scoped to this browser tab, matching the
// product's own requirement that a selected employee is "remembered for the
// browser session" and forgotten when it ends. It also avoids a real
// operational problem: if the auth session persisted in localStorage
// (surviving tab closes and new tabs on the same machine), the FIRST person
// to use a shared office computer would permanently occupy that browser's
// identity slot for anyone using it afterward. A fresh tab now always gets a
// fresh anonymous session, so the next person can freely select their own
// name — see the SQL migration's comments on why claims are re-claimable
// rather than permanent, which is what makes this safe.
// ----------------------------------------------------------------------------
const sessionStorageAdapter = {
  getItem: (key) => window.sessionStorage.getItem(key),
  setItem: (key, value) => window.sessionStorage.setItem(key, value),
  removeItem: (key) => window.sessionStorage.removeItem(key),
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: sessionStorageAdapter,
    persistSession: true,
    autoRefreshToken: true,
  },
})

// ----------------------------------------------------------------------------
// SESSION BOOTSTRAP
// ----------------------------------------------------------------------------
// Existing RLS policies only grant access to the `authenticated` role — not
// `anon` — so without *some* session, even SELECT queries are rejected.
// Supabase anonymous sign-in gives the browser a real `authenticated` JWT
// with no password. Reads work immediately and identically for everyone.
//
// Writes to leave_periods are gated by a SEPARATE, additional step: the
// selected employee must be explicitly linked to this session via the
// claim_employee_identity() database function (see leaveApi.js). Simply
// having an anonymous session is not enough to write leave for anyone —
// that link is what actually authorizes a write, and only the database
// controls it.
// ----------------------------------------------------------------------------

let sessionPromise = null

export function ensureSession() {
  if (sessionPromise) return sessionPromise

  sessionPromise = (async () => {
    const { data: existing } = await supabase.auth.getSession()
    if (existing?.session) return existing.session

    const { data, error } = await supabase.auth.signInAnonymously()
    if (error) {
      console.error('Session bootstrap failed:', error.message)
      throw error
    }
    return data.session
  })()

  return sessionPromise
}
