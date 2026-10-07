// The headers every REST call sends, in one place.
//
// For most of this app's life every request went out with the anon key as its
// bearer token. That key is published in the JavaScript bundle, so each of
// those requests arrived as "some anonymous visitor" and the database had no
// way to tell one signed-in person from another — or from a stranger who read
// the key out of the page source. It worked because Row Level Security was off
// on 41 of 43 tables, which is the same thing as saying anyone who found the
// URL could read, change or delete everything.
//
// Policies are written against auth.uid(), and auth.uid() is null unless the
// request carries the signed-in user's own token. So sending that token is the
// prerequisite for turning RLS on at all: without it every policy worth having
// would deny every request and the app would go dark.
//
// Sending it changes nothing on its own. Until the policies exist, these calls
// are authorised exactly as before — this is the groundwork, not the fix.

const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const projectRef = (import.meta.env.VITE_SUPABASE_URL || '')
  .split('//')[1]?.split('.')[0] || ''
const STORAGE_KEY = `sb-${projectRef}-auth-token`

// supabase-js keeps the session in localStorage and refreshes it in the
// background. Reading it directly keeps this function synchronous, which
// matters: a third of the call sites build their headers as a module-level
// constant or inside a render, where awaiting anything is not an option.
//
// Returns null rather than a stale token. A caller with no session still gets
// the anon key, so sign-in and the password-reset screens keep working.
function cachedAccessToken() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const session = JSON.parse(raw)
    const token = session?.access_token
    if (!token) return null
    // A token within ten seconds of expiry is treated as gone: better to send
    // the anon key and be refused by a policy than to send something the API
    // will reject outright.
    const expiresAt = (session?.expires_at || 0) * 1000
    if (expiresAt && Date.now() >= expiresAt - 10000) return null
    return token
  } catch {
    // Private browsing, cleared storage, a corrupt value. Fall back.
    return null
  }
}

// apikey always identifies the project; Authorization identifies the caller.
// They are different questions and PostgREST wants both.
export function restHeaders(extra) {
  const token = cachedAccessToken()
  return {
    apikey: anonKey,
    Authorization: `Bearer ${token || anonKey}`,
    ...(extra || {}),
  }
}

// Same thing for a JSON body, since nearly every write wants this exact pair.
export function jsonHeaders(extra) {
  return restHeaders({ 'Content-Type': 'application/json', ...(extra || {}) })
}

// Whether this request will carry a real identity. Useful for deciding whether
// a call is worth making at all once policies are in place.
export function hasUserToken() {
  return !!cachedAccessToken()
}

// A drop-in replacement for the module-level header constants.
//
// Those are built once, when the module is imported — which happens before
// anybody has signed in, so a constant can only ever hold the anon key. The
// obvious fix is to delete each constant and call restHeaders() at every use,
// but that means rewriting a hundred call sites and deleting identifiers other
// constants are derived from, which is how you break a working app.
//
// This reads the token at the moment the property is read instead. fetch()
// copies the header values when it builds the request, and spreading copies
// them where it appears, so both arrive with whatever token is current then.
// Swapping a constant's value for this needs no other change to the file.
export const lazyRestHeaders = new Proxy({}, {
  get(_target, prop) {
    const h = restHeaders()
    return Object.prototype.hasOwnProperty.call(h, prop) ? h[prop] : undefined
  },
  // Spread and Object.keys() ask these two, and a Proxy over {} would
  // otherwise report no keys at all and copy nothing.
  ownKeys() {
    return ['apikey', 'Authorization']
  },
  getOwnPropertyDescriptor() {
    return { enumerable: true, configurable: true }
  },
  has(_target, prop) {
    return prop === 'apikey' || prop === 'Authorization'
  },
})

// The same thing for the derived constants — the ones written as
// `{ ...HEADERS, 'Content-Type': 'application/json' }` at module level.
//
// Spreading happens where it is written, so those capture the anon key as the
// module loads however lazy the thing being spread is. They have to be lazy
// themselves, not merely built from something lazy.
export function lazyHeadersWith(extra) {
  const fixed = extra || {}
  return new Proxy({}, {
    get(_target, prop) {
      const h = restHeaders(fixed)
      return Object.prototype.hasOwnProperty.call(h, prop) ? h[prop] : undefined
    },
    ownKeys() {
      return ['apikey', 'Authorization', ...Object.keys(fixed)]
    },
    getOwnPropertyDescriptor() {
      return { enumerable: true, configurable: true }
    },
    has(_target, prop) {
      return prop === 'apikey' || prop === 'Authorization'
        || Object.prototype.hasOwnProperty.call(fixed, prop)
    },
  })
}
