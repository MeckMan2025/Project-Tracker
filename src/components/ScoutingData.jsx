import { useState, useEffect, useMemo } from 'react'
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react'
import { supabase } from '../supabase'
import { useUser } from '../contexts/UserContext'

function ProgressBar({ value, max, color = 'bg-pastel-pink' }) {
  const pct = max === 0 ? 0 : Math.min(100, Math.round((value / max) * 100))
  return (
    <div className="h-2 rounded-full bg-gray-200 mt-1">
      <div
        className={`h-2 rounded-full ${color} transition-all`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

function StatLine({ label, value, maxValue, color, suffix = '' }) {
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-xs">
        <span className="text-gray-600">{label}</span>
        <span className="font-medium text-gray-800">{value}{suffix}</span>
      </div>
      <ProgressBar value={typeof value === 'string' ? parseFloat(value) || 0 : value} max={maxValue} color={color} />
    </div>
  )
}

function ScoutingData() {
  const { isLead } = useUser()
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState('avgAllianceScore')
  const [expandedTeams, setExpandedTeams] = useState({})

  // Load records on mount
  useEffect(() => {
    async function load() {
      try {
        const { data, error } = await supabase
          .from('scouting_records')
          .select('*')
          .order('submitted_at', { ascending: true })
        if (error) {
          console.error('Failed to load scouting records:', error.message)
        }
        if (data) setRecords(data)
      } catch (err) {
        console.error('Exception loading scouting records:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('scouting-records-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'scouting_records' }, (payload) => {
        setRecords(prev => {
          if (prev.some(r => r.id === payload.new.id)) return prev
          return [...prev, payload.new]
        })
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'scouting_records' }, (payload) => {
        setRecords(prev => prev.filter(r => r.id !== payload.old.id))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const handleDelete = async (id) => {
    const { error } = await supabase.from('scouting_records').delete().eq('id', id)
    if (error) {
      console.error('Failed to delete scouting record:', error.message)
      return
    }
    setRecords(prev => prev.filter(r => r.id !== id))
  }

  // Group records by team number and compute stats
  const teamStats = useMemo(() => {
    const byTeam = {}
    records.forEach(r => {
      const d = r.data || {}
      const team = d.teamNumber
      if (!team) return
      if (!byTeam[team]) byTeam[team] = []
      byTeam[team].push({ ...d, _id: r.id, _submittedBy: r.submitted_by, _submittedAt: r.submitted_at })
    })

    const avg = (arr, key) => {
      const nums = arr.map(r => Number(r[key]) || 0)
      return nums.length === 0 ? 0 : nums.reduce((a, b) => a + b, 0) / nums.length
    }

    const pct = (arr, fn) => {
      if (arr.length === 0) return 0
      return Math.round((arr.filter(fn).length / arr.length) * 100)
    }

    const stats = Object.entries(byTeam).map(([team, matches]) => {
      // Auto
      const autoClassified = avg(matches, 'autoClassified')
      const autoMissed = avg(matches, 'autoArtifactsMissed')
      const autoOverflowed = avg(matches, 'autoOverflowed')
      const autoMotif = avg(matches, 'autoInMotifOrder')

      // Tele-op
      const teleClassified = avg(matches, 'teleClassified')
      const teleMissed = avg(matches, 'teleArtifactsMissed')
      const teleOverflowed = avg(matches, 'teleOverflowed')
      const teleMotif = avg(matches, 'teleInMotifOrder')
      const teleDepot = avg(matches, 'teleArtifactsInDepot')

      // Scores
      const avgAllianceScore = avg(matches, 'allianceScore')
      const avgArtifactPoints = avg(matches, 'artifactPoints')
      const avgPatternPoints = avg(matches, 'patternPoints')
      const avgBasePoints = avg(matches, 'basePoints')
      const avgFoulPoints = avg(matches, 'foulPoints')

      // RP rates
      const patternRPRate = pct(matches, m => m.patternRP)
      const goalRPRate = pct(matches, m => m.goalRP)
      const movementRPRate = pct(matches, m => m.movementRP)

      // Stability
      const noIssuesRate = pct(matches, m => m.robotStability === 'no')
      const majorBreakdownRate = pct(matches, m => m.robotStability === 'major')
      const shutdownRate = pct(matches, m => m.robotStability === 'shutdown')

      // Roles
      const roleCounts = {}
      matches.forEach(m => {
        (m.roles || []).forEach(role => {
          roleCounts[role] = (roleCounts[role] || 0) + 1
        })
      })
      const roles = Object.entries(roleCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([role, count]) => ({ role, count }))

      return {
        team,
        matchCount: matches.length,
        autoClassified, autoMissed, autoOverflowed, autoMotif,
        teleClassified, teleMissed, teleOverflowed, teleMotif, teleDepot,
        avgAllianceScore, avgArtifactPoints, avgPatternPoints, avgBasePoints, avgFoulPoints,
        patternRPRate, goalRPRate, movementRPRate,
        noIssuesRate, majorBreakdownRate, shutdownRate,
        roles,
        matches,
      }
    })

    // Sort
    if (sortBy === 'avgAllianceScore') {
      stats.sort((a, b) => b.avgAllianceScore - a.avgAllianceScore)
    } else if (sortBy === 'matchCount') {
      stats.sort((a, b) => b.matchCount - a.matchCount)
    } else if (sortBy === 'autoClassified') {
      stats.sort((a, b) => b.autoClassified - a.autoClassified)
    }

    return stats
  }, [records, sortBy])

  const toggleExpand = (team) => {
    setExpandedTeams(prev => ({ ...prev, [team]: !prev[team] }))
  }

  // Find max values for progress bar scaling
  const maxAuto = useMemo(() => Math.max(1, ...teamStats.map(t => Math.max(t.autoClassified, t.autoMissed, t.autoOverflowed, t.autoMotif))), [teamStats])
  const maxTele = useMemo(() => Math.max(1, ...teamStats.map(t => Math.max(t.teleClassified, t.teleMissed, t.teleOverflowed, t.teleMotif, t.teleDepot))), [teamStats])
  const maxScore = useMemo(() => Math.max(1, ...teamStats.map(t => t.avgAllianceScore)), [teamStats])

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-w-0">
        <p className="text-gray-500 animate-pulse">Loading scouting data...</p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="px-4 py-4 flex items-center justify-between">
          <div className="ml-10">
            <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-pastel-blue-dark via-pastel-pink-dark to-pastel-orange-dark bg-clip-text text-transparent">
              Scouting Analytics
            </h1>
            <p className="text-sm text-gray-500">
              {teamStats.length} team{teamStats.length !== 1 ? 's' : ''} &middot; {records.length} record{records.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-500">Sort by:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-pastel-pink focus:border-transparent bg-white"
            >
              <option value="avgAllianceScore">Avg Alliance Score</option>
              <option value="matchCount">Match Count</option>
              <option value="autoClassified">Avg Auto Classified</option>
            </select>
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 pl-14 md:pl-4 overflow-y-auto">
        {teamStats.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <p className="text-gray-400 text-lg">No scouting data yet. Submit data from the Scouting tab.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pb-8">
            {teamStats.map(ts => (
              <div
                key={ts.team}
                className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm border border-gray-100 overflow-hidden"
              >
                {/* Card Header */}
                <div className="px-4 py-3 bg-gradient-to-r from-pastel-blue/30 to-pastel-pink/30">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-gray-800">Team {ts.team}</h3>
                    <span className="text-sm text-gray-500 font-medium">
                      {ts.matchCount} match{ts.matchCount !== 1 ? 'es' : ''}
                    </span>
                  </div>
                </div>

                <div className="p-4 space-y-4">
                  {/* Auto Performance */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-2 border-b border-gray-100 pb-1">Auto Performance</h4>
                    <div className="space-y-1.5">
                      <StatLine label="Avg Classified" value={ts.autoClassified.toFixed(1)} maxValue={maxAuto} color="bg-blue-400" />
                      <StatLine label="Avg Missed" value={ts.autoMissed.toFixed(1)} maxValue={maxAuto} color="bg-red-300" />
                      <StatLine label="Avg Overflowed" value={ts.autoOverflowed.toFixed(1)} maxValue={maxAuto} color="bg-amber-300" />
                      <StatLine label="Avg in Motif Order" value={ts.autoMotif.toFixed(1)} maxValue={maxAuto} color="bg-green-400" />
                    </div>
                  </div>

                  {/* Tele-op Performance */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-2 border-b border-gray-100 pb-1">Tele-op Performance</h4>
                    <div className="space-y-1.5">
                      <StatLine label="Avg Classified" value={ts.teleClassified.toFixed(1)} maxValue={maxTele} color="bg-blue-400" />
                      <StatLine label="Avg Missed" value={ts.teleMissed.toFixed(1)} maxValue={maxTele} color="bg-red-300" />
                      <StatLine label="Avg Overflowed" value={ts.teleOverflowed.toFixed(1)} maxValue={maxTele} color="bg-amber-300" />
                      <StatLine label="Avg in Motif Order" value={ts.teleMotif.toFixed(1)} maxValue={maxTele} color="bg-green-400" />
                      <StatLine label="Avg in Depot" value={ts.teleDepot.toFixed(1)} maxValue={maxTele} color="bg-purple-400" />
                    </div>
                  </div>

                  {/* Scores */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-2 border-b border-gray-100 pb-1">Scores</h4>
                    <div className="space-y-1.5">
                      <StatLine label="Avg Alliance Score" value={ts.avgAllianceScore.toFixed(1)} maxValue={maxScore} color="bg-pastel-pink" />
                      <StatLine label="Avg Artifact Points" value={ts.avgArtifactPoints.toFixed(1)} maxValue={maxScore} color="bg-pastel-blue" />
                      <StatLine label="Avg Pattern Points" value={ts.avgPatternPoints.toFixed(1)} maxValue={36} color="bg-pastel-orange" />
                      <StatLine label="Avg Base Points" value={ts.avgBasePoints.toFixed(1)} maxValue={maxScore} color="bg-pastel-blue-dark" />
                      <StatLine label="Avg Foul Points" value={ts.avgFoulPoints.toFixed(1)} maxValue={maxScore} color="bg-red-300" />
                    </div>
                  </div>

                  {/* RP Rates */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-2 border-b border-gray-100 pb-1">RP Rates</h4>
                    <div className="space-y-1.5">
                      <StatLine label="Pattern RP" value={ts.patternRPRate} maxValue={100} color="bg-indigo-400" suffix="%" />
                      <StatLine label="Goal RP" value={ts.goalRPRate} maxValue={100} color="bg-emerald-400" suffix="%" />
                      <StatLine label="Movement RP" value={ts.movementRPRate} maxValue={100} color="bg-cyan-400" suffix="%" />
                    </div>
                  </div>

                  {/* Stability */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-2 border-b border-gray-100 pb-1">Stability</h4>
                    <div className="space-y-1.5">
                      <StatLine label="No Issues" value={ts.noIssuesRate} maxValue={100} color="bg-green-400" suffix="%" />
                      <StatLine label="Major Breakdown" value={ts.majorBreakdownRate} maxValue={100} color="bg-amber-400" suffix="%" />
                      <StatLine label="Shutdown" value={ts.shutdownRate} maxValue={100} color="bg-red-400" suffix="%" />
                    </div>
                  </div>

                  {/* Roles */}
                  {ts.roles.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-2 border-b border-gray-100 pb-1">Common Roles</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {ts.roles.map(({ role, count }) => (
                          <span key={role} className="px-2 py-0.5 bg-gray-100 rounded-full text-xs text-gray-600">
                            {role} <span className="font-semibold text-gray-800">({count})</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Expand/Collapse */}
                  <button
                    onClick={() => toggleExpand(ts.team)}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors w-full justify-center pt-1"
                  >
                    {expandedTeams[ts.team] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    {expandedTeams[ts.team] ? 'Hide' : 'Show'} match records
                  </button>

                  {expandedTeams[ts.team] && (
                    <div className="space-y-2 pt-1">
                      {ts.matches.map((m, i) => (
                        <div key={m._id || i} className="bg-gray-50 rounded-lg p-2.5 text-xs space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-gray-700">
                              Match {m.matchNumber || '?'} &middot; {m.allianceColor || '?'}
                            </span>
                            {isLead && m._id && (
                              <button
                                onClick={() => handleDelete(m._id)}
                                className="text-gray-400 hover:text-red-500 transition-colors"
                                title="Delete record"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                          <div className="text-gray-500">
                            Auto: {m.autoClassified || 0} classified, {m.autoArtifactsMissed || 0} missed
                            {' | '}
                            Tele: {m.teleClassified || 0} classified, {m.teleArtifactsMissed || 0} missed
                          </div>
                          <div className="text-gray-500">
                            Score: {m.allianceScore || 0} &middot; Artifact: {m.artifactPoints || 0} &middot; Pattern: {m.patternPoints || 0}
                          </div>
                          {m._submittedBy && (
                            <div className="text-gray-400">by {m._submittedBy}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

export default ScoutingData
