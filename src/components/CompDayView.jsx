import { useState, useEffect, useCallback, useMemo } from 'react'
import { Plus, Play, Pause, Trash2, Users, ArrowLeft, ClipboardCheck, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react'
import { useUser } from '../contexts/UserContext'
import { usePermissions } from '../hooks/usePermissions'
import { supabase } from '../supabase'

const REST_URL = import.meta.env.VITE_SUPABASE_URL
const REST_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const REST_HEADERS = { 'apikey': REST_KEY, 'Authorization': `Bearer ${REST_KEY}` }
const REST_JSON = { ...REST_HEADERS, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' }

async function restGet(path) {
  const res = await fetch(`${REST_URL}/rest/v1/${path}`, { headers: REST_HEADERS })
  if (!res.ok) throw new Error(`GET ${path}: ${res.status} ${await res.text()}`)
  return res.json()
}
async function restPost(table, data) {
  const res = await fetch(`${REST_URL}/rest/v1/${table}`, { method: 'POST', headers: REST_JSON, body: JSON.stringify(data) })
  if (!res.ok) throw new Error(`POST ${table}: ${res.status} ${await res.text()}`)
}
async function restPatch(table, filter, data) {
  const res = await fetch(`${REST_URL}/rest/v1/${table}?${filter}`, { method: 'PATCH', headers: REST_JSON, body: JSON.stringify(data) })
  if (!res.ok) throw new Error(`PATCH ${table}: ${res.status}`)
}
async function restDelete(table, filter) {
  await fetch(`${REST_URL}/rest/v1/${table}?${filter}`, { method: 'DELETE', headers: REST_HEADERS })
}

const ROLES = [
  { id: 'scouting', label: 'Scouting', emoji: '🔍', color: 'bg-blue-100 text-blue-800 border-blue-300', bg: 'from-blue-400 to-blue-600' },
  { id: 'pit-crew', label: 'Pit Crew', emoji: '🔧', color: 'bg-orange-100 text-orange-800 border-orange-300', bg: 'from-orange-400 to-orange-600' },
  { id: 'drive-team', label: 'Drive Team', emoji: '🎮', color: 'bg-purple-100 text-purple-800 border-purple-300', bg: 'from-purple-400 to-purple-600' },
  { id: 'spirit', label: 'Spirit', emoji: '📣', color: 'bg-pink-100 text-pink-800 border-pink-300', bg: 'from-pink-400 to-pink-600' },
  { id: 'bag-watch', label: 'Bag Watch', emoji: '🎒', color: 'bg-yellow-100 text-yellow-800 border-yellow-300', bg: 'from-yellow-400 to-yellow-600' },
  { id: 'break', label: 'Break', emoji: '☕', color: 'bg-gray-100 text-gray-600 border-gray-300', bg: 'from-gray-400 to-gray-500' },
]

const ROLE_MAP = Object.fromEntries(ROLES.map(r => [r.id, r]))

export default function CompDayView({ onBack }) {
  const { username } = useUser()
  const { hasLeadTag } = usePermissions()

  const [sessions, setSessions] = useState([])
  const [session, setSession] = useState(null)  // currently viewed session
  const [blocks, setBlocks] = useState([])
  const [assignments, setAssignments] = useState([])
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [scoutingRecords, setScoutingRecords] = useState([])

  // Lead UI state
  const [newSessionName, setNewSessionName] = useState('')
  const [newBlockName, setNewBlockName] = useState('')
  const [assigningBlock, setAssigningBlock] = useState(null)

  const fetchAll = useCallback(async () => {
    try {
      setError('')
      // Get all sessions (active + recent inactive for planning)
      const allSessions = await restGet('comp_day_sessions?order=created_at.desc&limit=10')
      setSessions(allSessions)

      // Find active session or most recent
      const active = allSessions.find(s => s.is_active)
      const current = active || allSessions[0] || null
      setSession(current)

      if (!current) {
        setBlocks([])
        setAssignments([])
        setMembers([])
        setLoading(false)
        return
      }

      const today = new Date().toISOString().split('T')[0]
      const [blks, assigns, profiles, scoutRecs] = await Promise.all([
        restGet(`comp_day_blocks?session_id=eq.${current.id}&order=order_index.asc`),
        restGet(`comp_day_assignments?session_id=eq.${current.id}&select=*`),
        restGet('profiles?select=display_name,function_tags'),
        restGet(`scouting_records?submitted_at=gte.${today}T00:00:00&select=submitted_by,submitted_at`),
      ])

      setBlocks(blks)
      setAssignments(assigns)
      setMembers(profiles.filter(p => !(p.function_tags || []).includes('Team')).map(p => p.display_name))
      setScoutingRecords(scoutRecs)
    } catch (err) {
      console.error('CompDay fetch error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel('comp-day-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comp_day_sessions' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comp_day_blocks' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comp_day_assignments' }, fetchAll)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'scouting_records' }, fetchAll)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [fetchAll])

  const activeBlock = useMemo(() => blocks.find(b => b.is_active), [blocks])
  const myRole = useMemo(() => {
    if (!activeBlock) return null
    const a = assignments.find(a => a.block_id === activeBlock.id && a.username === username)
    return a ? ROLE_MAP[a.role] : null
  }, [activeBlock, assignments, username])

  const isLive = session?.is_active

  // Lead actions
  const createSession = async () => {
    if (!newSessionName.trim()) return
    try {
      setError('')
      const id = 'comp_' + Date.now()
      await restPost('comp_day_sessions', {
        id,
        name: newSessionName.trim(),
        session_date: new Date().toISOString().split('T')[0],
        is_active: false,
        created_by: username,
      })
      setNewSessionName('')
      await fetchAll()
    } catch (err) {
      setError(err.message)
    }
  }

  const goLive = async () => {
    if (!session) return
    try {
      setError('')
      // Deactivate any other active sessions first
      await restPatch('comp_day_sessions', 'is_active=eq.true', { is_active: false })
      await restPatch('comp_day_sessions', `id=eq.${session.id}`, { is_active: true })
      await fetchAll()
    } catch (err) {
      setError(err.message)
    }
  }

  const endSession = async () => {
    if (!session) return
    try {
      setError('')
      await restPatch('comp_day_sessions', `id=eq.${session.id}`, { is_active: false })
      await fetchAll()
    } catch (err) {
      setError(err.message)
    }
  }

  const deleteSession = async () => {
    if (!session) return
    try {
      setError('')
      await restDelete('comp_day_sessions', `id=eq.${session.id}`)
      await fetchAll()
    } catch (err) {
      setError(err.message)
    }
  }

  const addBlock = async () => {
    if (!newBlockName.trim() || !session) return
    try {
      setError('')
      const id = 'block_' + Date.now()
      await restPost('comp_day_blocks', {
        id,
        session_id: session.id,
        name: newBlockName.trim(),
        order_index: blocks.length,
        is_active: false,
      })
      setNewBlockName('')
      await fetchAll()
    } catch (err) {
      setError(err.message)
    }
  }

  const activateBlock = async (blockId) => {
    try {
      setError('')
      await restPatch('comp_day_blocks', `session_id=eq.${session.id}`, { is_active: false })
      await restPatch('comp_day_blocks', `id=eq.${blockId}`, { is_active: true })
      await fetchAll()
    } catch (err) {
      setError(err.message)
    }
  }

  const deleteBlock = async (blockId) => {
    try {
      await restDelete('comp_day_blocks', `id=eq.${blockId}`)
      await fetchAll()
    } catch (err) {
      setError(err.message)
    }
  }

  const setRole = async (blockId, memberName, role) => {
    try {
      await restDelete('comp_day_assignments', `block_id=eq.${blockId}&username=eq.${encodeURIComponent(memberName)}`)
      if (role) {
        await restPost('comp_day_assignments', {
          id: 'assign_' + Date.now() + Math.random().toString(36).slice(2),
          block_id: blockId,
          session_id: session.id,
          username: memberName,
          role,
        })
      }
      await fetchAll()
    } catch (err) {
      setError(err.message)
    }
  }

  const getBlockAssignments = (blockId) => assignments.filter(a => a.block_id === blockId)
  const getMemberRole = (blockId, memberName) => {
    const a = assignments.find(a => a.block_id === blockId && a.username === memberName)
    return a?.role || ''
  }

  const unassignedInBlock = (blockId) => {
    const assigned = assignments.filter(a => a.block_id === blockId).map(a => a.username)
    return members.filter(m => !assigned.includes(m))
  }

  const viewSession = (s) => {
    setSession(s)
    setAssigningBlock(null)
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-400">Loading...</div>
  }

  // ─── Member View ───
  if (!hasLeadTag) {
    const liveSession = sessions.find(s => s.is_active)
    return (
      <div className="max-w-lg mx-auto p-4 space-y-4">
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft size={16} /> Back
        </button>

        {!liveSession ? (
          <div className="text-center py-16">
            <p className="text-6xl mb-4">🏁</p>
            <h2 className="text-xl font-bold text-gray-700">No Active Competition</h2>
            <p className="text-gray-400 mt-2">A lead will activate Comp Day mode when it's time.</p>
          </div>
        ) : (
          <>
            <div className="text-center">
              <h2 className="text-lg font-bold text-gray-700">{liveSession.name}</h2>
              {activeBlock && (
                <p className="text-sm text-gray-500 mt-1">Current: <span className="font-semibold">{activeBlock.name}</span></p>
              )}
            </div>

            {activeBlock && myRole ? (
              <div className={`rounded-2xl bg-gradient-to-br ${myRole.bg} p-8 text-center text-white shadow-lg`}>
                <p className="text-6xl mb-3">{myRole.emoji}</p>
                <h1 className="text-3xl font-black">{myRole.label}</h1>
                <p className="text-white/80 mt-2 text-sm">This is your current assignment</p>
              </div>
            ) : activeBlock ? (
              <div className="rounded-2xl bg-gray-100 p-8 text-center">
                <p className="text-4xl mb-2">❓</p>
                <h2 className="text-xl font-bold text-gray-600">No Role Assigned</h2>
                <p className="text-gray-400 mt-1">Ask a lead for your assignment.</p>
              </div>
            ) : (
              <div className="rounded-2xl bg-gray-50 p-8 text-center">
                <p className="text-4xl mb-2">⏳</p>
                <h2 className="text-xl font-bold text-gray-600">Waiting</h2>
                <p className="text-gray-400 mt-1">No block is active yet.</p>
              </div>
            )}

            {blocks.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-500 mb-2">Schedule</h3>
                <div className="space-y-2">
                  {blocks.map(b => {
                    const role = getMemberRole(b.id, username)
                    const roleInfo = ROLE_MAP[role]
                    return (
                      <div key={b.id} className={`flex items-center justify-between px-4 py-3 rounded-xl border ${b.is_active ? 'bg-pastel-blue/20 border-pastel-blue-dark' : 'bg-white border-gray-200'}`}>
                        <div className="flex items-center gap-2">
                          {b.is_active && <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />}
                          <span className={`text-sm font-medium ${b.is_active ? 'text-gray-800' : 'text-gray-600'}`}>{b.name}</span>
                        </div>
                        {roleInfo ? (
                          <span className={`text-xs px-2 py-1 rounded-full border ${roleInfo.color}`}>
                            {roleInfo.emoji} {roleInfo.label}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    )
  }

  // ─── Lead View ───
  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft size={16} /> Back
        </button>
        <h2 className="text-xl font-bold text-gray-800">🏁 Comp Day</h2>
        <div className="w-16" />
      </div>

      {/* Error display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
          <AlertCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm text-red-700 font-medium">Something went wrong</p>
            <p className="text-xs text-red-500 mt-0.5 break-all">{error}</p>
          </div>
          <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-600 text-xs">dismiss</button>
        </div>
      )}

      {/* Create new plan */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <h3 className="text-sm font-semibold text-gray-600 mb-2">Plan a Comp Day</h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={newSessionName}
            onChange={e => setNewSessionName(e.target.value)}
            placeholder="e.g. States Day 1, Qualifier Round 2"
            className="flex-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-pastel-blue focus:border-transparent"
            onKeyDown={e => e.key === 'Enter' && createSession()}
          />
          <button
            onClick={createSession}
            disabled={!newSessionName.trim()}
            className="px-4 py-2 rounded-lg bg-pastel-pink text-gray-800 text-sm font-medium disabled:opacity-40 hover:bg-pastel-pink-dark transition-colors"
          >
            Create
          </button>
        </div>
      </div>

      {/* Session picker (if multiple) */}
      {sessions.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {sessions.map(s => (
            <button
              key={s.id}
              onClick={() => viewSession(s)}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                session?.id === s.id
                  ? 'bg-pastel-blue text-gray-800 border-pastel-blue-dark'
                  : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {s.name}
              {s.is_active && <span className="ml-1.5 inline-block w-2 h-2 rounded-full bg-green-500" />}
            </button>
          ))}
        </div>
      )}

      {/* No sessions at all */}
      {!session && sessions.length === 0 && (
        <div className="text-center py-12">
          <p className="text-5xl mb-4">🏁</p>
          <h2 className="text-xl font-bold text-gray-700 mb-2">No Comp Days Planned</h2>
          <p className="text-gray-400">Create a plan above to get started.</p>
        </div>
      )}

      {/* Active session editor */}
      {session && (
        <>
          {/* Session header */}
          <div className="flex items-center justify-between bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-gray-800">{session.name}</h3>
                {isLive ? (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-300 font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> LIVE
                  </span>
                ) : (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200 font-medium">Planning</span>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-0.5">{session.session_date} &middot; {members.length} members &middot; {blocks.length} blocks</p>
            </div>
            <div className="flex items-center gap-2">
              {!isLive ? (
                <>
                  <button onClick={goLive} disabled={blocks.length === 0} className="px-3 py-1.5 rounded-lg bg-green-500 text-white text-sm font-medium hover:bg-green-600 transition-colors disabled:opacity-40" title={blocks.length === 0 ? 'Add blocks first' : ''}>
                    Go Live
                  </button>
                  <button onClick={deleteSession} className="px-3 py-1.5 rounded-lg bg-red-50 text-red-500 text-sm font-medium hover:bg-red-100 transition-colors">
                    Delete
                  </button>
                </>
              ) : (
                <button onClick={endSession} className="px-3 py-1.5 rounded-lg bg-red-50 text-red-500 text-sm font-medium hover:bg-red-100 transition-colors">
                  End Session
                </button>
              )}
            </div>
          </div>

          {/* Add block */}
          <div className="flex gap-2">
            <input
              type="text"
              value={newBlockName}
              onChange={e => setNewBlockName(e.target.value)}
              placeholder="Add block (e.g. Match 1, Lunch, Judging)"
              className="flex-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-pastel-blue focus:border-transparent"
              onKeyDown={e => e.key === 'Enter' && addBlock()}
            />
            <button onClick={addBlock} disabled={!newBlockName.trim()} className="px-4 py-2 rounded-lg bg-pastel-blue text-gray-700 text-sm font-medium disabled:opacity-40 hover:bg-pastel-blue-dark hover:text-white transition-colors">
              <Plus size={16} />
            </button>
          </div>

          {/* Blocks list */}
          {blocks.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-8">Add blocks to build the day's schedule</p>
          ) : (
            <div className="space-y-3">
              {blocks.map(block => {
                const blockAssigns = getBlockAssignments(block.id)
                const unassigned = unassignedInBlock(block.id)
                const isExpanded = assigningBlock === block.id

                return (
                  <div key={block.id} className={`bg-white rounded-xl shadow-sm border ${block.is_active ? 'border-green-400 ring-2 ring-green-100' : 'border-gray-100'}`}>
                    <div className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-2">
                        {block.is_active && <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />}
                        <span className="font-semibold text-gray-800">{block.name}</span>
                        <span className="text-xs text-gray-400">({blockAssigns.length}/{members.length})</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {isLive && (
                          !block.is_active ? (
                            <button onClick={() => activateBlock(block.id)} className="p-1.5 rounded-lg hover:bg-green-50 text-green-600 transition-colors" title="Activate this block">
                              <Play size={16} />
                            </button>
                          ) : (
                            <button onClick={() => restPatch('comp_day_blocks', `id=eq.${block.id}`, { is_active: false }).then(fetchAll)} className="p-1.5 rounded-lg hover:bg-yellow-50 text-yellow-600 transition-colors" title="Deactivate">
                              <Pause size={16} />
                            </button>
                          )
                        )}
                        <button onClick={() => setAssigningBlock(isExpanded ? null : block.id)} className={`p-1.5 rounded-lg transition-colors ${isExpanded ? 'bg-pastel-blue/30 text-pastel-blue-dark' : 'hover:bg-pastel-blue/20 text-gray-500'}`} title="Assign roles">
                          <Users size={16} />
                        </button>
                        <button onClick={() => deleteBlock(block.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition-colors" title="Delete block">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Role summary (collapsed) */}
                    {!isExpanded && blockAssigns.length > 0 && (
                      <div className="px-4 pb-3 flex flex-wrap gap-1.5">
                        {ROLES.map(role => {
                          const count = blockAssigns.filter(a => a.role === role.id).length
                          if (count === 0) return null
                          return (
                            <span key={role.id} className={`text-xs px-2 py-0.5 rounded-full border ${role.color}`}>
                              {role.emoji} {count}
                            </span>
                          )
                        })}
                        {unassigned.length > 0 && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-500 border border-red-200">
                            ❓ {unassigned.length} unassigned
                          </span>
                        )}
                      </div>
                    )}

                    {/* Expanded assignment panel */}
                    {isExpanded && (
                      <div className="border-t border-gray-100 p-4 space-y-2">
                        {members.map(member => {
                          const currentRole = getMemberRole(block.id, member)
                          return (
                            <div key={member} className="flex items-center gap-2">
                              <span className="text-sm text-gray-700 w-36 truncate font-medium">{member}</span>
                              <div className="flex flex-wrap gap-1 flex-1">
                                {ROLES.map(role => (
                                  <button
                                    key={role.id}
                                    onClick={() => setRole(block.id, member, currentRole === role.id ? '' : role.id)}
                                    className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                                      currentRole === role.id
                                        ? role.color + ' font-semibold'
                                        : 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100'
                                    }`}
                                  >
                                    {role.emoji} {role.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Scouting Accountability */}
          {(() => {
            const scoutAssigns = assignments.filter(a => a.role === 'scouting')
            const scoutMembers = [...new Set(scoutAssigns.map(a => a.username))]
            if (scoutMembers.length === 0) return null

            const scoutBlockCount = {}
            scoutMembers.forEach(m => {
              scoutBlockCount[m] = scoutAssigns.filter(a => a.username === m).length
            })

            const submissionCount = {}
            scoutingRecords.forEach(r => {
              submissionCount[r.submitted_by] = (submissionCount[r.submitted_by] || 0) + 1
            })

            return (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <ClipboardCheck size={16} className="text-blue-500" />
                  Scouting Accountability
                </h3>
                <div className="space-y-2">
                  {scoutMembers.map(member => {
                    const assigned = scoutBlockCount[member] || 0
                    const submitted = submissionCount[member] || 0
                    const ok = submitted >= assigned
                    return (
                      <div key={member} className={`flex items-center justify-between px-3 py-2 rounded-lg border ${ok ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                        <span className="text-sm font-medium text-gray-700">{member}</span>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-semibold ${ok ? 'text-green-600' : 'text-red-600'}`}>
                            {submitted}/{assigned} submitted
                          </span>
                          <span className="text-sm">{ok ? '✅' : '⚠️'}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <p className="text-xs text-gray-400 mt-2">Scouting blocks assigned vs. records submitted today</p>
              </div>
            )
          })()}

          {/* Live overview */}
          {isLive && activeBlock && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
                Now: {activeBlock.name}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {ROLES.map(role => {
                  const assigned = assignments.filter(a => a.block_id === activeBlock.id && a.role === role.id)
                  if (assigned.length === 0) return null
                  return (
                    <div key={role.id} className={`rounded-lg border p-3 ${role.color}`}>
                      <p className="text-xs font-semibold mb-1">{role.emoji} {role.label}</p>
                      {assigned.map(a => (
                        <p key={a.username} className="text-xs">{a.username}</p>
                      ))}
                    </div>
                  )
                })}
              </div>
              {unassignedInBlock(activeBlock.id).length > 0 && (
                <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3">
                  <p className="text-xs font-semibold text-red-600 mb-1">❓ Unassigned</p>
                  {unassignedInBlock(activeBlock.id).map(m => (
                    <p key={m} className="text-xs text-red-500">{m}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
