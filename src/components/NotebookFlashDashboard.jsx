import { useState, useEffect } from 'react'
import { ArrowLeft, Zap, ZapOff, Check, Clock, Ban, Bell } from 'lucide-react'
import { useUser } from '../contexts/UserContext'
import { useNotebookFlash } from '../hooks/useNotebookFlash'

const REST_URL = import.meta.env.VITE_SUPABASE_URL
const REST_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const REST_HEADERS = { 'apikey': REST_KEY, 'Authorization': `Bearer ${REST_KEY}` }
const REST_JSON = { ...REST_HEADERS, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' }

async function restGet(table, query = '') {
  const res = await fetch(`${REST_URL}/rest/v1/${table}?${query}`, { headers: REST_HEADERS })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export default function NotebookFlashDashboard({ onBack }) {
  const { username } = useUser()
  const { activeFlash, presentUsers, completedUsers, exemptUsers, loading, refetch } = useNotebookFlash()
  const [sessions, setSessions] = useState([])
  const [selectedSessionId, setSelectedSessionId] = useState('')
  const [starting, setStarting] = useState(false)
  const [ending, setEnding] = useState(false)
  const [error, setError] = useState('')

  // Load today's attendance sessions for the start dropdown
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]
    restGet('attendance_sessions', `session_date=eq.${today}&select=*&order=created_at.desc`)
      .then(setSessions)
      .catch(() => {})
  }, [])

  const handleStartFlash = async () => {
    if (!selectedSessionId || starting) return
    setStarting(true)
    setError('')
    try {
      const flash = {
        id: String(Date.now()) + Math.random().toString(36).slice(2),
        session_id: selectedSessionId,
        started_by: username,
        is_active: true,
        exempt_users: [],
      }
      const res = await fetch(`${REST_URL}/rest/v1/notebook_flash`, {
        method: 'POST', headers: REST_JSON, body: JSON.stringify(flash),
      })
      if (!res.ok) throw new Error(await res.text())
      refetch()
    } catch (err) {
      console.error('Failed to start flash:', err)
      setError('Failed to start flash. Please try again.')
    } finally {
      setStarting(false)
    }
  }

  const handleEndFlash = async () => {
    if (!activeFlash || ending) return
    setEnding(true)
    setError('')
    try {
      const res = await fetch(`${REST_URL}/rest/v1/notebook_flash?id=eq.${activeFlash.id}`, {
        method: 'PATCH', headers: REST_JSON,
        body: JSON.stringify({ is_active: false, ended_at: new Date().toISOString() }),
      })
      if (!res.ok) throw new Error(await res.text())
      refetch()
    } catch (err) {
      console.error('Failed to end flash:', err)
      setError('Failed to end flash. Please try again.')
    } finally {
      setEnding(false)
    }
  }

  const handleToggleExempt = async (user) => {
    if (!activeFlash) return
    const current = activeFlash.exempt_users || []
    const updated = current.includes(user)
      ? current.filter(u => u !== user)
      : [...current, user]
    try {
      const res = await fetch(`${REST_URL}/rest/v1/notebook_flash?id=eq.${activeFlash.id}`, {
        method: 'PATCH', headers: REST_JSON,
        body: JSON.stringify({ exempt_users: updated }),
      })
      if (!res.ok) throw new Error(await res.text())
      refetch()
    } catch (err) {
      console.error('Failed to update exempt list:', err)
    }
  }

  const handleSendReminder = async (targetUsername) => {
    try {
      // Look up user's profile id
      const profiles = await restGet('profiles', `display_name=ilike.${encodeURIComponent(targetUsername)}&select=id`)
      if (!profiles || profiles.length === 0) return
      const notif = {
        id: String(Date.now()) + Math.random().toString(36).slice(2),
        user_id: profiles[0].id,
        type: 'flash_reminder',
        title: 'Notebook Flash Reminder',
        body: `${username} is reminding you to submit your notebook entry!`,
      }
      await fetch(`${REST_URL}/rest/v1/notifications`, {
        method: 'POST', headers: REST_JSON, body: JSON.stringify(notif),
      })
    } catch (err) {
      console.error('Failed to send reminder:', err)
    }
  }

  const getUserStatus = (user) => {
    if (exemptUsers.includes(user)) return 'exempt'
    if (completedUsers.includes(user)) return 'completed'
    return 'pending'
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-gray-400 animate-pulse">Loading flash status...</div>
      </div>
    )
  }

  return (
    <div className="flex-1 p-6 overflow-y-auto">
      <div className="max-w-xl mx-auto space-y-6">
        {/* Back button */}
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft size={16} /> Back to Special Controls
        </button>

        <h2 className="text-xl font-bold bg-gradient-to-r from-pastel-blue-dark via-pastel-pink-dark to-pastel-orange-dark bg-clip-text text-transparent">
          Notebook Flash
        </h2>

        {error && <p className="text-sm text-red-500">{error}</p>}

        {/* No active flash — show start controls */}
        {!activeFlash ? (
          <div className="bg-white rounded-xl shadow-sm p-5 space-y-4">
            <h3 className="font-semibold text-gray-700">Start a Flash</h3>
            <p className="text-sm text-gray-500">
              Select an attendance session to require all present members to submit a notebook entry.
            </p>
            {sessions.length === 0 ? (
              <p className="text-sm text-gray-400">No attendance sessions found for today. Take attendance first.</p>
            ) : (
              <>
                <select
                  value={selectedSessionId}
                  onChange={e => setSelectedSessionId(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-pastel-blue focus:border-transparent"
                >
                  <option value="">Select a session...</option>
                  {sessions.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.session_date} - by {s.created_by}{s.notes ? ` (${s.notes})` : ''}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleStartFlash}
                  disabled={!selectedSessionId || starting}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-lg font-semibold transition-colors bg-pastel-pink hover:bg-pastel-pink-dark disabled:opacity-40"
                >
                  <Zap size={18} />
                  {starting ? 'Starting...' : 'Start Flash'}
                </button>
              </>
            )}
          </div>
        ) : (
          <>
            {/* Active flash controls */}
            <div className="bg-white rounded-xl shadow-sm p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                    <Zap size={18} className="text-yellow-500" /> Flash Active
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Started by {activeFlash.started_by} at {new Date(activeFlash.started_at).toLocaleTimeString()}
                  </p>
                </div>
                <button
                  onClick={handleEndFlash}
                  disabled={ending}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg font-medium text-sm bg-red-100 text-red-700 hover:bg-red-200 transition-colors disabled:opacity-40"
                >
                  <ZapOff size={16} />
                  {ending ? 'Ending...' : 'End Flash'}
                </button>
              </div>

              {/* Completion stats */}
              <div className="flex gap-4 text-center">
                <div className="flex-1 bg-green-50 rounded-lg p-3">
                  <div className="text-2xl font-bold text-green-600">{completedUsers.length}</div>
                  <div className="text-xs text-green-500">Completed</div>
                </div>
                <div className="flex-1 bg-red-50 rounded-lg p-3">
                  <div className="text-2xl font-bold text-red-600">
                    {presentUsers.filter(u => !completedUsers.includes(u) && !exemptUsers.includes(u)).length}
                  </div>
                  <div className="text-xs text-red-500">Pending</div>
                </div>
                <div className="flex-1 bg-gray-50 rounded-lg p-3">
                  <div className="text-2xl font-bold text-gray-500">{exemptUsers.length}</div>
                  <div className="text-xs text-gray-400">Exempt</div>
                </div>
              </div>
            </div>

            {/* User grid */}
            <div className="bg-white rounded-xl shadow-sm p-5 space-y-3">
              <h3 className="font-semibold text-gray-700">Completion Status</h3>
              <div className="space-y-2">
                {presentUsers.map(user => {
                  const status = getUserStatus(user)
                  return (
                    <div key={user} className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50">
                      <div className="flex items-center gap-2">
                        {status === 'completed' ? (
                          <Check size={16} className="text-green-500" />
                        ) : status === 'exempt' ? (
                          <Ban size={14} className="text-gray-400" />
                        ) : (
                          <Clock size={16} className="text-red-400" />
                        )}
                        <span className={`text-sm font-medium ${status === 'completed' ? 'text-green-700' : status === 'exempt' ? 'text-gray-400' : 'text-gray-700'}`}>
                          {user}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {status === 'pending' && (
                          <button
                            onClick={() => handleSendReminder(user)}
                            className="text-gray-400 hover:text-pastel-blue-dark transition-colors"
                            title="Send reminder"
                          >
                            <Bell size={14} />
                          </button>
                        )}
                        <button
                          onClick={() => handleToggleExempt(user)}
                          className={`text-xs px-2 py-1 rounded-lg transition-colors ${
                            status === 'exempt'
                              ? 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                              : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                          }`}
                        >
                          {status === 'exempt' ? 'Unexempt' : 'Exempt'}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
