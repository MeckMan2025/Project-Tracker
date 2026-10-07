import { useState, useEffect, useMemo } from 'react'
import { restHeaders } from '../lib/restHeaders'
import { createPortal } from 'react-dom'
import { ChevronDown, ChevronUp, Trash2, Plus, X, Calendar, Download } from 'lucide-react'
import { SCOUTING_FIELDS } from '../data/scoutingFields'
import { ALL_TEAMS as TEAM_LIST } from '../data/teams'
import { supabase } from '../supabase'
import { useUser } from '../contexts/UserContext'
import { usePermissions } from '../hooks/usePermissions'
import { teamScope } from '../lib/teamScope'
import NotificationBell from './NotificationBell'
import ScoutingAccountability from './ScoutingAccountability'

// Default considered teams (used as fallback before Supabase loads)
const DEFAULT_CONSIDERED = []

// Per-team scouting stats, populated live from match_scouting.
const SCOUT_STATS = {}

// Machu Picchu League (Iowa) — loaded with blank data for the new season.
const BLANK = { rank: null, rp: 0, tbp: 0, autoAvg: 0, teleopAvg: 0, highScore: 0, record: '--', played: 0 }
// The team list lives in data/teams.js, shared with the scouting form so the
// dropdown and this table are always the same set. BLANK fills in the stats
// a team has before anyone has scouted it.
const ALL_TEAMS = TEAM_LIST.map(t => ({ ...t, ...BLANK }))

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

// What RadRank shows per team, computed from match_scouting — the same fields
// the scouting form records. It used to read a previous season's game
// (artifacts, motif order, parking), none of which anybody scouts any more, so
// every number here was always going to be zero.
//
// A blank is skipped rather than counted as zero: a scout who did not see
// something must not drag a team's average down.
function computeScoutingStats(matches) {
  const n = matches.length
  const nums = (key) => matches.map(m => m[key]).filter(v => v != null && v !== '').map(Number)
  const avg = (key) => {
    const v = nums(key)
    return v.length ? +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) : 0
  }
  const sum = (key) => nums(key).reduce((a, b) => a + b, 0)
  const pct = (num, den) => den === 0 ? 0 : Math.round((num / den) * 100)
  const tally = (key) => {
    const out = {}
    matches.forEach(m => { const v = m[key]; if (v) out[v] = (out[v] || 0) + 1 })
    return out
  }

  const autoHit = sum('auto_scored'), autoMiss = sum('auto_missed')
  const teleHit = sum('teleop_scored'), teleMiss = sum('teleop_missed')

  return {
    scoutCount: n,
    startingPositions: tally('start_position'),

    autoAvgScored: avg('auto_scored'),
    teleAvgScored: avg('teleop_scored'),
    avgScored: +(avg('auto_scored') + avg('teleop_scored')).toFixed(1),
    autoAccuracy: pct(autoHit, autoHit + autoMiss),
    teleAccuracy: pct(teleHit, teleHit + teleMiss),

    avgCycles: avg('cycle_count'),
    avgCycleSec: avg('avg_cycle_sec'),

    autoReliability: avg('auto_reliability'),   // out of 3
    robotSpeed: avg('robot_speed'),             // the rest out of 5
    driverSkill: avg('driver_skill'),
    consistency: avg('consistency'),
    defenseResistance: avg('defense_resistance'),

    defense: tally('defense'),
    endgame: tally('endgame'),
    breakdowns: tally('breakdowns'),
    avgPenalties: avg('penalties'),

    // Shares of matches, which a pick list cares about more than any average.
    endgameSuccessPct: pct(matches.filter(m => m.endgame === 'Successful').length, n),
    cleanMatchPct: pct(matches.filter(m => !m.breakdowns || m.breakdowns === 'None').length, n),
  }
}

