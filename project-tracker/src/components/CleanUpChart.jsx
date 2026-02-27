import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabase'
import { useUser } from '../contexts/UserContext'
import { usePermissions } from '../hooks/usePermissions'
import NotificationBell from './NotificationBell'
import { Sparkles, Check, X, Trophy, UserMinus } from 'lucide-react'

const REST_URL = import.meta.env.VITE_SUPABASE_URL
const REST_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const REST_HEADERS = { 'apikey': REST_KEY, 'Authorization': `Bearer ${REST_KEY}` }
const REST_JSON = { ...REST_HEADERS, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' }

function genId() {
  return String(Date.now()) + Math.random().toString(36).slice(2)
}

const STATUS_STYLES = {
  assigned: 'bg-blue-100 text-blue-700',
  pending_confirmation: 'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-green-100 text-green-700',
  denied: 'bg-red-100 text-red-700',
}

const STATUS_LABELS = {
  assigned: 'Assigned',
  pending_confirmation: 'Pending',
  confirmed: 'Confirmed',
  denied: 'Denied',
}

export default function CleanUpChart() {
  const { username } = useUser()
  const { hasLeadTag, isGuest } = usePermissions()

  const [jobs, setJobs] = useState([])
  const [cleanupSessions, setCleanupSessions] = useState([])
  const [assignments, setAssignments] = useState([])
  const [exemptions, setExemptions] = useState([])
  const [profiles, setProfiles] = useState([])

  const [selectedUsers, setSelectedUsers] = useState([])
  const [feedback, setFeedback] = useState(null)
  const [generating, setGenerating] = useState(false)

  // Fetch all data on mount
  useEffect(() => {
    Promise.all([
      fetch(`${REST_URL}/rest/v1/cleanup_jobs?select=*&active=eq.true`, { headers: REST_HEADERS }).then(r => r.ok ? r.json() : []),
      fetch(`${REST_URL}/rest/v1/cleanup_sessions?select=*&order=created_at.desc`, { headers: REST_HEADERS }).then(r => r.ok ? r.json() : []),
      fetch(`${REST_URL}/rest/v1/cleanup_assignments?select=*`, { headers: REST_HEADERS }).then(r => r.ok ? r.json() : []),
      fetch(`${REST_URL}/rest/v1/cleanup_exemptions?select=*`, { headers: REST_HEADERS }).then(r => r.ok ? r.json() : []),
      fetch(`${REST_URL}/rest/v1/profiles?select=display_name,authority_tier,function_tags`, { headers: REST_HEADERS }).then(r => r.ok ? r.json() : []),
    ]).then(([j, cs, a, ex, p]) => {
      setJobs(j)
      setCleanupSessions(cs)
      setAssignments(a)
      setExemptions(ex)
      setProfiles(p)
    }).catch(err => console.error('CleanUpChart fetch error:', err))
  }, [])

  // Real-time subscriptions
  useEffect(() => {
    const channel = supabase
      .channel('cleanup-chart-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cleanup_jobs' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setJobs(prev => prev.some(j => j.id === payload.new.id) ? prev : [...prev, payload.new])
        } else if (payload.eventType === 'UPDATE') {
          setJobs(prev => prev.map(j => j.id === payload.new.id ? payload.new : j))
        } else if (payload.eventType === 'DELETE') {
          setJobs(prev => prev.filter(j => j.id !== payload.old.id))
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cleanup_sessions' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setCleanupSessions(prev => prev.some(s => s.id === payload.new.id) ? prev : [payload.new, ...prev])
        } else if (payload.eventType === 'UPDATE') {
          setCleanupSessions(prev => prev.map(s => s.id === payload.new.id ? payload.new : s))
        } else if (payload.eventType === 'DELETE') {
          setCleanupSessions(prev => prev.filter(s => s.id !== payload.old.id))
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cleanup_assignments' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setAssignments(prev => prev.some(a => a.id === payload.new.id) ? prev : [...prev, payload.new])
        } else if (payload.eventType === 'UPDATE') {
          setAssignments(prev => prev.map(a => a.id === payload.new.id ? payload.new : a))
        } else if (payload.eventType === 'DELETE') {
          setAssignments(prev => prev.filter(a => a.id !== payload.old.id))
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cleanup_exemptions' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setExemptions(prev => prev.some(e => e.id === payload.new.id) ? prev : [...prev, payload.new])
        } else if (payload.eventType === 'UPDATE') {
          setExemptions(prev => prev.map(e => e.id === payload.new.id ? payload.new : e))
        } else if (payload.eventType === 'DELETE') {
          setExemptions(prev => prev.filter(e => e.id !== payload.old.id))
        }
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  const showFeedback = (msg) => {
    setFeedback(msg)
    setTimeout(() => setFeedback(null), 3000)
  }

  // All non-guest team members
  const teamMembers = profiles
    .filter(p => p.display_name && p.authority_tier !== 'guest')
    .map(p => p.display_name)
    .sort()

  // Toggle user selection
  const toggleUser = (name) => {
    setSelectedUsers(prev =>
      prev.includes(name) ? prev.filter(u => u !== name) : [...prev, name]
    )
  }

  const selectAll = () => setSelectedUsers([...teamMembers])
  const selectNone = () => setSelectedUsers([])

  // Find the most recent cleanup session
  const latestCleanupSession = cleanupSessions[0] || null
  const latestAssignments = latestCleanupSession
    ? assignments.filter(a => a.cleanup_session_id === latestCleanupSession.id)
    : []
  const latestExemptions = latestCleanupSession
    ? exemptions.filter(e => e.cleanup_session_id === latestCleanupSession.id)
    : []

  // Get job name by id
  const jobName = (jobId) => jobs.find(j => j.id === jobId)?.name || jobId

  // Build rotation counts from ALL past assignments (for fair rotation)
  const rotationCounts = useMemo(() => {
    const counts = {}
    assignments.forEach(a => {
      if (!counts[a.assigned_username]) counts[a.assigned_username] = 0
      counts[a.assigned_username]++
    })
    return counts
  }, [assignments])

  // Generate cleanup assignments
  const handleGenerateCleanup = async () => {
    if (!hasLeadTag) return
    if (selectedUsers.length === 0) {
      showFeedback('Please select at least one person.')
      return
    }

    setGenerating(true)
    try {
      // Sort users by least-cleaned-first for fair rotation
      const sorted = [...selectedUsers].sort((a, b) => (rotationCounts[a] || 0) - (rotationCounts[b] || 0))

      // Create cleanup session (no attendance_session_id needed)
      const cleanupSessionId = genId()
      const cleanupSession = {
        id: cleanupSessionId,
        attendance_session_id: null,
        generated_by: username,
        created_at: new Date().toISOString(),
      }

      // Assign jobs round-robin
      const activeJobs = jobs.filter(j => j.active)
      const newAssignments = activeJobs.map((job, idx) => ({
        id: genId(),
        cleanup_session_id: cleanupSessionId,
        job_id: job.id,
        assigned_username: sorted[idx % sorted.length],
        status: 'assigned',
        confirmed_by: null,
        confirmed_at: null,
        points_awarded: 0,
      }))

      // Optimistic update
      setCleanupSessions(prev => [cleanupSession, ...prev])
      setAssignments(prev => [...prev, ...newAssignments])
      setSelectedUsers([])

      // Persist
      await fetch(`${REST_URL}/rest/v1/cleanup_sessions`, {
        method: 'POST', headers: REST_JSON, body: JSON.stringify(cleanupSession),
      })
      await fetch(`${REST_URL}/rest/v1/cleanup_assignments`, {
        method: 'POST', headers: REST_JSON, body: JSON.stringify(newAssignments),
      })

      showFeedback(`Cleanup generated! ${newAssignments.length} jobs assigned to ${sorted.length} people.`)
    } catch (err) {
      console.error('Failed to generate cleanup:', err)
      showFeedback('Error generating cleanup: ' + err.message)
    } finally {
      setGenerating(false)
    }
  }

  // Mark own assignment as complete (pending confirmation)
  const handleMarkComplete = async (assignmentId) => {
    setAssignments(prev => prev.map(a => a.id === assignmentId ? { ...a, status: 'pending_confirmation' } : a))
    try {
      await fetch(`${REST_URL}/rest/v1/cleanup_assignments?id=eq.${assignmentId}`, {
        method: 'PATCH', headers: REST_JSON,
        body: JSON.stringify({ status: 'pending_confirmation' }),
      })
    } catch (err) {
      console.error('Failed to mark complete:', err)
    }
  }

  // Lead confirms assignment
  const handleConfirm = async (assignmentId) => {
    if (!hasLeadTag) return
    const now = new Date().toISOString()
    setAssignments(prev => prev.map(a =>
      a.id === assignmentId
        ? { ...a, status: 'confirmed', confirmed_by: username, confirmed_at: now, points_awarded: 1 }
        : a
    ))
    try {
      await fetch(`${REST_URL}/rest/v1/cleanup_assignments?id=eq.${assignmentId}`, {
        method: 'PATCH', headers: REST_JSON,
        body: JSON.stringify({ status: 'confirmed', confirmed_by: username, confirmed_at: now, points_awarded: 1 }),
      })
    } catch (err) {
      console.error('Failed to confirm:', err)
    }
  }

  // Lead denies assignment
  const handleDeny = async (assignmentId) => {
    if (!hasLeadTag) return
    const now = new Date().toISOString()
    setAssignments(prev => prev.map(a =>
      a.id === assignmentId
        ? { ...a, status: 'denied', confirmed_by: username, confirmed_at: now, points_awarded: 0 }
        : a
    ))
    try {
      await fetch(`${REST_URL}/rest/v1/cleanup_assignments?id=eq.${assignmentId}`, {
        method: 'PATCH', headers: REST_JSON,
        body: JSON.stringify({ status: 'denied', confirmed_by: username, confirmed_at: now, points_awarded: 0 }),
      })
    } catch (err) {
      console.error('Failed to deny:', err)
    }
  }

  // Lead exempts a user from current session
  const handleExemptUser = async (exemptUsername) => {
    if (!hasLeadTag || !latestCleanupSession) return
    const exemption = {
      id: genId(),
      cleanup_session_id: latestCleanupSession.id,
      username: exemptUsername,
      exempted_by: username,
      created_at: new Date().toISOString(),
    }
    setExemptions(prev => [...prev, exemption])

    // Remove their assignments from this session
    const toRemove = latestAssignments.filter(a => a.assigned_username === exemptUsername)
    setAssignments(prev => prev.filter(a => !toRemove.some(r => r.id === a.id)))

    try {
      await fetch(`${REST_URL}/rest/v1/cleanup_exemptions`, {
        method: 'POST', headers: REST_JSON, body: JSON.stringify(exemption),
      })
      for (const a of toRemove) {
        await fetch(`${REST_URL}/rest/v1/cleanup_assignments?id=eq.${a.id}`, {
          method: 'DELETE', headers: REST_HEADERS,
        })
      }
      showFeedback(`${exemptUsername} exempted from cleanup.`)
    } catch (err) {
      console.error('Failed to exempt user:', err)
    }
  }

  // Leaderboard: total confirmed points per user across all sessions
  const leaderboard = useMemo(() => {
    const board = {}
    assignments.forEach(a => {
      if (!board[a.assigned_username]) board[a.assigned_username] = { points: 0, total: 0 }
      board[a.assigned_username].total++
      if (a.status === 'confirmed') {
        board[a.assigned_username].points += (a.points_awarded || 1)
      }
    })
    return Object.entries(board)
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name))
  }, [assignments])

  // Users in latest session who can be exempted
  const exemptableUsers = latestCleanupSession
    ? [...new Set(latestAssignments.map(a => a.assigned_username))]
        .filter(u => !latestExemptions.some(e => e.username === u))
    : []

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="px-4 py-3 ml-14 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-pastel-blue-dark via-pastel-pink-dark to-pastel-orange-dark bg-clip-text text-transparent">
              Clean Up Chart
            </h1>
            <p className="text-sm text-gray-500">Cleanup job assignments & leaderboard</p>
          </div>
          <NotificationBell />
        </div>
      </header>

      <div className="flex-1 p-4 overflow-y-auto">
        <div className="max-w-lg mx-auto space-y-6">

          {feedback && (
            <div className="text-center text-green-600 font-medium animate-pulse text-sm">{feedback}</div>
          )}

          {/* Generate Cleanup — Lead Only */}
          {hasLeadTag && (
            <div className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
              <h3 className="text-sm font-semibold text-gray-500 flex items-center gap-2">
                <Sparkles size={16} className="text-pastel-orange-dark" />
                Generate Cleanup
              </h3>
              <p className="text-xs text-gray-400">Select who's here for cleanup:</p>
              <div className="flex gap-2 mb-1">
                <button onClick={selectAll} className="text-xs text-pastel-blue-dark hover:underline">Select All</button>
                <button onClick={selectNone} className="text-xs text-gray-400 hover:underline">Clear</button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {teamMembers.map(name => (
                  <button
                    key={name}
                    onClick={() => toggleUser(name)}
                    className={`px-2.5 py-1.5 text-xs rounded-lg transition-colors ${
                      selectedUsers.includes(name)
                        ? 'bg-pastel-blue text-gray-800 font-semibold'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
              {selectedUsers.length > 0 && (
                <p className="text-xs text-gray-500">{selectedUsers.length} selected</p>
              )}
              <button
                onClick={handleGenerateCleanup}
                disabled={generating || selectedUsers.length === 0}
                className="w-full px-4 py-3 rounded-xl bg-pastel-blue/40 hover:bg-pastel-blue/60 disabled:opacity-50 transition-colors text-sm font-semibold text-gray-700"
              >
                {generating ? 'Generating...' : 'Generate Cleanup'}
              </button>
            </div>
          )}

          {/* Current Assignments */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-500">
              {latestCleanupSession ? 'Current Assignments' : 'No cleanup sessions yet'}
            </h3>
            {latestAssignments.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">
                {latestCleanupSession ? 'No assignments for this session.' : 'Generate cleanup to get started.'}
              </p>
            ) : (
              latestAssignments.map(a => (
                <div key={a.id} className="bg-white rounded-xl p-3 shadow-sm flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-700 truncate">{jobName(a.job_id)}</p>
                    <p className="text-xs text-gray-400">{a.assigned_username}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${STATUS_STYLES[a.status] || 'bg-gray-100 text-gray-500'}`}>
                      {STATUS_LABELS[a.status] || a.status}
                    </span>

                    {/* Own assignment: Mark Complete */}
                    {a.status === 'assigned' && a.assigned_username === username && (
                      <button
                        onClick={() => handleMarkComplete(a.id)}
                        className="p-1.5 rounded-lg bg-green-50 hover:bg-green-100 text-green-600 transition-colors"
                        title="Mark Complete"
                      >
                        <Check size={14} />
                      </button>
                    )}

                    {/* Lead: Confirm / Deny */}
                    {a.status === 'pending_confirmation' && hasLeadTag && (
                      <>
                        <button
                          onClick={() => handleConfirm(a.id)}
                          className="p-1.5 rounded-lg bg-green-50 hover:bg-green-100 text-green-600 transition-colors"
                          title="Confirm"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          onClick={() => handleDeny(a.id)}
                          className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 transition-colors"
                          title="Deny"
                        >
                          <X size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Leaderboard */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-500 flex items-center gap-2">
              <Trophy size={16} className="text-pastel-pink-dark" />
              Leaderboard
            </h3>
            {leaderboard.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No cleanup data yet.</p>
            ) : (
              leaderboard.map((entry, idx) => (
                <div key={entry.name} className="bg-white rounded-xl p-3 shadow-sm flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      idx === 0 ? 'bg-yellow-100 text-yellow-700' :
                      idx === 1 ? 'bg-gray-100 text-gray-600' :
                      idx === 2 ? 'bg-orange-100 text-orange-700' :
                      'bg-gray-50 text-gray-400'
                    }`}>
                      {idx + 1}
                    </span>
                    <span className="text-sm font-medium text-gray-700">{entry.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-gray-800">{entry.points} pts</span>
                    <p className="text-xs text-gray-400">{entry.total} jobs</p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Exemptions — Lead Only */}
          {hasLeadTag && latestCleanupSession && (
            <div className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
              <h3 className="text-sm font-semibold text-gray-500 flex items-center gap-2">
                <UserMinus size={16} className="text-pastel-orange-dark" />
                Exemptions
              </h3>

              {latestExemptions.length > 0 && (
                <div className="space-y-1">
                  {latestExemptions.map(e => (
                    <div key={e.id} className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">{e.username}</span>
                      <span className="text-xs text-gray-400">by {e.exempted_by}</span>
                    </div>
                  ))}
                </div>
              )}

              {exemptableUsers.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {exemptableUsers.map(u => (
                    <button
                      key={u}
                      onClick={() => handleExemptUser(u)}
                      className="px-2 py-1 text-xs rounded-lg bg-pastel-orange/30 hover:bg-pastel-orange/50 text-gray-700 transition-colors"
                    >
                      Exempt {u}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400">No users to exempt.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
