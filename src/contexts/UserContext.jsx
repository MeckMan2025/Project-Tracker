import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../supabase'

const UserContext = createContext(null)

export function UserProvider({ children }) {
  const [username, setUsername] = useState('')
  const [isLead, setIsLead] = useState(false)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = async (userId) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('display_name, role')
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
      localStorage.setItem('scrum-username', profile.display_name)
      localStorage.setItem('chat-username', profile.display_name)
    }
  }

  const clearState = () => {
    setUser(null)
    setUsername('')
    setIsLead(false)
    localStorage.removeItem('scrum-username')
    localStorage.removeItem('chat-username')
  }

  // Restore session on mount
  useEffect(() => {
    let mounted = true

    async function init() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!mounted) return
        if (session?.user) {
          setUser(session.user)
          const profile = await fetchProfile(session.user.id)
          if (mounted) applyProfile(profile)
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
        if (event === 'SIGNED_IN' && session?.user) {
          setUser(session.user)
          const profile = await fetchProfile(session.user.id)
          if (mounted) applyProfile(profile)
        } else if (event === 'SIGNED_OUT') {
          clearState()
        }
      }
    )

    // Safety fallback — never stay on loading screen forever
    const timeout = setTimeout(() => {
      if (mounted) setLoading(false)
    }, 5000)

    return () => {
      mounted = false
      subscription.unsubscribe()
      clearTimeout(timeout)
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
      value={{ username, isLead, user, loading, login, signup, logout, checkWhitelist, resetPassword }}
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
