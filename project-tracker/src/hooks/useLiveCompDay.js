import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { restHeaders } from '../lib/restHeaders'

// The Competition Day that is live right now, or null.
//
// One answer for the whole app: when a lead presses Go Live, everyone's app
// learns it here, within a moment over realtime and within half a minute by
// the safety-net poll, and switches to that day's scouting screen. When it
// is paused or ended the answer goes back to null and the app lets go.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL

export function useLiveCompDay(scope) {
  const [live, setLive] = useState(null)

  useEffect(() => {
    let cancelled = false
    const check = async () => {
      if (document.visibilityState !== 'visible') return
      try {
        const res = await fetch(
          `${supabaseUrl}/rest/v1/comp_day_sessions?${scope}&is_active=eq.true&order=created_at.desc&limit=1&select=id,name,session_date`,
          { headers: restHeaders() }
        )
        if (!res.ok) return
        const rows = await res.json()
        if (!cancelled) setLive(Array.isArray(rows) && rows[0] ? rows[0] : null)
      } catch { /* keep what we had; the next check corrects it */ }
    }
    check()
    const interval = setInterval(check, 30000)
    document.addEventListener('visibilitychange', check)
    const channel = supabase
      .channel('live-comp-day')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comp_day_sessions' }, check)
      .subscribe()
    return () => {
      cancelled = true
      clearInterval(interval)
      document.removeEventListener('visibilitychange', check)
      supabase.removeChannel(channel)
    }
  }, [scope])

  return live
}
