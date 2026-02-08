import { useState, useEffect, useMemo } from 'react'
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react'
import { supabase } from '../supabase'
import { useUser } from '../contexts/UserContext'

const DEFAULT_TEAMS = [
  { name: 'Guild of Gears', number: '' },
  { name: 'Royal Robots', number: '' },
  { name: 'Robo Raptors', number: '' },
]

const ALLOWED_DELETERS = ['yukti', 'kayden', 'lily', 'nick', 'harshita']

function pctBar(value) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2.5 rounded-full bg-gray-200">
        <div
          className="h-2.5 rounded-full bg-pastel-pink transition-all"
          style={{ width: `${Math.min(100, value)}%` }}
        />
      </div>
      <span className="text-xs font-semibold text-gray-700 w-10 text-right">{value}%</span>
    </div>
  )
}

function computeStats(matches) {
  if (matches.length === 0) {
    return {
      matchCount: 0,
      startingPositions: {},
      autoPctMissed: 0, autoPctClassified: 0, autoPctOverflowed: 0, autoPctMotif: 0,
      telePctMissed: 0, telePctClassified: 0, telePctOverflowed: 0, telePctMotif: 0,
      teleLeavePct: 0,
    }
  }

  // Starting positions
  const startingPositions = {}
  matches.forEach(m => {
    const pos = m.startingPosition || 'Unknown'
    startingPositions[pos] = (startingPositions[pos] || 0) + 1
  })

  // Auto totals across all matches
  const autoTotal = matches.reduce((s, m) =>
    s + (Number(m.autoClassified) || 0) + (Number(m.autoArtifactsMissed) || 0) +
    (Number(m.autoOverflowed) || 0) + (Number(m.autoInMotifOrder) || 0), 0)
  const autoClassified = matches.reduce((s, m) => s + (Number(m.autoClassified) || 0), 0)
  const autoMissed = matches.reduce((s, m) => s + (Number(m.autoArtifactsMissed) || 0), 0)
  const autoOverflowed = matches.reduce((s, m) => s + (Number(m.autoOverflowed) || 0), 0)
  const autoMotif = matches.reduce((s, m) => s + (Number(m.autoInMotifOrder) || 0), 0)

  // Tele-op totals
  const teleTotal = matches.reduce((s, m) =>
    s + (Number(m.teleClassified) || 0) + (Number(m.teleArtifactsMissed) || 0) +
    (Number(m.teleOverflowed) || 0) + (Number(m.teleInMotifOrder) || 0), 0)
  const teleClassified = matches.reduce((s, m) => s + (Number(m.teleClassified) || 0), 0)
  const teleMissed = matches.reduce((s, m) => s + (Number(m.teleArtifactsMissed) || 0), 0)
  const teleOverflowed = matches.reduce((s, m) => s + (Number(m.teleOverflowed) || 0), 0)
  const teleMotif = matches.reduce((s, m) => s + (Number(m.teleInMotifOrder) || 0), 0)

  // Leave %
  const leaveCount = matches.filter(m => m.teleDidLeave === true).length

  const safePct = (num, den) => den === 0 ? 0 : Math.round((num / den) * 100)

  return {
    matchCount: matches.length,
    startingPositions,
    autoPctClassified: safePct(autoClassified, autoTotal),
    autoPctMissed: safePct(autoMissed, autoTotal),
    autoPctOverflowed: safePct(autoOverflowed, autoTotal),
    autoPctMotif: safePct(autoMotif, autoTotal),
    telePctClassified: safePct(teleClassified, teleTotal),
    telePctMissed: safePct(teleMissed, teleTotal),
    telePctOverflowed: safePct(teleOverflowed, teleTotal),
    telePctMotif: safePct(teleMotif, teleTotal),
    teleLeavePct: safePct(leaveCount, matches.length),
  }
}

