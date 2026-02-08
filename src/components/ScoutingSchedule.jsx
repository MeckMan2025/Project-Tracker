import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useUser } from '../contexts/UserContext'
import { Plus, X, Trash2, Save, Pencil, Users, Calendar } from 'lucide-react'

// Default groups - leads can edit these via Supabase
const DEFAULT_GROUPS = [
  { id: '1', name: 'Group 1', members: [], teams: [] },
  { id: '2', name: 'Group 2', members: [], teams: [] },
  { id: '3', name: 'Group 3', members: [], teams: [] },
  { id: '4', name: 'Group 4', members: [], teams: [] },
  { id: '5', name: 'Group 5', members: [], teams: [] },
  { id: '6', name: 'Group 6', members: [], teams: [] },
]

const DEFAULT_FIXED_ROLES = [
  { role: 'Drive Team', members: [] },
  { role: 'Pit Crew', members: [] },
  { role: 'Media', members: [] },
  { role: 'Observation', members: [] },
  { role: 'Head Scouter', members: [] },
]

const ALLIANCE_POSITIONS = ['Red 1', 'Red 2', 'Blue 1', 'Blue 2']

export default function ScoutingSchedule() {
  const { username, isLead } = useUser()
  const [scheduleData, setScheduleData] = useState(null)
  const [editing, setEditing] = useState(false)
  const [editData, setEditData] = useState(null)
  const [saving, setSaving] = useState(false)

  // Load schedule from Supabase
  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('scouting_schedule')
        .select('*')
        .eq('id', 'main')
        .single()
      if (data) {
        setScheduleData(data.data)
      } else {
        // Initialize with defaults
        const defaults = {
          groups: DEFAULT_GROUPS,
          fixedRoles: DEFAULT_FIXED_ROLES,
          matches: [],
        }
        setScheduleData(defaults)
      }
    }
    load()
  }, [])

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel('schedule-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scouting_schedule' }, (payload) => {
        if (payload.new?.data) setScheduleData(payload.new.data)
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  const startEditing = () => {
    setEditData(JSON.parse(JSON.stringify(scheduleData)))
    setEditing(true)
  }

  const cancelEditing = () => {
    setEditData(null)
    setEditing(false)
  }

  const saveSchedule = async () => {
    setSaving(true)
    const { error } = await supabase
      .from('scouting_schedule')
      .upsert({ id: 'main', data: editData, updated_by: username, updated_at: new Date().toISOString() })
    if (!error) {
      setScheduleData(editData)
      setEditing(false)
      setEditData(null)
    }
    setSaving(false)
  }

  // Edit helpers
  const updateGroupMembers = (groupIdx, value) => {
    setEditData(prev => {
      const g = [...prev.groups]
      g[groupIdx] = { ...g[groupIdx], members: value.split(',').map(s => s.trim()).filter(Boolean) }
      return { ...prev, groups: g }
    })
  }

  const updateGroupTeams = (groupIdx, value) => {
    setEditData(prev => {
      const g = [...prev.groups]
      g[groupIdx] = { ...g[groupIdx], teams: value.split(',').map(s => s.trim()).filter(Boolean) }
      return { ...prev, groups: g }
    })
  }

  const updateFixedRoleMembers = (roleIdx, value) => {
    setEditData(prev => {
      const r = [...prev.fixedRoles]
      r[roleIdx] = { ...r[roleIdx], members: value.split(',').map(s => s.trim()).filter(Boolean) }
      return { ...prev, fixedRoles: r }
    })
  }

  const addMatch = () => {
    setEditData(prev => {
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
  }

  const removeMatch = (idx) => {
    setEditData(prev => ({
      ...prev,
      matches: prev.matches.filter((_, i) => i !== idx),
    }))
  }

  const updateMatchNumber = (idx, num) => {
    setEditData(prev => {
      const m = [...prev.matches]
      m[idx] = { ...m[idx], matchNumber: parseInt(num) || 0 }
      return { ...prev, matches: m }
    })
  }

  const updateMatchAssignment = (matchIdx, position, value) => {
    setEditData(prev => {
      const m = [...prev.matches]
      m[matchIdx] = { ...m[matchIdx], assignments: { ...m[matchIdx].assignments, [position]: value } }
      return { ...prev, matches: m }
    })
  }

  const data = editing ? editData : scheduleData

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
        <div className="px-4 py-3 ml-14 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-pastel-blue-dark via-pastel-pink-dark to-pastel-orange-dark bg-clip-text text-transparent">
              Scouting Schedule
            </h1>
            <p className="text-sm text-gray-500">Match assignments & scouting groups</p>
          </div>
          {isLead && !editing && (
            <button onClick={startEditing} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-pastel-pink hover:bg-pastel-pink-dark transition-colors">
              <Pencil size={14} /> Edit
            </button>
          )}
          {editing && (
            <div className="flex gap-2">
              <button onClick={cancelEditing} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 hover:bg-gray-200 transition-colors">
                <X size={14} /> Cancel
              </button>
              <button onClick={saveSchedule} disabled={saving} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-pastel-pink hover:bg-pastel-pink-dark transition-colors disabled:opacity-50">
                <Save size={14} /> {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          )}
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
                  {editing ? (
                    <input
                      type="text"
                      value={editData.fixedRoles[i].members.join(', ')}
                      onChange={e => updateFixedRoleMembers(i, e.target.value)}
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
                  {editing ? (
                    <>
                      <label className="text-xs text-gray-400 mt-1 block">Members:</label>
                      <input
                        type="text"
                        value={editData.groups[i].members.join(', ')}
                        onChange={e => updateGroupMembers(i, e.target.value)}
                        placeholder="Names, comma separated"
                        className="w-full text-sm border rounded-lg px-2 py-1 focus:ring-2 focus:ring-pastel-blue focus:border-transparent"
                      />
                      <label className="text-xs text-gray-400 mt-1 block">FTC Teams:</label>
                      <input
                        type="text"
                        value={editData.groups[i].teams.join(', ')}
                        onChange={e => updateGroupTeams(i, e.target.value)}
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
            <h2 className="text-lg font-semibold text-gray-700 border-b-2 border-pastel-pink pb-1 mb-3 flex items-center gap-2">
              <Calendar size={18} /> Match Scouting Assignments
            </h2>

            {editing && (
              <button onClick={addMatch} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-pastel-blue hover:bg-pastel-blue-dark transition-colors mb-3">
                <Plus size={14} /> Add Match
              </button>
            )}

            {data.matches.length === 0 ? (
              <div className="text-center text-gray-400 py-8">
                <Calendar size={40} className="mx-auto mb-2 opacity-50" />
                <p>No matches scheduled yet.</p>
                {isLead && !editing && <p className="text-sm mt-1">Tap Edit to add match assignments.</p>}
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
                      {editing && <th className="px-2 py-2 border-b w-8"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {data.matches
                      .sort((a, b) => a.matchNumber - b.matchNumber)
                      .map((match, idx) => (
                        <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50/50">
                          <td className="px-3 py-2 font-medium text-gray-700">
                            {editing ? (
                              <input
                                type="number"
                                value={editData.matches[idx].matchNumber}
                                onChange={e => updateMatchNumber(idx, e.target.value)}
                                className="w-16 border rounded px-1 py-0.5 text-sm focus:ring-2 focus:ring-pastel-blue focus:border-transparent"
                              />
                            ) : (
                              `Q${match.matchNumber}`
                            )}
                          </td>
                          {ALLIANCE_POSITIONS.map(pos => {
                            const isRed = pos.startsWith('Red')
                            return (
                              <td
                                key={pos}
                                className={`px-3 py-2 ${isRed ? 'bg-red-50/50' : 'bg-blue-50/50'}`}
                              >
                                {editing ? (
                                  <select
                                    value={editData.matches[idx].assignments[pos] || ''}
                                    onChange={e => updateMatchAssignment(idx, pos, e.target.value)}
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
                          {editing && (
                            <td className="px-2 py-2">
                              <button onClick={() => removeMatch(idx)} className="text-gray-300 hover:text-red-400 transition-colors">
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
