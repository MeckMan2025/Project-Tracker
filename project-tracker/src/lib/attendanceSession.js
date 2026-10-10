// Starting a day's attendance session, in one place.
//
// The manager's "Start Today's Session" button and the badge scanner both need
// today's session to exist, and they have to agree on what a new one looks
// like — who is on the roster, who starts excused — or a scan at the door
// would start a different meeting from the one a lead would have started.

import { lazyHeadersWith, lazyRestHeaders } from './restHeaders'
import { storedTeamScope } from '../lib/teamScope'
import { teamScope, stampTeam } from './teamScope'
import { excludedFromAttendance } from './attendanceRoster'

const REST_URL = import.meta.env.VITE_SUPABASE_URL
const REST_HEADERS = lazyRestHeaders
const REST_JSON = lazyHeadersWith({ 'Content-Type': 'application/json', 'Prefer': 'return=minimal' })

export function genId() {
  return String(Date.now()) + Math.random().toString(36).slice(2)
}

export function todayStr() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const PROFILE_FIELDS = 'display_name,authority_tier,function_tags,last_seen_at'

async function existingSession(date, scope) {
  const res = await fetch(`${REST_URL}/rest/v1/attendance_sessions?${scope}&session_date=eq.${date}&select=*&order=created_at&limit=1`, { headers: REST_HEADERS })
  if (!res.ok) return null
  const rows = await res.json()
  return rows[0] || null
}

export async function sessionRecords(sessionId, teamNumber) {
  const res = await fetch(`${REST_URL}/rest/v1/attendance_records?${teamScope(teamNumber)}&session_id=eq.${sessionId}&select=*`, { headers: REST_HEADERS })
  return res.ok ? res.json() : []
}

// Today's (or `date`'s) session for this team, created if there isn't one yet.
//
// Resolves to { session, records, created, profiles }. `created` is false when
// the session was already there — including when another screen started it a
// moment before we did. `profiles` is the roster as fetched just now, when we
// had to fetch it. Throws with a readable message when the server refuses.
export async function ensureSessionForDate({ date, username, teamNumber }) {
  const scope = teamScope(teamNumber)

  // Local state goes stale when a tab is left open and the realtime socket
  // drops, so ask the server before inserting — that is how a second lead
  // ended up starting a session someone else had already started.
  try {
    const found = await existingSession(date, scope)
    if (found) return { session: found, records: await sessionRecords(found.id, teamNumber), created: false }
  } catch {}

  let profiles = null
  try {
    const res = await fetch(`${REST_URL}/rest/v1/profiles?${storedTeamScope()}&${scope}&select=${PROFILE_FIELDS}`, { headers: REST_HEADERS })
    if (res.ok) profiles = await res.json()
  } catch {}
  if (!profiles) throw new Error('Could not load the roster')

  const members = profiles.filter(p => p.display_name && p.authority_tier !== 'guest' && !excludedFromAttendance(p))

  // Whoever already told us they'd miss this meeting. Marking them present
  // and waiting for a lead to undo it would throw away the one thing they
  // did right, so their notice is honoured from the start: excused if they
  // filed in time, absent if they filed late. A 'partial' notice means
  // they'll be here for some of it, so that still starts present.
  const noticed = new Map()
  try {
    const nres = await fetch(
      `${REST_URL}/rest/v1/absence_notices?${scope}&meeting_date=eq.${date}&select=username,on_time,kind`,
      { headers: REST_HEADERS })
    if (nres.ok) for (const n of await nres.json()) noticed.set(n.username, n)
  } catch {}

  const startingStatus = (name) => {
    const n = noticed.get(name)
    if (n && n.kind === 'out') return n.on_time ? 'excused' : 'absent'
    return 'present'
  }

  const sessionId = genId()
  const session = stampTeam({
    id: sessionId,
    session_date: date,
    created_by: username,
    notes: '',
    created_at: new Date().toISOString(),
  }, teamNumber)

  // Everyone starts present and a lead taps down the few who aren't. That
  // is the shorter job at almost every meeting, and it beats the old rule
  // — present only if the app had been open in the last 30 seconds —
  // which marked the whole room absent whenever nobody had it open.
  const records = members.map(p => stampTeam({
    id: genId(),
    session_id: sessionId,
    username: p.display_name,
    status: startingStatus(p.display_name),
    marked_by: username,
    created_at: new Date().toISOString(),
  }, teamNumber))

  const sessRes = await fetch(`${REST_URL}/rest/v1/attendance_sessions`, {
    method: 'POST', headers: REST_JSON, body: JSON.stringify(session),
  })
  if (!sessRes.ok) {
    // 409 = the one-session-per-day unique index caught a race we lost.
    if (sessRes.status === 409) {
      const found = await existingSession(date, scope)
      if (found) return { session: found, records: await sessionRecords(found.id, teamNumber), created: false, profiles }
    }
    const errText = await sessRes.text()
    console.error('Session insert failed:', errText)
    throw new Error('Error creating session: ' + errText)
  }

  const recRes = await fetch(`${REST_URL}/rest/v1/attendance_records`, {
    method: 'POST', headers: REST_JSON, body: JSON.stringify(records),
  })
  if (!recRes.ok) {
    const errText = await recRes.text()
    console.error('Records insert failed:', errText)
    const err = new Error('Error saving records: ' + errText)
    err.session = session
    throw err
  }

  return { session, records, created: true, profiles }
}