function ScoutingData() {
  const { username } = useUser()
  const [records, setRecords] = useState([])
  const [expandedTeams, setExpandedTeams] = useState({})

  const canDelete = ALLOWED_DELETERS.includes((username || '').toLowerCase())

  // Load from Supabase
  useEffect(() => {
    supabase
      .from('scouting_records')
      .select('*')
      .order('submitted_at', { ascending: true })
      .then(({ data, error }) => {
        if (error) console.error('Failed to load scouting records:', error.message)
        if (data) setRecords(data)
      })
      .catch(err => console.error('Exception loading scouting records:', err))
  }, [])

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel('scouting-data-rt')
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
    return () => supabase.removeChannel(channel)
  }, [])

  const handleDelete = async (id) => {
    const { error } = await supabase.from('scouting_records').delete().eq('id', id)
    if (error) {
      console.error('Failed to delete:', error.message)
      return
    }
    setRecords(prev => prev.filter(r => r.id !== id))
  }

  // Build team list: default teams + any additional from scouting data
  const teams = useMemo(() => {
    // Group scouting records by team number
    const byNumber = {}
    records.forEach(r => {
      const d = r.data || {}
      const num = String(d.teamNumber || '').trim()
      if (!num) return
      if (!byNumber[num]) byNumber[num] = []
      byNumber[num].push({ ...d, _id: r.id, _by: r.submitted_by, _at: r.submitted_at })
    })

    const result = []

    // Default teams always show
    DEFAULT_TEAMS.forEach(dt => {
      const numStr = String(dt.number || '').trim()
      const matches = numStr ? (byNumber[numStr] || []) : []
      result.push({
        key: dt.name,
        name: dt.name,
        number: dt.number,
        matches,
        ...computeStats(matches),
      })
      if (numStr) delete byNumber[numStr]
    })

    // Additional teams from scouting data
    Object.entries(byNumber).forEach(([num, matches]) => {
      result.push({
        key: num,
        name: '',
        number: num,
        matches,
        ...computeStats(matches),
      })
    })

    return result
  }, [records])

  const toggleExpand = (key) => {
    setExpandedTeams(prev => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="px-4 py-4 ml-10">
          <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-pastel-blue-dark via-pastel-pink-dark to-pastel-orange-dark bg-clip-text text-transparent">
            Scouting Data
          </h1>
          <p className="text-sm text-gray-500">
            Team analytics from scouting submissions
          </p>
        </div>
      </header>

      <main className="flex-1 p-4 pl-14 md:pl-4 overflow-y-auto">
        <div className="max-w-3xl mx-auto space-y-6 pb-8">
          {teams.map(t => (
            <div
              key={t.key}
              className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm border border-gray-100 overflow-hidden"
            >
              {/* Team Header */}
              <div className="px-5 py-4 bg-gradient-to-r from-pastel-blue/30 to-pastel-pink/30 border-b border-gray-100">
                <h2 className="text-lg font-bold text-gray-800">
                  {t.name || 'Team'}{t.number ? ` #${t.number}` : ''}
                </h2>
                <p className="text-sm text-gray-500">
                  {t.matchCount} match{t.matchCount !== 1 ? 'es' : ''} scouted
                </p>
              </div>

              <div className="p-5 space-y-5">
                {/* Starting Position */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Starting Position</h3>
                  {Object.keys(t.startingPositions).length === 0 ? (
                    <p className="text-xs text-gray-400">No data</p>
                  ) : (
                    <div className="space-y-1">
                      {Object.entries(t.startingPositions).map(([pos, count]) => (
                        <div key={pos} className="flex items-center gap-2">
                          <span className="text-xs text-gray-600 w-28 truncate">{pos}</span>
                          <div className="flex-1 h-2 rounded-full bg-gray-200">
                            <div
                              className="h-2 rounded-full bg-pastel-blue transition-all"
                              style={{ width: `${Math.round((count / t.matchCount) * 100)}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium text-gray-700 w-10 text-right">
                            {Math.round((count / t.matchCount) * 100)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Autonomous */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Autonomous</h3>
                  <div className="space-y-2">
                    <div>
                      <span className="text-xs text-gray-600">Classified</span>
                      {pctBar(t.autoPctClassified)}
                    </div>
                    <div>
                      <span className="text-xs text-gray-600">Missed</span>
                      {pctBar(t.autoPctMissed)}
                    </div>
                    <div>
                      <span className="text-xs text-gray-600">Overflowed</span>
                      {pctBar(t.autoPctOverflowed)}
                    </div>
                    <div>
                      <span className="text-xs text-gray-600">In Motif Order</span>
                      {pctBar(t.autoPctMotif)}
                    </div>
                  </div>
                </div>

                {/* Tele-Op */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Tele-Op</h3>
                  <div className="space-y-2">
                    <div>
                      <span className="text-xs text-gray-600">Classified</span>
                      {pctBar(t.telePctClassified)}
                    </div>
                    <div>
                      <span className="text-xs text-gray-600">Missed</span>
                      {pctBar(t.telePctMissed)}
                    </div>
                    <div>
                      <span className="text-xs text-gray-600">Overflowed</span>
                      {pctBar(t.telePctOverflowed)}
                    </div>
                    <div>
                      <span className="text-xs text-gray-600">In Motif Order</span>
                      {pctBar(t.telePctMotif)}
                    </div>
                    <div>
                      <span className="text-xs text-gray-600">Leave Rate</span>
                      {pctBar(t.teleLeavePct)}
                    </div>
                  </div>
                </div>

                {/* Responses Toggle */}
                <button
                  onClick={() => toggleExpand(t.key)}
                  className="flex items-center gap-1.5 text-xs font-medium text-pastel-pink-dark hover:text-gray-700 transition-colors px-3 py-1.5 bg-gray-50 rounded-lg"
                >
                  {expandedTeams[t.key] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  {expandedTeams[t.key] ? 'Hide' : 'View'} Scouting Responses ({t.matchCount})
                </button>

                {expandedTeams[t.key] && (
                  <div className="space-y-2">
                    {t.matches.length === 0 ? (
                      <p className="text-xs text-gray-400 py-2">No responses yet.</p>
                    ) : (
                      t.matches.map((m, i) => (
                        <div key={m._id || i} className="bg-gray-50 rounded-lg p-3 text-xs space-y-1 border border-gray-100">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-gray-700">
                              Match {m.matchNumber || '?'} &middot; {m.allianceColor || '?'} Alliance
                            </span>
                            {canDelete && m._id && (
                              <button
                                onClick={() => handleDelete(m._id)}
                                className="text-gray-400 hover:text-red-500 transition-colors p-1"
                                title="Delete response"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                          <div className="text-gray-500">
                            Start: {m.startingPosition || '?'} | Stability: {
                              m.robotStability === 'no' ? 'No issues' :
                              m.robotStability === 'major' ? 'Major breakdown' :
                              m.robotStability === 'shutdown' ? 'Shutdown' : '?'
                            }
                          </div>
                          <div className="text-gray-500">
                            Auto: {m.autoClassified || 0} classified, {m.autoArtifactsMissed || 0} missed, {m.autoOverflowed || 0} overflow, {m.autoInMotifOrder || 0} motif
                          </div>
                          <div className="text-gray-500">
                            Tele: {m.teleClassified || 0} classified, {m.teleArtifactsMissed || 0} missed, {m.teleOverflowed || 0} overflow, {m.teleInMotifOrder || 0} motif
                          </div>
                          {(m.roles || []).length > 0 && (
                            <div className="text-gray-500">Roles: {m.roles.join(', ')}</div>
                          )}
                          {m.observations && (
                            <div className="text-gray-400 italic">"{m.observations}"</div>
                          )}
                          {m._by && (
                            <div className="text-gray-400 pt-0.5">Submitted by {m._by}</div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}

export default ScoutingData
