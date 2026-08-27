import { createContext, useContext, useMemo, useState, useEffect } from 'react'
import { useUser } from './UserContext'
import { usePresence } from '../hooks/usePresence'

// Shares live online/offline status app-wide. Two signals, combined:
//   1. Supabase Realtime presence (instant, but a websocket can drop/lag).
//   2. The last_seen_at heartbeat App.jsx writes every 10s for every logged-in
//      user — reliable, and the same signal attendance uses.
// A person counts as online if either says so. isOnline() takes a display_name.
const PresenceContext = createContext({ onlineUsers: [], presenceState: {}, isOnline: () => false })

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY
const headers = { apikey: key, Authorization: `Bearer ${key}` }
// Heartbeat is every 10s; allow a couple of missed beats before going red.
const ONLINE_WINDOW_MS = 45 * 1000

export function PresenceProvider({ children }) {
  const { username } = useUser()
  const { onlineUsers, presenceState } = usePresence(username)
  const [lastSeen, setLastSeen] = useState({}) // { display_name: epochMs }

  // Poll heartbeats so a dot turns green within ~10s of someone coming online,
  // even if the realtime websocket didn't catch it.
  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const res = await fetch(`${url}/rest/v1/profiles?select=display_name,last_seen_at`, { headers })
        if (!alive || !res.ok) return
        const rows = await res.json()
        const map = {}
        for (const r of rows) {
          if (r.display_name && r.last_seen_at) map[r.display_name] = new Date(r.last_seen_at).getTime()
        }
        if (alive) setLastSeen(map) // new object every tick so dots re-evaluate (and age out)
      } catch { /* ignore */ }
    }
    load()
    const t = setInterval(load, 10000)
    return () => { alive = false; clearInterval(t) }
  }, [])

  const value = useMemo(() => {
    const wsOnline = new Set((onlineUsers || []).map(u => u.username))
    const isOnline = (name) => {
      if (!name) return false
      if (wsOnline.has(name)) return true
      const ts = lastSeen[name]
      return !!ts && (Date.now() - ts) < ONLINE_WINDOW_MS
    }
    return { onlineUsers, presenceState, isOnline }
  }, [onlineUsers, presenceState, lastSeen])

  return <PresenceContext.Provider value={value}>{children}</PresenceContext.Provider>
}

export function usePresenceContext() {
  return useContext(PresenceContext)
}
