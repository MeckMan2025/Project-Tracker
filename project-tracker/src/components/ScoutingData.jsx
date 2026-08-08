import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, ChevronUp, Trash2, Plus, X, Calendar, Download } from 'lucide-react'
import { supabase } from '../supabase'
import { useUser } from '../contexts/UserContext'
import { usePermissions } from '../hooks/usePermissions'
import NotificationBell from './NotificationBell'
import ScoutingAccountability from './ScoutingAccountability'

// Default considered teams (used as fallback before Supabase loads)
const DEFAULT_CONSIDERED = []

// Per-team scouting stats (cleared for new season; populated live from scouting_records)
const SCOUT_STATS = {}

// Competition teams (cleared for new season)
const ALL_TEAMS = []

// Delete permission now handled by usePermissions hook (canDeleteScouting)

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

function computeScoutingStats(matches) {
  const n = matches.length
  const safePct = (num, den) => den === 0 ? 0 : Math.round((num / den) * 100)
  const avg = (total) => n === 0 ? 0 : +(total / n).toFixed(1)

  if (n === 0) {
    return {
      scoutCount: 0,
      startingPositions: {},
      autoPctClassified: 0, autoPctMissed: 0, autoPctOverflowed: 0, autoPctMotif: 0,
      telePctClassified: 0, telePctMissed: 0, telePctOverflowed: 0, telePctMotif: 0,
      teleLeavePct: 0,
      autoAvgClassified: 0, autoAvgMissed: 0, autoAvgOverflowed: 0, autoAvgMotif: 0,
      teleAvgClassified: 0, teleAvgMissed: 0, teleAvgOverflowed: 0, teleAvgMotif: 0, teleAvgDepot: 0,
      fullParkPct: 0, partialParkPct: 0, noParkPct: 0,
      avgAllianceScore: 0,
    }
  }

  const startingPositions = {}
  matches.forEach(m => {
    const pos = m.startingPosition || 'Unknown'
    startingPositions[pos] = (startingPositions[pos] || 0) + 1
  })

  const autoClassified = matches.reduce((s, m) => s + (Number(m.autoClassified) || 0), 0)
  const autoMissed = matches.reduce((s, m) => s + (Number(m.autoArtifactsMissed) || 0), 0)
  const autoOverflowed = matches.reduce((s, m) => s + (Number(m.autoOverflowed) || 0), 0)
  const autoMotif = matches.reduce((s, m) => s + (Number(m.autoInMotifOrder) || 0), 0)
  const autoTotal = autoClassified + autoMissed + autoOverflowed + autoMotif

  const teleClassified = matches.reduce((s, m) => s + (Number(m.teleClassified) || 0), 0)
  const teleMissed = matches.reduce((s, m) => s + (Number(m.teleArtifactsMissed) || 0), 0)
  const teleOverflowed = matches.reduce((s, m) => s + (Number(m.teleOverflowed) || 0), 0)
  const teleMotif = matches.reduce((s, m) => s + (Number(m.teleInMotifOrder) || 0), 0)
  const teleDepot = matches.reduce((s, m) => s + (Number(m.teleArtifactsInDepot) || 0), 0)
  const teleTotal = teleClassified + teleMissed + teleOverflowed + teleMotif

  const leaveCount = matches.filter(m => m.teleDidLeave === true).length
  const fullPark = matches.filter(m => m.parkingStatus === 'full').length
  const partialPark = matches.filter(m => m.parkingStatus === 'partial').length
  const noPark = matches.filter(m => m.parkingStatus === 'none' || m.parkingStatus === '').length

  const totalScore = matches.reduce((s, m) => s + (Number(m.allianceScore) || 0), 0)

  return {
    scoutCount: n,
    startingPositions,
    autoPctClassified: safePct(autoClassified, autoTotal),
    autoPctMissed: safePct(autoMissed, autoTotal),
    autoPctOverflowed: safePct(autoOverflowed, autoTotal),
    autoPctMotif: safePct(autoMotif, autoTotal),
    telePctClassified: safePct(teleClassified, teleTotal),
    telePctMissed: safePct(teleMissed, teleTotal),
    telePctOverflowed: safePct(teleOverflowed, teleTotal),
    telePctMotif: safePct(teleMotif, teleTotal),
    teleLeavePct: safePct(leaveCount, n),
    autoAvgClassified: avg(autoClassified),
    autoAvgMissed: avg(autoMissed),
    autoAvgOverflowed: avg(autoOverflowed),
    autoAvgMotif: avg(autoMotif),
    teleAvgClassified: avg(teleClassified),
    teleAvgMissed: avg(teleMissed),
    teleAvgOverflowed: avg(teleOverflowed),
    teleAvgMotif: avg(teleMotif),
    teleAvgDepot: avg(teleDepot),
    fullParkPct: safePct(fullPark, n),
    partialParkPct: safePct(partialPark, n),
    noParkPct: safePct(noPark, n),
    avgAllianceScore: avg(totalScore),
  }
}