// What we know about a team, in the order a pick list asks: can they score,
// can they cycle, how do they handle pressure, and do they break.
//
// Every figure here comes from the scouting form's own fields. The two panels
// this replaces each rendered a previous season's game from their own copy of
// the markup, which is how they came to disagree with the form in the first
// place — one component now, so there is nowhere for them to drift apart.
function ScoutPanel({ t }) {
  const rate = (v, outOf) => v ? `${v}/${outOf}` : '—'
  const most = (tally) => {
    const e = Object.entries(tally || {})
    if (!e.length) return '—'
    return e.sort((a, b) => b[1] - a[1])[0][0]
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-2 border-b border-gray-100 pb-1">
        Our Scouting Data{' '}
        <span className="font-normal text-gray-400">
          ({t.scoutCount} match{t.scoutCount !== 1 ? 'es' : ''})
        </span>
      </h3>

      {t.scoutCount === 0 ? (
        <p className="text-xs text-gray-400 py-2">Nobody has scouted this team yet.</p>
      ) : (
        <>
          {/* Scoring — the first question anyone asks. */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            <Stat value={t.avgScored} label="Scored / match" />
            <Stat value={`${t.teleAccuracy}%`} label="Teleop accuracy" />
            <Stat value={t.avgCycles} label="Cycles / match" />
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-1 mb-3">
            <Line label="Auto scored" value={t.autoAvgScored} />
            <Line label="Auto accuracy" value={`${t.autoAccuracy}%`} />
            <Line label="Teleop scored" value={t.teleAvgScored} />
            <Line label="Seconds / cycle" value={t.avgCycleSec || '—'} />
          </div>

          {/* The ratings, as bars — out of 5 except auto reliability, which the
              form asks out of 3. */}
          <div className="space-y-1 mb-3">
            <Rated label="Driver skill" value={t.driverSkill} outOf={5} />
            <Rated label="Consistency" value={t.consistency} outOf={5} />
            <Rated label="Robot speed" value={t.robotSpeed} outOf={5} />
            <Rated label="Auto reliability" value={t.autoReliability} outOf={3} />
            <Rated label="Holds up to defense" value={t.defenseResistance} outOf={5} />
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <Line label="Endgame success" value={`${t.endgameSuccessPct}%`} />
            <Line label="Matches without breakdown" value={`${t.cleanMatchPct}%`} />
            <Line label="Plays defense" value={most(t.defense)} />
            <Line label="Penalties / match" value={t.avgPenalties || '—'} />
            <Line label="Usual start" value={most(t.startingPositions)} />
            <Line label="Usual endgame" value={most(t.endgame)} />
            <Line label="Worst breakdown" value={
              t.breakdowns?.Major ? `Major ×${t.breakdowns.Major}`
              : t.breakdowns?.Minor ? `Minor ×${t.breakdowns.Minor}`
              : t.scoutCount ? 'None' : '—'} />
          </div>
        </>
      )}
    </div>
  )
}

const Stat = ({ value, label }) => (
  <div className="bg-gray-50 rounded-lg p-2 text-center">
    <p className="text-base font-bold text-gray-800">{value}</p>
    <p className="text-[10px] text-gray-500 uppercase">{label}</p>
  </div>
)

const Line = ({ label, value }) => (
  <div className="flex items-baseline justify-between gap-2">
    <span className="text-xs text-gray-500">{label}</span>
    <span className="text-xs font-semibold text-gray-700">{value}</span>
  </div>
)

// A rating means nothing without its scale, so the bar carries it: 4 out of 5
// and 4 out of 3 are not the same claim.
const Rated = ({ label, value, outOf }) => (
  <div className="flex items-center gap-2">
    <span className="text-xs text-gray-500 w-36 shrink-0">{label}</span>
    <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
      <div className="h-full rounded-full bg-pastel-yellow-dark"
           style={{ width: `${Math.min(100, (value / outOf) * 100)}%` }} />
    </div>
    <span className="text-xs font-semibold text-gray-700 w-9 text-right">
      {value ? `${value}/${outOf}` : '—'}
    </span>
  </div>
)

function ScoutingData() {
  const { username } = useUser()
  const { canDeleteScouting: canDelete, canViewScoutingData, isGuest, hasLeadTag, isCofounder, myTeamNumber } = usePermissions()
  // One rule for whose rows these are — see lib/teamScope.js.
  const SCOPE = teamScope(myTeamNumber)
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
      if (r.created_at) {
        const date = r.created_at.split('T')[0] // YYYY-MM-DD
        dateSet.add(date)
      }
    })
    return [...dateSet].sort((a, b) => b.localeCompare(a)) // newest first
  }, [records])

  // Filter records by selected date
  const filteredRecords = useMemo(() => {
    if (!selectedDate) return records
    return records.filter(r => r.created_at && r.created_at.startsWith(selectedDate))
  }, [records, selectedDate])

  // Load from Supabase
  useEffect(() => {
    supabase
      .from('match_scouting')
      .select('*')
      .order('created_at', { ascending: true })
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
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'match_scouting' }, (payload) => {
        setRecords(prev => {
          if (prev.some(r => r.id === payload.new.id)) return prev
          return [...prev, payload.new]
        })
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'match_scouting' }, (payload) => {
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
    const { error } = await supabase.from('match_scouting').delete().eq('id', id)
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
      // match_scouting keeps one flat row per team per match. The old table
      // nested everything in a `data` blob, which is why this used to reach
      // through r.data.
      const num = String(r.team_number || '').trim()
      if (!num) return
      if (!byNumber[num]) byNumber[num] = []
      byNumber[num].push({ ...r, _id: r.id, _by: r.scout, _at: r.created_at })
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
    fetch(`${supabaseUrl}/rest/v1/match_scouting?${SCOPE}&select=*&order=created_at.asc`, {
      headers: restHeaders(),
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
      ? exportRecordsCache.filter(r => r.created_at && r.created_at.startsWith(selectedDate))
      : exportRecordsCache
    if (exportRecords.length === 0) {
      alert('No scouting records found. Try refreshing the page.')
      return
    }
    // Built from the field definitions, so the export can never drift from
    // what the form records — which is exactly what had happened: this still
    // exported a previous season's columns.
    const headers = ['Team Number', ...SCOUTING_FIELDS.filter(f => f.key !== 'team_number').map(f => f.label), 'Scout', 'Recorded At']
    const escape = (v) => {
      const s = String(v ?? '')
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
    }
    const rows = exportRecords.map(r => [
      r.team_number,
      ...SCOUTING_FIELDS.filter(f => f.key !== 'team_number').map(f => r[f.key] ?? ''),
      r.scout || '', r.created_at || '',
    ])
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
        <div className="px-4 py-4 ml-14 flex items-center justify-between">
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

                <ScoutPanel t={t} />

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

                <ScoutPanel t={t} />

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
