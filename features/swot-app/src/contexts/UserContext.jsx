// LOCAL DEV STAND-IN for the main app's src/contexts/UserContext.jsx.
// Exposes the same useUser() fields SwotView reads, backed by a simple
// name + role picker instead of real accounts. Do not merge this file.
import { createContext, useContext, useState, useCallback } from 'react'

const STORAGE_KEY = 'swot-dev-user'

// Function tags that give each test role the same permissions as a real account.
export const DEV_ROLES = {
  lead: { label: 'Lead', functionTags: ['Project Manager'] },
  teammate: { label: 'Teammate', functionTags: ['Programming'] },
  guest: { label: 'Guest', functionTags: [] },
}

const loadSession = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
    return saved?.username && DEV_ROLES[saved.devRole] ? saved : null
  } catch {
    return null
  }
}

const UserContext = createContext(null)

export function UserProvider({ children }) {
  const [session, setSession] = useState(loadSession)

  const login = useCallback((username, devRole) => {
    const next = { username, devRole }
    setSession(next)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* private mode */ }
  }, [])

  const logout = useCallback(() => {
    setSession(null)
    try { localStorage.removeItem(STORAGE_KEY) } catch { /* private mode */ }
  }, [])

  const value = {
    username: session?.username || null,
    user: session ? { id: session.username } : null,
    functionTags: session ? DEV_ROLES[session.devRole].functionTags : [],
    devRole: session?.devRole || null,
    login,
    logout,
  }

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>
}

export function useUser() {
  const ctx = useContext(UserContext)
  if (!ctx) throw new Error('useUser must be used within a UserProvider')
  return ctx
}