function ScoutingData() {
  const { username } = useUser()
  const { canDeleteScouting: canDelete, canViewScoutingData, isGuest, hasLeadTag, isCofounder } = usePermissions()
  const [records, setRecords] = useState([])
  const [expandedTeams, setExpandedTeams] = useState({})
  const [consideredList, setConsideredList] = useState([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [addForm, setAddForm] = useState({ name: '', number: '', rank: '' })
  const [deleteMode, setDeleteMode] = useState(false)
  const [selectedDate, setSelectedDate] = useState('') // '' = all dates

  // Get unique submission dates from records
  const availableDates = useMemo(() => {
    const dateSet = new Set()
    records.forEach(r => {
      if (r.submitted_at) {
        const date = r.submitted_at.split('T')[0] // YYYY-MM-DD
        dateSet.add(date)
      }
    })
    return [...dateSet].sort((a, b) => b.localeCompare(a)) // newest first
  }, [records])

  // Filter records by selected date
  const filteredRecords = useMemo(() => {
    if (!selectedDate) return records
    return records.filter(r => r.submitted_at && r.submitted_at.startsWith(selectedDate))
  }, [records, selectedDate])

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

  // Load considered teams from Supabase
  useEffect(() => {
    supabase
      .from('considered_teams')
      .select('*')
      .then(({ data, error }) => {
        if (error) console.error('Failed to load considered teams:', error.message)
        if (data) setConsideredList(data)
      })
  }, [])

  // Realtime for considered teams
  useEffect(() => {
    const channel = supabase
      .channel('considered-teams-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'considered_teams' }, () => {
        supabase.from('considered_teams').select('*').then(({ data }) => {
          if (data) setConsideredList(data)
        })
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  const handleAddConsidered = async () => {
    try {
      const number = addForm.number.trim()
      const name = addForm.name.trim()
      const rank = addForm.rank ? parseInt(addForm.rank) : null
      if (!number || !name) return

      // If a rank is specified, shift existing teams at that rank and below
      if (rank) {
        const toShift = consideredList.filter(c => c.rank && c.rank >= rank)
        for (const c of toShift) {
          await supabase.from('considered_teams').update({ rank: c.rank + 1 }).eq('team_number', c.team_number)
        }
      }

      const { data: insertData, error } = await supabase.from('considered_teams').insert({
        team_number: number,
        team_name: name,
        rank: rank,
        added_by: username
      }).select()
      if (error) {
        alert('Failed to add team: ' + error.message)
        return
      }
      // Refetch to get updated ranks
      const { data } = await supabase.from('considered_teams').select('*')
      if (data) setConsideredList(data)
      setAddForm({ name: '', number: '', rank: '' })
      setShowAddModal(false)
    } catch (err) {
      alert('Error: ' + err.message)
    }
  }

  const handleRemoveConsidered = async (teamNumber) => {
    const { error } = await supabase.from('considered_teams').delete().eq('team_number', teamNumber)
    if (error) console.error('Failed to remove considered team:', error.message)
    else setConsideredList(prev => prev.filter(c => c.team_number !== teamNumber))
  }

  const handleDelete = async (id) => {
    const { error } = await supabase.from('scouting_records').delete().eq('id', id)
    if (error) {
      console.error('Failed to delete:', error.message)
      return
    }
    setRecords(prev => prev.filter(r => r.id !== id))
  }

  const consideredNumbers = consideredList.map(c => c.team_number)

  // Merge competition data with scouting submissions, split into considered vs rest
  const { consideredTeams, otherTeams } = useMemo(() => {
    // Group scouting records by team number (using filtered records)
    const byNumber = {}
    filteredRecords.forEach(r => {
      const d = r.data || {}
      const num = String(d.teamNumber || '').trim()
      if (!num) return
      if (!byNumber[num]) byNumber[num] = []
      byNumber[num].push({ ...d, _id: r.id, _by: r.submitted_by, _at: r.submitted_at })
    })

    // Build team list from ALL_TEAMS, attach scouting data
    // Use hardcoded SCOUT_STATS as base, override with dynamic data if available
    const knownNumbers = new Set(ALL_TEAMS.map(t => t.number))
    const all = ALL_TEAMS.map(t => {
      const matches = byNumber[t.number] || []
      delete byNumber[t.number]
      const dynamicStats = computeScoutingStats(matches)
      const hardcodedStats = SCOUT_STATS[t.number]
      // When filtering by date, only use dynamic stats (hardcoded stats are all-time and can't be date-filtered)
      const stats = dynamicStats.scoutCount > 0 ? dynamicStats : (!selectedDate && hardcodedStats ? { ...hardcodedStats, scoutCount: hardcodedStats.scouted, startingPositions: {} } : dynamicStats)
      return { ...t, matches, ...stats }
    })

    // Add custom teams (not in ALL_TEAMS) from considered list
    consideredList.forEach(c => {
      if (!knownNumbers.has(c.team_number)) {
        const matches = byNumber[c.team_number] || []
        delete byNumber[c.team_number]
        const stats = computeScoutingStats(matches)
        all.push({
          number: c.team_number,
          name: c.team_name || `Team ${c.team_number}`,
          rank: c.rank || null,
          record: '-',
          played: 0,
          rp: '-',
          tbp: '-',
          autoAvg: '-',
          teleopAvg: '-',
          highScore: '-',
          matches,
          ...stats,
        })
      }
    })

    // Apply rank overrides from considered_teams
    const rankOverrides = {}
    consideredList.forEach(c => { if (c.rank) rankOverrides[c.team_number] = c.rank })

    const considered = all
      .filter(t => consideredNumbers.includes(t.number))
      .map(t => rankOverrides[t.number] ? { ...t, rank: rankOverrides[t.number] } : t)
      .sort((a, b) => (a.rank || 999) - (b.rank || 999))
    const others = all.filter(t => !consideredNumbers.includes(t.number))
      .sort((a, b) => (a.rank || 999) - (b.rank || 999))

    return { consideredTeams: considered, otherTeams: others }
  }, [filteredRecords, consideredList, consideredNumbers, selectedDate])

  const toggleExpand = (key) => {
    setExpandedTeams(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const [exportReady, setExportReady] = useState(false)
  const [exportRecordsCache, setExportRecordsCache] = useState([])

  // Pre-fetch scouting records using anon key directly (bypasses auth RLS)
  useEffect(() => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
    fetch(`${supabaseUrl}/rest/v1/scouting_records?select=*&order=submitted_at.asc`, {
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` },
    })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setExportRecordsCache(data)
          setExportReady(true)
        }
      })
      .catch(() => {})
  }, [])

  const exportToSheets = () => {
    const exportRecords = selectedDate
      ? exportRecordsCache.filter(r => r.submitted_at && r.submitted_at.startsWith(selectedDate))
      : exportRecordsCache
    if (exportRecords.length === 0) {
      alert('No scouting records found. Try refreshing the page.')
      return
    }
    const headers = [
      'Team Number', 'Alliance Color', 'Match Number', 'Starting Position',
      'Auto Classified', 'Auto Missed', 'Auto Overflowed', 'Auto Motif Order',
      'Tele Classified', 'Tele Missed', 'Tele Overflowed', 'Tele Motif Order', 'Tele Depot',
      'Did Leave', 'Parking Status', 'Double Park',
      'Alliance Score', 'Leave Points', 'Artifact Points', 'Pattern Points', 'Base Points', 'Foul Points',
      'Pattern RP', 'Goal RP', 'Movement RP',
      'Robot Stability', 'Roles', 'Observations',
      'Submitted By', 'Submitted At',
    ]
    const escape = (v) => {
      const s = String(v ?? '')
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
    }
    const rows = exportRecords.map(r => {
      const d = r.data || {}
      return [
        d.teamNumber, d.allianceColor, d.matchNumber, d.startingPosition,
        d.autoClassified ?? 0, d.autoArtifactsMissed ?? 0, d.autoOverflowed ?? 0, d.autoInMotifOrder ?? 0,
        d.teleClassified ?? 0, d.teleArtifactsMissed ?? 0, d.teleOverflowed ?? 0, d.teleInMotifOrder ?? 0, d.teleArtifactsInDepot ?? 0,
        d.teleDidLeave === true ? 'Yes' : d.teleDidLeave === false ? 'No' : '',
        d.parkingStatus, d.doublePark === true ? 'Yes' : d.doublePark === false ? 'No' : '',
        d.allianceScore, d.leavePoints, d.artifactPoints, d.patternPoints, d.basePoints, d.foulPoints,
        d.patternRP ? 'Yes' : 'No', d.goalRP ? 'Yes' : 'No', d.movementRP ? 'Yes' : 'No',
        d.robotStability === 'no' ? 'No issues' : d.robotStability === 'major' ? 'Major breakdown' : d.robotStability === 'shutdown' ? 'Shutdown' : '',
        (d.roles || []).join('; '),
        d.observations || '',
        r.submitted_by || '', r.submitted_at || '',
      ].map(escape).join(',')
    })
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `scouting-forms${selectedDate ? `-${selectedDate}` : ''}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const addTeamModal = showAddModal ? createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={() => { setShowAddModal(false); setAddForm({ name: '', number: '', rank: '' }) }}>
      <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 25px 50px rgba(0,0,0,0.25)', width: '100%', maxWidth: '384px', margin: '0 16px', padding: '24px' }} onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-gray-800 mb-4">Add Team to Considered</h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-600">Team Name</label>
            <input
              type="text"
              value={addForm.name}
              onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
              className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pastel-pink"
              placeholder="e.g. Pioneer Robotics"
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Team Number</label>
            <input
              type="text"
              value={addForm.number}
              onChange={e => setAddForm(f => ({ ...f, number: e.target.value }))}
              className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pastel-pink"
              placeholder="e.g. 25656"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Rank <span className="text-gray-400">(optional)</span></label>
            <input
              type="number"
              min="1"
              value={addForm.rank}
              onChange={e => setAddForm(f => ({ ...f, rank: e.target.value }))}
              className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pastel-pink"
              placeholder="e.g. 5"
            />
            <p className="text-[10px] text-gray-400 mt-1">If this rank is taken, existing teams will shift down</p>
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button
            onClick={() => { setShowAddModal(false); setAddForm({ name: '', number: '', rank: '' }) }}
            className="flex-1 px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleAddConsidered}
            disabled={!addForm.name.trim() || !addForm.number.trim()}
            className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-pastel-pink-dark hover:bg-pastel-pink rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Add Team
          </button>
        </div>
      </div>
    </div>,
    document.body
  ) : null

  return (
    <>
    {addTeamModal}
    <div className="flex-1 flex flex-col min-w-0">
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="px-4 py-4 ml-10 flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-pastel-blue-dark via-pastel-pink-dark to-pastel-orange-dark bg-clip-text text-transparent">
              Scouting Data
            </h1>
            <p className="text-sm text-gray-500">
              {ALL_TEAMS.length} teams &middot; {filteredRecords.length} scouting response{filteredRecords.length !== 1 ? 's' : ''}
              {selectedDate && ` on ${new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="flex items-center gap-1.5">
                <Calendar size={14} className="text-gray-400" />
                <select
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 pr-6 text-gray-700 focus:outline-none focus:ring-2 focus:ring-pastel-pink appearance-none cursor-pointer"
                >
                  <option value="">All Dates</option>
                  {availableDates.map(d => (
                    <option key={d} value={d}>
                      {new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </option>
                  ))}
                </select>
              </div>
              {selectedDate && (
                <button
                  onClick={() => setSelectedDate('')}
                  className="absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center rounded-full bg-pastel-pink text-white text-[10px]"
                  title="Clear date filter"
                >
                  <X size={10} />
                </button>
              )}
            </div>
            <button
              onClick={exportToSheets}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-pastel-pink-dark hover:bg-pastel-pink rounded-lg transition-colors shadow-sm"
              title="Download scouting form data as CSV"
            >
              <Download size={14} />
              Export
            </button>
            <NotificationBell />
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 pl-14 md:pl-4 overflow-y-auto">
        <div className="max-w-3xl mx-auto space-y-5 pb-8">

          {/* Scouting Accountability Grid */}
          <ScoutingAccountability />

          {/* Teams Being Considered */}
          <div className="border-b-2 border-pastel-pink pb-2 mb-1">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-800">Teams Being Considered</h2>
                <p className="text-xs text-gray-500">Alliance partner candidates</p>
              </div>
              <div className="flex items-center gap-2">
                {hasLeadTag && (
                  <button
                    onClick={() => setDeleteMode(!deleteMode)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${deleteMode ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                  >
                    {deleteMode ? 'Done' : 'Delete Mode'}
                  </button>
                )}
                {hasLeadTag && (
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-pastel-pink/40 hover:bg-pastel-pink transition-colors text-gray-700"
                    title="Add team to considered"
                  >
                    <Plus size={18} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {consideredTeams.map(t => (
            <div
              key={t.number}
              className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm border border-gray-100 overflow-hidden"
            >
              {/* Team Header */}
              <div className="px-5 py-4 bg-gradient-to-r from-pastel-blue/30 to-pastel-pink/30 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div>
                      <h2 className="text-lg font-bold text-gray-800">
                        {t.name} <span className="text-gray-500 font-medium">#{t.number}</span>
                      </h2>
                      {t.rank && (
                        <span className="text-sm text-gray-500">Rank {t.rank}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {deleteMode && hasLeadTag && (
                      <button
                        onClick={() => handleRemoveConsidered(t.number)}
                        className="w-7 h-7 flex items-center justify-center rounded-full bg-red-100 hover:bg-red-200 text-red-500 hover:text-red-700 transition-colors"
                        title="Remove team"
                      >
                        <X size={16} />
                      </button>
                    )}
                    <div className="text-right">
                      <span className="text-sm font-semibold text-gray-700">{t.record}</span>
                      <p className="text-xs text-gray-400">{t.played} matches</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-5 space-y-5">
                {/* Competition Stats */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2 border-b border-gray-100 pb-1">Competition Stats</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                      <p className="text-lg font-bold text-gray-800">{t.rp}</p>
                      <p className="text-[10px] text-gray-500 uppercase tracking-wide">RP/Match</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                      <p className="text-lg font-bold text-gray-800">{t.tbp}</p>
                      <p className="text-[10px] text-gray-500 uppercase tracking-wide">TBP/Match</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                      <p className="text-lg font-bold text-gray-800">{t.autoAvg}</p>
                      <p className="text-[10px] text-gray-500 uppercase tracking-wide">Auto Avg</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                      <p className="text-lg font-bold text-gray-800">{t.teleopAvg}</p>
                      <p className="text-[10px] text-gray-500 uppercase tracking-wide">Teleop Avg</p>
                    </div>
                  </div>
                  <div className="mt-2 text-center">
                    <span className="text-xs text-gray-500">High Score: <span className="font-semibold text-gray-700">{t.highScore}</span></span>
                  </div>
                </div>

                {/* Scouting Data Section */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2 border-b border-gray-100 pb-1">
                    Our Scouting Data <span className="font-normal text-gray-400">({t.scoutCount} response{t.scoutCount !== 1 ? 's' : ''})</span>
                  </h3>

                  {t.scoutCount > 0 && (
                    <>
                      {/* Key Stats Grid */}
                      <div className="grid grid-cols-3 gap-2 mb-3">
                        <div className="bg-gray-50 rounded-lg p-2 text-center">
                          <p className="text-base font-bold text-gray-800">{t.avgAllianceScore}</p>
                          <p className="text-[10px] text-gray-500 uppercase">Avg Score</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-2 text-center">
                          <p className="text-base font-bold text-gray-800">{t.teleLeavePct}%</p>
                          <p className="text-[10px] text-gray-500 uppercase">Leave Rate</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-2 text-center">
                          <p className="text-base font-bold text-gray-800">{t.fullParkPct}%</p>
                          <p className="text-[10px] text-gray-500 uppercase">Full Park</p>
                        </div>
                      </div>

                      {/* Park Breakdown */}
                      <div className="mb-3">
                        <h4 className="text-xs font-medium text-gray-600 mb-1">Park Rate</h4>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-600 w-16">Full</span>
                            {pctBar(t.fullParkPct)}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-600 w-16">Partial</span>
                            {pctBar(t.partialParkPct)}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-600 w-16">No Park</span>
                            {pctBar(t.noParkPct)}
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Starting Position */}
                  <div className="mb-3">
                    <h4 className="text-xs font-medium text-gray-600 mb-1">Starting Position</h4>
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
                                style={{ width: `${Math.round((count / t.scoutCount) * 100)}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium text-gray-700 w-10 text-right">
                              {Math.round((count / t.scoutCount) * 100)}%
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Autonomous */}
                  <div className="mb-3">
                    <h4 className="text-xs font-medium text-gray-600 mb-1">Autonomous (avg per match)</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
                      <div className="bg-gray-50 rounded-lg p-2 text-center">
                        <p className="text-sm font-bold text-gray-800">{t.autoAvgClassified}</p>
                        <p className="text-[10px] text-gray-500">Classified</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2 text-center">
                        <p className="text-sm font-bold text-gray-800">{t.autoAvgMissed}</p>
                        <p className="text-[10px] text-gray-500">Missed</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2 text-center">
                        <p className="text-sm font-bold text-gray-800">{t.autoAvgOverflowed}</p>
                        <p className="text-[10px] text-gray-500">Overflowed</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2 text-center">
                        <p className="text-sm font-bold text-gray-800">{t.autoAvgMotif}</p>
                        <p className="text-[10px] text-gray-500">Motif Order</p>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <div><span className="text-xs text-gray-500">Classified %</span>{pctBar(t.autoPctClassified)}</div>
                      <div><span className="text-xs text-gray-500">Missed %</span>{pctBar(t.autoPctMissed)}</div>
                      <div><span className="text-xs text-gray-500">Overflowed %</span>{pctBar(t.autoPctOverflowed)}</div>
                      <div><span className="text-xs text-gray-500">Motif Order %</span>{pctBar(t.autoPctMotif)}</div>
                    </div>
                  </div>

                  {/* Tele-Op */}
                  <div>
                    <h4 className="text-xs font-medium text-gray-600 mb-1">Tele-Op (avg per match)</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-2">
                      <div className="bg-gray-50 rounded-lg p-2 text-center">
                        <p className="text-sm font-bold text-gray-800">{t.teleAvgClassified}</p>
                        <p className="text-[10px] text-gray-500">Classified</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2 text-center">
                        <p className="text-sm font-bold text-gray-800">{t.teleAvgMissed}</p>
                        <p className="text-[10px] text-gray-500">Missed</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2 text-center">
                        <p className="text-sm font-bold text-gray-800">{t.teleAvgOverflowed}</p>
                        <p className="text-[10px] text-gray-500">Overflowed</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2 text-center">
                        <p className="text-sm font-bold text-gray-800">{t.teleAvgMotif}</p>
                        <p className="text-[10px] text-gray-500">Motif Order</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2 text-center">
                        <p className="text-sm font-bold text-gray-800">{t.teleAvgDepot}</p>
                        <p className="text-[10px] text-gray-500">Depot</p>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <div><span className="text-xs text-gray-500">Classified %</span>{pctBar(t.telePctClassified)}</div>
                      <div><span className="text-xs text-gray-500">Missed %</span>{pctBar(t.telePctMissed)}</div>
                      <div><span className="text-xs text-gray-500">Overflowed %</span>{pctBar(t.telePctOverflowed)}</div>
                      <div><span className="text-xs text-gray-500">Motif Order %</span>{pctBar(t.telePctMotif)}</div>
                      <div><span className="text-xs text-gray-500">Leave Rate</span>{pctBar(t.teleLeavePct)}</div>
                    </div>
                  </div>
                </div>

                {/* Responses Toggle */}
                <button
                  onClick={() => toggleExpand(t.number)}
                  className="flex items-center gap-1.5 text-xs font-medium text-pastel-pink-dark hover:text-gray-700 transition-colors px-3 py-1.5 bg-gray-50 rounded-lg"
                >
                  {expandedTeams[t.number] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  {expandedTeams[t.number] ? 'Hide' : 'View'} Scouting Responses ({t.scoutCount})
                </button>

                {expandedTeams[t.number] && (
                  <div className="space-y-2">
                    {t.matches.length === 0 ? (
                      <p className="text-xs text-gray-400 py-2">No scouting responses yet.</p>
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

          {/* All Teams by Rank */}
          <div className="border-b-2 border-pastel-blue pb-2 mb-1 mt-8">
            <h2 className="text-lg font-bold text-gray-800">All Teams by Rank</h2>
            <p className="text-xs text-gray-500">Ordered by competition ranking</p>
          </div>

          {otherTeams.map(t => (
            <div
              key={t.number}
              className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm border border-gray-100 overflow-hidden"
            >
              {/* Team Header */}
              <div className="px-5 py-4 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-gray-800">
                      {t.name} <span className="text-gray-500 font-medium">#{t.number}</span>
                    </h2>
                    {t.rank && (
                      <span className="text-sm text-gray-500">Rank {t.rank}</span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-semibold text-gray-700">{t.record}</span>
                    <p className="text-xs text-gray-400">{t.played} matches</p>
                  </div>
                </div>
              </div>

              <div className="p-5 space-y-5">
                {/* Competition Stats */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2 border-b border-gray-100 pb-1">Competition Stats</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                      <p className="text-lg font-bold text-gray-800">{t.rp}</p>
                      <p className="text-[10px] text-gray-500 uppercase tracking-wide">RP/Match</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                      <p className="text-lg font-bold text-gray-800">{t.tbp}</p>
                      <p className="text-[10px] text-gray-500 uppercase tracking-wide">TBP/Match</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                      <p className="text-lg font-bold text-gray-800">{t.autoAvg}</p>
                      <p className="text-[10px] text-gray-500 uppercase tracking-wide">Auto Avg</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                      <p className="text-lg font-bold text-gray-800">{t.teleopAvg}</p>
                      <p className="text-[10px] text-gray-500 uppercase tracking-wide">Teleop Avg</p>
                    </div>
                  </div>
                  <div className="mt-2 text-center">
                    <span className="text-xs text-gray-500">High Score: <span className="font-semibold text-gray-700">{t.highScore}</span></span>
                  </div>
                </div>

                {/* Scouting Data Section */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2 border-b border-gray-100 pb-1">
                    Our Scouting Data <span className="font-normal text-gray-400">({t.scoutCount} response{t.scoutCount !== 1 ? 's' : ''})</span>
                  </h3>

                  <div className="mb-3">
                    <h4 className="text-xs font-medium text-gray-600 mb-1">Starting Position</h4>
                    {Object.keys(t.startingPositions).length === 0 ? (
                      <p className="text-xs text-gray-400">No data</p>
                    ) : (
                      <div className="space-y-1">
                        {Object.entries(t.startingPositions).map(([pos, count]) => (
                          <div key={pos} className="flex items-center gap-2">
                            <span className="text-xs text-gray-600 w-28 truncate">{pos}</span>
                            <div className="flex-1 h-2 rounded-full bg-gray-200">
                              <div className="h-2 rounded-full bg-pastel-blue transition-all" style={{ width: `${Math.round((count / t.scoutCount) * 100)}%` }} />
                            </div>
                            <span className="text-xs font-medium text-gray-700 w-10 text-right">{Math.round((count / t.scoutCount) * 100)}%</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mb-3">
                    <h4 className="text-xs font-medium text-gray-600 mb-1">Autonomous</h4>
                    <div className="space-y-1.5">
                      <div><span className="text-xs text-gray-500">Classified</span>{pctBar(t.autoPctClassified)}</div>
                      <div><span className="text-xs text-gray-500">Missed</span>{pctBar(t.autoPctMissed)}</div>
                      <div><span className="text-xs text-gray-500">Overflowed</span>{pctBar(t.autoPctOverflowed)}</div>
                      <div><span className="text-xs text-gray-500">In Motif Order</span>{pctBar(t.autoPctMotif)}</div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-medium text-gray-600 mb-1">Tele-Op</h4>
                    <div className="space-y-1.5">
                      <div><span className="text-xs text-gray-500">Classified</span>{pctBar(t.telePctClassified)}</div>
                      <div><span className="text-xs text-gray-500">Missed</span>{pctBar(t.telePctMissed)}</div>
                      <div><span className="text-xs text-gray-500">Overflowed</span>{pctBar(t.telePctOverflowed)}</div>
                      <div><span className="text-xs text-gray-500">In Motif Order</span>{pctBar(t.telePctMotif)}</div>
                      <div><span className="text-xs text-gray-500">Leave Rate</span>{pctBar(t.teleLeavePct)}</div>
                    </div>
                  </div>
                </div>

                {/* Responses Toggle */}
                <button
                  onClick={() => toggleExpand(t.number)}
                  className="flex items-center gap-1.5 text-xs font-medium text-pastel-pink-dark hover:text-gray-700 transition-colors px-3 py-1.5 bg-gray-50 rounded-lg"
                >
                  {expandedTeams[t.number] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  {expandedTeams[t.number] ? 'Hide' : 'View'} Scouting Responses ({t.scoutCount})
                </button>

                {expandedTeams[t.number] && (
                  <div className="space-y-2">
                    {t.matches.length === 0 ? (
                      <p className="text-xs text-gray-400 py-2">No scouting responses yet.</p>
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
    </>
  )
}

export default ScoutingData
