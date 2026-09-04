import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabase'
import { useUser } from '../contexts/UserContext'
import { usePermissions } from '../hooks/usePermissions'
import NotificationBell from './NotificationBell'
import { Download } from 'lucide-react'
import { ArrowLeft, ChevronRight } from 'lucide-react'
import { useAttendancePartial, presencePct, recordTiming } from '../lib/attendancePartial'
import { excludedAttName, excludedNamesFrom } from '../lib/attendanceRoster'

const REST_URL = import.meta.env.VITE_SUPABASE_URL
const REST_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const REST_HEADERS = { 'apikey': REST_KEY, 'Authorization': `Bearer ${REST_KEY}` }

const STATUS_COLORS = {
  present: 'bg-green-100 text-green-700',
  absent: 'bg-red-100 text-red-700',
  excused: 'bg-orange-100 text-orange-700',
}

// Inline SVG line chart of presence % across recent meetings (no dependencies).
function TrendChart({ points, color = '#6366f1' }) {
  const pts = points.slice(-12) // last 12 meetings
  if (pts.length < 1) return null
  const W = 320, H = 132, padL = 26, padR = 10, padT = 10, padB = 22
  const plotW = W - padL - padR, plotH = H - padT - padB
  const n = pts.length
  const x = (i) => n <= 1 ? padL + plotW / 2 : padL + (i * plotW) / (n - 1)
  const y = (v) => padT + plotH - (Math.max(0, Math.min(100, v)) / 100) * plotH
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.pct).toFixed(1)}`).join(' ')
  const area = `${line} L${x(n - 1).toFixed(1)},${y(0).toFixed(1)} L${x(0).toFixed(1)},${y(0).toFixed(1)} Z`
  const fmt = (d) => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const avg = Math.round(pts.reduce((a, b) => a + b.pct, 0) / n)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 150 }} preserveAspectRatio="xMidYMid meet">
      {[0, 50, 100].map(g => (
        <g key={g}>
          <line x1={padL} x2={W - padR} y1={y(g)} y2={y(g)} stroke="#eef2f7" strokeWidth="1" />
          <text x={padL - 5} y={y(g) + 3} textAnchor="end" fontSize="8" fill="#9ca3af">{g}</text>
        </g>
      ))}
      <path d={area} fill={color} opacity="0.08" />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p, i) => <circle key={i} cx={x(i)} cy={y(p.pct)} r="2.6" fill={color} />)}
      {pts.map((p, i) => (i === 0 || i === n - 1 || (n >= 5 && i === Math.floor((n - 1) / 2))) ? (
        <text key={'x' + i} x={x(i)} y={H - 6} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'} fontSize="8" fill="#9ca3af">{fmt(p.date)}</text>
      ) : null)}
      <text x={W - padR} y={padT + 2} textAnchor="end" fontSize="9" fill={color} fontWeight="700">avg {avg}%</text>
    </svg>
  )
}

export default function AttendanceView() {
  const { username } = useUser()
  const { canViewAllAttendance, canViewOwnAttendance, hasLeadTag } = usePermissions()

  const [sessions, setSessions] = useState([])
  const [records, setRecords] = useState([])
  const [selectedUser, setSelectedUser] = useState(null)
  const [profiles, setProfiles] = useState([])
  const { partial } = useAttendancePartial()

  // Mentors and coaches are tagged, not named, so the roster rules need the
  // profile rows — records only carry a username.
  const excludedNames = useMemo(() => excludedNamesFrom(profiles), [profiles])
  const isExcluded = (name) => excludedAttName(name) || excludedNames.has(name)

  useEffect(() => {
    const headers = REST_HEADERS
    Promise.all([
      fetch(`${REST_URL}/rest/v1/attendance_sessions?select=*&order=session_date.desc`, { headers }).then(r => r.ok ? r.json() : []),
      // All records are loaded so everyone can see the team-average trend;
      // individual names/rates stay gated to leads in the Team Overview list.
      fetch(`${REST_URL}/rest/v1/attendance_records?select=*`, { headers }).then(r => r.ok ? r.json() : []),
      fetch(`${REST_URL}/rest/v1/profiles?select=display_name,function_tags`, { headers }).then(r => r.ok ? r.json() : []),
    ]).then(([s, r, p]) => {
      setSessions(s)
      setRecords(r)
      setProfiles(p)
    }).catch(() => {})
  }, [username, canViewAllAttendance])

  // Real-time
  useEffect(() => {
    const channel = supabase
      .channel('attendance-view-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_sessions' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setSessions(prev => prev.some(s => s.id === payload.new.id) ? prev : [payload.new, ...prev])
        } else if (payload.eventType === 'UPDATE') {
          setSessions(prev => prev.map(s => s.id === payload.new.id ? payload.new : s))
        } else if (payload.eventType === 'DELETE') {
          setSessions(prev => prev.filter(s => s.id !== payload.old.id))
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_records' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const rec = payload.new
          setRecords(prev => prev.some(r => r.id === rec.id) ? prev : [...prev, rec])
        } else if (payload.eventType === 'UPDATE') {
          setRecords(prev => prev.map(r => r.id === payload.new.id ? payload.new : r))
        } else if (payload.eventType === 'DELETE') {
          setRecords(prev => prev.filter(r => r.id !== payload.old.id))
        }
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [canViewAllAttendance, username])

  // Presence-weighted rate: average of "% of each meeting they were present for"
  // across all sessions (0 for absent/excused/no-record).
  const statusFor = (name, sid) => (records.find(r => r.session_id === sid && r.username === name)?.status) || 'no record'
  const rateFor = (name) => sessions.length > 0
    ? Math.round(sessions.reduce((sum, s) => sum + presencePct(s.id, name, statusFor(name, s.id), partial, s.session_date), 0) / sessions.length)
    : 0

  // Personal stats
  const myRecords = records.filter(r => r.username === username)
  const myPresent = myRecords.filter(r => r.status === 'present').length
  const myExcused = myRecords.filter(r => r.status === 'excused').length
  const myAttendanceRate = rateFor(username)

  // Team stats (leads only) — mentors, coaches, teams and ETS are excluded
  const teamStats = canViewAllAttendance ? (() => {
    const byUser = {}
    records.forEach(r => {
      if (isExcluded(r.username)) return
      if (!byUser[r.username]) byUser[r.username] = { present: 0, absent: 0, excused: 0, total: 0 }
      byUser[r.username][r.status] = (byUser[r.username][r.status] || 0) + 1
      byUser[r.username].total++
    })
    return Object.entries(byUser)
      .map(([name, stats]) => ({ name, ...stats, rate: rateFor(name) }))
      .sort((a, b) => b.rate - a.rate)
  })() : []

  // Per-user session breakdown
  if (selectedUser) {
    const userRecords = records.filter(r => r.username === selectedUser)
    const userRecordMap = {}
    userRecords.forEach(r => { userRecordMap[r.session_id] = r.status })

    return (
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
          <div className="px-4 py-3 ml-14 flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-pastel-blue-dark via-pastel-pink-dark to-pastel-orange-dark bg-clip-text text-transparent">
                Attendance
              </h1>
              <p className="text-sm text-gray-500">{selectedUser}'s record</p>
            </div>
            <NotificationBell />
          </div>
        </header>
        <div className="flex-1 p-4 overflow-y-auto">
          <div className="max-w-lg mx-auto space-y-4">
            <button
              onClick={() => setSelectedUser(null)}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              <ArrowLeft size={14} /> Back to overview
            </button>

            <h2 className="text-lg font-semibold text-gray-800">{selectedUser}</h2>

            {sessions.length >= 1 && (
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-500 mb-2">Trend</h3>
                <TrendChart points={[...sessions].reverse().map(s => ({ date: s.session_date, pct: presencePct(s.id, selectedUser, userRecordMap[s.id] || 'no record', partial, s.session_date) }))} />
              </div>
            )}

            <div className="space-y-2">
              {sessions.map(s => {
                const status = userRecordMap[s.id] || 'no record'
                const colorClass = STATUS_COLORS[status] || 'bg-gray-100 text-gray-400'
                const pct = presencePct(s.id, selectedUser, status, partial, s.session_date)
                const t = recordTiming(s.id, selectedUser, partial)
                const tag = [t.lateMin ? `late ${t.lateMin}m${t.lateExcused ? ' (exc)' : ''}` : '', t.earlyMin ? `left ${t.earlyMin}m${t.earlyExcused ? ' (exc)' : ''}` : ''].filter(Boolean).join(' · ')
                return (
                  <div key={s.id} className="bg-white rounded-xl p-3 shadow-sm flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-sm text-gray-700">
                        {new Date(s.session_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      </span>
                      {status === 'present' && tag && <div className="text-[11px] text-gray-400">{tag}</div>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {status === 'present' && <span className={`text-xs font-bold ${pct >= 80 ? 'text-green-600' : pct >= 50 ? 'text-yellow-600' : 'text-red-500'}`}>{pct}%</span>}
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${colorClass}`}>{status}</span>
                    </div>
                  </div>
                )
              })}
              {sessions.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-6">No sessions yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  const exportCSV = () => {
    const byId = Object.fromEntries(sessions.map(s => [s.id, s]))
    const rows = [...records]
      .map(r => ({
        date: byId[r.session_id]?.session_date || '',
        session: byId[r.session_id]?.notes || '',
        name: r.username,
        status: r.status,
        markedBy: r.marked_by || '',
      }))
      .sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name))

    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const csv = [
      ['Date', 'Session', 'Name', 'Status', 'Marked by'].join(','),
      ...rows.map(r => [r.date, r.session, r.name, r.status, r.markedBy].map(esc).join(',')),
    ].join('\n')

    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `attendance-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="px-4 py-3 ml-14 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-pastel-blue-dark via-pastel-pink-dark to-pastel-orange-dark bg-clip-text text-transparent">
              Attendance
            </h1>
            <p className="text-sm text-gray-500">Track your meeting attendance</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Always shown, next to the bell — hiding it when there's no data
                just made it look missing. Disabled when there's nothing to send. */}
            <button
              onClick={exportCSV}
              disabled={records.length === 0}
              title={records.length === 0 ? 'No attendance recorded yet' : 'Download attendance as CSV'}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-pastel-pink hover:bg-pastel-pink-dark disabled:opacity-40 disabled:hover:bg-pastel-pink text-gray-700 transition-colors"
            >
              <Download size={13} /> Export
            </button>
            <NotificationBell />
          </div>
        </div>
      </header>

      <div className="flex-1 p-4 overflow-y-auto">
        <div className="max-w-lg mx-auto space-y-6">

          {/* Personal Stats Card */}
          {canViewOwnAttendance && (
            <div className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
              <h3 className="text-sm font-semibold text-gray-500">Your Attendance</h3>
              <div className="flex items-end gap-4">
                <div className="text-3xl font-bold text-gray-800">{myAttendanceRate}%</div>
                <div className="text-xs text-gray-400 pb-1">
                  {myPresent} present / {sessions.length} sessions
                  {myExcused > 0 && ` (${myExcused} excused)`}
                </div>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2.5">
                <div
                  className="h-2.5 rounded-full transition-all duration-500"
                  style={{
                    width: `${myAttendanceRate}%`,
                    background: myAttendanceRate >= 80 ? '#86efac' : myAttendanceRate >= 50 ? '#fde68a' : '#fca5a5',
                  }}
                />
              </div>
            </div>
          )}

          {/* Personal Trend */}
          {sessions.length >= 1 && (
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-500 mb-2">Your Trend</h3>
              <TrendChart points={[...sessions].reverse().map(s => ({ date: s.session_date, pct: presencePct(s.id, username, statusFor(username, s.id), partial, s.session_date) }))} />
            </div>
          )}

          {/* Personal History */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-500">Your History</h3>
            {sessions.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No attendance sessions yet.</p>
            ) : (
              sessions.map(s => {
                const myRecord = myRecords.find(r => r.session_id === s.id)
                const status = myRecord ? myRecord.status : 'no record'
                const colorClass = STATUS_COLORS[status] || 'bg-gray-100 text-gray-400'
                const pct = presencePct(s.id, username, status, partial, s.session_date)
                const t = recordTiming(s.id, username, partial)
                const tag = [t.lateMin ? `late ${t.lateMin}m${t.lateExcused ? ' (exc)' : ''}` : '', t.earlyMin ? `left ${t.earlyMin}m${t.earlyExcused ? ' (exc)' : ''}` : ''].filter(Boolean).join(' · ')
                return (
                  <div key={s.id} className="bg-white rounded-xl p-3 shadow-sm flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-sm text-gray-700">
                        {new Date(s.session_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      </span>
                      {status === 'present' && tag && <div className="text-[11px] text-gray-400">{tag}</div>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {status === 'present' && <span className={`text-xs font-bold ${pct >= 80 ? 'text-green-600' : pct >= 50 ? 'text-yellow-600' : 'text-red-500'}`}>{pct}%</span>}
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${colorClass}`}>{status}</span>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Team Trend — visible to everyone (aggregate average, no names) */}
          {sessions.length >= 1 && (
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-500 mb-2">Team Trend (average)</h3>
              <TrendChart
                color="#10b981"
                points={[...sessions].reverse().map(s => {
                  const recs = records.filter(r => r.session_id === s.id && !isExcluded(r.username))
                  const vals = recs.map(r => presencePct(s.id, r.username, r.status, partial, s.session_date))
                  return { date: s.session_date, pct: vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0 }
                })}
              />
            </div>
          )}

          {/* Lead-only Team Overview */}
          {canViewAllAttendance && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-500">Team Overview</h3>
              {teamStats.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No records yet.</p>
              ) : (
                teamStats.map(u => (
                  <button
                    key={u.name}
                    onClick={() => setSelectedUser(u.name)}
                    className="w-full bg-white rounded-xl p-3 shadow-sm hover:shadow-md transition-all flex items-center justify-between text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-700 truncate">{u.name}</span>
                        <span className={`text-xs font-semibold ${u.rate >= 80 ? 'text-green-600' : u.rate >= 50 ? 'text-yellow-600' : 'text-red-500'}`}>
                          {u.rate}%
                        </span>
                      </div>
                      <div className="flex gap-3 text-xs text-gray-400 mt-0.5">
                        <span>{u.present}P</span>
                        <span>{u.absent}A</span>
                        {u.excused > 0 && <span>{u.excused}E</span>}
                      </div>
                    </div>
                    <ChevronRight size={14} className="text-gray-300 shrink-0" />
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
