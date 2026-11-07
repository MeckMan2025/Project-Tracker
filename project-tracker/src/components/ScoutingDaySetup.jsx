import MemberPicker from './MemberPicker'
import { useMemberNames } from '../hooks/useMemberNames'
import { onlyMyTeam, teamScope } from '../lib/teamScope'
import { restHeaders } from '../lib/restHeaders'
import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../supabase'
import { useUser } from '../contexts/UserContext'
import { usePermissions } from '../hooks/usePermissions'
import { Check, ChevronLeft, ClipboardList, Pause, Pencil, Plus, Shuffle, Star, Target, Tent, Trash2, Wrench } from 'lucide-react'
import { ALL_TEAMS } from '../data/teams'
import { COVER_MODES, coverOf, coverLabel, groupsByMatch } from '../lib/dayRota'
import { SCOUTING_ROLE, PIT_ROLE } from '../lib/dayRota'
import { HOME_TEAM_NUMBER } from '../data/team'

// ---- Default data (from the team's scouting spreadsheet) -------------------
// What a fresh day starts as.
//
// Structure only — the groups, the jobs that need covering, the shape of a
// scouting rotation — and no names. There used to be twenty-nine people in
// here, copied from the spreadsheet the season it was written: fourteen of
// them have since left the app entirely and three moved to another team, so
// every new day began by offering a lead a rota of people who are not there.
//
// A hard-coded roster is wrong the moment somebody joins or leaves, and it is
// wrong quietly. Leads pick real people from the real roster instead.
// Event roles that used to be offered and are not any more.
const RETIRED_ROLES = ['Observation', PIT_ROLE]
// Roles a person may hold as well as Scouting. Pit crew scout between
// repairs, so they are offered on both and neither clears the other.
const DOUBLES_WITH_SCOUTING = ['Pit Crew']
const canShare = (a, b) => (a === SCOUTING_ROLE && DOUBLES_WITH_SCOUTING.includes(b)) || (b === SCOUTING_ROLE && DOUBLES_WITH_SCOUTING.includes(a))

const DEFAULT_DATA = {
  fixedRoles: [
    { role: 'Drive Team', members: [] },
    { role: 'Pit Crew', members: [] },
    { role: 'Media', members: [] },
    { role: SCOUTING_ROLE, members: [] },
  ],
  // Teams that get a pit visit, and who makes it: { id, team, who }.
  pitTeams: [],
  scoutGroups: [
    { id: 's1', name: 'Group 1', head: '', red1: '', red2: '', blue1: '', blue2: '' },
  ],
  standBy: '',
  matchSchedule: [
    { id: 'ms1', match: '1', red1: '', red2: '', blue1: '', blue2: '' },
  ],
}

const TABS = [
  { key: 'roles', label: 'Event Roles', icon: Wrench },
  { key: 'scouting', label: 'Scouting', icon: Target },
  { key: 'schedule', label: 'Match Schedule', icon: ClipboardList },
  { key: 'pit', label: 'Pit', icon: Tent },
]

const teamNameOf = (n) => (ALL_TEAMS.find(t => String(t.number) === String(n || '').trim()) || {}).name || ''

const uid = () => String(Date.now()) + Math.random().toString(36).slice(2)

