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

// ── Which group covers which match ─────────────────────────────────────────
// A group's `cover` says how it is scheduled:
//   rotate  takes turns with the other rotating groups, match by match (the
//           old behaviour, and the default for a group saved before this)
//   all     every match of the day
//   shift   matches `from` to `to`, with optional clock times `start`–`end`
//   list    the matches written in `list`, e.g. "1-5, 9, 12"
// A match claimed by an all/shift/list group goes to that group (or groups);
// the rest are dealt round the rotating groups in order.
export const COVER_MODES = [
  ['rotate', 'Takes turns with other groups'],
  ['all', 'Every match'],
  ['shift', 'A shift (match range and times)'],
  ['list', 'Specific matches'],
]
export const coverOf = (g) => ({ mode: 'rotate', ...(g?.cover || {}) })
export function parseMatchList(text) {
  const out = new Set()
  String(text || '').split(/[,\s]+/).forEach(part => {
    const m = /^(\d+)\s*[-–]\s*(\d+)$/.exec(part.trim())
    if (m) { const a = +m[1], b = +m[2]; for (let i = Math.min(a, b); i <= Math.max(a, b) && i - Math.min(a, b) < 500; i++) out.add(String(i)) }
    else if (/^\d+$/.test(part.trim())) out.add(String(+part.trim()))
  })
  return out
}
function covers(g, match) {
  const c = coverOf(g), n = Number(match)
  if (c.mode === 'all') return true
  if (c.mode === 'shift') {
    const from = c.from === '' || c.from == null ? -Infinity : Number(c.from)
    const to = c.to === '' || c.to == null ? Infinity : Number(c.to)
    return n >= from && n <= to
  }
  if (c.mode === 'list') return parseMatchList(c.list).has(String(n))
  return false
}
// match id -> the groups scouting it.
export function groupsByMatch(doc) {
  const groups = doc?.scoutGroups || []
  const fixed = groups.filter(g => coverOf(g).mode !== 'rotate')
  const rotating = groups.filter(g => coverOf(g).mode === 'rotate')
  const out = new Map()
  let turn = 0
  orderedMatches(doc).forEach(row => {
    const id = String(row.match).trim()
    const claim = fixed.filter(g => covers(g, id))
    out.set(id, claim.length ? claim : rotating.length ? [rotating[turn++ % rotating.length]] : [])
  })
  return out
}
// "matches 1–10 · 9:00–11:30", for showing a group's cover in a line.
export function coverLabel(g, doc) {
  const c = coverOf(g)
  const t = c.start || c.end ? ` · ${c.start || '?'}–${c.end || '?'}` : ''
  if (c.mode === 'all') return `every match${t}`
  if (c.mode === 'shift') return `matches ${c.from || 'start'}–${c.to || 'end'}${t}`
  if (c.mode === 'list') return `matches ${String(c.list || '').trim() || '(none yet)'}${t}`
  const mine = [...groupsByMatch(doc).entries()].filter(([, gs]) => gs.some(x => x.id === g.id)).map(([m]) => m)
  return mine.length ? `takes turns: ${mine.slice(0, 8).join(', ')}${mine.length > 8 ? '…' : ''}${t}` : `takes turns${t}`
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
  const by = groupsByMatch(doc)
  orderedMatches(doc).forEach(row => {
    (by.get(String(row.match).trim()) || []).forEach(g => POSITIONS.forEach(pos => {
      const team = String(row[pos] || '').trim()
      if (isPerson(g[pos], username)) out.push({ match: String(row.match).trim(), team, position: pos, positionLabel: POSITION_LABEL[pos], who: g[pos] || '', group: g.name })
    }))
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
  const by = groupsByMatch(doc)
  orderedMatches(doc).forEach(row => {
    (by.get(String(row.match).trim()) || []).forEach(g => POSITIONS.forEach(pos => {
      const team = String(row[pos] || '').trim()
      if (team || g[pos]) out.push({ match: String(row.match).trim(), team, who: g[pos] || '', position: POSITION_LABEL[pos], positionLabel: POSITION_LABEL[pos], group: g.name })
    }))
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

// Which scouting belongs to the live day: rows sent today, and not before the
// day was made. Creation time alone was not enough — practice scouting in the
// week after Bettendorf was set up counted as that event's, and its board
// showed every match done before the event had begun. A live day is always
// happening today, so today is the line (this device's midnight).
export const daySince = (day) => {
  if (!day) return null
  const midnight = new Date(); midnight.setHours(0, 0, 0, 0)
  const made = day.created_at ? new Date(day.created_at) : null
  return (made && !isNaN(made) && made > midnight ? made : midnight).toISOString()
}
