import { createContext, useContext, useState, useEffect } from 'react'

const LEADS = ['kayden', 'harshita', 'yukti', 'nick', 'lily']

const UserContext = createContext(null)

export function UserProvider({ children }) {
  const [username, setUsername] = useState(() => {
    // Migrate from chat-username if scrum-username doesn't exist yet
    const saved = localStorage.getItem('scrum-username')
    if (saved) return saved
    const chatName = localStorage.getItem('chat-username')
    if (chatName) {
      localStorage.setItem('scrum-username', chatName)
      return chatName
    }
    return ''
  })

  const isLead = username
    ? LEADS.includes(username.toLowerCase())
    : false

  const login = (name) => {
    const trimmed = name.trim()
    if (!trimmed) return
    localStorage.setItem('scrum-username', trimmed)
    localStorage.setItem('chat-username', trimmed)
    setUsername(trimmed)
  }

  const logout = () => {
    localStorage.removeItem('scrum-username')
    localStorage.removeItem('chat-username')
    setUsername('')
  }

  return (
    <UserContext.Provider value={{ username, isLead, login, logout }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  const ctx = useContext(UserContext)
  if (!ctx) throw new Error('useUser must be used within a UserProvider')
  return ctx
}
