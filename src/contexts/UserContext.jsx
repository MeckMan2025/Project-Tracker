import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../supabase'

const UserContext = createContext(null)
const SESSION_MAX_AGE = 12 * 60 * 60 * 1000 // 12 hours

export function UserProvider({ children }) {
  const [username, setUsername] = useState('')
  const [isLead, setIsLead] = useState(false)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [passwordRecovery, setPasswordRecovery] = useState(false)
  const [mustChangePassword, setMustChangePassword] = useState(false)
  const [sessionExpired, setSessionExpired] = useState(false)

  const fetchProfile = async (userId) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('display_name, role, must_change_password')
      .eq('id', userId)
      .single()

    if (error) {
      console.error('Failed to fetch profile:', error.message)
      return null
    }
    return data
  }

  const checkWhitelist = async (email) => {
    const { data, error } = await supabase
      .from('approved_emails')
      .select('email, role')
      .eq('email', email.toLowerCase().trim())
      .single()

    if (error || !data) return null
    return data
  }

  const applyProfile = (profile) => {
    if (profile) {
      setUsername(profile.display_name)
      setIsLead(profile.role === 'lead')
      setMustChangePassword(!!profile.must_change_password)
      localStorage.setItem('scrum-username', profile.display_name)
      localStorage.setItem('chat-username', profile.display_name)
    }
  }

  const clearState = () => {
    setUser(null)
    setUsername('')
    setIsLead(false)
    sessionStorage.removeItem('session-start')
    localStorage.removeItem('scrum-username')
    localStorage.removeItem('chat-username')
  }

  const isSessionExpired = () => {
    const start = sessionStorage.getItem('session-start')
    if (!start) return true
    return Date.now() - parseInt(start, 10) > SESSION_MAX_AGE
  }

  const expireSession = async () => {
    setSessionExpired(true)
    try { await supabase.auth.signOut() } catch (e) { /* ignore */ }
    clearState()
    localStorage.clear()
    sessionStorage.clear()
  }

  // Restore session on mount
  useEffect(() => {
    let mounted = true

    // If we have cached credentials, unblock the app immediately
    // Supabase session check + profile fetch happen in the background
    const cachedName = localStorage.getItem('scrum-username')
    const cachedRole = localStorage.getItem('scrum-role')
    if (cachedName && sessionStorage.getItem('session-start') && !isSessionExpired()) {
      setUsername(cachedName)
      setIsLead(cachedRole === 'lead')
      setLoading(false)
    }

    async function init() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!mounted) return
        if (session?.user) {
          if (isSessionExpired()) {
            await expireSession()
            if (mounted) setLoading(false)
            return
          }
          setUser(session.user)
          const profile = await fetchProfile(session.user.id)
          if (mounted) {
            applyProfile(profile)
            if (profile) localStorage.setItem('scrum-role', profile.role)
            setLoading(false)
          }
          return
        }
      } catch (err) {
        console.error('Failed to restore session:', err)
      }
      if (mounted) setLoading(false)
    }

    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return
        if (event === 'PASSWORD_RECOVERY') {
          setPasswordRecovery(true)
          if (session?.user) setUser(session.user)
        } else if (event === 'SIGNED_IN' && session?.user) {
          sessionStorage.setItem('session-start', Date.now().toString())
          setSessionExpired(false)
          setUser(session.user)
          const profile = await fetchProfile(session.user.id)
          if (mounted) applyProfile(profile)
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          // Keep user state fresh when token auto-refreshes (e.g. after page idle/refresh)
          setUser(session.user)
        } else if (event === 'SIGNED_OUT') {
          clearState()
        }
      }
    )

    // Periodic 12-hour check (every 60 seconds)
    const interval = setInterval(() => {
      if (sessionStorage.getItem('session-start') && isSessionExpired()) {
        expireSession()
      }
    }, 60 * 1000)

    // Detect stale session on tab/laptop wake
    const handleVisibility = async () => {
      if (document.visibilityState !== 'visible') return
      if (sessionStorage.getItem('session-start') && isSessionExpired()) {
        expireSession()
        return
      }
      // Verify session is still valid with Supabase
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session && sessionStorage.getItem('session-start')) {
          expireSession()
        }
      } catch (e) {
        // ignore network errors on wake
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    // Safety fallback — never stay on loading screen forever
    const timeout = setTimeout(() => {
      if (mounted) setLoading(false)
    }, 2000)

    return () => {
      mounted = false
      subscription.unsubscribe()
      clearTimeout(timeout)
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) throw error
    return data
  }

  const signup = async (email, password, displayName, role = 'member') => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })
    if (error) throw error

    // Create profile row
    if (data.user) {
      const { error: profileError } = await supabase.from('profiles').insert({
        id: data.user.id,
        display_name: displayName,
        role: role,
      })
      if (profileError) {
        console.error('Failed to create profile:', profileError.message)
      }
    }
    return data
  }

  const resetPassword = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    })
    if (error) throw error
  }

  const updatePassword = async (newPassword) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) throw error
    // Clear forced password change flag
    if (user) {
      await supabase.from('profiles').update({ must_change_password: false }).eq('id', user.id)
    }
    setMustChangePassword(false)
    setPasswordRecovery(false)
  }

  const logout = async () => {
    try {
      await supabase.auth.signOut()
    } catch (e) {
      // sign out even if supabase call fails
    }
    clearState()
    localStorage.clear()
    sessionStorage.clear()
    window.location.replace(window.location.origin)
  }

  return (
    <UserContext.Provider
      value={{ username, isLead, user, loading, login, signup, logout, checkWhitelist, resetPassword, updatePassword, passwordRecovery, mustChangePassword, sessionExpired }}
    >
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  const ctx = useContext(UserContext)
  if (!ctx) throw new Error('useUser must be used within a UserProvider')
  return ctx
}
