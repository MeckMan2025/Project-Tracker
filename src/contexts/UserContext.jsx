import { createContext, useContext, useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'

const UserContext = createContext(null)
const SESSION_MAX_AGE = 12 * 60 * 60 * 1000 // 12 hours

export function UserProvider({ children }) {
  const [roleChangeAlert, setRoleChangeAlert] = useState(null)
  const [username, setUsername] = useState('')
  const [isLead, setIsLead] = useState(false)
  const [role, setRole] = useState(() => localStorage.getItem('scrum-role') || 'member')
  const [secondaryRoles, setSecondaryRoles] = useState(() => {
    try {
      const cached = localStorage.getItem('scrum-secondary-roles')
      return cached ? JSON.parse(cached) : []
    } catch (e) { return [] }
  })
  const [authorityTier, setAuthorityTier] = useState(() => localStorage.getItem('scrum-authority-tier') || 'guest')
  const [isAuthorityAdmin, setIsAuthorityAdmin] = useState(() => localStorage.getItem('scrum-is-authority-admin') === 'true')
  const [primaryRoleLabel, setPrimaryRoleLabel] = useState(() => localStorage.getItem('scrum-primary-role-label') || '')
  const [functionTags, setFunctionTags] = useState(() => {
    try {
      const cached = localStorage.getItem('scrum-function-tags')
      return cached ? JSON.parse(cached) : []
    } catch (e) { return [] }
  })
  const [shortBio, setShortBio] = useState(() => localStorage.getItem('scrum-short-bio') || '')
  // Refs to track latest values for realtime listener (avoids stale closures)
  const functionTagsRef = useRef(functionTags)
  const authorityTierRef = useRef(authorityTier)
  useEffect(() => { functionTagsRef.current = functionTags }, [functionTags])
  useEffect(() => { authorityTierRef.current = authorityTier }, [authorityTier])
  const [nickname, setNickname] = useState(() => localStorage.getItem('scrum-nickname') || '')
  const [useNickname, setUseNickname] = useState(() => localStorage.getItem('scrum-use-nickname') === 'true')
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [passwordRecovery, setPasswordRecovery] = useState(false)
  const [mustChangePassword, setMustChangePassword] = useState(false)
  const [sessionExpired, setSessionExpired] = useState(false)

  const fetchProfile = async (userId) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
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

  const ADMIN_EMAILS = ['deshpandeyukti@pleasval.org', 'meckleykayden@pleasval.org']

  // email param avoids stale-closure issues when called from useEffect callbacks
  const applyProfile = (profile, email) => {
    if (profile) {
      const userEmail = (email || user?.email || '')?.toLowerCase()
      const isAdmin = userEmail && ADMIN_EMAILS.includes(userEmail)

      setUsername(profile.display_name)
      localStorage.setItem('scrum-cached-user-id', profile.id)
      setIsLead(profile.role === 'lead')
      const profileRole = profile.role || 'member'
      const profileSecondaryRoles = profile.secondary_roles || []
      setRole(profileRole)
      setSecondaryRoles(profileSecondaryRoles)
      setMustChangePassword(!!profile.must_change_password)
      // Authority fields
      let tier = profile.authority_tier || 'guest'
      let admin = !!profile.is_authority_admin
      if (isAdmin) {
        admin = true
        tier = 'teammate'
      }
      const roleLabel = profile.primary_role_label || ''
      let tags = profile.function_tags || []
      // Auto-grant Co-Founder tag — persist to DB if missing
      if (isAdmin && !tags.includes('Co-Founder')) {
        tags = [...tags, 'Co-Founder']
        supabase.from('profiles').update({ function_tags: tags }).eq('id', profile.id).then()
      }
      const bio = profile.short_bio || ''
      setAuthorityTier(tier)
      setIsAuthorityAdmin(admin)
      setPrimaryRoleLabel(roleLabel)
      setFunctionTags(tags)
      setShortBio(bio)
      const nick = profile.nickname || ''
      const useNick = !!profile.use_nickname
      setNickname(nick)
      setUseNickname(useNick)
      localStorage.setItem('scrum-username', profile.display_name)
      localStorage.setItem('chat-username', profile.display_name)
      localStorage.setItem('scrum-role', profileRole)
      localStorage.setItem('scrum-secondary-roles', JSON.stringify(profileSecondaryRoles))
      localStorage.setItem('scrum-authority-tier', tier)
      localStorage.setItem('scrum-is-authority-admin', String(admin))
      localStorage.setItem('scrum-primary-role-label', roleLabel)
      localStorage.setItem('scrum-function-tags', JSON.stringify(tags))
      localStorage.setItem('scrum-short-bio', bio)
      localStorage.setItem('scrum-nickname', nick)
      localStorage.setItem('scrum-use-nickname', String(useNick))
    }
  }

  const clearState = () => {
    setUser(null)
    setUsername('')
    setIsLead(false)
    setRole('member')
    setSecondaryRoles([])
    setAuthorityTier('guest')
    setIsAuthorityAdmin(false)
    setPrimaryRoleLabel('')
    setFunctionTags([])
    setShortBio('')
    setNickname('')
    setUseNickname(false)
    localStorage.removeItem('session-start')
    localStorage.removeItem('scrum-username')
    localStorage.removeItem('chat-username')
    localStorage.removeItem('scrum-role')
    localStorage.removeItem('scrum-secondary-roles')
    localStorage.removeItem('scrum-authority-tier')
    localStorage.removeItem('scrum-is-authority-admin')
    localStorage.removeItem('scrum-primary-role-label')
    localStorage.removeItem('scrum-function-tags')
    localStorage.removeItem('scrum-short-bio')
    localStorage.removeItem('scrum-nickname')
    localStorage.removeItem('scrum-use-nickname')
  }

  const isSessionExpired = () => {
    const start = localStorage.getItem('session-start')
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
          // Load cached profile keyed by user ID for instant render
          const cachedUserId = localStorage.getItem('scrum-cached-user-id')
          if (cachedUserId === session.user.id) {
            const cachedName = localStorage.getItem('scrum-username')
            if (cachedName) {
              setUsername(cachedName)
              const cachedTier = localStorage.getItem('scrum-authority-tier')
              if (cachedTier) setAuthorityTier(cachedTier)
              const cachedTags = localStorage.getItem('scrum-function-tags')
              if (cachedTags) { try { setFunctionTags(JSON.parse(cachedTags)) } catch (e) {} }
              const cachedRole = localStorage.getItem('scrum-role')
              if (cachedRole) { setRole(cachedRole); setIsLead(cachedRole === 'lead') }
              // Check for auto-admin emails (cached instant render)
              const userEmail = session.user.email?.toLowerCase() || ''
              if (userEmail && ADMIN_EMAILS.includes(userEmail)) {
                setIsAuthorityAdmin(true)
                setAuthorityTier('teammate')
                const currentTags = JSON.parse(localStorage.getItem('scrum-function-tags') || '[]')
                if (!currentTags.includes('Co-Founder')) {
                  const newTags = [...currentTags, 'Co-Founder']
                  setFunctionTags(newTags)
                  localStorage.setItem('scrum-function-tags', JSON.stringify(newTags))
                }
                localStorage.setItem('scrum-is-authority-admin', 'true')
                localStorage.setItem('scrum-authority-tier', 'teammate')
              }
              if (mounted) setLoading(false)
            }
          }
          // Always verify against DB
          const profile = await fetchProfile(session.user.id)
          if (mounted) {
            if (profile) {
              applyProfile(profile, session.user.email)
            } else if (!cachedUserId || cachedUserId !== session.user.id) {
              console.warn('[Auth] No profile found — forcing re-login')
              await expireSession()
              setLoading(false)
              return
            }
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
          const cachedUserId = localStorage.getItem('scrum-cached-user-id')
          const isSameUser = cachedUserId === session.user.id
          if (!isSameUser) {
            // Different user — clear stale cache from previous account
            localStorage.removeItem('scrum-cached-user-id')
            setAuthorityTier('guest')
            setFunctionTags([])
            setUsername('')
          }
          localStorage.setItem('session-start', Date.now().toString())
          setSessionExpired(false)
          setUser(session.user)
          // Auto-grant admin for specific emails
          const userEmail = session.user.email?.toLowerCase() || ''
          if (userEmail && ADMIN_EMAILS.includes(userEmail)) {
            setIsAuthorityAdmin(true)
            setAuthorityTier('teammate')
            const currentTags = JSON.parse(localStorage.getItem('scrum-function-tags') || '[]')
            if (!currentTags.includes('Co-Founder')) {
              const newTags = [...currentTags, 'Co-Founder']
              setFunctionTags(newTags)
              localStorage.setItem('scrum-function-tags', JSON.stringify(newTags))
            }
            localStorage.setItem('scrum-is-authority-admin', 'true')
            localStorage.setItem('scrum-authority-tier', 'teammate')
          }
          const profile = await fetchProfile(session.user.id)
          if (mounted) {
            if (profile) {
              applyProfile(profile, session.user.email)
            } else {
              console.error('[Auth] No profile found for user:', session.user.id)
            }
          }
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
      if (localStorage.getItem('session-start') && isSessionExpired()) {
        expireSession()
      }
    }, 60 * 1000)

    // Detect stale session on tab/laptop wake + re-fetch profile for permission changes
    const handleVisibility = async () => {
      if (document.visibilityState !== 'visible') return
      if (localStorage.getItem('session-start') && isSessionExpired()) {
        expireSession()
        return
      }
      // Verify session is still valid with Supabase
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session && localStorage.getItem('session-start')) {
          expireSession()
        } else if (session?.user && mounted) {
          // Re-fetch profile to pick up any tier/role changes made by leads
          const profile = await fetchProfile(session.user.id)
          if (mounted && profile) applyProfile(profile, session.user.email)
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

  // Realtime subscription on own profile — picks up tier/role changes made by leads
  // Only listens for function_tags and authority_tier columns to avoid heartbeat noise
  useEffect(() => {
    if (!user) return
    // Poll every 30s instead of realtime to avoid heartbeat conflicts
    const checkForRoleChanges = async () => {
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
        const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
        const headers = { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
        const res = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${user.id}&select=function_tags,authority_tier`, { headers })
        if (!res.ok) return
        const [profile] = await res.json()
        if (!profile) return
        const currentTags = functionTagsRef.current || []
        const currentTier = authorityTierRef.current
        const newTags = profile.function_tags || []
        const newTier = profile.authority_tier
        const tagsChanged = JSON.stringify(newTags) !== JSON.stringify(currentTags)
        const tierChanged = newTier && newTier !== currentTier
        if (!tagsChanged && !tierChanged) return
        const addedRoles = newTags.filter(t => !currentTags.includes(t))
        const removedRoles = currentTags.filter(t => !newTags.includes(t) && t !== 'Co-Founder')
        if (addedRoles.length > 0) {
          setRoleChangeAlert({ type: 'added', roles: addedRoles })
        } else if (removedRoles.length > 0) {
          setRoleChangeAlert({ type: 'removed', roles: removedRoles })
        } else if (tierChanged) {
          setRoleChangeAlert({ type: 'tier', tier: newTier })
        }
        // Update refs so we don't alert again
        functionTagsRef.current = newTags
        authorityTierRef.current = newTier
      } catch {}
    }
    const interval = setInterval(checkForRoleChanges, 30000)
    return () => clearInterval(interval)
  }, [user?.id])

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
      const PERM_COFOUNDERS = ['yukti', 'kayden']
      const isPermCofounder = PERM_COFOUNDERS.some(n => displayName.toLowerCase().includes(n))
      const { error: profileError } = await supabase.from('profiles').insert({
        id: data.user.id,
        display_name: displayName,
        role: role,
        authority_tier: isPermCofounder ? 'teammate' : 'guest',
        function_tags: isPermCofounder ? ['Co-Founder'] : [],
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
    // signOut() can hang if the Supabase auth lock is stuck (e.g. after hard refresh).
    // Give it 3 seconds max, then proceed with local cleanup regardless.
    try {
      await Promise.race([
        supabase.auth.signOut(),
        new Promise(resolve => setTimeout(resolve, 500))
      ])
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
      value={{ username, nickname, useNickname, chatName: (useNickname && nickname) ? nickname : username, isLead, role, secondaryRoles, authorityTier, isAuthorityAdmin, primaryRoleLabel, functionTags, shortBio, user, loading, login, signup, logout, checkWhitelist, resetPassword, updatePassword, passwordRecovery, mustChangePassword, sessionExpired, roleChangeAlert, dismissRoleChangeAlert: () => setRoleChangeAlert(null) }}
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
