import { createContext, useContext, useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'

const UserContext = createContext(null)
const SESSION_MAX_AGE = 30 * 24 * 60 * 60 * 1000 // 30 days

export function UserProvider({ children }) {
  const [roleChangeAlert, setRoleChangeAlert] = useState(null) // kept for context API compat
  // Diagnostic for the role-sync problem: what the last profile read did.
  const [profileSync, setProfileSync] = useState({ at: null, source: 'none', error: '' })
  const pollProfileRef = useRef(null)
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
  const [nickname, setNickname] = useState(() => localStorage.getItem('scrum-nickname') || '')
  const [useNickname, setUseNickname] = useState(() => localStorage.getItem('scrum-use-nickname') === 'true')
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [passwordRecovery, setPasswordRecovery] = useState(false)
  const [mustChangePassword, setMustChangePassword] = useState(false)
  const [sessionExpired, setSessionExpired] = useState(false)
  const [isTeam, setIsTeam] = useState(() => localStorage.getItem('scrum-is-team') === 'true')
  const [teamNumber, setTeamNumber] = useState(() => localStorage.getItem('scrum-team-number') || '')

  // Auth account exists but its profile row is gone (deleted members were
  // removed from `profiles` while their auth user survived). Rebuild the
  // profile from the email so the person can get back in instead of being
  // bounced out forever.
  const ensureProfile = async (authUser) => {
    if (!authUser?.id) return null
    const email = (authUser.email || '').toLowerCase()
    // Name from the whitelist's shape (lastfirst@school) — a lead can rename.
    const local = email.split('@')[0].replace(/[._0-9]+/g, ' ').trim()
    const guess = local ? local.charAt(0).toUpperCase() + local.slice(1) : email
    // Roles a lead pre-assigned to this address, if any.
    let tags = []
    try {
      const wl = await supabase.from('approved_emails').select('role').eq('email', email).single()
      tags = String(wl?.data?.role || '')
        .split(',').map(r => r.trim()).filter(r => r && r.toLowerCase() !== 'member')
    } catch { /* ignore */ }
    const row = {
      id: authUser.id,
      display_name: guess,
      role: 'member',
      authority_tier: tags.length > 0 ? 'teammate' : 'guest',
      function_tags: tags,
    }
    const { error } = await supabase.from('profiles').insert(row)
    if (error) { console.error('Could not rebuild profile:', error.message); return null }
    console.warn('[Auth] Rebuilt a missing profile for', email)
    return row
  }

  const fetchProfile = async (userId) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (!error) {
      setProfileSync({ at: Date.now(), source: 'client', error: '' })
      return data
    }
    console.error('Failed to fetch profile via client:', error.message)

    // Fall back to the anon REST endpoint, which is how the rest of the app
    // reads. The client call runs as the authenticated role; if that read is
    // blocked the profile never loads, and roles silently never update.
    try {
      const url = import.meta.env.VITE_SUPABASE_URL
      const key = import.meta.env.VITE_SUPABASE_ANON_KEY
      const res = await fetch(`${url}/rest/v1/profiles?id=eq.${userId}&select=*`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      })
      if (!res.ok) {
        setProfileSync({ at: Date.now(), source: 'failed', error: `client: ${error.message} | rest: ${res.status}` })
        return null
      }
      const rows = await res.json()
      const row = Array.isArray(rows) && rows[0] ? rows[0] : null
      setProfileSync({
        at: Date.now(),
        source: row ? 'rest' : 'failed',
        error: row ? `client failed: ${error.message}` : `client: ${error.message} | rest: no row`,
      })
      return row
    } catch (e) {
      setProfileSync({ at: Date.now(), source: 'failed', error: `client: ${error.message} | rest threw: ${e.message}` })
      console.error('Profile REST fallback failed:', e)
      return null
    }
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

  const TEAM_EMAIL_REGEX = /^team(\d+)@teams\.radical$/

  // email param avoids stale-closure issues when called from useEffect callbacks
  const applyProfile = (profile, email) => {
    if (profile) {
      const userEmail = (email || user?.email || '')?.toLowerCase()
      const isAdmin = userEmail && ADMIN_EMAILS.includes(userEmail)

      // Detect team accounts by email pattern
      const teamMatch = userEmail && userEmail.match(TEAM_EMAIL_REGEX)
      const isTeamAccount = !!teamMatch
      const teamNum = teamMatch ? teamMatch[1] : ''
      setIsTeam(isTeamAccount)
      setTeamNumber(teamNum)
      localStorage.setItem('scrum-is-team', String(isTeamAccount))
      localStorage.setItem('scrum-team-number', teamNum)

      setUsername(profile.display_name)
      localStorage.setItem('scrum-cached-user-id', profile.id)
      setIsLead(profile.role === 'lead')
      const profileRole = profile.role || 'member'
      const profileSecondaryRoles = profile.secondary_roles || []
      setRole(profileRole)
      setSecondaryRoles(profileSecondaryRoles)
      setMustChangePassword(!!profile.must_change_password && !teamMatch)
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
    setIsTeam(false)
    setTeamNumber('')
    localStorage.removeItem('scrum-is-team')
    localStorage.removeItem('scrum-team-number')
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
          localStorage.setItem('scrum-user-email', session.user.email || '')
          // A valid session with no session-start just means the bookkeeping key
          // was lost (it's only written on SIGNED_IN). Treat now as the start
          // rather than expiring — otherwise isSessionExpired() returns true and
          // logs the user out on every visit.
          if (!localStorage.getItem('session-start')) {
            localStorage.setItem('session-start', Date.now().toString())
          }
          if (isSessionExpired()) {
            await expireSession()
            if (mounted) setLoading(false)
            return
          }
          setUser(session.user)
          // Immediately detect team account from email — must happen before any setLoading(false)
          const userEmail = session.user.email?.toLowerCase() || ''
          const teamMatch = userEmail.match(TEAM_EMAIL_REGEX)
          if (teamMatch) {
            setIsTeam(true)
            setTeamNumber(teamMatch[1])
            localStorage.setItem('scrum-is-team', 'true')
            localStorage.setItem('scrum-team-number', teamMatch[1])
          }
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
            } else if (await ensureProfile(session.user)) {
              const rebuilt = await fetchProfile(session.user.id)
              if (rebuilt) applyProfile(rebuilt, session.user.email)
            } else if (!cachedUserId || cachedUserId !== session.user.id) {
              console.warn('[Auth] No profile found — forcing re-login')
              await expireSession()
              setLoading(false)
              return
            } else {
              // Profile unreadable but the cache matches this user. Previously we
              // fell through and kept the cached roles, so a stale function_tags
              // could grant access forever. Fail closed instead: no roles until
              // the DB actually answers.
              console.warn('[Auth] Profile unreadable — dropping cached roles')
              setFunctionTags([])
              setAuthorityTier('guest')
              setIsAuthorityAdmin(false)
              localStorage.setItem('scrum-function-tags', '[]')
              localStorage.setItem('scrum-authority-tier', 'guest')
            }
            setupRealtimeSub(session.user.id)
            setupRoleNotifSub(session.user.id)
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
          localStorage.setItem('scrum-user-email', session.user.email || '')
          // Immediately detect team account from email
          const userEmail = session.user.email?.toLowerCase() || ''
          const signInTeamMatch = userEmail.match(TEAM_EMAIL_REGEX)
          if (signInTeamMatch) {
            setIsTeam(true)
            setTeamNumber(signInTeamMatch[1])
            localStorage.setItem('scrum-is-team', 'true')
            localStorage.setItem('scrum-team-number', signInTeamMatch[1])
          }
          // Auto-grant admin for specific emails
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
          let profile = await fetchProfile(session.user.id)
          if (!profile) {
            // Their account outlived its profile — rebuild rather than dead-end.
            await ensureProfile(session.user)
            profile = await fetchProfile(session.user.id)
          }
          if (mounted) {
            if (profile) {
              applyProfile(profile, session.user.email)
            } else {
              console.error('[Auth] No profile found for user:', session.user.id)
            }
            setupRealtimeSub(session.user.id)
            setupRoleNotifSub(session.user.id)
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

    // Poll the profile so a role change lands within ~15s even when realtime
    // isn't delivering. Realtime and the focus refresh are still the fast paths;
    // this is the floor that makes access changes actually take effect.
    // Only re-applies when something access-related moved, so it doesn't
    // re-render or rewrite localStorage on every tick.
    let lastAccessKey = null
    const pollProfile = async () => {
      if (!mounted || document.visibilityState !== 'visible') return
      try {
        // Deliberately avoids supabase.auth.getSession(): it takes a web lock
        // shared across tabs, and a frozen duplicate tab can hold it forever —
        // hanging every path that waits on it while looking like nothing.
        // Plain REST with the cached id has no lock to wait on.
        const uid = localStorage.getItem('scrum-cached-user-id')
        if (!uid) return
        const restUrl = import.meta.env.VITE_SUPABASE_URL
        const restKey = import.meta.env.VITE_SUPABASE_ANON_KEY
        const res = await fetch(`${restUrl}/rest/v1/profiles?id=eq.${uid}&select=*`, {
          headers: { apikey: restKey, Authorization: `Bearer ${restKey}` },
        })
        if (!res.ok || !mounted) return
        const rows = await res.json()
        const profile = Array.isArray(rows) && rows[0] ? rows[0] : null
        if (!profile || !mounted) return
        setProfileSync({ at: Date.now(), source: 'rest', error: '' })
        const key = JSON.stringify([
          profile.function_tags || [],
          profile.authority_tier || '',
          profile.role || '',
          profile.is_authority_admin || false,
        ])
        if (key === lastAccessKey) return
        lastAccessKey = key
        applyProfile(profile, localStorage.getItem('scrum-user-email') || '')
      } catch { /* ignore */ }
    }
    pollProfileRef.current = pollProfile
    const profilePoll = setInterval(pollProfile, 5 * 1000)

    // Re-read the profile whenever the tab regains focus. Realtime below covers
    // the live case, but it only fires if `profiles` is in the supabase_realtime
    // publication — without this, a role removed by a lead can sit stale in an
    // open tab until the next sign-in.
    const refreshOnFocus = () => {
      if (document.visibilityState !== 'visible' || !mounted) return
      pollProfileRef.current?.()
    }
    document.addEventListener('visibilitychange', refreshOnFocus)
    window.addEventListener('focus', refreshOnFocus)

    // Belt-and-braces on top of the profiles subscription below: a role change
    // always writes a 'role_change' notification, and the notifications channel
    // is known to work (it drives the celebration modal). If `profiles` isn't in
    // the supabase_realtime publication, this is what actually clears a removed
    // role from an open tab.
    let roleNotifChannel = null
    const setupRoleNotifSub = (userId) => {
      if (roleNotifChannel) supabase.removeChannel(roleNotifChannel)
      roleNotifChannel = supabase
        .channel(`role-change-${userId}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        }, async (payload) => {
          if (!mounted || payload.new?.type !== 'role_change') return
          try {
            const { data: { session } } = await supabase.auth.getSession()
            if (session?.user && mounted) {
              const profile = await fetchProfile(session.user.id)
              if (mounted && profile) applyProfile(profile, session.user.email)
            }
          } catch { /* ignore */ }
        })
        .subscribe()
    }

    // Realtime subscription: pick up role/tag changes made by leads immediately
    let profileChannel = null
    const setupRealtimeSub = (userId) => {
      if (profileChannel) supabase.removeChannel(profileChannel)
      if (roleNotifChannel) supabase.removeChannel(roleNotifChannel)
      profileChannel = supabase
        .channel(`profile-changes-${userId}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userId}`,
        }, async () => {
          if (!mounted) return
          // Re-fetch profile + session email to avoid stale closure issues
          try {
            const { data: { session } } = await supabase.auth.getSession()
            if (session?.user && mounted) {
              const profile = await fetchProfile(session.user.id)
              if (mounted && profile) applyProfile(profile, session.user.email)
            }
          } catch (e) { /* ignore */ }
        })
        .subscribe()
    }

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
      if (profileChannel) supabase.removeChannel(profileChannel)
      clearTimeout(timeout)
      clearInterval(interval)
      clearInterval(profilePoll)
      document.removeEventListener('visibilitychange', handleVisibility)
      document.removeEventListener('visibilitychange', refreshOnFocus)
      window.removeEventListener('focus', refreshOnFocus)
    }
  }, [])

  // Role-change detection now lives inside applyProfile (which runs on
  // initial load, sign-in, and tab-wake), so no separate poll is needed.

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

      // Roles a lead assigned to this email before it had an account. They're
      // stored comma-separated in approved_emails.role, so 'member' (the plain
      // default) means "no roles".
      const preAssigned = String(role || '')
        .split(',')
        .map(r => r.trim())
        .filter(r => r && r.toLowerCase() !== 'member')
      const tags = isPermCofounder
        ? [...new Set(['Co-Founder', ...preAssigned])]
        : preAssigned

      const { error: profileError } = await supabase.from('profiles').insert({
        id: data.user.id,
        display_name: displayName,
        role: role,
        authority_tier: (isPermCofounder || tags.length > 0) ? 'teammate' : 'guest',
        function_tags: tags,
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
      value={{ username, nickname, useNickname, chatName: (useNickname && nickname) ? nickname : username, isLead, role, secondaryRoles, authorityTier, isAuthorityAdmin, primaryRoleLabel, functionTags, shortBio, user, loading, login, signup, logout, checkWhitelist, resetPassword, updatePassword, passwordRecovery, mustChangePassword, sessionExpired, roleChangeAlert, dismissRoleChangeAlert: () => setRoleChangeAlert(null), isTeam, teamNumber, profileSync, refreshProfileNow: () => pollProfileRef.current?.() }}
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
