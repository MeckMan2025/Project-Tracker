import { useState, useEffect } from 'react'
import { ChevronDown, ChevronUp, Trash2, Download } from 'lucide-react'
import { supabase } from '../supabase'
import { useUser } from '../contexts/UserContext'
import NotificationBell from './NotificationBell'

function TeamScoutingData() {
  const { username, teamNumber } = useUser()
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState(null)
  const [sortField, setSortField] = useState('submitted_at')
  const [sortDir, setSortDir] = useState('desc')

  useEffect(() => {
    loadRecords()
  }, [teamNumber, username])

  const loadRecords = async () => {
    setLoading(true)
    try {
      // Try filtering by owner_team first
      if (teamNumber) {
        const { data, error } = await supabase.from('scouting_records').select('*')
          .eq('owner_team', teamNumber)
          .order('submitted_at', { ascending: false })
        if (!error) {
          setRecords(data || [])
          setLoading(false)
          return
        }
      }
      // Fallback: filter by submitted_by containing the username
      const { data, error } = await supabase.from('scouting_records').select('*')
        .eq('submitted_by', username || '')
        .order('submitted_at', { ascending: false })
      if (error) throw error
      setRecords(data || [])
    } catch (err) {
      console.error('Failed to load scouting records:', err)
      setRecords([])
    }
    setLoading(false)
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this scouting record?')) return
    const { error } = await supabase.from('scouting_records').delete().eq('id', id)
    if (!error) {
      setRecords(prev => prev.filter(r => r.id !== id))
    }
  }

  const handleExport = () => {
    if (!records.length) return
    const rows = records.map(r => {
      const d = r.data || {}
      return {
        'Team #': d.teamNumber || '',
        'Match #': d.matchNumber || '',
        'Alliance': d.allianceColor || '',
        'Starting Position': d.startingPosition || '',
        'Auto Classified': d.autoClassified || 0,
        'Auto Missed': d.autoArtifactsMissed || 0,
        'Auto Overflowed': d.autoOverflowed || 0,
        'Auto Motif': d.autoInMotifOrder || 0,
        'Tele Classified': d.teleClassified || 0,
        'Tele Missed': d.teleArtifactsMissed || 0,
        'Tele Overflowed': d.teleOverflowed || 0,
        'Tele Motif': d.teleInMotifOrder || 0,
        'Tele Depot': d.teleArtifactsInDepot || 0,
        'Parking': d.parkingStatus || '',
        'Stability': d.robotStability || '',
        'Roles': (d.roles || []).join('; '),
        'Observations': d.observations || '',
        'Submitted By': r.submitted_by || '',
        'Submitted At': r.submitted_at || '',
      }
    })
    const headers = Object.keys(rows[0])
    const csv = [headers.join(','), ...rows.map(r => headers.map(h => `"${String(r[h]).replace(/"/g, '""')}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `scouting-data-team${teamNumber || 'unknown'}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const sorted = [...records].sort((a, b) => {
    let aVal, bVal
    if (sortField === 'submitted_at') {
      aVal = a.submitted_at || ''
      bVal = b.submitted_at || ''
    } else if (sortField === 'teamNumber') {
      aVal = a.data?.teamNumber || ''
      bVal = b.data?.teamNumber || ''
    } else if (sortField === 'matchNumber') {
      aVal = a.data?.matchNumber || ''
      bVal = b.data?.matchNumber || ''
    }
    if (aVal < bVal) return sortDir === 'asc' ? -1 : 1
    if (aVal > bVal) return sortDir === 'asc' ? 1 : -1
    return 0
  })

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  const SortIcon = ({ field }) => {
    if (sortField !== field) return null
    return sortDir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
  }

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="px-4 py-3 ml-14 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-pastel-blue-dark via-pastel-pink-dark to-pastel-orange-dark bg-clip-text text-transparent">
              Scouting Data
            </h1>
            <p className="text-xs text-gray-500">{records.length} record{records.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex items-center gap-2">
            {records.length > 0 && (
              <button
                onClick={handleExport}
                className="p-2 rounded-lg hover:bg-pastel-blue/30 transition-colors text-gray-500"
                title="Export CSV"
              >
                <Download size={18} />
              </button>
            )}
            <NotificationBell />
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 pl-14 md:pl-4 overflow-y-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <img src="/ScrumLogo-transparent.png" alt="Logo" className="w-14 h-14 animate-spin drop-shadow-lg" />
            <p className="text-sm font-semibold text-gray-500 animate-pulse">Scrumming it up...</p>
          </div>
        ) : records.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg font-medium">No scouting data yet</p>
            <p className="text-sm mt-1">Submit scouting forms to see your data here</p>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-2">
            {/* Sort controls */}
            <div className="flex gap-2 mb-4 text-sm">
              <button
                onClick={() => toggleSort('submitted_at')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition-colors ${sortField === 'submitted_at' ? 'bg-pastel-pink text-gray-800' : 'bg-white hover:bg-gray-50 text-gray-600'}`}
              >
                Date <SortIcon field="submitted_at" />
              </button>
              <button
                onClick={() => toggleSort('teamNumber')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition-colors ${sortField === 'teamNumber' ? 'bg-pastel-pink text-gray-800' : 'bg-white hover:bg-gray-50 text-gray-600'}`}
              >
                Team # <SortIcon field="teamNumber" />
              </button>
              <button
                onClick={() => toggleSort('matchNumber')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition-colors ${sortField === 'matchNumber' ? 'bg-pastel-pink text-gray-800' : 'bg-white hover:bg-gray-50 text-gray-600'}`}
              >
                Match # <SortIcon field="matchNumber" />
              </button>
            </div>

            {sorted.map(record => {
              const d = record.data || {}
              const isExpanded = expandedId === record.id
              return (
                <div key={record.id} className="bg-white rounded-xl shadow-sm border overflow-hidden">
                  <div
                    className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : record.id)}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-3 h-3 rounded-full ${d.allianceColor === 'Red' ? 'bg-red-400' : d.allianceColor === 'Blue' ? 'bg-blue-400' : 'bg-gray-300'}`} />
                      <div>
                        <span className="font-semibold text-gray-800">Team {d.teamNumber || '?'}</span>
                        <span className="text-gray-400 mx-2">|</span>
                        <span className="text-sm text-gray-600">Match {d.matchNumber || '?'}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">
                        {record.submitted_at ? new Date(record.submitted_at).toLocaleDateString() : ''}
                      </span>
                      {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-4 pb-4 border-t bg-gray-50/50">
                      <div className="grid grid-cols-2 gap-4 mt-3">
                        <div>
                          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Auto</h4>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between"><span className="text-gray-600">Classified</span><span className="font-medium">{d.autoClassified || 0}</span></div>
                            <div className="flex justify-between"><span className="text-gray-600">Missed</span><span className="font-medium">{d.autoArtifactsMissed || 0}</span></div>
                            <div className="flex justify-between"><span className="text-gray-600">Overflowed</span><span className="font-medium">{d.autoOverflowed || 0}</span></div>
                            <div className="flex justify-between"><span className="text-gray-600">Motif Order</span><span className="font-medium">{d.autoInMotifOrder || 0}</span></div>
                          </div>
                        </div>
                        <div>
                          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Teleop</h4>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between"><span className="text-gray-600">Classified</span><span className="font-medium">{d.teleClassified || 0}</span></div>
                            <div className="flex justify-between"><span className="text-gray-600">Missed</span><span className="font-medium">{d.teleArtifactsMissed || 0}</span></div>
                            <div className="flex justify-between"><span className="text-gray-600">Overflowed</span><span className="font-medium">{d.teleOverflowed || 0}</span></div>
                            <div className="flex justify-between"><span className="text-gray-600">Motif Order</span><span className="font-medium">{d.teleInMotifOrder || 0}</span></div>
                            <div className="flex justify-between"><span className="text-gray-600">Depot</span><span className="font-medium">{d.teleArtifactsInDepot || 0}</span></div>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mt-3">
                        <div>
                          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">End Game</h4>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between"><span className="text-gray-600">Starting Pos</span><span className="font-medium">{d.startingPosition || '-'}</span></div>
                            <div className="flex justify-between"><span className="text-gray-600">Parking</span><span className="font-medium">{d.parkingStatus || '-'}</span></div>
                            <div className="flex justify-between"><span className="text-gray-600">Double Park</span><span className="font-medium">{d.doublePark ? 'Yes' : 'No'}</span></div>
                            <div className="flex justify-between"><span className="text-gray-600">Left</span><span className="font-medium">{d.teleDidLeave ? 'Yes' : 'No'}</span></div>
                          </div>
                        </div>
                        <div>
                          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Details</h4>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between"><span className="text-gray-600">Stability</span><span className="font-medium">{d.robotStability === 'no' ? 'No issues' : d.robotStability === 'major' ? 'Major issue' : d.robotStability === 'shutdown' ? 'Shut off' : '-'}</span></div>
                            <div className="flex justify-between"><span className="text-gray-600">Alliance Score</span><span className="font-medium">{d.allianceScore || '-'}</span></div>
                            {d.roles && d.roles.length > 0 && (
                              <div><span className="text-gray-600">Roles: </span><span className="font-medium">{d.roles.join(', ')}</span></div>
                            )}
                          </div>
                        </div>
                      </div>

                      {d.observations && (
                        <div className="mt-3">
                          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Observations</h4>
                          <p className="text-sm text-gray-700 bg-white rounded-lg p-2">{d.observations}</p>
                        </div>
                      )}

                      <div className="mt-3 flex justify-between items-center">
                        <span className="text-xs text-gray-400">By {record.submitted_by}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(record.id) }}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}

export default TeamScoutingData
