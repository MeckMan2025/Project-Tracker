import { useUser } from '../contexts/UserContext'

const ELEVATED_LEGACY_ROLES = ['lead', 'coach', 'mentor', 'cofounder']
const ELEVATED_FUNCTION_TAGS = ['Co-Founder', 'Mentor', 'Coach', 'Team Lead', 'Business Lead', 'Technical Lead']

function deriveTierFromRole(role, secondaryRoles, functionTags) {
  if (role === 'guest') return 'guest'
  // Check function tags first (newer system)
  if (functionTags && functionTags.some(t => ELEVATED_FUNCTION_TAGS.includes(t))) return 'top'
  // Fall back to legacy roles
  const allRoles = [role, ...(secondaryRoles || [])]
  if (allRoles.some(r => ELEVATED_LEGACY_ROLES.includes(r))) return 'top'
  return 'teammate'
}

export function usePermissions() {
  const { username, isLead, user, role, secondaryRoles, authorityTier, isAuthorityAdmin, functionTags } = useUser()

  // Use authority_tier if explicitly set, otherwise derive from function tags / legacy role
  const tier = authorityTier || deriveTierFromRole(role, secondaryRoles, functionTags)

  const isGuest = tier === 'guest'
  const isTeammate = tier === 'teammate'
  const isTop = tier === 'top'
  const isCofounder = functionTags && functionTags.includes('Co-Founder')

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
