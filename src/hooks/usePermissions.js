import { useUser } from '../contexts/UserContext'

const PERMANENT_COFOUNDERS = ['yukti', 'kayden']

const LEAD_TAGS = ['Co-Founder', 'Mentor', 'Coach', 'Team Lead', 'Business Lead', 'Technical Lead']

export function usePermissions() {
  const { username, isLead, user, role, secondaryRoles, authorityTier, isAuthorityAdmin, functionTags } = useUser()

  // Use the authority_tier from the database profile directly.
  // Fall back to 'top' for permanent co-founders even if profile hasn't loaded yet.
  const isPermanentCofounder = username && PERMANENT_COFOUNDERS.some(n => username.toLowerCase().includes(n))
  const tier = isPermanentCofounder ? 'top' : (authorityTier || 'teammate')

  const isGuest = tier === 'guest'
  const isTeammate = tier === 'teammate'
  const isTop = tier === 'top'
  const isCofounder = (functionTags && functionTags.includes('Co-Founder')) ||
    (username && PERMANENT_COFOUNDERS.some(n => username.toLowerCase().includes(n)))

  const hasLeadTag = isCofounder || (functionTags && functionTags.some(t => LEAD_TAGS.includes(t)))

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

    // Top or Lead tags
    canEditContent: isTop || hasLeadTag || isLead,
    canReviewRequests: isTop || hasLeadTag,
    canDeleteScouting: isTop,
    canReorderScoutingRanks: isTop,
    canPauseMuteChat: isTop,
    canViewAllAttendance: isTop,
    canOrganizeNotebook: isTop,
    canApproveQuotes: isTop,
    canManageUsers: isTop || hasLeadTag,
    canDragAnyTask: isTop || hasLeadTag,
    canOverrideAttendance: isTop,
    canChangeRoles: hasLeadTag,
    canChangeAuthorityTier: isTop,

    // Co-Founders & Top
    canReviewSuggestions: isTop || isCofounder,

    // Nobody
    canEditScouting: false,

    // Legacy compat
    role,
    secondaryRoles,
    isElevated: isTop,
    isAdmin: isTop,
  }
}
