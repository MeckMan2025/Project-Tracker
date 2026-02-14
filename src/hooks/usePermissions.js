import { useUser } from '../contexts/UserContext'

const ELEVATED_LEGACY_ROLES = ['lead', 'coach', 'mentor', 'cofounder']
const ELEVATED_FUNCTION_TAGS = ['Co-Founder', 'Mentor', 'Coach', 'Team Lead', 'Business Lead', 'Technical Lead']
const TEAMMATE_FUNCTION_TAGS = ['Website', 'Build', 'CAD', 'Scouting', 'Outreach', 'Communications', 'Programming']
const TIER_RANK = { guest: 0, teammate: 1, top: 2 }

function deriveTierFromTags(functionTags) {
  if (!functionTags || functionTags.length === 0) return null
  if (functionTags.some(t => ELEVATED_FUNCTION_TAGS.includes(t))) return 'top'
  if (functionTags.some(t => TEAMMATE_FUNCTION_TAGS.includes(t))) return 'teammate'
  if (functionTags.includes('Guest')) return 'guest'
  return null
}

function deriveTierFromRole(role, secondaryRoles) {
  if (role === 'guest') return 'guest'
  const allRoles = [role, ...(secondaryRoles || [])]
  if (allRoles.some(r => ELEVATED_LEGACY_ROLES.includes(r))) return 'top'
  return 'teammate'
}

function highestTier(...tiers) {
  let best = 'guest'
  for (const t of tiers) {
    if (t && (TIER_RANK[t] || 0) > (TIER_RANK[best] || 0)) best = t
  }
  return best
}

export function usePermissions() {
  const { username, isLead, user, role, secondaryRoles, authorityTier, isAuthorityAdmin, functionTags } = useUser()

  // Take the highest of: DB tier, function tag tier, legacy role tier
  const tagTier = deriveTierFromTags(functionTags)
  const legacyTier = deriveTierFromRole(role, secondaryRoles)
  const tier = highestTier(authorityTier || 'guest', tagTier || 'guest', legacyTier)

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
