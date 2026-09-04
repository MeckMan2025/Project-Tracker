import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'
import { useUser } from '../contexts/UserContext'
import { usePermissions } from '../hooks/usePermissions'
import { ArrowLeft, ClipboardCheck, Trash2, Edit3, Plus, X, UserPlus, ChevronDown, ChevronUp, Clock } from 'lucide-react'
import { useAttendancePartial, presencePct, sessionDuration, recordTiming } from '../lib/attendancePartial'
import { excludedFromAttendance } from '../lib/attendanceRoster'

const REST_URL = import.meta.env.VITE_SUPABASE_URL
const REST_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const REST_HEADERS = { 'apikey': REST_KEY, 'Authorization': `Bearer ${REST_KEY}` }
const REST_JSON = { ...REST_HEADERS, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' }

function genId() {
  return String(Date.now()) + Math.random().toString(36).slice(2)
}

function todayStr() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const STATUS_COLORS = {
  present: 'bg-green-100 text-green-700',
  absent: 'bg-red-100 text-red-700',
  excused: 'bg-orange-100 text-orange-700',
  'no record': 'bg-gray-100 text-gray-400',
}

export default function AttendanceManager({ onBack }) {
  const { username } = useUser()
  const { hasLeadTag } = usePermissions()

  const [sessions, setSessions] = useState([])
  const [records, setRecords] = useState([])
  const [profiles, setProfiles] = useState([])
  const [selectedSession, setSelectedSession] = useState(null)
  const [editing, setEditing] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [addingUser, setAddingUser] = useState(false)
  const { partial, setSessionDurationMin, setTiming } = useAttendancePartial()
  const [expandedRec, setExpandedRec] = useState(null)
  // Guards "Start Today's Session" against repeat taps. The ref is what the
  // handler reads (state updates are async and a fast second tap would miss it).
  const creatingRef = useRef(false)
  const [creating, setCreating] = useState(false)
  // Who wrote a notebook entry, by meeting date. Attendance follows the
  // notebook: no entry means absent, an entry means present. Being late or
  // leaving early never decides it on its own.
  const [notebookByDate, setNotebookByDate] = useState({})
  const [applyingRule, setApplyingRule] = useState(false)

  // Mentors, coaches, team accounts and the ETS account are never part of
  // attendance — see lib/attendanceRoster.
  const excludeFromAttendance = excludedFromAttendance
  // Fetch all sessions, records, and profiles
  // Fetch sessions, records, profiles on mount
  useEffect(() => {
    const headers = REST_HEADERS
    Promise.all([
      fetch(`${REST_URL}/rest/v1/attendance_sessions?select=*&order=session_date.desc`, { headers }).then(r => r.ok ? r.json() : []),
      fetch(`${REST_URL}/rest/v1/attendance_records?select=*`, { headers }).then(r => r.ok ? r.json() : []),
      fetch(`${REST_URL}/rest/v1/profiles?select=display_name,authority_tier,function_tags,last_seen_at`, { headers }).then(r => r.ok ? r.json() : []),
      fetch(`${REST_URL}/rest/v1/notebook_entries?select=username,meeting_date`, { headers }).then(r => r.ok ? r.json() : []),
    ]).then(([s, r, p, n]) => {
      setSessions(s)
      setRecords(r)
      setProfiles(p)
      const by = {}
      for (const e of n || []) (by[e.meeting_date] ||= new Set()).add(e.username)
      setNotebookByDate(by)
    }).catch(() => {})
  }, [])

  // Refresh profiles every 10s to keep last_seen_at current
  useEffect(() => {
    const interval = setInterval(() => {
      fetch(`${REST_URL}/rest/v1/profiles?select=display_name,authority_tier,function_tags,last_seen_at`, { headers: REST_HEADERS })
        .then(r => r.ok ? r.json() : null)
        .then(p => { if (p) setProfiles(p) })
        .catch(() => {})
    }, 10000)
    return () => clearInterval(interval)
  }, [])

  // Real-time subscriptions
  useEffect(() => {
    const channel = supabase
      .channel('attendance-mgr-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_sessions' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setSessions(prev => prev.some(s => s.id === payload.new.id) ? prev : [payload.new, ...prev])
        } else if (payload.eventType === 'UPDATE') {
          setSessions(prev => prev.map(s => s.id === payload.new.id ? payload.new : s))
        } else if (payload.eventType === 'DELETE') {
          setSessions(prev => prev.filter(s => s.id !== payload.old.id))
          setSelectedSession(prev => prev?.id === payload.old.id ? null : prev)
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_records' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setRecords(prev => prev.some(r => r.id === payload.new.id) ? prev : [...prev, payload.new])
        } else if (payload.eventType === 'UPDATE') {
          setRecords(prev => prev.map(r => r.id === payload.new.id ? payload.new : r))
        } else if (payload.eventType === 'DELETE') {
          setRecords(prev => prev.filter(r => r.id !== payload.old.id))
        }
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  const showFeedback = (msg) => {
    setFeedback(msg)
    setTimeout(() => setFeedback(null), 3000)
  }

  // All profiles with a display name (exclude explicit guests)
  const teamMembers = profiles.filter(p => p.display_name && p.authority_tier !== 'guest' && !excludeFromAttendance(p))

  // Who's been seen in the last 15 seconds (heartbeat pings every 10s)
  const recentlySeen = (name) => {
    const p = profiles.find(pr => pr.display_name === name)
    if (!p?.last_seen_at) return false
    return (Date.now() - new Date(p.last_seen_at).getTime()) < 30 * 1000
  }

  // Pull today's session (plus its records) straight from the server and show it.
  // Used whenever a session already exists, so a second tap opens the real one
  // instead of creating a rival.
  const openExistingSession = async (existing) => {
    setSessions(prev => prev.some(s => s.id === existing.id) ? prev : [existing, ...prev])
    try {
      const res = await fetch(`${REST_URL}/rest/v1/attendance_records?session_id=eq.${existing.id}&select=*`, { headers: REST_HEADERS })
      if (res.ok) {
        const rows = await res.json()
        setRecords(prev => {
          const known = new Set(prev.map(r => r.id))
          return [...prev, ...rows.filter(r => !known.has(r.id))]
        })
      }
    } catch {}
    setSelectedSession(existing)
    setEditing(true)
  }

  const handleTakeAttendance = async () => {
    // Repeat taps used to each create their own session (12 duplicates for one
    // meeting), because the guard below ran before the awaits and the button
    // stayed live the whole time.
    if (creatingRef.current) return
    creatingRef.current = true
    setCreating(true)
    try {
      const today = todayStr()
      const localDupe = sessions.find(s => s.session_date === today)
      if (localDupe) {
        showFeedback('A session already exists for today. Opening it.')
        await openExistingSession(localDupe)
        return
      }

      // Local state goes stale when a tab is left open and the realtime socket
      // drops, so ask the server before inserting — that is how a second lead
      // ended up starting a session someone else had already started.
      try {
        const res = await fetch(`${REST_URL}/rest/v1/attendance_sessions?session_date=eq.${today}&select=*&order=created_at&limit=1`, { headers: REST_HEADERS })
        if (res.ok) {
          const rows = await res.json()
          if (rows.length > 0) {
            showFeedback('A session already exists for today. Opening it.')
            await openExistingSession(rows[0])
            return
          }
        }
      } catch {}

      // Re-fetch profiles right now to get fresh last_seen_at
      let freshProfiles = profiles
      try {
        const res = await fetch(`${REST_URL}/rest/v1/profiles?select=display_name,authority_tier,function_tags,last_seen_at`, { headers: REST_HEADERS })
        if (res.ok) {
          freshProfiles = await res.json()
          setProfiles(freshProfiles)
        }
      } catch {}

      const freshMembers = freshProfiles.filter(p => p.display_name && p.authority_tier !== 'guest' && !excludeFromAttendance(p))
      const isRecentlySeen = (name) => {
        const p = freshProfiles.find(pr => pr.display_name === name)
        if (!p?.last_seen_at) return false
        return (Date.now() - new Date(p.last_seen_at).getTime()) < 30 * 1000
      }

      const sessionId = genId()
      const session = {
        id: sessionId,
        session_date: today,
        created_by: username,
        notes: '',
        created_at: new Date().toISOString(),
      }

      // Mark recently active users as present, rest as absent
      const newRecords = freshMembers.map(p => ({
        id: genId(),
        session_id: sessionId,
        username: p.display_name,
        status: isRecentlySeen(p.display_name) ? 'present' : 'absent',
        marked_by: username,
        created_at: new Date().toISOString(),
      }))

      // Optimistic update
      setSessions(prev => [session, ...prev])
      setRecords(prev => [...prev, ...newRecords])

      try {
        const sessRes = await fetch(`${REST_URL}/rest/v1/attendance_sessions`, {
          method: 'POST', headers: REST_JSON, body: JSON.stringify(session),
        })
        if (!sessRes.ok) {
          // 409 = the one-session-per-day unique index caught a race we lost.
          if (sessRes.status === 409) {
            setSessions(prev => prev.filter(s => s.id !== sessionId))
            setRecords(prev => prev.filter(r => r.session_id !== sessionId))
            const dupeRes = await fetch(`${REST_URL}/rest/v1/attendance_sessions?session_date=eq.${today}&select=*&order=created_at&limit=1`, { headers: REST_HEADERS })
            const rows = dupeRes.ok ? await dupeRes.json() : []
            if (rows.length > 0) {
              showFeedback('Someone already started today\u2019s session. Opening it.')
              await openExistingSession(rows[0])
              return
            }
          }
          const errText = await sessRes.text()
          console.error('Session insert failed:', errText)
          setSessions(prev => prev.filter(s => s.id !== sessionId))
          setRecords(prev => prev.filter(r => r.session_id !== sessionId))
          showFeedback('Error creating session: ' + errText)
          return
        }
        // Insert records in batch
        const recRes = await fetch(`${REST_URL}/rest/v1/attendance_records`, {
          method: 'POST', headers: REST_JSON, body: JSON.stringify(newRecords),
        })
        if (!recRes.ok) {
          const errText = await recRes.text()
          console.error('Records insert failed:', errText)
          showFeedback('Error saving records: ' + errText)
          return
        }
        const presentCount = newRecords.filter(r => r.status === 'present').length
        showFeedback(`Session created! ${presentCount}/${newRecords.length} present.`)
        setSelectedSession(session)
        setEditing(true)
      } catch (err) {
        console.error('Failed to take attendance:', err)
        showFeedback('Error: ' + err.message)
      }
    } finally {
      creatingRef.current = false
      setCreating(false)
    }
  }

  const handleDeleteSession = async (sessionId) => {
    if (!window.confirm('Delete this attendance session? This cannot be undone.')) return
    setSessions(prev => prev.filter(s => s.id !== sessionId))
    setRecords(prev => prev.filter(r => r.session_id !== sessionId))
    if (selectedSession?.id === sessionId) {
      setSelectedSession(null)
      setEditing(false)
    }
    try {
      await fetch(`${REST_URL}/rest/v1/attendance_sessions?id=eq.${sessionId}`, {
        method: 'DELETE', headers: REST_HEADERS,
      })
    } catch (err) {
      console.error('Failed to delete session:', err)
    }
  }

  const handleToggleStatus = async (record) => {
    // A "no record" placeholder (member added after this meeting) has no DB row
    // yet — the first tap creates one, marked present, then it cycles normally.
    if (record.virtual) {
      const newRec = {
        id: genId(),
        session_id: record.session_id,
        username: record.username,
        status: 'present',
        marked_by: username,
        created_at: new Date().toISOString(),
      }
      setRecords(prev => [...prev, newRec])
      try {
        await fetch(`${REST_URL}/rest/v1/attendance_records`, {
          method: 'POST', headers: REST_JSON, body: JSON.stringify(newRec),
        })
      } catch (err) { console.error('Failed to create record:', err) }
      return
    }

    const cycle = ['present', 'absent', 'excused']
    const nextIdx = (cycle.indexOf(record.status) + 1) % cycle.length
    const newStatus = cycle[nextIdx]

    setRecords(prev => prev.map(r => r.id === record.id ? { ...r, status: newStatus, marked_by: username } : r))
    try {
      await fetch(`${REST_URL}/rest/v1/attendance_records?id=eq.${record.id}`, {
        method: 'PATCH', headers: REST_JSON,
        body: JSON.stringify({ status: newStatus, marked_by: username }),
      })
    } catch (err) {
      console.error('Failed to update record:', err)
    }
  }

  const handleAddPerson = async (personName, sessionId) => {
    const existing = records.find(r => r.session_id === sessionId && r.username === personName)
    if (existing) {
      showFeedback(`${personName} is already in this session.`)
      return
    }
    const record = {
      id: genId(),
      session_id: sessionId,
      username: personName,
      status: 'present',
      marked_by: username,
      created_at: new Date().toISOString(),
    }
    setRecords(prev => [...prev, record])
    setAddingUser(false)
    try {
      await fetch(`${REST_URL}/rest/v1/attendance_records`, {
        method: 'POST', headers: REST_JSON, body: JSON.stringify(record),
      })
    } catch (err) {
      console.error('Failed to add person:', err)
    }
  }

  const handleRemoveRecord = async (recordId) => {
    setRecords(prev => prev.filter(r => r.id !== recordId))
    try {
      await fetch(`${REST_URL}/rest/v1/attendance_records?id=eq.${recordId}`, {
        method: 'DELETE', headers: REST_HEADERS,
      })
    } catch (err) {
      console.error('Failed to remove record:', err)
    }
  }

  // Show every current team member on each meeting — real records as-is, plus a
  // neutral "no record" row for anyone (e.g. members added after the meeting was
  // logged) who doesn't have one yet. This way new members appear on all past
  // meetings automatically, ready for a lead to mark.
  const sessionRecords = selectedSession
    ? (() => {
        const sid = selectedSession.id
        const real = records.filter(r => r.session_id === sid)
        const haveRecord = new Set(real.map(r => r.username))
        const virtuals = teamMembers
          .filter(m => !haveRecord.has(m.display_name))
          .map(m => ({
            id: `virtual_${sid}_${m.display_name}`,
            session_id: sid,
            username: m.display_name,
            status: 'no record',
            virtual: true,
          }))
        return [...real, ...virtuals].sort((a, b) => a.username.localeCompare(b.username))
      })()
    : []

  // What the notebook rule would change for a session, in both directions.
  // 'excused' is a lead's deliberate call and is left alone.
  const notebookDiff = (session) => {
    if (!session) return { toAbsent: [], toPresent: [] }
    const wrote = notebookByDate[session.session_date] || new Set()
    const real = records.filter(r => r.session_id === session.id)
    return {
      toAbsent: real.filter(r => r.status === 'present' && !wrote.has(r.username)),
      toPresent: real.filter(r => r.status === 'absent' && wrote.has(r.username)),
    }
  }

  const applyNotebookRule = async (session = selectedSession, quiet = false) => {
    if (applyingRule || !session) return
    const { toAbsent, toPresent } = notebookDiff(session)
    if (toAbsent.length === 0 && toPresent.length === 0) return
    setApplyingRule(true)
    const ids = (list) => list.map(r => r.id).join(',')
    const patch = async (list, status) => {
      if (list.length === 0) return
      await fetch(`${REST_URL}/rest/v1/attendance_records?id=in.(${ids(list)})`, {
        method: 'PATCH', headers: REST_JSON,
        body: JSON.stringify({ status, marked_by: username }),
      })
    }
    const changed = new Map()
    toAbsent.forEach(r => changed.set(r.id, 'absent'))
    toPresent.forEach(r => changed.set(r.id, 'present'))
    setRecords(prev => prev.map(r => changed.has(r.id) ? { ...r, status: changed.get(r.id), marked_by: username } : r))
    try {
      await Promise.all([patch(toAbsent, 'absent'), patch(toPresent, 'present')])
      if (!quiet) {
        const bits = [
          toAbsent.length ? `${toAbsent.length} marked absent` : '',
          toPresent.length ? `${toPresent.length} marked present` : '',
        ].filter(Boolean).join(' · ')
        showFeedback(bits)
      }
    } catch (err) {
      console.error('Failed to apply the notebook rule:', err)
      showFeedback('Could not apply it — try again')
    } finally {
      setApplyingRule(false)
    }
  }

  // The deadline is the end of the meeting day. Once a day is over, anyone
  // without an entry for it is absent — so any past session a lead opens gets
  // settled automatically. Today's is left alone; there's still time to write.
  const settledRef = useRef(false)
  useEffect(() => {
    if (settledRef.current || !hasLeadTag) return
    if (sessions.length === 0 || records.length === 0) return
    if (Object.keys(notebookByDate).length === 0) return
    const today = todayStr()
    const past = sessions.filter(s => s.session_date < today)
    const pending = past.filter(s => {
      const d = notebookDiff(s)
      return d.toAbsent.length > 0 || d.toPresent.length > 0
    })
    if (pending.length === 0) return
    settledRef.current = true
    ;(async () => { for (const s of pending) await applyNotebookRule(s, true) })()
  }, [sessions, records, notebookByDate, hasLeadTag]) // eslint-disable-line

  const getSessionSummary = (sessionId) => {
    const sr = records.filter(r => r.session_id === sessionId)
    const present = sr.filter(r => r.status === 'present').length
    return { present, total: sr.length }
  }

  // Detail view for a specific session
  if (selectedSession) {
    const usersInSession = sessionRecords.map(r => r.username)
    const addableUsers = profiles
      .filter(p => p.authority_tier !== 'guest' && !excludeFromAttendance(p) && !usersInSession.includes(p.display_name))
      .map(p => p.display_name)
      .sort()

    return (
      <div className="flex-1 p-4 overflow-y-auto">
        <div className="max-w-lg mx-auto space-y-4">
          <button
            onClick={() => { setSelectedSession(null); setEditing(false); setAddingUser(false) }}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            <ArrowLeft size={14} /> Back to Sessions
          </button>

          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-800">
                {new Date(selectedSession.session_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
              </h2>
              <p className="text-xs text-gray-400">Created by {selectedSession.created_by}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setEditing(!editing)}
                className={`p-2 rounded-lg transition-colors ${editing ? 'bg-pastel-blue text-gray-800' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
                title={editing ? 'Done editing' : 'Edit'}
              >
                <Edit3 size={16} />
              </button>
              <button
                onClick={() => handleDeleteSession(selectedSession.id)}
                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                title="Delete session"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>

          {feedback && (
            <div className="text-center text-green-600 font-medium animate-pulse text-sm">{feedback}</div>
          )}

          {/* Today's session hasn't hit its deadline yet, so the rule is offered
              rather than applied. Past days settle themselves on load. */}
          {hasLeadTag && (() => {
            const { toAbsent, toPresent } = notebookDiff(selectedSession)
            if (toAbsent.length === 0 && toPresent.length === 0) return null
            const bits = [
              toAbsent.length ? `${toAbsent.length} without an entry → absent` : '',
              toPresent.length ? `${toPresent.length} wrote one → present` : '',
            ].filter(Boolean).join(' · ')
            return (
              <button
                onClick={() => applyNotebookRule()}
                disabled={applyingRule}
                className="w-full px-4 py-2.5 rounded-xl bg-pastel-orange/30 hover:bg-pastel-orange/50 disabled:opacity-50 transition-colors text-sm font-semibold text-gray-700 text-left"
              >
                {applyingRule ? 'Applying…' : 'Match attendance to the notebook'}
                <span className="block text-xs font-normal text-gray-500 mt-0.5">{bits}</span>
              </button>
            )
          })()}

          <div className="bg-white rounded-xl p-3 shadow-sm flex items-center justify-between gap-3">
            <div className="text-sm text-gray-500">
              {sessionRecords.filter(r => r.status === 'present').length} present / {sessionRecords.filter(r => r.status !== 'no record').length} marked
            </div>
            <label className="flex items-center gap-1.5 text-xs text-gray-500 shrink-0">
              Meeting length
              <input
                type="number" min="1"
                value={sessionDuration(selectedSession.id, partial, selectedSession.session_date)}
                onChange={e => setSessionDurationMin(selectedSession.id, e.target.value)}
                className="w-16 text-sm border rounded-lg px-2 py-1 focus:ring-2 focus:ring-pastel-blue focus:border-transparent"
              /> min
            </label>
          </div>

          <div className="space-y-2">
            {sessionRecords.map(r => {
              const present = r.status === 'present'
              const t = recordTiming(selectedSession.id, r.username, partial)
              const pct = presencePct(selectedSession.id, r.username, r.status, partial, selectedSession.session_date)
              const open = expandedRec === r.id
              const tag = (mins, exc, label) => mins ? `${label} ${mins}m${exc ? ' (exc)' : ''}` : ''
              const timingLine = [tag(t.lateMin, t.lateExcused, 'late'), tag(t.earlyMin, t.earlyExcused, 'left')].filter(Boolean).join(' · ')
              return (
                <div key={r.id} className="bg-white rounded-xl shadow-sm">
                  <div className="p-3 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-gray-700">{r.username}</span>
                      {present && timingLine && <div className="text-[11px] text-gray-400 mt-0.5">{timingLine}</div>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {present && (
                        <span className={`text-xs font-bold ${pct >= 80 ? 'text-green-600' : pct >= 50 ? 'text-yellow-600' : 'text-red-500'}`}>{pct}%</span>
                      )}
                      <button
                        onClick={() => editing && handleToggleStatus(r)}
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[r.status] || 'bg-gray-100 text-gray-500'} ${editing ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
                      >
                        {r.status}
                      </button>
                      {editing && present && (
                        <button
                          onClick={() => setExpandedRec(open ? null : r.id)}
                          title="Late / left early"
                          className={`p-1 rounded-lg transition-colors ${open ? 'bg-pastel-blue text-gray-700' : 'text-gray-400 hover:bg-gray-100'}`}
                        >
                          <Clock size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                  {editing && present && open && (
                    <div className="px-3 pb-3 pt-2 border-t border-gray-100 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 w-24 shrink-0">Late (min)</span>
                        <input type="number" min="0" value={t.lateMin || ''} placeholder="0"
                          onChange={e => setTiming(selectedSession.id, r.username, { lateMin: Math.max(0, Number(e.target.value) || 0) })}
                          className="w-20 text-sm border rounded-lg px-2 py-1 focus:ring-2 focus:ring-pastel-blue focus:border-transparent" />
                        <label className="flex items-center gap-1 text-xs text-gray-500 ml-auto">
                          <input type="checkbox" checked={!!t.lateExcused} onChange={e => setTiming(selectedSession.id, r.username, { lateExcused: e.target.checked })} /> excused
                        </label>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 w-24 shrink-0">Left early (min)</span>
                        <input type="number" min="0" value={t.earlyMin || ''} placeholder="0"
                          onChange={e => setTiming(selectedSession.id, r.username, { earlyMin: Math.max(0, Number(e.target.value) || 0) })}
                          className="w-20 text-sm border rounded-lg px-2 py-1 focus:ring-2 focus:ring-pastel-blue focus:border-transparent" />
                        <label className="flex items-center gap-1 text-xs text-gray-500 ml-auto">
                          <input type="checkbox" checked={!!t.earlyExcused} onChange={e => setTiming(selectedSession.id, r.username, { earlyExcused: e.target.checked })} /> excused
                        </label>
                      </div>
                      <p className="text-[11px] text-gray-400">Present for <b>{pct}%</b> of the {sessionDuration(selectedSession.id, partial, selectedSession.session_date)}-min meeting.</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {editing && (
            <div>
              {addingUser ? (
                <div className="bg-white rounded-xl p-3 shadow-sm space-y-2">
                  <p className="text-xs font-semibold text-gray-500">Add a person</p>
                  {addableUsers.length === 0 ? (
                    <p className="text-xs text-gray-400">All team members are already in this session.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {addableUsers.map(name => (
                        <button
                          key={name}
                          onClick={() => handleAddPerson(name, selectedSession.id)}
                          className="px-2 py-1 text-xs rounded-lg bg-pastel-blue/30 hover:bg-pastel-blue/50 text-gray-700 transition-colors"
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                  )}
                  <button onClick={() => setAddingUser(false)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                </div>
              ) : (
                <button
                  onClick={() => setAddingUser(true)}
                  className="w-full px-4 py-2 rounded-xl border-2 border-dashed border-gray-200 hover:border-gray-300 text-sm text-gray-400 hover:text-gray-600 transition-colors flex items-center justify-center gap-1"
                >
                  <UserPlus size={14} /> Add Person
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  // Session list view
  return (
    <div className="flex-1 p-4 overflow-y-auto">
      <div className="max-w-lg mx-auto space-y-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft size={14} /> Back
        </button>

        <div className="flex items-center gap-2">
          <ClipboardCheck size={20} className="text-pastel-blue-dark" />
          <h2 className="text-lg font-bold text-gray-800">Attendance Manager</h2>
        </div>

        {feedback && (
          <div className="text-center text-green-600 font-medium animate-pulse text-sm">{feedback}</div>
        )}

        <button
          onClick={handleTakeAttendance}
          disabled={creating}
          className="w-full px-4 py-3 rounded-xl bg-pastel-blue/40 hover:bg-pastel-blue/60 disabled:opacity-50 disabled:hover:bg-pastel-blue/40 disabled:cursor-not-allowed transition-colors text-sm font-semibold text-gray-700"
        >
          {creating ? 'Starting\u2026' : "Start Today's Session"}
        </button>
        <p className="text-xs text-gray-400 text-center -mt-2">
          {(() => {
            const online = teamMembers.filter(p => recentlySeen(p.display_name))
            return online.length > 0
              ? `${online.length} online: ${online.map(p => p.display_name).join(', ')}`
              : 'No users detected online yet'
          })()}
          {' — '}leads can edit after.
        </p>

        {sessions.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No attendance sessions yet.</p>
        ) : (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-500">Past Sessions ({sessions.length})</h3>
            {sessions.map(s => {
              const { present, total } = getSessionSummary(s.id)
              return (
                <button
                  key={s.id}
                  onClick={() => setSelectedSession(s)}
                  className="w-full bg-white rounded-xl p-3 shadow-sm hover:shadow-md transition-all text-left flex items-center justify-between"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-700">
                      {new Date(s.session_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </p>
                    <p className="text-xs text-gray-400">by {s.created_by}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-semibold text-gray-600">{present}/{total}</span>
                    <p className="text-xs text-gray-400">present</p>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
