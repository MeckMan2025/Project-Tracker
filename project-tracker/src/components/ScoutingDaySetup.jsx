import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../supabase'
import { useUser } from '../contexts/UserContext'
import { usePermissions } from '../hooks/usePermissions'
import { Users, Wrench, Target, ListOrdered, ChevronLeft, Plus, Trash2, Play, Square, Star } from 'lucide-react'
import NotificationBell from './NotificationBell'

// ---- Default data (from the team's scouting spreadsheet) -------------------
const DEFAULT_DATA = {
  groups: [
    { id: '1', name: 'Group 1', members: ['Lily', 'Ricky', 'Lucy'], teams: ['367', '4177', '4237'] },
    { id: '2', name: 'Group 2', members: ['Reyansh', 'Aakansha', 'Varsha'], teams: ['10602', '12745', '15050'] },
    { id: '3', name: 'Group 3', members: ['James', 'Kayden', 'Weston'], teams: ['5062', '6072', '6093'] },
    { id: '4', name: 'Group 4', members: ['Braden', 'Rian', 'Arav'], teams: ['15055', '18482', '22064'] },
    { id: '5', name: 'Group 5', members: ['Jacob', 'Anish', 'Yasu'], teams: ['7196', '8588', '8696'] },
    { id: '6', name: 'Group 6', members: ['Yukti', 'Daegus'], teams: ['23971', '25788', '31541'] },
    { id: '7', name: 'Group 7', members: ['Thanuja', 'Pragnya'], teams: ['8743', '8988', '10082'] },
  ],
  fixedRoles: [
    { role: 'Drive Team', members: ['Harshita', 'Saumyaa', 'Nick', 'Amruta'] },
    { role: 'Pit Crew', members: ['Lucy', 'James'] },
    { role: 'Media', members: ['Lily', 'Yasu', 'Aakansha'] },
    { role: 'Observation', members: ['Thanuja', 'Pragnya'] },
  ],
  scoutGroups: [
    { id: 's1', name: 'Group 1', head: 'Braden', red1: 'Kayden', red2: 'Ashrit', blue1: 'Jacob', blue2: 'Charan' },
    { id: 's2', name: 'Group 2', head: 'Rian', red1: 'Kashvi', red2: 'Ricky', blue1: 'Alexiandria', blue2: 'Reyansh' },
    { id: 's3', name: 'Group 3', head: 'Chethan', red1: 'Anish', red2: 'Keegan', blue1: 'Weston', blue2: 'Daegus' },
  ],
  standBy: 'Yukti',
  matchPlan: [
    { id: 'm1', group: 'A', field: 'A', matches: '1, 3, 5, 7, 9' },
    { id: 'm2', group: 'B', field: 'B', matches: '2, 4, 6, 8, 10' },
    { id: 'm3', group: 'C', field: 'A', matches: '11, 13, 15, 17, 19' },
    { id: 'm4', group: 'A', field: 'B', matches: '12, 14, 16, 18, 20' },
  ],
}

const groupStyle = (letter) => {
  const L = (letter || '').toUpperCase()
  if (L === 'A') return { dot: 'bg-blue-500', chip: 'bg-blue-50 text-blue-700', ring: 'border-blue-200' }
  if (L === 'B') return { dot: 'bg-red-500', chip: 'bg-red-50 text-red-700', ring: 'border-red-200' }
  if (L === 'C') return { dot: 'bg-green-500', chip: 'bg-green-50 text-green-700', ring: 'border-green-200' }
  return { dot: 'bg-gray-400', chip: 'bg-gray-50 text-gray-600', ring: 'border-gray-200' }
}

const TABS = [
  { key: 'groups', label: 'Groups', icon: Users },
  { key: 'roles', label: 'Event Roles', icon: Wrench },
  { key: 'scouting', label: 'Scouting', icon: Target },
  { key: 'matches', label: 'Match Plan', icon: ListOrdered },
]

const uid = () => String(Date.now()) + Math.random().toString(36).slice(2)

