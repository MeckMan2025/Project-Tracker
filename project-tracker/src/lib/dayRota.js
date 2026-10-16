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

const norm = (s) => String(s || '').trim().toLowerCase()

export const recordKey = (team, match) => `${String(team || '').trim()}|${String(match || '').trim()}`

// The (team, match) pairs that have a scouting row.
export function scoutedKeys(rows) {
  return new Set((rows || []).map(r => recordKey(r.team_number, r.match_number)))
}

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
  orderedMatches(doc).forEach((row, k) => {
    const g = groups[k % groups.length]
    POSITIONS.forEach(pos => {
      const team = String(row[pos] || '').trim()
      if (team && isPerson(g[pos], username)) out.push({ match: String(row.match).trim(), team, position: pos, group: g.name })
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
