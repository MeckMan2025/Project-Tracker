import { useUser } from '../contexts/UserContext'

const PERMANENT_COFOUNDERS = ['yukti', 'kayden']

const LEAD_TAGS = ['Co-Founder', 'Mentor', 'Coach', 'Team Lead', 'Business Lead', 'Technical Lead']

export function usePermissions() {
  const { username, isLead, user, role, secondaryRoles, authorityTier, isAuthorityAdmin, functionTags } = useUser()

  // Tier is auto-derived from roles (set by UserManagement on role change).
  // Permanent co-founders always get teammate tier at minimum.
  const isPermanentCofounder = username && PERMANENT_COFOUNDERS.some(n => username.toLowerCase().includes(n))
  const tier = isPermanentCofounder ? 'teammate' : (authorityTier || 'guest')

  const isGuest = tier === 'guest'

  // Co-Founder: includes permanent co-founders + anyone with Co-Founder tag
  const isCofounder = (functionTags && functionTags.includes('Co-Founder')) || isPermanentCofounder

  // Lead: any lead-level role tag (Co-Founder, Mentor, Coach, Team Lead, etc.)
  const hasLeadTag = isCofounder || (functionTags && functionTags.some(t => LEAD_TAGS.includes(t)))

  return {
    tier,
    isGuest,
    isCofounder,
    hasLeadTag,

    // View permissions (all tiers including guest)
    canViewBoards: true,
    canViewOrgChart: !isGuest,
    canViewAIManual: true,
    canViewScoutingData: true,

    // Teammate (non-guest, non-lead) — request-based workflow
    canRequestContent: !isGuest && !hasLeadTag,
    canRequestRoles: !isGuest && !hasLeadTag,

    // Teammate + Lead tags (non-guest)
    canSubmitScouting: !isGuest,
    canSubmitNotebook: !isGuest,
    canSelfCheckIn: !isGuest,
    canUseChat: !isGuest,
    canDeleteOwnMessages: !isGuest,
    canViewOwnAttendance: !isGuest,
    canSubmitSuggestions: !isGuest,
    canDragOwnTask: !isGuest,
    canImport: !isGuest,

    // Lead tags (Co-Founder, Mentor, Coach, Team Lead, Business Lead, Technical Lead)
    canEditContent: hasLeadTag,
    canReviewRequests: hasLeadTag,
    canDeleteScouting: hasLeadTag,
    canReorderScoutingRanks: hasLeadTag,
    canPauseMuteChat: hasLeadTag,
    canOrganizeNotebook: hasLeadTag,
    canApproveQuotes: hasLeadTag,
    canManageUsers: hasLeadTag,
    canDragAnyTask: hasLeadTag,
    canDeleteAnyMessage: hasLeadTag,
    canChangeRoles: hasLeadTag,
    canViewAllAttendance: hasLeadTag,
    canOverrideAttendance: hasLeadTag,

    // Co-Founders only
    canReviewSuggestions: isCofounder,

    // Nobody
    canEditScouting: false,

    // Legacy compat
    role,
    secondaryRoles,
    isElevated: hasLeadTag,
  }
}
