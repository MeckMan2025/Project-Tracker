import { useUser } from '../contexts/UserContext'

const ELEVATED_LEGACY_ROLES = ['lead', 'coach', 'mentor', 'cofounder']

function deriveTierFromRole(role, secondaryRoles) {
  if (role === 'guest') return 'guest'
  const allRoles = [role, ...(secondaryRoles || [])]
  if (allRoles.some(r => ELEVATED_LEGACY_ROLES.includes(r))) return 'top'
  return 'teammate'
}

export function usePermissions() {
  const { username, isLead, user, role, secondaryRoles, authorityTier, isAuthorityAdmin } = useUser()

  // Use authority_tier if set, otherwise derive from legacy role
  const tier = authorityTier || deriveTierFromRole(role, secondaryRoles)

  const isGuest = tier === 'guest'
  const isTeammate = tier === 'teammate'
  const isTop = tier === 'top'

  return {
    tier,
    isGuest,
    isTeammate,
    isTop,
    isAuthorityAdmin: !!isAuthorityAdmin,

    // View permissions (all tiers)
    canViewBoards: true,
    canViewOrgChart: true,
    canViewAIManual: true,

    // Teammate + Top
    canSubmitScouting: !isGuest,
    canSubmitNotebook: !isGuest,
    canRequestContent: isTeammate,
    canSelfCheckIn: !isGuest,
    canUseChat: !isGuest,
    canDeleteOwnMessages: !isGuest,
    canViewOwnAttendance: !isGuest,
    canViewScoutingData: !isGuest,
    canSubmitSuggestions: !isGuest,
    canDragOwnTask: !isGuest,

    // Top only
    canEditContent: isTop,
    canReviewRequests: isTop,
    canDeleteScouting: isTop,
    canReorderScoutingRanks: isTop,
    canPauseMuteChat: isTop,
    canViewAllAttendance: isTop,
    canOrganizeNotebook: isTop,
    canApproveQuotes: isTop,
    canImport: isTop,
    canManageUsers: isTop,
    canReviewSuggestions: isTop,
    canDragAnyTask: isTop,

    // Legacy compat
    role,
    secondaryRoles,
    isElevated: isTop,
    isAdmin: isTop && !!isAuthorityAdmin,
  }
}
