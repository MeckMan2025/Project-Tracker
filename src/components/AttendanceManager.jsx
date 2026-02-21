import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useUser } from '../contexts/UserContext'
import { usePermissions } from '../hooks/usePermissions'
import { usePresence } from '../hooks/usePresence'
import { ArrowLeft, ClipboardCheck, Trash2, Edit3, Plus, X, UserPlus, ChevronDown, ChevronUp } from 'lucide-react'

const REST_URL = import.meta.env.VITE_SUPABASE_URL
const REST_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const REST_HEADERS = { 'apikey': REST_KEY, 'Authorization': `Bearer ${REST_KEY}` }
const REST_JSON = { ...REST_HEADERS, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' }

function genId() {
  return String(Date.now()) + Math.random().toString(36).slice(2)
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

const STATUS_COLORS = {
  present: 'bg-green-100 text-green-700',
  absent: 'bg-red-100 text-red-700',
  excused: 'bg-orange-100 text-orange-700',
}

export default function AttendanceManager({ onBack }) {
  const { username } = useUser()
  const { hasLeadTag } = usePermissions()
  const { onlineUsers } = usePresence(username)

  const [sessions, setSessions] = useState([])
  const [records, setRecords] = useState([])
  const [profiles, setProfiles] = useState([])
  const [selectedSession, setSelectedSession] = useState(null)
  const [editing, setEditing] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [addingUser, setAddingUser] = useState(false)

  // Fetch all sessions, records, and profiles
  useEffect(() => {
    const headers = REST_HEADERS
    Promise.all([
      fetch(`${REST_URL}/rest/v1/attendance_sessions?select=*&order=session_date.desc`, { headers }).then(r => r.ok ? r.json() : []),
      fetch(`${REST_URL}/rest/v1/attendance_records?select=*`, { headers }).then(r => r.ok ? r.json() : []),
      fetch(`${REST_URL}/rest/v1/profiles?select=display_name,authority_tier,function_tags`, { headers }).then(r => r.ok ? r.json() : []),
    ]).then(([s, r, p]) => {
      setSessions(s)
      setRecords(r)
      setProfiles(p)
    }).catch(() => {})
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

  // Get non-guest profiles
  const teamMembers = profiles.filter(p => p.authority_tier !== 'guest')
  const onlineUsernames = (onlineUsers || []).filter(u => u.username && u.username !== '_anonymous').map(u => u.username)

  const handleTakeAttendance = async () => {
    const today = todayStr()
    if (sessions.some(s => s.session_date === today)) {
      showFeedback('A session already exists for today. Open it to edit.')
      return
    }

    const sessionId = genId()
    const session = {
      id: sessionId,
      session_date: today,
      created_by: username,
      notes: '',
      created_at: new Date().toISOString(),
    }

    const newRecords = teamMembers.map(p => ({
      id: genId(),
      session_id: sessionId,
      username: p.display_name,
      status: onlineUsernames.includes(p.display_name) ? 'present' : 'absent',
      marked_by: username,
      created_at: new Date().toISOString(),
    }))

    // Optimistic update
    setSessions(prev => [session, ...prev])
    setRecords(prev => [...prev, ...newRecords])

    try {
      await fetch(`${REST_URL}/rest/v1/attendance_sessions`, {
        method: 'POST', headers: REST_JSON, body: JSON.stringify(session),
      })
      // Insert records in batch
      await fetch(`${REST_URL}/rest/v1/attendance_records`, {
        method: 'POST', headers: REST_JSON, body: JSON.stringify(newRecords),
      })
      showFeedback(`Attendance taken! ${newRecords.filter(r => r.status === 'present').length}/${newRecords.length} present.`)
    } catch (err) {
      console.error('Failed to take attendance:', err)
      showFeedback('Error saving attendance.')
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

  const sessionRecords = selectedSession
    ? records.filter(r => r.session_id === selectedSession.id).sort((a, b) => a.username.localeCompare(b.username))
    : []

  const getSessionSummary = (sessionId) => {
    const sr = records.filter(r => r.session_id === sessionId)
    const present = sr.filter(r => r.status === 'present').length
    return { present, total: sr.length }
  }

  // Detail view for a specific session
  if (selectedSession) {
    const usersInSession = sessionRecords.map(r => r.username)
    const addableUsers = profiles
      .filter(p => p.authority_tier !== 'guest' && !usersInSession.includes(p.display_name))
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

          <div className="text-sm text-gray-500">
            {sessionRecords.filter(r => r.status === 'present').length} present / {sessionRecords.length} total
          </div>

          <div className="space-y-2">
            {sessionRecords.map(r => (
              <div key={r.id} className="bg-white rounded-xl p-3 shadow-sm flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-gray-700">{r.username}</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => editing && handleToggleStatus(r)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[r.status] || 'bg-gray-100 text-gray-500'} ${editing ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
                  >
                    {r.status}
                  </button>
                  {editing && (
                    <button
                      onClick={() => handleRemoveRecord(r.id)}
                      className="text-gray-300 hover:text-red-400 transition-colors"
                      title="Remove"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
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
          className="w-full px-4 py-3 rounded-xl bg-pastel-blue/40 hover:bg-pastel-blue/60 transition-colors text-sm font-semibold text-gray-700"
        >
          Take Attendance Now
        </button>
        <p className="text-xs text-gray-400 text-center -mt-2">
          Marks online users as present, offline as absent. One session per day.
          <br />Currently online: {onlineUsernames.length > 0 ? onlineUsernames.join(', ') : 'none detected'}
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
