import { createContext, useContext, useMemo } from 'react'
import { useUser } from './UserContext'
import { usePresence } from '../hooks/usePresence'

// Shares live online/offline status app-wide off a single Supabase Realtime
// presence channel. Presence is keyed by display_name (that's what usePresence
// tracks), so isOnline() takes a person's display_name.
const PresenceContext = createContext({ onlineUsers: [], presenceState: {}, isOnline: () => false })

export function PresenceProvider({ children }) {
  const { username } = useUser()
  const { onlineUsers, presenceState } = usePresence(username)
  const value = useMemo(() => {
    const online = new Set((onlineUsers || []).map(u => u.username))
    return {
      onlineUsers,
      presenceState,
      isOnline: (name) => !!name && online.has(name),
    }
  }, [onlineUsers, presenceState])
  return <PresenceContext.Provider value={value}>{children}</PresenceContext.Provider>
}

export function usePresenceContext() {
  return useContext(PresenceContext)
}
