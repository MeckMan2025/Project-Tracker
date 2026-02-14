import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../supabase'
import { useUser } from '../contexts/UserContext'
import { usePermissions } from '../hooks/usePermissions'
import { Users, Shield, Clock, Play, Square } from 'lucide-react'

const ALLIANCE_SLOTS = ['Red 1', 'Red 2', 'Blue 1', 'Blue 2', 'Standby']

const DEFAULT_DATA = {
  groups: [
    { id: '1', name: 'Group 1', members: [], teams: [] },
    { id: '2', name: 'Group 2', members: [], teams: [] },
    { id: '3', name: 'Group 3', members: [], teams: [] },
    { id: '4', name: 'Group 4', members: [], teams: [] },
    { id: '5', name: 'Group 5', members: [], teams: [] },
    { id: '6', name: 'Group 6', members: [], teams: [] },
  ],
  fixedRoles: [
    { role: 'Drive Team', members: [] },
    { role: 'Pit Crew', members: [] },
    { role: 'Media', members: [] },
    { role: 'Observation', members: [] },
    { role: 'Head Scouter', members: [] },
  ],
  allianceSlots: {
    'Red 1': '',
    'Red 2': '',
    'Blue 1': '',
    'Blue 2': '',
    'Standby': '',
  },
}

export default function ScoutingSchedule() {
  const { username } = useUser()
  const { canEditContent } = usePermissions()
  const isLead = canEditContent
  const [data, setData] = useState(null)
  const [activePeriod, setActivePeriod] = useState(null)
  const [periodSubmissions, setPeriodSubmissions] = useState([])
  const [showPeriodForm, setShowPeriodForm] = useState(false)
  const [periodName, setPeriodName] = useState('')
  const saveTimer = useRef(null)
  const activePeriodRef = useRef(null)

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  // Keep ref in sync for realtime callbacks
  useEffect(() => { activePeriodRef.current = activePeriod }, [activePeriod])

  // REST headers using anon key (bypasses auth lock that hangs getSession)
  const restHeaders = {
    'apikey': supabaseKey,
    'Authorization': `Bearer ${supabaseKey}`,
    'Content-Type': 'application/json',
  }

  // Load submissions for a period
  const loadSubmissions = useCallback(async (periodId) => {
    try {
      const headers = restHeaders
      const res = await fetch(
        `${supabaseUrl}/rest/v1/scouting_records?scouting_period_id=eq.${periodId}&select=submitted_by`,
        { headers }
      )
      if (res.ok) {
        const rows = await res.json()
        setPeriodSubmissions(rows.map(r => r.submitted_by))
      }
    } catch { /* ignore */ }
  }, [supabaseUrl, supabaseKey])

  // Load schedule data via REST
  useEffect(() => {
    async function load() {
      try {
        const headers = restHeaders
        const res = await fetch(
          `${supabaseUrl}/rest/v1/scouting_schedule?id=eq.main&select=*`,
          { headers }
        )
        if (res.ok) {
          const rows = await res.json()
          const row = rows && rows.length > 0 ? rows[0] : null
          const loaded = row?.data || { ...DEFAULT_DATA }
          // Ensure allianceSlots exists (migration from old format)
          if (!loaded.allianceSlots) {
            loaded.allianceSlots = { ...DEFAULT_DATA.allianceSlots }
          }
          setData(loaded)
        } else {
          setData({ ...DEFAULT_DATA })
        }
      } catch {
        setData({ ...DEFAULT_DATA })
      }
    }
    load()
  }, [supabaseUrl, supabaseKey])

  // Load active scouting period via REST
  useEffect(() => {
    async function loadPeriod() {
      try {
        const headers = restHeaders
        const res = await fetch(
          `${supabaseUrl}/rest/v1/scouting_periods?is_active=eq.true&select=*&limit=1`,
          { headers }
        )
        if (res.ok) {
          const rows = await res.json()
          const period = rows && rows.length > 0 ? rows[0] : null
          setActivePeriod(period)
          if (period) loadSubmissions(period.id)
        }
      } catch { /* ignore */ }
    }
    loadPeriod()
  }, [supabaseUrl, supabaseKey, loadSubmissions])

  // Realtime subscriptions
  useEffect(() => {
    const channel = supabase
      .channel('schedule-and-periods')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scouting_schedule' }, (payload) => {
        if (payload.new?.data) {
          const d = payload.new.data
          if (!d.allianceSlots) d.allianceSlots = { ...DEFAULT_DATA.allianceSlots }
          setData(d)
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scouting_periods' }, (payload) => {
        if (payload.new?.is_active) {
          setActivePeriod(payload.new)
          loadSubmissions(payload.new.id)
        } else {
          setActivePeriod(null)
          setPeriodSubmissions([])
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'scouting_records' }, (payload) => {
        const current = activePeriodRef.current
        if (current && payload.new?.scouting_period_id === current.id) {
          setPeriodSubmissions(prev => [...prev, payload.new.submitted_by])
        }
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [loadSubmissions])

  // Auto-save schedule data via REST (debounced)
  const autoSave = useCallback((newData) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      const body = { id: 'main', data: newData, updated_by: username, updated_at: new Date().toISOString() }
      try {
        const headers = restHeaders
        await fetch(`${supabaseUrl}/rest/v1/scouting_schedule`, {
          method: 'POST',
          headers: { ...headers, 'Prefer': 'resolution=merge-duplicates' },
          body: JSON.stringify(body),
        })
      } catch (err) {
        console.error('Failed to save schedule:', err)
      }
    }, 800)
  }, [username, supabaseUrl, getHeaders])

  const update = (updater) => {
    setData(prev => {
      const next = updater(prev)
      autoSave(next)
      return next
    })
  }

  // Start a scouting period
  const startPeriod = async () => {
    if (!periodName.trim()) return
    const expectedScouts = Object.entries(data.allianceSlots || {})
      .filter(([slot, name]) => name && slot !== 'Standby')
      .map(([, name]) => name)
    const id = String(Date.now()) + Math.random().toString(36).slice(2)
    const period = {
      id,
      name: periodName.trim(),
      started_at: new Date().toISOString(),
      ended_at: null,
      is_active: true,
      created_by: username,
      expected_scouts: expectedScouts,
    }
    try {
      const headers = restHeaders
      const res = await fetch(`${supabaseUrl}/rest/v1/scouting_periods`, {
        method: 'POST',
        headers,
        body: JSON.stringify(period),
      })
      if (res.ok) {
        setActivePeriod(period)
        setPeriodSubmissions([])
        setShowPeriodForm(false)
        setPeriodName('')
      } else {
        console.error('Failed to start period:', await res.text())
      }
    } catch (err) {
      console.error('Failed to start period:', err)
    }
  }

  // Stop the active scouting period
  const stopPeriod = async () => {
    if (!activePeriod) return
    try {
      const headers = restHeaders
      await fetch(`${supabaseUrl}/rest/v1/scouting_periods?id=eq.${activePeriod.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ is_active: false, ended_at: new Date().toISOString() }),
      })
      setActivePeriod(null)
      setPeriodSubmissions([])
    } catch (err) {
      console.error('Failed to stop period:', err)
    }
  }

  if (!data) {
    return (
      <div className="flex-1 flex items-center justify-center min-w-0">
        <p className="text-gray-400">Loading schedule...</p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="px-4 py-3 ml-14">
          <h1 className="text-xl font-bold bg-gradient-to-r from-pastel-blue-dark via-pastel-pink-dark to-pastel-orange-dark bg-clip-text text-transparent">
            Scouting Schedule
          </h1>
          <p className="text-sm text-gray-500">Alliance assignments & scouting accountability</p>
        </div>
      </header>

      <main className="flex-1 p-4 overflow-y-auto">
        <div className="max-w-4xl mx-auto space-y-6">

          {/* Active Scouting Period Banner */}
          {activePeriod && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                  </span>
                  <span className="font-semibold text-green-800">{activePeriod.name}</span>
                  <span className="text-sm text-green-600">- Active</span>
                </div>
                {isLead && (
                  <button
                    onClick={stopPeriod}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-red-100 hover:bg-red-200 text-red-700 transition-colors"
                  >
                    <Square size={14} /> Stop Period
                  </button>
                )}
              </div>
              {/* Accountability Tracker */}
              <div>
                <p className="text-sm font-medium text-green-700 mb-2">Scout Accountability</p>
                <div className="flex flex-wrap gap-2">
                  {(activePeriod.expected_scouts || []).map((scout, idx) => {
                    const hasSubmitted = periodSubmissions.includes(scout)
                    return (
                      <span
                        key={`${scout}-${idx}`}
                        className={`px-3 py-1 rounded-full text-sm font-medium ${
                          hasSubmitted
                            ? 'bg-green-200 text-green-800'
                            : 'bg-red-200 text-red-800'
                        }`}
                      >
                        {scout}
                      </span>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Fixed Event Roles */}
          <section>
            <h2 className="text-lg font-semibold text-gray-700 border-b-2 border-pastel-pink pb-1 mb-3 flex items-center gap-2">
              <Users size={18} /> Fixed Event Roles
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {data.fixedRoles.map((role, i) => (
                <div key={role.role} className="bg-white rounded-lg p-3 shadow-sm">
                  <h4 className="text-sm font-semibold text-gray-700">{role.role}</h4>
                  {isLead ? (
                    <input
                      type="text"
                      value={role.members.join(', ')}
                      onChange={e => {
                        const members = e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                        update(prev => {
                          const r = [...prev.fixedRoles]
                          r[i] = { ...r[i], members }
                          return { ...prev, fixedRoles: r }
                        })
                      }}
                      placeholder="Names, comma separated"
                      className="w-full mt-1 text-sm border rounded-lg px-2 py-1 focus:ring-2 focus:ring-pastel-blue focus:border-transparent"
                    />
                  ) : (
                    <p className="text-sm text-gray-500 mt-1">
                      {role.members.length > 0 ? role.members.join(', ') : <span className="italic text-gray-300">Not assigned</span>}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Scouting Groups */}
          <section>
            <h2 className="text-lg font-semibold text-gray-700 border-b-2 border-pastel-pink pb-1 mb-3 flex items-center gap-2">
              <Users size={18} /> Scouting Groups
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {data.groups.map((group, i) => (
                <div key={group.id} className="bg-white rounded-lg p-3 shadow-sm">
                  <h4 className="text-sm font-semibold text-gray-700">{group.name}</h4>
                  {isLead ? (
                    <>
                      <label className="text-xs text-gray-400 mt-1 block">Members:</label>
                      <input
                        type="text"
                        value={group.members.join(', ')}
                        onChange={e => {
                          const members = e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                          update(prev => {
                            const g = [...prev.groups]
                            g[i] = { ...g[i], members }
                            return { ...prev, groups: g }
                          })
                        }}
                        placeholder="Names, comma separated"
                        className="w-full text-sm border rounded-lg px-2 py-1 focus:ring-2 focus:ring-pastel-blue focus:border-transparent"
                      />
                      <label className="text-xs text-gray-400 mt-1 block">FTC Teams:</label>
                      <input
                        type="text"
                        value={group.teams.join(', ')}
                        onChange={e => {
                          const teams = e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                          update(prev => {
                            const g = [...prev.groups]
                            g[i] = { ...g[i], teams }
                            return { ...prev, groups: g }
                          })
                        }}
                        placeholder="Team numbers, comma separated"
                        className="w-full text-sm border rounded-lg px-2 py-1 focus:ring-2 focus:ring-pastel-blue focus:border-transparent"
                      />
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-gray-500 mt-1">
                        {group.members.length > 0 ? group.members.join(', ') : <span className="italic text-gray-300">No members</span>}
                      </p>
                      {group.teams.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {group.teams.map(t => (
                            <span key={t} className="text-xs px-1.5 py-0.5 bg-pastel-orange/30 text-gray-600 rounded">#{t}</span>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Alliance Slot Assignments */}
          <section>
            <h2 className="text-lg font-semibold text-gray-700 border-b-2 border-pastel-pink pb-1 mb-3 flex items-center gap-2">
              <Shield size={18} /> Alliance Slot Assignments
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {ALLIANCE_SLOTS.map(slot => {
                const isRed = slot.startsWith('Red')
                const isBlue = slot.startsWith('Blue')
                const bgClass = isRed ? 'bg-red-50 border-red-200' : isBlue ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'
                const textClass = isRed ? 'text-red-700' : isBlue ? 'text-blue-700' : 'text-gray-700'
                const inputBg = isRed ? 'bg-red-50' : isBlue ? 'bg-blue-50' : 'bg-white'
                return (
                  <div key={slot} className={`rounded-lg p-3 shadow-sm border ${bgClass}`}>
                    <h4 className={`text-sm font-semibold ${textClass}`}>{slot}</h4>
                    {isLead ? (
                      <input
                        type="text"
                        value={(data.allianceSlots || {})[slot] || ''}
                        onChange={e => {
                          update(prev => ({
                            ...prev,
                            allianceSlots: { ...(prev.allianceSlots || {}), [slot]: e.target.value },
                          }))
                        }}
                        placeholder="Person name"
                        className={`w-full mt-1 text-sm border rounded-lg px-2 py-1 focus:ring-2 focus:ring-pastel-blue focus:border-transparent ${inputBg}`}
                      />
                    ) : (
                      <p className={`text-sm mt-1 font-medium ${textClass}`}>
                        {(data.allianceSlots || {})[slot] || <span className="italic text-gray-300 font-normal">Unassigned</span>}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </section>

          {/* Scouting Period Controls (leads only, when no period active) */}
          {isLead && !activePeriod && (
            <section>
              <h2 className="text-lg font-semibold text-gray-700 border-b-2 border-pastel-pink pb-1 mb-3 flex items-center gap-2">
                <Clock size={18} /> Scouting Period
              </h2>
              {showPeriodForm ? (
                <div className="bg-white rounded-lg p-4 shadow-sm space-y-3">
                  <input
                    type="text"
                    value={periodName}
                    onChange={e => setPeriodName(e.target.value)}
                    placeholder="Period name (e.g. Quals Match 5)"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-pastel-blue focus:border-transparent"
                  />
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Expected scouts (from current slot assignments):</p>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(data.allianceSlots || {})
                        .filter(([slot, name]) => name && slot !== 'Standby')
                        .map(([slot, name]) => (
                          <span key={slot} className="text-xs px-2 py-1 bg-pastel-blue/30 rounded-full">{name} ({slot})</span>
                        ))}
                      {Object.entries(data.allianceSlots || {})
                        .filter(([slot, name]) => name && slot !== 'Standby').length === 0 && (
                        <span className="text-xs text-gray-400 italic">No scouts assigned to slots yet</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={startPeriod}
                      disabled={!periodName.trim()}
                      className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium bg-green-100 hover:bg-green-200 text-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Play size={14} /> Start
                    </button>
                    <button
                      onClick={() => { setShowPeriodForm(false); setPeriodName('') }}
                      className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowPeriodForm(true)}
                  className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium bg-pastel-blue hover:bg-pastel-blue-dark transition-colors"
                >
                  <Play size={14} /> Start Scouting Period
                </button>
              )}
            </section>
          )}

        </div>
      </main>
    </div>
  )
}