// One person in one position. Leads pick from the roster (the same list the
// event pickers use, so no mentor, coach or the ETS account); a name saved
// before this that is not on the roster still shows, so nothing vanishes.
function Slot({ label, value, onChange, isLead, tint, options = [] }) {
  const bg = tint === 'red' ? 'bg-red-50' : tint === 'blue' ? 'bg-blue-50' : 'bg-white'
  const labelColor = tint === 'red' ? 'text-red-600' : tint === 'blue' ? 'text-blue-600' : 'text-gray-500'
  const choices = value && !options.includes(value) ? [value, ...options] : options
  return (
    <div className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 ${tint ? bg : ''}`}>
      <span className={`text-xs font-semibold w-14 shrink-0 ${labelColor}`}>{label}</span>
      {isLead ? (
        <select
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 min-w-0 text-sm bg-transparent border-b border-gray-200 focus:border-pastel-blue focus:outline-none py-0.5 text-gray-700"
        >
          <option value="">—</option>
          {choices.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      ) : (
        <span className="flex-1 text-sm text-gray-700 truncate">{value || <span className="italic text-gray-300">—</span>}</span>
      )}
    </div>
  )
}

// onRename, when given, lets a lead change the day's name from this screen
// instead of going back to the list; the caller owns where the name lives.
// onPause, when given, puts a Pause button in the header: this day is live for
// everyone and the caller knows how to end that. Only passed to the few who may.
export default function ScoutingDaySetup({ scheduleId, dateTitle, dateSubtitle, onBack, onRename, onPause, initialTab = 'scouting' }) {
  const { username } = useUser()
  const { hasLeadTag, myTeamNumber} = usePermissions()
  const SCOPE = teamScope(myTeamNumber)
  const isLead = hasLeadTag
  const [data, setData] = useState(null)
  const [tab, setTab] = useState(initialTab)
  const [nameDraft, setNameDraft] = useState(null) // string while the title is being edited
  const commitName = () => {
    const next = (nameDraft || '').trim()
    if (next && next !== dateTitle) onRename?.(next)
    setNameDraft(null)
  }
  const saveTimer = useRef(null)

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  // Fill in any missing sections so old saved rows still render
  // One job each, across the whole day: somebody on Media (or any role other
  // than Scouting) is not also a Head or a Red 2. Their scouting position is
  // cleared, not the role, because the role is the deliberate choice and the
  // position is what Randomise or an older day left behind.
  const clearConflicts = (d) => {
    const busyOutside = (role) => new Set(d.fixedRoles.filter(r => r.role !== role && !canShare(r.role, role)).flatMap(r => r.members || []))
    const busy = busyOutside(SCOUTING_ROLE)
    const busyPit = busy   // pits are done by the scouts, so the same people are busy
    const free = (name) => (busy.has(name) ? '' : name)
    const freePit = (name) => (busyPit.has(name) ? '' : name)
    return {
      ...d,
      standBy: free(d.standBy),
      scoutGroups: d.scoutGroups.map(g => ({
        ...g, head: free(g.head), red1: free(g.red1), red2: free(g.red2), blue1: free(g.blue1), blue2: free(g.blue2),
      })),
      pitTeams: (d.pitTeams || []).map(t => ({ ...t, who: freePit(t.who) })),
    }
  }

  const withDefaults = (loaded) => clearConflicts({
    // A role added to the default list after a day was saved is appended to
    // that day, so every day shows the same set of jobs.
    fixedRoles: (() => {
      // Roles retired from the default list leave older days too.
      const have = (loaded.fixedRoles || []).filter(r => !RETIRED_ROLES.includes(r.role))
      return [...have, ...DEFAULT_DATA.fixedRoles.filter(d => !have.some(r => r.role === d.role)).map(r => ({ ...r }))]
    })(),
    // Days saved before this started with three scouting groups. Drop the
    // second and third when nobody was ever put in them; one a lead added
    // (any other id) stays, full or not.
    scoutGroups: (loaded.scoutGroups || DEFAULT_DATA.scoutGroups.map(s => ({ ...s })))
      .filter(g => !(['s2', 's3'].includes(g.id) && !g.head && !g.red1 && !g.red2 && !g.blue1 && !g.blue2)),
    standBy: loaded.standBy ?? DEFAULT_DATA.standBy,
    matchSchedule: loaded.matchSchedule || DEFAULT_DATA.matchSchedule.map(m => ({ ...m })),
    pitTeams: loaded.pitTeams || [],
  })

  useEffect(() => {
    setData(null)
    ;(async () => {
      try {
        const res = await fetch(`${supabaseUrl}/rest/v1/scouting_schedule?${SCOPE}&id=eq.${scheduleId}&select=*`, { headers: restHeaders({ 'Content-Type': 'application/json' }) })
        if (res.ok) {
          const rows = await res.json()
          const row = rows && rows.length > 0 ? rows[0] : null
          setData(withDefaults(row?.data || {}))
        } else setData(withDefaults({}))
      } catch { setData(withDefaults({})) }
    })()
  }, [supabaseUrl, supabaseKey, scheduleId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const channel = supabase
      .channel(`schedule-${scheduleId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scouting_schedule' }, onlyMyTeam((payload) => {
        if (payload.new?.id === scheduleId && payload.new?.data) setData(withDefaults(payload.new.data))
      }))
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [scheduleId]) // eslint-disable-line react-hooks/exhaustive-deps

  const autoSave = useCallback((newData) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      try {
        await fetch(`${supabaseUrl}/rest/v1/scouting_schedule`, {
          method: 'POST',
          headers: { ...restHeaders({ 'Content-Type': 'application/json' }), Prefer: 'resolution=merge-duplicates' },
          body: JSON.stringify({ id: scheduleId, data: newData, updated_by: username, updated_at: new Date().toISOString() }),
        })
      } catch (err) { console.error('Failed to save schedule:', err) }
    }, 800)
  }, [username, supabaseUrl, supabaseKey, scheduleId]) // eslint-disable-line react-hooks/exhaustive-deps

  const update = (updater) => setData(prev => { const next = updater(prev); autoSave(next); return next })

  // Fill the whole day at random.
  //
  // Not a toy: the rota is the longest part of setting up a competition and
  // most of it is arbitrary. Who scouts Red 1 in Group 2 does not matter, only
  // that somebody does and that nobody is in two places at once. So this deals
  // everyone out and leaves the lead to fix the handful that do matter.
  //
  // Dealt, not sampled: everybody is shuffled once and handed out in turn, so
  // nobody draws two jobs while somebody else sits out. Jobs are filled in
  // order of how much they need a person — the scouting positions first,
  // because an empty Red 2 means a match nobody watched.
  //
  // Only ever real people from the live roster, which is why it refuses rather
  // than inventing anyone when the roster has not loaded.
  const roster = useMemberNames({ forEvent: true })

  const shuffle = (list) => {
    const deck = [...list]
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[deck[i], deck[j]] = [deck[j], deck[i]]
    }
    return deck
  }

  // The Scouting event role is who scouts. The positions on the Scouting tab
  // are filled from those people and nobody else, so a lead decides the pool
  // once, in Event Roles, and the tab offers only them.
  const scoutPool = (data?.fixedRoles || []).find(r => r.role === SCOUTING_ROLE)?.members || []
  // The same people do the pits: one Scouting role, both jobs.
  const pitPool = scoutPool

  const shuffleEverything = () => {
    if (!roster.length) return
    // Scouting positions are dealt from the Scouting role. When nobody has been
    // put on it yet, everyone is in the pool and the people dealt a position
    // become the role, so the tab and the role still agree afterwards.
    const scouts = shuffle(scoutPool.length ? scoutPool : roster)
    const pits = scouts
    const others = shuffle(roster.filter(n => !scouts.includes(n) && !pits.includes(n)))
    let at = 0
    // Round-robin: when there are fewer people than jobs, start the deck again
    // rather than leaving the rest of the day blank. Somebody doubling up is a
    // thing a lead can see and fix; an empty position is one they cannot.
    const nextScout = () => scouts[at++ % scouts.length]
    let ot = 0
    const nextOther = () => (others.length ? others : roster)[ot++ % (others.length || roster.length)]

    update(p => {
      const dealt = []
      const take = () => { const n = nextScout(); dealt.push(n); return n }
      const scoutGroups = p.scoutGroups.map(g => ({
        ...g, head: take(), red1: take(), red2: take(), blue1: take(), blue2: take(),
      }))
      const standBy = take()
      const fixedRoles = p.fixedRoles.map(r => r.role === SCOUTING_ROLE
        ? { ...r, members: scoutPool.length ? r.members : [...new Set(dealt)] }
        : { ...r, members: [nextOther()] })
      // Pit visits shared round the pit scouts, when there are any.
      let pt = 0
      const pitTeams = pits.length ? (p.pitTeams || []).map(t => ({ ...t, who: pits[pt++ % pits.length] })) : p.pitTeams
      return { ...p, scoutGroups, standBy, fixedRoles, pitTeams }
    })
  }
  const csv = (arr) => (arr || []).join(', ')


  if (!data) {
    return <div className="flex-1 flex items-center justify-center min-w-0"><p className="text-gray-400">Loading schedule…</p></div>
  }

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="px-4 py-3 ml-14 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            {onBack && (
              <button onClick={onBack} className="p-1.5 -ml-1 rounded-lg hover:bg-gray-100 shrink-0" title="Back to schedule">
                <ChevronLeft size={22} className="text-gray-500" />
              </button>
            )}
            <div className="min-w-0">
              {nameDraft !== null ? (
                <div className="flex items-center gap-1">
                  <input
                    value={nameDraft}
                    onChange={e => setNameDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') commitName(); if (e.key === 'Escape') setNameDraft(null) }}
                    onBlur={commitName}
                    autoFocus
                    className="text-xl font-bold text-gray-800 min-w-0 flex-1 bg-transparent border-b-2 border-pastel-blue focus:outline-none"
                  />
                  <button onMouseDown={e => e.preventDefault()} onClick={commitName} className="p-1 rounded hover:bg-gray-100" title="Save name"><Check size={16} className="text-green-600" /></button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 min-w-0">
                  <h1 className="text-xl font-bold bg-gradient-to-r from-pastel-blue-dark via-pastel-pink-dark to-pastel-orange-dark bg-clip-text text-transparent truncate">
                    {dateTitle || 'Scouting Setup'}
                  </h1>
                  {isLead && onRename && (
                    <button onClick={() => setNameDraft(dateTitle || '')} className="p-1 rounded hover:bg-gray-100 shrink-0" title="Rename"><Pencil size={14} className="text-gray-400 hover:text-pastel-blue-dark" /></button>
                  )}
                </div>
              )}
              <p className="text-sm text-gray-500 truncate">{dateSubtitle || 'Groups, roles & scouting assignments'}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {onPause && (
              <button
                onClick={onPause}
                title="Pause this Competition Day — everyone's app goes back to normal"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 transition-colors"
              >
                <Pause size={15} /> Pause
              </button>
            )}
            {isLead && tab === 'scouting' && (
              <button
                onClick={shuffleEverything}
                disabled={!roster.length}
                title={roster.length
                  ? 'Deal everyone out at random — scouting positions, stand-by and event roles'
                  : 'Waiting for the roster'}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold bg-pastel-yellow hover:bg-pastel-yellow-dark text-gray-800 transition-colors disabled:bg-gray-100 disabled:text-gray-400"
              >
                <Shuffle size={15} /> Randomise
              </button>
            )}
          </div>
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

          {/* ---- EVENT ROLES TAB ---- */}
          {tab === 'roles' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {data.fixedRoles.map((role, i) => (
                <div key={role.role} className="bg-white rounded-xl p-3.5 shadow-sm border border-gray-100">
                  <h4 className="text-sm font-bold text-gray-700 mb-2">{role.role}</h4>
                  {isLead ? (
                    <MemberPicker
                      forEvent
                      value={role.members}
                      // One job each: somebody already on another role is not offered here.
                      exclude={data.fixedRoles.filter((r, k) => k !== i && !canShare(r.role, role.role)).flatMap(r => r.members || [])}
                      onChange={members => update(p => { const r = [...p.fixedRoles]; r[i] = { ...r[i], members }; return clearConflicts({ ...p, fixedRoles: r }) })}
                    />
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
              {isLead && !scoutPool.length && (
                <p className="text-xs text-gray-400">
                  Positions here are picked from the people on the <button onClick={() => setTab('roles')} className="font-semibold text-pastel-blue-dark hover:underline">Scouting role</button> in Event Roles. Nobody is on it yet, so put your scouts there first, or press Randomise to deal everyone out.
                </p>
              )}
              {/* Stand By */}
              <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 flex items-center gap-2">
                <Star size={15} className="text-pastel-orange-dark shrink-0" />
                <span className="text-xs font-semibold text-gray-500 shrink-0">Stand By</span>
                {isLead ? (
                  <select value={data.standBy || ''} onChange={e => update(p => ({ ...p, standBy: e.target.value }))} className="flex-1 min-w-0 text-sm bg-transparent border-b border-gray-200 focus:border-pastel-blue focus:outline-none py-0.5 text-gray-700">
                    <option value="">—</option>
                    {(data.standBy && !scoutPool.includes(data.standBy) ? [data.standBy, ...scoutPool] : scoutPool).map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                ) : (
                  <span className="text-sm font-medium text-gray-700">{data.standBy || <span className="italic text-gray-300">—</span>}</span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {data.scoutGroups.map((g, i) => (
                  <div key={g.id} className="bg-white rounded-xl p-3.5 shadow-sm border border-gray-100">
                    {isLead ? (
                      <div className="flex items-center gap-1 mb-2">
                        <input value={g.name} onChange={e => update(p => { const s = [...p.scoutGroups]; s[i] = { ...s[i], name: e.target.value }; return { ...p, scoutGroups: s } })} className="flex-1 min-w-0 text-sm font-bold text-gray-700 border-b border-gray-200 focus:border-pastel-blue focus:outline-none py-0.5" />
                        {data.scoutGroups.length > 1 && (
                          <button onClick={() => update(p => ({ ...p, scoutGroups: p.scoutGroups.filter(x => x.id !== g.id) }))} title="Remove this group" className="p-1 rounded hover:bg-red-50 shrink-0"><Trash2 size={14} className="text-gray-300 hover:text-red-400" /></button>
                        )}
                      </div>
                    ) : (
                      <h4 className="text-sm font-bold text-gray-700 mb-2">{g.name}</h4>
                    )}
                    <div className="space-y-1">
                      <Slot options={scoutPool} label="Head" value={g.head} isLead={isLead} onChange={v => update(p => { const s = [...p.scoutGroups]; s[i] = { ...s[i], head: v }; return { ...p, scoutGroups: s } })} />
                      <Slot options={scoutPool} label="Red 1" tint="red" value={g.red1} isLead={isLead} onChange={v => update(p => { const s = [...p.scoutGroups]; s[i] = { ...s[i], red1: v }; return { ...p, scoutGroups: s } })} />
                      <Slot options={scoutPool} label="Red 2" tint="red" value={g.red2} isLead={isLead} onChange={v => update(p => { const s = [...p.scoutGroups]; s[i] = { ...s[i], red2: v }; return { ...p, scoutGroups: s } })} />
                      <Slot options={scoutPool} label="Blue 1" tint="blue" value={g.blue1} isLead={isLead} onChange={v => update(p => { const s = [...p.scoutGroups]; s[i] = { ...s[i], blue1: v }; return { ...p, scoutGroups: s } })} />
                      <Slot options={scoutPool} label="Blue 2" tint="blue" value={g.blue2} isLead={isLead} onChange={v => update(p => { const s = [...p.scoutGroups]; s[i] = { ...s[i], blue2: v }; return { ...p, scoutGroups: s } })} />
                    </div>
                    {/* Which matches this group covers, and when. */}
                    <div className="mt-2.5 pt-2 border-t border-gray-100 space-y-1.5">
                      {(() => {
                        const c = coverOf(g)
                        const setCover = (patch) => update(p => { const s = [...p.scoutGroups]; s[i] = { ...s[i], cover: { ...coverOf(s[i]), ...patch } }; return { ...p, scoutGroups: s } })
                        const field = 'text-xs border-b border-gray-200 focus:border-pastel-blue focus:outline-none py-0.5 bg-transparent'
                        if (!isLead) return <p className="text-xs text-gray-500"><span className="font-semibold text-gray-600">Covers:</span> {coverLabel(g, data)}</p>
                        return (
                          <>
                            <label className="flex items-center gap-2 text-xs">
                              <span className="font-semibold text-gray-500 shrink-0">Covers</span>
                              <select value={c.mode} onChange={e => setCover({ mode: e.target.value })} className={`${field} flex-1 min-w-0 text-gray-700`}>
                                {COVER_MODES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                              </select>
                            </label>
                            {c.mode === 'shift' && (
                              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                Match <input inputMode="numeric" value={c.from ?? ''} onChange={e => setCover({ from: e.target.value.replace(/\D/g, '') })} placeholder="1" className={`${field} w-10 text-center`} />
                                to <input inputMode="numeric" value={c.to ?? ''} onChange={e => setCover({ to: e.target.value.replace(/\D/g, '') })} placeholder="end" className={`${field} w-10 text-center`} />
                              </div>
                            )}
                            {c.mode === 'list' && (
                              <input value={c.list ?? ''} onChange={e => setCover({ list: e.target.value })} placeholder="e.g. 1-5, 9, 12" className={`${field} w-full`} />
                            )}
                            <div className="flex items-center gap-1.5 text-xs text-gray-500">
                              When <input type="time" value={c.start ?? ''} onChange={e => setCover({ start: e.target.value })} className={`${field} w-[5.5rem]`} />
                              – <input type="time" value={c.end ?? ''} onChange={e => setCover({ end: e.target.value })} className={`${field} w-[5.5rem]`} />
                              <span className="text-[10px] text-gray-400">optional</span>
                            </div>
                            <p className="text-[11px] text-gray-400">{coverLabel(g, data)}</p>
                          </>
                        )
                      })()}
                    </div>
                  </div>
                ))}
              </div>
              {(() => {
                // Matches nobody is scouting, and matches two groups both have.
                const by = groupsByMatch(data)
                const none = [...by.entries()].filter(([, gs]) => !gs.length).map(([m]) => m)
                const both = [...by.entries()].filter(([, gs]) => gs.length > 1).map(([m, gs]) => `${m} (${gs.map(x => x.name).join(' + ')})`)
                if (!none.length && !both.length) return null
                return (
                  <div className="text-xs rounded-lg border border-amber-200 bg-amber-50 text-amber-800 px-3 py-2 space-y-0.5">
                    {none.length > 0 && <p><b>Nobody covers</b> match{none.length === 1 ? '' : 'es'} {none.join(', ')}.</p>}
                    {both.length > 0 && <p><b>Two groups both cover</b> {both.join(', ')}.</p>}
                  </div>
                )
              })()}
              {isLead && (
                <button onClick={() => update(p => ({ ...p, scoutGroups: [...p.scoutGroups, { id: uid(), name: `Group ${p.scoutGroups.length + 1}`, head: '', red1: '', red2: '', blue1: '', blue2: '' }] }))} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-pastel-pink hover:bg-pastel-pink-dark text-gray-700"><Plus size={14} /> Add Group</button>
              )}
            </>
          )}

          {/* ---- MATCH SCHEDULE TAB ---- */}
          {tab === 'schedule' && (
            <>
              <p className="text-xs text-gray-400 mb-3">
                Who plays in each match. A team number fills in its name from the
                team list; anything not on the list still saves, it just shows as
                a number. This is what lets a scout's screen say which team they
                are watching rather than only which match.
              </p>
              <div className="space-y-2">
                {data.matchSchedule.map((row, i) => {
                  const set = (key, value) => update(p => {
                    const m = [...p.matchSchedule]; m[i] = { ...m[i], [key]: value }
                    return { ...p, matchSchedule: m }
                  })
                  const nameOf = (n) => (ALL_TEAMS.find(t => String(t.number) === String(n).trim()) || {}).name || ''
                  const cell = (key, label) => (
                    <div key={key} className="min-w-0">
                      <label className="block text-[10px] uppercase tracking-wide text-gray-400">{label}</label>
                      <input
                        value={row[key] || ''}
                        onChange={e => set(key, e.target.value)}
                        disabled={!isLead}
                        inputMode="numeric"
                        placeholder="—"
                        className="w-full text-sm border-b border-gray-200 focus:border-pastel-blue focus:outline-none disabled:bg-transparent"
                      />
                      <span className="block text-[10px] text-gray-400 truncate">{nameOf(row[key])}</span>
                    </div>
                  )
                  return (
                    <div key={row.id} className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="text-xs text-gray-400">Match</span>
                        <input
                          value={row.match || ''}
                          onChange={e => set('match', e.target.value)}
                          disabled={!isLead}
                          inputMode="numeric"
                          className="w-14 text-sm font-semibold border-b border-gray-200 focus:border-pastel-blue focus:outline-none disabled:bg-transparent"
                        />
                        {/* Which slot is ours. Writes our number into that slot
                            (and out of any other), so Drive mode knows the match
                            is ours even when no other team is typed yet. */}
                        {(() => {
                          const us = String(myTeamNumber || HOME_TEAM_NUMBER)
                          const mine = ['red1', 'red2', 'blue1', 'blue2'].find(k => String(row[k] || '').trim() === us) || ''
                          return (
                            <label className="flex items-center gap-1 text-xs text-gray-500 ml-1">
                              <span>We are</span>
                              <select
                                value={mine}
                                disabled={!isLead}
                                onChange={e => update(p => {
                                  const m = [...p.matchSchedule]; const r = { ...m[i] }
                                  ;['red1', 'red2', 'blue1', 'blue2'].forEach(k => { if (String(r[k] || '').trim() === us) r[k] = '' })
                                  if (e.target.value) r[e.target.value] = us
                                  m[i] = r; return { ...p, matchSchedule: m }
                                })}
                                className={`text-xs rounded-md border px-1.5 py-0.5 ${mine ? (mine.startsWith('red') ? 'border-red-300 bg-red-50 text-red-700' : 'border-blue-300 bg-blue-50 text-blue-700') : 'border-gray-200 bg-white text-gray-500'}`}
                              >
                                <option value="">not playing</option>
                                <option value="red1">Red 1</option>
                                <option value="red2">Red 2</option>
                                <option value="blue1">Blue 1</option>
                                <option value="blue2">Blue 2</option>
                              </select>
                            </label>
                          )
                        })()}
                        {isLead && (
                          <button
                            onClick={() => update(p => ({ ...p, matchSchedule: p.matchSchedule.filter(x => x.id !== row.id) }))}
                            className="ml-auto p-1 rounded hover:bg-red-50"
                          >
                            <Trash2 size={14} className="text-gray-300 hover:text-red-400" />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {cell('red1', 'Red 1')}
                        {cell('red2', 'Red 2')}
                        {cell('blue1', 'Blue 1')}
                        {cell('blue2', 'Blue 2')}
                      </div>
                    </div>
                  )
                })}
              </div>
              {isLead && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => update(p => {
                      const last = p.matchSchedule[p.matchSchedule.length - 1]
                      const next = last && /^\d+$/.test(String(last.match)) ? String(Number(last.match) + 1) : ''
                      return { ...p, matchSchedule: [...p.matchSchedule, { id: uid(), match: next, red1: '', red2: '', blue1: '', blue2: '' }] }
                    })}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-pastel-pink hover:bg-pastel-pink-dark text-gray-700"
                  >
                    <Plus size={14} /> Add Match
                  </button>
                  {/* No team numbers yet? The count is enough: scouts still know
                      they are Red 1 in match 7 and fill the team in on the day. */}
                  <label className="flex items-center gap-2 text-sm text-gray-600">
                    <span>or set up</span>
                    <input id="matchCount" type="number" min="1" max="200" defaultValue={Math.max(data.matchSchedule.length, 1)} className="w-16 px-2 py-1.5 rounded-lg border border-gray-200 text-sm text-center" />
                    <button
                      onClick={() => {
                        const n = Number(document.getElementById('matchCount')?.value || 0)
                        if (!n) return
                        update(p => {
                          const have = new Set(p.matchSchedule.map(m => String(m.match || '').trim()))
                          const fresh = []
                          for (let k = 1; k <= n; k++) if (!have.has(String(k))) fresh.push({ id: uid(), match: String(k), red1: '', red2: '', blue1: '', blue2: '' })
                          return { ...p, matchSchedule: [...p.matchSchedule, ...fresh].sort((a, b) => Number(a.match) - Number(b.match)) }
                        })
                      }}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-700"
                    >
                      matches, teams later
                    </button>
                  </label>
                </div>
              )}
            </>
          )}

          {/* ---- PIT TAB ---- */}
          {tab === 'pit' && (
            <>
              <p className="text-xs text-gray-400 mb-3">
                Each scout visits two pits. Type the team numbers next to each
                person; the people are the same ones scouting matches. A pit is
                visited once, so there is no match number.
              </p>
              {isLead && !pitPool.length && (
                <p className="text-xs text-gray-400 mb-3">
                  Nobody is on the <button onClick={() => setTab('roles')} className="font-semibold text-pastel-blue-dark hover:underline">Scouting role</button> yet, so there is nobody to give a pit to.
                </p>
              )}
              <div className="space-y-2">
                {pitPool.map(person => {
                  const mine = (data.pitTeams || []).filter(t => t.who === person)
                  // Two slots to fill, plus any extra a lead added.
                  const slots = Math.max(2, mine.length)
                  return (
                    <div key={person} className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 flex items-center gap-3 flex-wrap">
                      <div className="w-36 shrink-0 min-w-0">
                        <span className="block text-[10px] uppercase tracking-wide text-gray-400">Scout</span>
                        <span className="block text-sm font-semibold text-gray-800 truncate">{person}</span>
                      </div>
                      {Array.from({ length: slots }).map((_, k) => {
                        const row = mine[k]
                        return (
                          <div key={row ? row.id : `new-${k}`} className="w-28 shrink-0 min-w-0">
                            <label className="block text-[10px] uppercase tracking-wide text-gray-400">Team {k + 1}</label>
                            <input
                              value={row ? (row.team || '') : ''}
                              onChange={e => update(p => {
                                const t = [...(p.pitTeams || [])]
                                if (row) { const i = t.findIndex(x => x.id === row.id); t[i] = { ...t[i], team: e.target.value } }
                                else t.push({ id: uid(), team: e.target.value, who: person })
                                return { ...p, pitTeams: t }
                              })}
                              disabled={!isLead}
                              inputMode="numeric"
                              placeholder="—"
                              className="w-full text-sm font-semibold border-b border-gray-200 focus:border-pastel-blue focus:outline-none disabled:bg-transparent"
                            />
                            <span className="block text-[10px] text-gray-400 truncate">{row ? teamNameOf(row.team) : ''}</span>
                          </div>
                        )
                      })}
                      {isLead && (
                        <div className="flex items-center gap-1 ml-auto">
                          <button onClick={() => update(p => ({ ...p, pitTeams: [...(p.pitTeams || []), { id: uid(), team: '', who: person }] }))} className="p-1 rounded hover:bg-gray-100" title="One more pit for this scout"><Plus size={14} className="text-gray-400" /></button>
                          {mine.length > 0 && <button onClick={() => update(p => ({ ...p, pitTeams: (p.pitTeams || []).filter(x => x.who !== person) }))} className="p-1 rounded hover:bg-red-50" title="Clear this scout's pits"><Trash2 size={14} className="text-gray-300 hover:text-red-400" /></button>}
                        </div>
                      )}
                    </div>
                  )
                })}
                {(() => {
                  const loose = (data.pitTeams || []).filter(t => !pitPool.includes(t.who) && String(t.team || '').trim())
                  return loose.length ? (
                    <div className="bg-white rounded-xl p-3 shadow-sm border border-amber-100">
                      <p className="text-xs text-amber-700 font-semibold mb-2">Not given to anyone yet</p>
                      <div className="space-y-2">
                        {loose.map(row => (
                          <div key={row.id} className="flex items-center gap-3">
                            <span className="w-28 text-sm font-semibold text-gray-800">{row.team} <span className="block text-[10px] text-gray-400 font-normal truncate">{teamNameOf(row.team)}</span></span>
                            <div className="flex-1 min-w-0"><Slot label="Who" value={row.who} isLead={isLead} options={pitPool} onChange={v => update(p => { const t = [...p.pitTeams]; const i = t.findIndex(x => x.id === row.id); t[i] = { ...t[i], who: v }; return { ...p, pitTeams: t } })} /></div>
                            {isLead && <button onClick={() => update(p => ({ ...p, pitTeams: p.pitTeams.filter(x => x.id !== row.id) }))} className="p-1 rounded hover:bg-red-50 shrink-0" title="Remove"><Trash2 size={14} className="text-gray-300 hover:text-red-400" /></button>}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null
                })()}
                {!pitPool.length && !(data.pitTeams || []).length && <p className="text-sm text-gray-400 italic">No pit visits yet.</p>}
              </div>
              {isLead && (
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => update(p => {
                      // Every team on the match schedule not already listed, dealt
                      // two per scout in turn.
                      const have = new Set((p.pitTeams || []).map(t => String(t.team || '').trim()).filter(Boolean))
                      const fresh = []
                      ;(p.matchSchedule || []).forEach(m => ['red1', 'red2', 'blue1', 'blue2'].forEach(k => {
                        const t = String(m[k] || '').trim()
                        if (t && !have.has(t)) { have.add(t); fresh.push(t) }
                      }))
                      const kept = (p.pitTeams || []).filter(t => String(t.team || '').trim())
                      const load = {}; kept.forEach(t => { if (t.who) load[t.who] = (load[t.who] || 0) + 1 })
                      const rows = fresh.map(team => {
                        const who = pitPool.length ? pitPool.slice().sort((a, b) => (load[a] || 0) - (load[b] || 0))[0] : ''
                        if (who) load[who] = (load[who] || 0) + 1
                        return { id: uid(), team, who }
                      })
                      return { ...p, pitTeams: [...kept, ...rows] }
                    })}
                    title="Every team on the match schedule that is not listed yet, shared out so each scout has about two"
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-700"
                  >
                    <ClipboardList size={14} /> Fill from the match schedule
                  </button>
                  <button
                    onClick={() => update(p => { let k = 0; const rows = (p.pitTeams || []).filter(t => String(t.team || '').trim()); return { ...p, pitTeams: rows.map(t => ({ ...t, who: pitPool[k++ % pitPool.length] })) } })}
                    disabled={!pitPool.length || !(data.pitTeams || []).some(t => String(t.team || '').trim())}
                    title={pitPool.length ? 'Deal the pits out evenly, in turn, to the scouts' : 'Put people on the Scouting role first'}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-pastel-yellow hover:bg-pastel-yellow-dark text-gray-800 disabled:bg-gray-100 disabled:text-gray-400"
                  >
                    <Shuffle size={14} /> Share out evenly
                  </button>
                </div>
              )}
            </>
          )}

        </div>
      </main>
    </div>
  )
}
