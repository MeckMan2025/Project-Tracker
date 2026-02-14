import { useUser } from '../contexts/UserContext'

const TOP_TAGS = ['Co-Founder', 'Mentor', 'Coach', 'Team Lead', 'Business Lead', 'Technical Lead']
const TEAMMATE_TAGS = ['Website', 'Build', 'CAD', 'Scouting', 'Outreach', 'Communications', 'Programming']
const PERMANENT_COFOUNDERS = ['yukti', 'kayden']

function deriveTierFromTags(functionTags, displayName) {
  // Permanent co-founders always get top
  if (displayName && PERMANENT_COFOUNDERS.includes(displayName.toLowerCase())) return 'top'
  if (functionTags && functionTags.includes('Guest')) return 'guest'
  if (functionTags && functionTags.some(t => TOP_TAGS.includes(t))) return 'top'
  if (functionTags && functionTags.some(t => TEAMMATE_TAGS.includes(t))) return 'teammate'
  return 'teammate'
}

export function usePermissions() {
  const { username, isLead, user, role, secondaryRoles, isAuthorityAdmin, functionTags } = useUser()

  const tier = deriveTierFromTags(functionTags, username)

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
    canViewOwnAttendance: !isGuest,
    canViewScoutingData: !isGuest,
    canSubmitSuggestions: !isGuest,
    canDragOwnTask: !isGuest,
    canImport: !isGuest,

    // Top only
    canEditContent: isTop,
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
