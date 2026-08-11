import { useUser } from '../contexts/UserContext'

const PERMANENT_COFOUNDERS = ['yukti', 'kayden']

const LEAD_TAGS = ['Co-Founder', 'Mentor', 'Coach', 'Project Manager', 'Business Lead', 'Technical Lead']

export function usePermissions() {
  const { username, isLead, user, role, secondaryRoles, authorityTier, isAuthorityAdmin, functionTags, isTeam } = useUser()

  // Tier is auto-derived from roles (set by UserManagement on role change).
  // Permanent co-founders always get teammate tier at minimum.
  const isPermanentCofounder = username && PERMANENT_COFOUNDERS.some(n => username.toLowerCase().includes(n))
  const tier = isPermanentCofounder ? 'teammate' : (authorityTier || 'guest')

  const isGuest = tier === 'guest' && !isTeam

  // Co-Founder: includes permanent co-founders + anyone with Co-Founder tag
  const isCofounder = (functionTags && functionTags.includes('Co-Founder')) || isPermanentCofounder

  // Outreach is excluded from Special Controls; a lead who also holds Outreach
  // keeps it.
  const hasOutreachRole = !!(functionTags && functionTags.includes('Outreach'))
  const hasFinanceRole = !!(functionTags && functionTags.includes('Finance'))
  const hasCommsRole = !!(functionTags && functionTags.includes('Communications'))

  // Lead: any lead-level role tag (Co-Founder, Mentor, Coach, Project Manager, etc.)
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
    canRequestContent: !isGuest && !hasLeadTag && !isTeam,
    canRequestRoles: !isGuest && !hasLeadTag && !isTeam,

    // Teammate + Lead tags (non-guest)
    canSubmitScouting: !isGuest,
    canSubmitNotebook: !isGuest,
    canSelfCheckIn: !isGuest,
    // Chat is closed to everyone but co-founders for now.
    canUseChat: isCofounder,
    canDeleteOwnMessages: !isGuest,
    canViewOwnAttendance: !isGuest,
    canSubmitSuggestions: true,
    canDragOwnTask: !isGuest,
    canImport: !isGuest,

    // Lead tags (Co-Founder, Mentor, Coach, Project Manager, Business Lead, Technical Lead)
    // Team accounts can also edit their own boards directly
    canEditContent: hasLeadTag || isTeam,
    canReviewRequests: hasLeadTag,
    canDeleteScouting: hasLeadTag,
    canReorderScoutingRanks: hasLeadTag,
    canPauseMuteChat: hasLeadTag,
    canOrganizeNotebook: hasLeadTag,
    canApproveQuotes: hasLeadTag,
    canManageUsers: hasLeadTag,
    canDragAnyTask: hasLeadTag || isTeam,
    canDeleteAnyMessage: hasLeadTag,
    canChangeRoles: hasLeadTag,
    canViewAllAttendance: hasLeadTag,
    canOverrideAttendance: hasLeadTag,

    // Co-Founders only
    canReviewSuggestions: isCofounder,

    // Functional roles (Outreach, Finance) don't get Special Controls; a lead
    // who also holds one of those roles keeps it.
    canViewSpecialControls: !isGuest && (hasLeadTag || (!hasOutreachRole && !hasFinanceRole && !hasCommsRole)),

    // Outreach can put events on the calendar directly instead of filing a
    // request. Adding events is the ONLY thing the role unlocks — editing and
    // deleting events, and every other kind of content, stay with leads.
    canAddEvents: hasLeadTag || isTeam || hasOutreachRole || hasFinanceRole,

    // Finance-only tabs, and who reviews expense requests.
    canViewFinanceTabs: hasFinanceRole,
    // The season budget is the Business Lead's number to enter (co-founders can too).
    canSetBudget: (functionTags && functionTags.includes('Business Lead')) || isCofounder,
    canReviewExpenseRequests: hasFinanceRole || hasLeadTag,

    // Log Reach and Portfolio belong to Outreach and nobody else.
    canViewOutreachTabs: hasOutreachRole,

    // An Outreach member's Requests tab carries event requests and nothing else.
    outreachEventRequestsOnly: hasOutreachRole && !hasLeadTag,

    // Nobody
    canEditScouting: false,

    // Legacy compat
    role,
    secondaryRoles,
    isElevated: hasLeadTag,
  }
}
