import { useUser } from '../contexts/UserContext'

const ELEVATED_ROLES = ['lead', 'coach', 'mentor', 'cofounder']
const ADMIN_ROLES = ['lead', 'mentor', 'cofounder']

export function usePermissions() {
  const { username, isLead, user, role, secondaryRoles } = useUser()

  // Also check localStorage directly as a last-resort fallback
  const cachedRole = typeof window !== 'undefined' ? localStorage.getItem('scrum-role') : null
  const effectiveRole = role || cachedRole || 'member'

  const allRoles = [effectiveRole, ...(secondaryRoles || [])]
  // Fallback: if legacy isLead is true OR cached role is lead, treat as elevated+admin
  const legacyLead = isLead || cachedRole === 'lead'
  const isElevated = legacyLead || allRoles.some(r => ELEVATED_ROLES.includes(r))
  const isAdmin = legacyLead || allRoles.some(r => ADMIN_ROLES.includes(r))
  const isGuest = effectiveRole === 'guest' && !legacyLead

  return {
    canEditContent: isElevated,
    canManageUsers: isAdmin,
    canReviewRequests: isElevated,
    canReviewSuggestions: isElevated,
    canDeleteScouting: isElevated,
    canDragAnyTask: isElevated,
    canDragOwnTask: !isGuest,
    canRequestContent: effectiveRole === 'member' && !legacyLead,
    canImport: isElevated,
    isGuest,
    isElevated,
    isAdmin,
    role: effectiveRole,
    secondaryRoles,
  }
}
