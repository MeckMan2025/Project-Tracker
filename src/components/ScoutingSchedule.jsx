import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../supabase'
import { useUser } from '../contexts/UserContext'
import { Plus, Trash2, Users, Calendar } from 'lucide-react'

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
  matches: [],
}

const ALLIANCE_POSITIONS = ['Red 1', 'Red 2', 'Blue 1', 'Blue 2']

export default function ScoutingSchedule() {
  const { username, isLead } = useUser()
  const [data, setData] = useState(null)
  const saveTimer = useRef(null)

  // Load
  useEffect(() => {
    async function load() {
      const { data: row } = await supabase
        .from('scouting_schedule')
        .select('*')
        .eq('id', 'main')
        .single()
      setData(row?.data || { ...DEFAULT_DATA })
    }
    load()
  }, [])

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel('schedule-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scouting_schedule' }, (payload) => {
        if (payload.new?.data) setData(payload.new.data)
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  // Auto-save with debounce
  const autoSave = useCallback((newData) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      await supabase
        .from('scouting_schedule')
        .upsert({ id: 'main', data: newData, updated_by: username, updated_at: new Date().toISOString() })
    }, 800)
  }, [username])

  const update = (updater) => {
    setData(prev => {
      const next = updater(prev)
      autoSave(next)
      return next
    })
  }

  if (!data) {
    return (
      <div className="flex-1 flex items-center justify-center min-w-0">
        <p className="text-gray-400">Loading schedule...</p>
      </div>
    )
  }

  const groupOptions = data.groups.map(g => g.name)

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="px-4 py-3 ml-14">
          <h1 className="text-xl font-bold bg-gradient-to-r from-pastel-blue-dark via-pastel-pink-dark to-pastel-orange-dark bg-clip-text text-transparent">
            Scouting Schedule
          </h1>
          <p className="text-sm text-gray-500">Match assignments & scouting groups</p>
        </div>
      </header>

      <main className="flex-1 p-4 overflow-y-auto">
        <div className="max-w-4xl mx-auto space-y-6">

          {/* Fixed Roles */}
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

          {/* Match Scouting Grid */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-gray-700 border-b-2 border-pastel-pink pb-1 flex items-center gap-2">
                <Calendar size={18} /> Match Scouting Assignments
              </h2>
              {isLead && (
                <button
                  onClick={() => {
                    update(prev => {
                      const nextNum = prev.matches.length > 0
                        ? Math.max(...prev.matches.map(m => m.matchNumber)) + 1
                        : 1
                      return {
                        ...prev,
                        matches: [...prev.matches, {
                          matchNumber: nextNum,
                          assignments: { 'Red 1': '', 'Red 2': '', 'Blue 1': '', 'Blue 2': '' },
                        }],
                      }
                    })
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-pastel-blue hover:bg-pastel-blue-dark transition-colors"
                >
                  <Plus size={14} /> Add Match
                </button>
              )}
            </div>

            {data.matches.length === 0 ? (
              <div className="text-center text-gray-400 py-8">
                <Calendar size={40} className="mx-auto mb-2 opacity-50" />
                <p>No matches scheduled yet.</p>
                {isLead && <p className="text-sm mt-1">Tap "Add Match" to start building the schedule.</p>}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left px-3 py-2 font-semibold text-gray-600 border-b">Match</th>
                      {ALLIANCE_POSITIONS.map(pos => (
                        <th
                          key={pos}
                          className={`text-left px-3 py-2 font-semibold border-b ${
                            pos.startsWith('Red') ? 'text-red-700 bg-red-50' : 'text-blue-700 bg-blue-50'
                          }`}
                        >
                          {pos}
                        </th>
                      ))}
                      {isLead && <th className="px-2 py-2 border-b w-8"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {[...data.matches]
                      .sort((a, b) => a.matchNumber - b.matchNumber)
                      .map((match, idx) => (
                        <tr key={match.matchNumber} className="border-b border-gray-100 hover:bg-gray-50/50">
                          <td className="px-3 py-2 font-medium text-gray-700">
                            Q{match.matchNumber}
                          </td>
                          {ALLIANCE_POSITIONS.map(pos => {
                            const isRed = pos.startsWith('Red')
                            return (
                              <td key={pos} className={`px-3 py-2 ${isRed ? 'bg-red-50/50' : 'bg-blue-50/50'}`}>
                                {isLead ? (
                                  <select
                                    value={match.assignments[pos] || ''}
                                    onChange={e => {
                                      const val = e.target.value
                                      update(prev => {
                                        const m = [...prev.matches]
                                        const realIdx = m.findIndex(x => x.matchNumber === match.matchNumber)
                                        if (realIdx >= 0) {
                                          m[realIdx] = { ...m[realIdx], assignments: { ...m[realIdx].assignments, [pos]: val } }
                                        }
                                        return { ...prev, matches: m }
                                      })
                                    }}
                                    className={`w-full text-sm border rounded px-1 py-0.5 focus:ring-2 focus:ring-pastel-blue focus:border-transparent ${
                                      isRed ? 'bg-red-50' : 'bg-blue-50'
                                    }`}
                                  >
                                    <option value="">--</option>
                                    {groupOptions.map(g => <option key={g} value={g}>{g}</option>)}
                                  </select>
                                ) : (
                                  <span className={`text-sm font-medium ${isRed ? 'text-red-700' : 'text-blue-700'}`}>
                                    {match.assignments[pos] || '-'}
                                  </span>
                                )}
                              </td>
                            )
                          })}
                          {isLead && (
                            <td className="px-2 py-2">
                              <button
                                onClick={() => {
                                  update(prev => ({
                                    ...prev,
                                    matches: prev.matches.filter(m => m.matchNumber !== match.matchNumber),
                                  }))
                                }}
                                className="text-gray-300 hover:text-red-400 transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

        </div>
      </main>
    </div>
  )
}
