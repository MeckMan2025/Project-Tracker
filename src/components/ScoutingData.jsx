import { useState, useEffect, useMemo } from 'react'
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react'
import { supabase } from '../supabase'
import { useUser } from '../contexts/UserContext'

// Teams being considered for alliance
const CONSIDERED_NUMBERS = ['6603', '20097', 'royal-robotics']

// All teams from competition rankings
// Columns: rank, number, name, rp/match, tbp/match, auto avg, teleop avg, high score, record, matches played
const ALL_TEAMS = [
  { rank: null, number: 'royal-robotics', name: 'Royal Robotics', rp: 0, tbp: 0, autoAvg: 0, teleopAvg: 0, highScore: 0, record: '--', played: 0 },
  { rank: 11, number: '6072',  name: 'Wildbot Robotics',                   rp: 4.30, tbp: 72.20, autoAvg: 15.00, teleopAvg: 21.10, highScore: 146, record: '10-0-0', played: 24 },
  { rank: 12, number: '15050', name: 'Lightning Bots',                     rp: 4.30, tbp: 64.00, autoAvg: 14.00, teleopAvg: 15.00, highScore: 79,  record: '10-0-0', played: 30 },
  { rank: 13, number: '8672',  name: 'UBett',                              rp: 4.30, tbp: 61.00, autoAvg: 13.50, teleopAvg: 12.30, highScore: 78,  record: '10-0-0', played: 30 },
  { rank: 14, number: '6603',  name: 'Guild of Gears',                     rp: 4.20, tbp: 78.80, autoAvg: 13.50, teleopAvg: 17.10, highScore: 154, record: '10-0-0', played: 30 },
  { rank: 15, number: '8696',  name: 'Trobotix',                           rp: 4.20, tbp: 60.90, autoAvg: 12.50, teleopAvg: 14.50, highScore: 82,  record: '10-0-0', played: 24 },
  { rank: 16, number: '20097', name: 'Robo Raptors',                       rp: 4.10, tbp: 81.60, autoAvg: 14.00, teleopAvg: 15.00, highScore: 111, record: '10-0-0', played: 24 },
  { rank: 17, number: '8588',  name: 'Finger Puppet Mafia',                rp: 4.00, tbp: 67.50, autoAvg: 15.50, teleopAvg: 12.20, highScore: 116, record: '8-2-0',  played: 18 },
  { rank: 18, number: '5062',  name: 'Mechanaries',                        rp: 4.00, tbp: 60.70, autoAvg: 13.00, teleopAvg: 15.00, highScore: 78,  record: '10-0-0', played: 30 },
  { rank: 19, number: '6545',  name: 'Knight Riders',                      rp: 3.90, tbp: 67.40, autoAvg: 11.00, teleopAvg: 17.50, highScore: 138, record: '10-0-0', played: 24 },
  { rank: 20, number: '10602', name: 'Pioneer Robotics',                   rp: 3.90, tbp: 61.80, autoAvg: 10.50, teleopAvg: 13.50, highScore: 147, record: '10-0-0', played: 30 },
  { rank: 21, number: '15055', name: 'DeDucktive Thinkers',                rp: 3.90, tbp: 60.90, autoAvg: 11.50, teleopAvg: 10.00, highScore: 118, record: '10-0-0', played: 30 },
  { rank: 22, number: '4237',  name: 'Cyberhawks',                         rp: 3.90, tbp: 53.40, autoAvg: 10.00, teleopAvg: 12.10, highScore: 135, record: '10-0-0', played: 24 },
  { rank: 23, number: '4177',  name: 'Finger Tightans',                    rp: 3.90, tbp: 47.90, autoAvg: 11.00, teleopAvg: 12.40, highScore: 148, record: '9-1-0',  played: 24 },
  { rank: 24, number: '12745', name: 'Long John Launchers',                rp: 3.80, tbp: 57.30, autoAvg: 13.00, teleopAvg: 12.10, highScore: 79,  record: '10-0-0', played: 18 },
  { rank: 25, number: '23971', name: 'Trobotix JV',                        rp: 3.50, tbp: 36.40, autoAvg: 10.00, teleopAvg: 10.10, highScore: 64,  record: '9-0-1',  played: 24 },
  { rank: 26, number: '10139', name: 'Glitch Mob',                         rp: 3.40, tbp: 69.60, autoAvg: 13.50, teleopAvg: 15.00, highScore: 138, record: '7-3-0',  played: 18 },
  { rank: 27, number: '8988',  name: 'Bellevue Blockheads',                rp: 3.40, tbp: 62.50, autoAvg: 11.00, teleopAvg: 12.30, highScore: 127, record: '9-1-0',  played: 24 },
  { rank: 28, number: '32494', name: 'Screw Ups-Washington Middle School', rp: 3.40, tbp: 51.30, autoAvg: 11.00, teleopAvg: 10.70, highScore: 76,  record: '9-1-0',  played: 24 },
  { rank: 29, number: '367',   name: 'Organized Chaos',                    rp: 3.20, tbp: 49.20, autoAvg: 13.00, teleopAvg: 12.30, highScore: 91,  record: '6-3-1',  played: 30 },
  { rank: 30, number: '18482', name: 'Mechanical Soup',                    rp: 3.00, tbp: 57.10, autoAvg: 11.50, teleopAvg: 13.50, highScore: 142, record: '8-2-0',  played: 24 },
  { rank: 31, number: '13532', name: 'EagleBots FTC 13532',                rp: 2.60, tbp: 40.30, autoAvg: 13.00, teleopAvg: 6.50,  highScore: 74,  record: '6-4-0',  played: 24 },
  { rank: 32, number: '11721', name: 'Central Processing Units',           rp: 2.40, tbp: 57.10, autoAvg: 12.50, teleopAvg: 12.90, highScore: 120, record: '4-6-0',  played: 18 },
  { rank: 33, number: '25788', name: 'Byte Brawlers',                      rp: 2.30, tbp: 33.90, autoAvg: 9.50,  teleopAvg: 8.00,  highScore: 54,  record: '5-5-0',  played: 24 },
  { rank: 34, number: '8813',  name: 'The Winter Soldiers',                rp: 0,    tbp: 0,     autoAvg: 0,     teleopAvg: 0,     highScore: 0,   record: '--',     played: 0  },
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

  // Merge competition data with scouting submissions, split into considered vs rest
  const { consideredTeams, otherTeams } = useMemo(() => {
    // Group scouting records by team number
    const byNumber = {}
    records.forEach(r => {
      const d = r.data || {}
      const num = String(d.teamNumber || '').trim()
      if (!num) return
      if (!byNumber[num]) byNumber[num] = []
      byNumber[num].push({ ...d, _id: r.id, _by: r.submitted_by, _at: r.submitted_at })
    })

    // Build team list from ALL_TEAMS, attach scouting data
    const all = ALL_TEAMS.map(t => {
      const matches = byNumber[t.number] || []
      delete byNumber[t.number]
      return { ...t, matches, ...computeScoutingStats(matches) }
    })

    // Any teams in scouting data not in ALL_TEAMS
    Object.entries(byNumber).forEach(([num, matches]) => {
      all.push({
        rank: null, number: num, name: `Team ${num}`,
        rp: 0, tbp: 0, autoAvg: 0, teleopAvg: 0, highScore: 0, record: '--', played: 0,
        matches, ...computeScoutingStats(matches),
      })
    })

    const considered = all.filter(t => CONSIDERED_NUMBERS.includes(t.number))
    const others = all.filter(t => !CONSIDERED_NUMBERS.includes(t.number))
      .sort((a, b) => (a.rank || 999) - (b.rank || 999))

    return { consideredTeams: considered, otherTeams: others }
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
            {ALL_TEAMS.length} teams &middot; {records.length} scouting response{records.length !== 1 ? 's' : ''}
          </p>
        </div>
      </header>

      <main className="flex-1 p-4 pl-14 md:pl-4 overflow-y-auto">
        <div className="max-w-3xl mx-auto space-y-5 pb-8">

          {/* Teams Being Considered */}
          <div className="border-b-2 border-pastel-pink pb-2 mb-1">
            <h2 className="text-lg font-bold text-gray-800">Teams Being Considered</h2>
            <p className="text-xs text-gray-500">Alliance partner candidates</p>
          </div>

          {consideredTeams.map(t => (
            <div
              key={t.number}
              className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm border border-gray-100 overflow-hidden"
            >
              {/* Team Header */}
              <div className="px-5 py-4 bg-gradient-to-r from-pastel-blue/30 to-pastel-pink/30 border-b border-gray-100">
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
  )
}

export default ScoutingData
