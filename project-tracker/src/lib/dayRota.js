// Who scouts what on a Competition Day, worked out from the day's own setup.
//
// A day's setup (the scouting_schedule document `day-comp-<session id>`) holds
// the scouting groups — who sits in Red 1, Red 2, Blue 1, Blue 2 — and the
// match schedule — which team is in each of those slots each match. Put
// together, they say which team each person watches in each match. The match
// scouting rows say which of those have been done. Nothing else is stored:
// pause a day, host it again a week later, and what is left to do is simply
// what has no row yet.
//
// Groups take matches in turn: with two groups the first covers matches
// 1, 3, 5… and the second 2, 4, 6…; with one group it covers them all.

const POSITIONS = ['red1', 'red2', 'blue1', 'blue2']

// The two event roles that are pools of scouts: the Scouting tab draws its
// positions from one, the Pit tab its visits from the other.
export const SCOUTING_ROLE = 'Scouting'
export const PIT_ROLE = 'Pit Scouting'

export const roleMembers = (doc, role) =>
  (doc?.fixedRoles || []).find(r => r.role === role)?.members || []

const POSITION_LABEL = { red1: 'Red 1', red2: 'Red 2', blue1: 'Blue 1', blue2: 'Blue 2' }

const norm = (s) => String(s || '').trim().toLowerCase()

export const recordKey = (team, match) => `${String(team || '').trim()}|${String(match || '').trim()}`

// The (team, match) pairs that have a scouting row — and, for a job whose
// team was never written on the schedule, (scout, match): the only proof is
// that the person down for Red 1 in match 5 saved a row for match 5.
export const scoutKey = (who, match) => `@${norm(who)}|${String(match || '').trim()}`
export function scoutedKeys(rows) {
  const out = new Set()
  ;(rows || []).forEach(r => {
    out.add(recordKey(r.team_number, r.match_number))
    if (r.scout) out.add(scoutKey(r.scout, r.match_number))
  })
  return out
}
export const POSITION_LABELS = { red1: 'Red 1', red2: 'Red 2', blue1: 'Blue 1', blue2: 'Blue 2' }

function orderedMatches(doc) {
  return [...(doc?.matchSchedule || [])]
    .filter(m => String(m.match || '').trim())
    .sort((a, b) => Number(a.match) - Number(b.match))
}

// Slots hold full names from the roster; older days may hold a first name.
function isPerson(slot, username) {
  const v = norm(slot)
  if (!v) return false
  const me = norm(username)
  if (v === me) return true
  return !v.includes(' ') && v === me.split(/\s+/)[0]
}

// Everything this person is down to scout on the day, in match order.
export function assignmentsFor(doc, username) {
  const groups = doc?.scoutGroups || []
  if (!groups.length) return []
  const out = []
  // A match with no team numbers yet is still a match to scout: you know you
  // are Red 1 even before anyone knows who Red 1 is.
  orderedMatches(doc).forEach((row, k) => {
    const g = groups[k % groups.length]
    POSITIONS.forEach(pos => {
      const team = String(row[pos] || '').trim()
      if (isPerson(g[pos], username)) out.push({ match: String(row.match).trim(), team, position: pos, positionLabel: POSITION_LABEL[pos], who: g[pos] || '', group: g.name })
    })
  })
  return out
}

// How far through the day the whole team is.
export function dayProgress(doc, rows) {
  const done = scoutedKeys(rows)
  let total = 0, scouted = 0
  orderedMatches(doc).forEach(row => POSITIONS.forEach(pos => {
    const team = String(row[pos] || '').trim()
    if (!team) return
    total++
    if (done.has(recordKey(team, row.match))) scouted++
  }))
  return { scouted, total }
}

// Every match-scouting job on the day, for the whole team, in match order.
export function allAssignments(doc) {
  const groups = doc?.scoutGroups || []
  if (!groups.length) return []
  const out = []
  orderedMatches(doc).forEach((row, k) => {
    const g = groups[k % groups.length]
    POSITIONS.forEach(pos => {
      const team = String(row[pos] || '').trim()
      if (team || g[pos]) out.push({ match: String(row.match).trim(), team, who: g[pos] || '', position: POSITION_LABEL[pos], positionLabel: POSITION_LABEL[pos], group: g.name })
    })
  })
  return out
}

// Every pit visit on the day. No match number: a pit is visited once.
export function pitAssignments(doc) {
  return (doc?.pitTeams || [])
    .filter(t => String(t.team || '').trim())
    .map(t => ({ team: String(t.team).trim(), match: null, who: t.who || '' }))
}

export function pitAssignmentsFor(doc, username) {
  return pitAssignments(doc).filter(a => isPerson(a.who, username))
}

// The teams that have a pit scouting row.
export function pitScoutedKeys(rows) {
  return new Set((rows || []).map(r => String(r.team_number || '').trim()).filter(Boolean))
}

// Rows written before this day was created belong to an earlier event and
// must not turn this day's jobs green. The day's creation time is the line;
// an older day without one falls back to the start of its date.
export const daySince = (day) => {
  if (!day) return null
  if (day.created_at) return day.created_at
  if (day.session_date) return `${day.session_date}T00:00:00`
  return null
}
