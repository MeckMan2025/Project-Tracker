import { useUser } from '../contexts/UserContext'

const PERMANENT_COFOUNDERS = ['yukti', 'kayden']

export function usePermissions() {
  const { username, isLead, user, role, secondaryRoles, authorityTier, isAuthorityAdmin, functionTags } = useUser()

  // Use the authority_tier from the database profile directly.
  // Fall back to 'top' for permanent co-founders even if profile hasn't loaded yet.
  const isPermanentCofounder = username && PERMANENT_COFOUNDERS.includes(username.toLowerCase())
  const tier = isPermanentCofounder ? 'top' : (authorityTier || 'teammate')

  const isGuest = tier === 'guest'
  const isTeammate = tier === 'teammate'
  const isTop = tier === 'top'
  const isCofounder = (functionTags && functionTags.includes('Co-Founder')) ||
    (username && PERMANENT_COFOUNDERS.includes(username.toLowerCase()))

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
    canDeleteAnyMessage: isTop || isCofounder,
    canViewOwnAttendance: !isGuest,
    canViewScoutingData: !isGuest,
    canSubmitSuggestions: !isGuest,
    canDragOwnTask: !isGuest,
    canImport: !isGuest,

    // Top only
    canEditContent: isTop || isCofounder || isLead,
    canReviewRequests: isTop,
    canDeleteScouting: isTop,
    canReorderScoutingRanks: isTop,
    canPauseMuteChat: isTop,
    canViewAllAttendance: isTop,
    canOrganizeNotebook: isTop,
    canApproveQuotes: isTop,
    canManageUsers: isTop,
    canDragAnyTask: isTop,
    canOverrideAttendance: isTop,
    canChangeAuthorityTier: isTop,

    // Co-Founders only
    canReviewSuggestions: isCofounder,

    // Nobody
    canEditScouting: false,

    // Legacy compat
    role,
    secondaryRoles,
    isElevated: isTop,
    isAdmin: isTop,
  }
}