// Small read/edit text field
function Slot({ label, value, onChange, isLead, tint }) {
  const bg = tint === 'red' ? 'bg-red-50' : tint === 'blue' ? 'bg-blue-50' : 'bg-white'
  const labelColor = tint === 'red' ? 'text-red-600' : tint === 'blue' ? 'text-blue-600' : 'text-gray-500'
  return (
    <div className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 ${tint ? bg : ''}`}>
      <span className={`text-xs font-semibold w-14 shrink-0 ${labelColor}`}>{label}</span>
      {isLead ? (
        <input
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="—"
          className="flex-1 min-w-0 text-sm bg-transparent border-b border-gray-200 focus:border-pastel-blue focus:outline-none py-0.5"
        />
      ) : (
        <span className="flex-1 text-sm text-gray-700 truncate">{value || <span className="italic text-gray-300">—</span>}</span>
      )}
    </div>
  )
}

export default function ScoutingDaySetup({ scheduleId, dateTitle, dateSubtitle, onBack }) {
  const { username } = useUser()
  const { hasLeadTag } = usePermissions()
  const isLead = hasLeadTag
  const [data, setData] = useState(null)
  const [tab, setTab] = useState('groups')
  const [activePeriod, setActivePeriod] = useState(null)
  const [periodSubmissions, setPeriodSubmissions] = useState([])
  const [showPeriodForm, setShowPeriodForm] = useState(false)
  const [periodName, setPeriodName] = useState('')
  const saveTimer = useRef(null)
  const activePeriodRef = useRef(null)

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  const restHeaders = { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' }

  useEffect(() => { activePeriodRef.current = activePeriod }, [activePeriod])

  // Fill in any missing sections so old saved rows still render
  const withDefaults = (loaded) => ({
    groups: loaded.groups || DEFAULT_DATA.groups.map(g => ({ ...g })),
    fixedRoles: loaded.fixedRoles || DEFAULT_DATA.fixedRoles.map(r => ({ ...r })),
    scoutGroups: loaded.scoutGroups || DEFAULT_DATA.scoutGroups.map(s => ({ ...s })),
    standBy: loaded.standBy ?? DEFAULT_DATA.standBy,
    matchPlan: loaded.matchPlan || DEFAULT_DATA.matchPlan.map(m => ({ ...m })),
  })

  const loadSubmissions = useCallback(async (periodId) => {
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/scouting_records?scouting_period_id=eq.${periodId}&select=submitted_by`, { headers: restHeaders })
      if (res.ok) { const rows = await res.json(); setPeriodSubmissions(rows.map(r => r.submitted_by)) }
    } catch { /* ignore */ }
  }, [supabaseUrl, supabaseKey])

  useEffect(() => {
    setData(null)
    ;(async () => {
      try {
        const res = await fetch(`${supabaseUrl}/rest/v1/scouting_schedule?id=eq.${scheduleId}&select=*`, { headers: restHeaders })
        if (res.ok) {
          const rows = await res.json()
          const row = rows && rows.length > 0 ? rows[0] : null
          setData(withDefaults(row?.data || {}))
        } else setData(withDefaults({}))
      } catch { setData(withDefaults({})) }
    })()
  }, [supabaseUrl, supabaseKey, scheduleId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch(`${supabaseUrl}/rest/v1/scouting_periods?is_active=eq.true&select=*&limit=1`, { headers: restHeaders })
        if (res.ok) { const rows = await res.json(); const p = rows?.[0] || null; setActivePeriod(p); if (p) loadSubmissions(p.id) }
      } catch { /* ignore */ }
    })()
  }, [supabaseUrl, supabaseKey, loadSubmissions]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const channel = supabase
      .channel(`schedule-${scheduleId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scouting_schedule' }, (payload) => {
        if (payload.new?.id === scheduleId && payload.new?.data) setData(withDefaults(payload.new.data))
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scouting_periods' }, (payload) => {
        if (payload.new?.is_active) { setActivePeriod(payload.new); loadSubmissions(payload.new.id) }
        else { setActivePeriod(null); setPeriodSubmissions([]) }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'scouting_records' }, (payload) => {
        const current = activePeriodRef.current
        if (current && payload.new?.scouting_period_id === current.id) setPeriodSubmissions(prev => [...prev, payload.new.submitted_by])
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [loadSubmissions, scheduleId]) // eslint-disable-line react-hooks/exhaustive-deps

  const autoSave = useCallback((newData) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      try {
        await fetch(`${supabaseUrl}/rest/v1/scouting_schedule`, {
          method: 'POST',
          headers: { ...restHeaders, Prefer: 'resolution=merge-duplicates' },
          body: JSON.stringify({ id: scheduleId, data: newData, updated_by: username, updated_at: new Date().toISOString() }),
        })
      } catch (err) { console.error('Failed to save schedule:', err) }
    }, 800)
  }, [username, supabaseUrl, supabaseKey, scheduleId]) // eslint-disable-line react-hooks/exhaustive-deps

  const update = (updater) => setData(prev => { const next = updater(prev); autoSave(next); return next })
  const csv = (arr) => (arr || []).join(', ')
  const parseCsv = (s) => s.split(',').map(x => x.trim()).filter(Boolean)

  // ---- Scouting period ----
  const startPeriod = async () => {
    if (!periodName.trim()) return
    const expected = data.scoutGroups.flatMap(g => [g.red1, g.red2, g.blue1, g.blue2]).filter(Boolean)
    const period = { id: uid(), name: periodName.trim(), started_at: new Date().toISOString(), ended_at: null, is_active: true, created_by: username, expected_scouts: expected }
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/scouting_periods`, { method: 'POST', headers: restHeaders, body: JSON.stringify(period) })
      if (res.ok) { setActivePeriod(period); setPeriodSubmissions([]); setShowPeriodForm(false); setPeriodName('') }
    } catch (err) { console.error('Failed to start period:', err) }
  }
  const stopPeriod = async () => {
    if (!activePeriod) return
    try {
      await fetch(`${supabaseUrl}/rest/v1/scouting_periods?id=eq.${activePeriod.id}`, { method: 'PATCH', headers: restHeaders, body: JSON.stringify({ is_active: false, ended_at: new Date().toISOString() }) })
      setActivePeriod(null); setPeriodSubmissions([])
    } catch (err) { console.error('Failed to stop period:', err) }
  }

  if (!data) {
    return <div className="flex-1 flex items-center justify-center min-w-0"><p className="text-gray-400">Loading schedule…</p></div>
  }

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="px-4 py-3 ml-14 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <button onClick={onBack} className="p-1.5 -ml-1 rounded-lg hover:bg-gray-100 shrink-0" title="Back to schedule">
              <ChevronLeft size={22} className="text-gray-500" />
            </button>
            <div className="min-w-0">
              <h1 className="text-xl font-bold bg-gradient-to-r from-pastel-blue-dark via-pastel-pink-dark to-pastel-orange-dark bg-clip-text text-transparent truncate">
                {dateTitle || 'Scouting Setup'}
              </h1>
              <p className="text-sm text-gray-500 truncate">{dateSubtitle || 'Groups, roles & scouting assignments'}</p>
            </div>
          </div>
          <NotificationBell />
        </div>
        {/* Tabs */}
        <div className="px-4 pb-2 ml-14 flex gap-1.5 overflow-x-auto">
          {TABS.map(t => {
            const Icon = t.icon
            const active = tab === t.key
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition-colors ${active ? 'bg-gradient-to-r from-pastel-blue to-pastel-pink text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                <Icon size={14} /> {t.label}
              </button>
            )
          })}
        </div>
      </header>

      <main className="flex-1 p-4 overflow-y-auto">
        <div className="max-w-4xl mx-auto space-y-4">

          {/* Live period banner */}
          {activePeriod && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                  </span>
                  <span className="font-semibold text-green-800 text-sm">{activePeriod.name} · Live</span>
                </div>
                {isLead && <button onClick={stopPeriod} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-red-100 hover:bg-red-200 text-red-700"><Square size={12} /> Stop</button>}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(activePeriod.expected_scouts || []).map((s, i) => (
                  <span key={`${s}-${i}`} className={`px-2 py-0.5 rounded-full text-xs font-medium ${periodSubmissions.includes(s) ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>{s}</span>
                ))}
              </div>
            </div>
          )}

          {/* ---- GROUPS TAB ---- */}
          {tab === 'groups' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {data.groups.map((group, i) => (
                <div key={group.id} className="bg-white rounded-xl p-3.5 shadow-sm border border-gray-100">
                  <h4 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-1.5">
                    <span className="w-6 h-6 rounded-lg bg-gradient-to-br from-pastel-blue to-pastel-pink text-white text-xs flex items-center justify-center font-black">{i + 1}</span>
                    {group.name}
                  </h4>
                  {isLead ? (
                    <>
                      <label className="text-[11px] font-semibold text-gray-400 uppercase">Members</label>
                      <input value={csv(group.members)} onChange={e => update(p => { const g = [...p.groups]; g[i] = { ...g[i], members: parseCsv(e.target.value) }; return { ...p, groups: g } })} placeholder="Names…" className="w-full mb-2 text-sm border rounded-lg px-2 py-1 focus:ring-2 focus:ring-pastel-blue focus:border-transparent" />
                      <label className="text-[11px] font-semibold text-gray-400 uppercase">FTC Teams</label>
                      <input value={csv(group.teams)} onChange={e => update(p => { const g = [...p.groups]; g[i] = { ...g[i], teams: parseCsv(e.target.value) }; return { ...p, groups: g } })} placeholder="Team #s…" className="w-full text-sm border rounded-lg px-2 py-1 focus:ring-2 focus:ring-pastel-blue focus:border-transparent" />
                    </>
                  ) : (
                    <>
                      <div className="flex flex-wrap gap-1 mb-2">
                        {group.members.length ? group.members.map(m => <span key={m} className="text-xs px-2 py-0.5 bg-pastel-blue/20 text-gray-600 rounded-full">{m}</span>) : <span className="text-xs italic text-gray-300">No members</span>}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {group.teams.map(t => <span key={t} className="text-xs px-1.5 py-0.5 bg-pastel-orange/30 text-gray-600 rounded font-mono">#{t}</span>)}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ---- EVENT ROLES TAB ---- */}
          {tab === 'roles' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {data.fixedRoles.map((role, i) => (
                <div key={role.role} className="bg-white rounded-xl p-3.5 shadow-sm border border-gray-100">
                  <h4 className="text-sm font-bold text-gray-700 mb-2">{role.role}</h4>
                  {isLead ? (
                    <input value={csv(role.members)} onChange={e => update(p => { const r = [...p.fixedRoles]; r[i] = { ...r[i], members: parseCsv(e.target.value) }; return { ...p, fixedRoles: r } })} placeholder="Names, comma separated" className="w-full text-sm border rounded-lg px-2 py-1 focus:ring-2 focus:ring-pastel-blue focus:border-transparent" />
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {role.members.length ? role.members.map(m => <span key={m} className="text-xs px-2 py-0.5 bg-pastel-pink/20 text-gray-600 rounded-full">{m}</span>) : <span className="text-xs italic text-gray-300">Not assigned</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ---- SCOUTING TAB ---- */}
          {tab === 'scouting' && (
            <>
              {/* Stand By */}
              <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 flex items-center gap-2">
                <Star size={15} className="text-pastel-orange-dark shrink-0" />
                <span className="text-xs font-semibold text-gray-500 shrink-0">Stand By</span>
                {isLead ? (
                  <input value={data.standBy} onChange={e => update(p => ({ ...p, standBy: e.target.value }))} placeholder="—" className="flex-1 text-sm border-b border-gray-200 focus:border-pastel-blue focus:outline-none py-0.5" />
                ) : (
                  <span className="text-sm font-medium text-gray-700">{data.standBy || <span className="italic text-gray-300">—</span>}</span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {data.scoutGroups.map((g, i) => (
                  <div key={g.id} className="bg-white rounded-xl p-3.5 shadow-sm border border-gray-100">
                    {isLead ? (
                      <input value={g.name} onChange={e => update(p => { const s = [...p.scoutGroups]; s[i] = { ...s[i], name: e.target.value }; return { ...p, scoutGroups: s } })} className="w-full text-sm font-bold text-gray-700 mb-2 border-b border-gray-200 focus:border-pastel-blue focus:outline-none py-0.5" />
                    ) : (
                      <h4 className="text-sm font-bold text-gray-700 mb-2">{g.name}</h4>
                    )}
                    <div className="space-y-1">
                      <Slot label="Head" value={g.head} isLead={isLead} onChange={v => update(p => { const s = [...p.scoutGroups]; s[i] = { ...s[i], head: v }; return { ...p, scoutGroups: s } })} />
                      <Slot label="Red 1" tint="red" value={g.red1} isLead={isLead} onChange={v => update(p => { const s = [...p.scoutGroups]; s[i] = { ...s[i], red1: v }; return { ...p, scoutGroups: s } })} />
                      <Slot label="Red 2" tint="red" value={g.red2} isLead={isLead} onChange={v => update(p => { const s = [...p.scoutGroups]; s[i] = { ...s[i], red2: v }; return { ...p, scoutGroups: s } })} />
                      <Slot label="Blue 1" tint="blue" value={g.blue1} isLead={isLead} onChange={v => update(p => { const s = [...p.scoutGroups]; s[i] = { ...s[i], blue1: v }; return { ...p, scoutGroups: s } })} />
                      <Slot label="Blue 2" tint="blue" value={g.blue2} isLead={isLead} onChange={v => update(p => { const s = [...p.scoutGroups]; s[i] = { ...s[i], blue2: v }; return { ...p, scoutGroups: s } })} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Period control (compact, leads only) */}
              {isLead && !activePeriod && (
                <div className="pt-1">
                  {showPeriodForm ? (
                    <div className="bg-white rounded-xl p-3.5 shadow-sm border border-gray-100 space-y-2">
                      <input value={periodName} onChange={e => setPeriodName(e.target.value)} placeholder="Period name (e.g. Quals Match 5)" className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-pastel-blue focus:border-transparent" />
                      <p className="text-xs text-gray-400">Tracks whether each scouter (Red/Blue slots above) submitted.</p>
                      <div className="flex gap-2">
                        <button onClick={startPeriod} disabled={!periodName.trim()} className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium bg-green-100 hover:bg-green-200 text-green-700 disabled:opacity-50"><Play size={14} /> Start</button>
                        <button onClick={() => { setShowPeriodForm(false); setPeriodName('') }} className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-600">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setShowPeriodForm(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-pastel-blue hover:bg-pastel-blue-dark text-gray-700"><Play size={14} /> Start Scouting Period</button>
                  )}
                </div>
              )}
            </>
          )}

          {/* ---- MATCH PLAN TAB ---- */}
          {tab === 'matches' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {data.matchPlan.map((row, i) => {
                  const st = groupStyle(row.group)
                  return (
                    <div key={row.id} className={`bg-white rounded-xl p-3.5 shadow-sm border ${st.ring}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`w-3 h-3 rounded-sm ${st.dot} shrink-0`} />
                        {isLead ? (
                          <div className="flex items-center gap-1 text-sm font-bold text-gray-700">
                            Group
                            <input value={row.group} onChange={e => update(p => { const m = [...p.matchPlan]; m[i] = { ...m[i], group: e.target.value.toUpperCase().slice(0, 1) }; return { ...p, matchPlan: m } })} className="w-8 text-center border-b border-gray-200 focus:border-pastel-blue focus:outline-none" />
                            — Field
                            <input value={row.field} onChange={e => update(p => { const m = [...p.matchPlan]; m[i] = { ...m[i], field: e.target.value.toUpperCase().slice(0, 1) }; return { ...p, matchPlan: m } })} className="w-8 text-center border-b border-gray-200 focus:border-pastel-blue focus:outline-none" />
                            <button onClick={() => update(p => ({ ...p, matchPlan: p.matchPlan.filter(x => x.id !== row.id) }))} className="ml-auto p-1 rounded hover:bg-red-50"><Trash2 size={14} className="text-gray-300 hover:text-red-400" /></button>
                          </div>
                        ) : (
                          <h4 className="text-sm font-bold text-gray-700">Group {row.group} — Field {row.field}</h4>
                        )}
                      </div>
                      {isLead ? (
                        <input value={row.matches} onChange={e => update(p => { const m = [...p.matchPlan]; m[i] = { ...m[i], matches: e.target.value }; return { ...p, matchPlan: m } })} placeholder="Match numbers, comma separated" className="w-full text-sm border rounded-lg px-2 py-1 focus:ring-2 focus:ring-pastel-blue focus:border-transparent" />
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {parseCsv(row.matches).map((mn, k) => <span key={k} className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.chip}`}>Match {mn}</span>)}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              {isLead && (
                <button onClick={() => update(p => ({ ...p, matchPlan: [...p.matchPlan, { id: uid(), group: 'A', field: 'A', matches: '' }] }))} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-pastel-pink hover:bg-pastel-pink-dark text-gray-700"><Plus size={14} /> Add Group Rotation</button>
              )}
            </>
          )}

        </div>
      </main>
    </div>
  )
}
