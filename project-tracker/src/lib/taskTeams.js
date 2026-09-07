// Assigning a task to a whole side of the team.
//
// Derived from the org chart's departments rather than listed again here, so
// Business / Hardware / Software mean the same thing on a task as they do on
// the chart, and a role moving between departments moves with it.

import { DEPARTMENTS } from '../data/orgRoles'

export const UP_FOR_GRABS = '__up_for_grabs__'
export const EVERYONE = '__everyone__'

const EMOJI = { business: '💼', hardware: '🔧', software: '💻' }

export const TEAM_ASSIGNEES = DEPARTMENTS.map(d => ({
  value: `__team_${d.key}__`,
  key: d.key,
  label: `${d.label} team`,
  emoji: EMOJI[d.key] || '👥',
  // Anyone holding one of these tags is on that side.
  tags: [d.leadTag, d.coLeadTag, ...d.roles.map(r => r.tag)].filter(Boolean),
}))

const byValue = Object.fromEntries(TEAM_ASSIGNEES.map(t => [t.value, t]))

export const isTeamAssignee = (v) => !!byValue[v]
export const teamOf = (v) => byValue[v] || null
export const teamLabel = (v) => {
  const t = byValue[v]
  return t ? `${t.emoji} ${t.label}` : null
}

// Which team assignees a person's tasks should include, from their role tags.
export const teamsForTags = (tags) =>
  TEAM_ASSIGNEES.filter(t => (tags || []).some(tag => t.tags.includes(tag))).map(t => t.value)

// Every assignee value that counts as "mine", for the task queries.
export const myAssigneeValues = (username, tags) =>
  [username, EVERYONE, ...teamsForTags(tags)].filter(Boolean)

// One label for any assignee value, so every screen says the same thing.
export const assigneeLabel = (v) => {
  if (v === UP_FOR_GRABS) return '🙋 Up for Grabs'
  if (v === EVERYONE) return '👥 Everyone'
  return teamLabel(v) || v || 'Unassigned'
}
