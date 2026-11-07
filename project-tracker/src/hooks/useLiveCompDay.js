import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { restHeaders, ensureUserToken } from '../lib/restHeaders'

// The Competition Day that is live right now, or null.
//
// One answer for the whole app: when a lead presses Go Live, everyone's app
// learns it here, within a moment over realtime and within half a minute by
// the safety-net poll, and switches to that day's scouting screen. When it
// is paused or ended the answer goes back to null and the app lets go.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL

// Fired on this window after a day is hosted, paused or ended.
export const LIVE_CHANGED = 'comp-day-live-changed'
export const announceLiveChange = () => window.dispatchEvent(new Event(LIVE_CHANGED))

// The last live day this phone saw, per team, so the app opens straight into
// Competition Day instead of showing Home for a second while it asks.
// Kept per signed-in person as well as per team, so a phone shared between
// two people (or two teams) never opens on somebody else's day.
const signedInId = () => {
  try {
    const k = Object.keys(localStorage).find(x => /^sb-.*-auth-token$/.test(x))
    return k ? (JSON.parse(localStorage.getItem(k))?.user?.id || '') : ''
  } catch { return '' }
}
const CACHE = (scope) => `live-comp-day:${signedInId()}:${scope || ''}`
const readCache = (scope) => {
  if (!signedInId()) return null
  try { return JSON.parse(localStorage.getItem(CACHE(scope)) || 'null') } catch { return null }
}
const writeCache = (scope, day) => { try { if (!signedInId()) return; day ? localStorage.setItem(CACHE(scope), JSON.stringify(day)) : localStorage.removeItem(CACHE(scope)) } catch { /* ignore */ } }

export function useLiveCompDay(scope) {
  const [live, setLive] = useState(() => readCache(scope))

  useEffect(() => {
    let cancelled = false
    // A live day must not flicker. Every flip from "a day" to "no day" and
    // back is an activation, and an activation sends every screen to Home —
    // which is how people kept being pulled off a half-filled scouting form.
    // So: no identity, no verdict (the public key always sees no day); one
    // empty answer is noted, not believed; a second in a row ends the day.
    // A press of Pause on this device (force) is believed at once.
    let misses = 0
    // A day remembered from last time is only a guess: the first real answer
    // that says "no day" is believed at once, so a day that ended while the
    // app was closed lets go straight away rather than after two polls.
    const cached = readCache(scope)
    let fromCache = !!cached
    // The team (scope) can settle after the first render: pick up that
    // team's remembered day, and never keep another team's.
    if (cached) setLive(prev => (prev && prev.id === cached.id ? prev : cached))
    const check = async (force) => {
      if (force !== true && document.visibilityState !== 'visible') return
      try {
        const authed = await ensureUserToken()
        if (!authed) return
        const res = await fetch(
          `${supabaseUrl}/rest/v1/comp_day_sessions?${scope}&is_active=eq.true&order=created_at.desc&limit=1&select=id,name,session_date,created_at`,
          { headers: restHeaders() }
        )
        if (!res.ok || cancelled) return
        const rows = await res.json()
        const found = Array.isArray(rows) && rows[0] ? rows[0] : null
        if (cancelled) return
        if (found) {
          misses = 0
          fromCache = false
          writeCache(scope, found)
          // Same day, same object: no re-render for a poll that changed nothing.
          setLive(prev => (prev && prev.id === found.id && prev.name === found.name && prev.session_date === found.session_date && prev.created_at === found.created_at) ? prev : found)
        } else if (force === true || fromCache || ++misses >= 2) {
          misses = 0
          fromCache = false
          writeCache(scope, null)
          setLive(null)
        }
      } catch { /* keep what we had; the next check corrects it */ }
    }
    check()
    const interval = setInterval(check, 30000)
    document.addEventListener('visibilitychange', check)
    // The screen that pressed Go Live or Pause says so at once, so this app
    // moves straight away rather than waiting on realtime or the poll.
    const nudge = () => check(true)
    window.addEventListener(LIVE_CHANGED, nudge)
    const channel = supabase
      .channel('live-comp-day')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comp_day_sessions' }, check)
      .subscribe()
    return () => {
      cancelled = true
      clearInterval(interval)
      document.removeEventListener('visibilitychange', check)
      window.removeEventListener(LIVE_CHANGED, nudge)
      supabase.removeChannel(channel)
    }
  }, [scope])

  return live
}
