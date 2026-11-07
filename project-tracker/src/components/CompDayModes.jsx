import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { Wrench, Gamepad2, Camera, Search, CheckCircle2, AlertTriangle, Plus, Upload, Flag, Trash2, MessageCircle, ChevronDown, CalendarDays, Megaphone } from 'lucide-react'
import { useUser } from '../contexts/UserContext'
import { usePermissions } from '../hooks/usePermissions'
import { restHeaders, ensureUserToken } from '../lib/restHeaders'
import { storedTeamScope, stampStored } from '../lib/teamScope'
import { uploadImageFile } from '../lib/photos'
import { HOME_TEAM_NUMBER } from '../data/team'
import PitChecklist from './PitChecklist'
import { daySince } from '../lib/dayRota'
import { SCOUTING_FIELDS } from '../data/scoutingFields'

// The four ways to spend a Competition Day. The board shows one at a time:
//
//   Scout   what you're scouting and how the day is going (the original board)
//   Media   the shot list, and the photos going up as they're taken
//   Pit     is the robot ready, what's broken, the pre-match checklist
//   Drive   our next match, who we're with and against, what scouting says
//
// Your role for the current block picks the mode you land on; anyone can
// switch. What a mode writes (a status, an issue, a note, a shot ticked) goes
// to comp_day_notes so every phone on the day sees it.

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const MODES = [
  { id: 'scout', label: 'Scout', icon: Search,   tint: 'bg-blue-500' },
  { id: 'media', label: 'Media', icon: Camera,   tint: 'bg-pink-500' },
  { id: 'pit',   label: 'Pit',   icon: Wrench,   tint: 'bg-orange-500' },
  { id: 'drive', label: 'Drive', icon: Gamepad2, tint: 'bg-purple-500' },
]
const ROLE_MODE = { scouting: 'scout', 'pit-crew': 'pit', 'drive-team': 'drive', spirit: 'media', strategy: 'drive', safety: 'pit' }
const ROLE_LABEL = { scouting: 'Scouting', 'pit-crew': 'Pit Crew', 'drive-team': 'Drive Team', spirit: 'Spirit', strategy: 'Strategy', safety: 'Safety' }
const MODE_LS = 'comp-day-mode'

// One tab per role you hold today, named after the role. Two roles, two
// tabs. One role, no bar at all. Leads see every mode, with their own role
// (if any) as the one they land on.
export function ModeBar({ mode, onChange, tabs }) {
  const shown = tabs || []
  if (shown.length < 2) return null
  return (
    <div className={`grid gap-1.5 bg-white/80 backdrop-blur-sm rounded-xl shadow-sm p-1.5`} style={{ gridTemplateColumns: `repeat(${shown.length}, minmax(0, 1fr))` }}>
      {shown.map(({ id, label, icon: Icon, tint }) => {
        const on = mode === id
        return (
          <button key={id} type="button" onClick={() => onChange(id)}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold transition-colors ${
              on ? `${tint} text-white shadow` : 'text-gray-600 hover:bg-gray-100'}`}>
            <Icon size={16} /> <span className="truncate">{label}</span>
          </button>
        )
      })}
    </div>
  )
}

// Which mode to land on: the role you were given for this day's current
// block, else the one you used last, else Scout.
export function useDefaultMode(day) {
  const { username } = useUser()
  const { hasLeadTag, isCofounder } = usePermissions()
  const seesAll = !!(hasLeadTag || isCofounder)
  const [mode, setModeState] = useState(() => {
    try { return localStorage.getItem(MODE_LS) || null } catch { return null }
  })
  const [fromRole, setFromRole] = useState(null)
  const [roles, setRoles] = useState([])      // every role you hold on this day, any block
  useEffect(() => {
    if (!day?.id || !username) return
    let on = true
    ;(async () => {
      try {
        await ensureUserToken()
        const scope = storedTeamScope()
        const [aRes, bRes] = await Promise.all([
          fetch(`${supabaseUrl}/rest/v1/comp_day_assignments?${scope}&session_id=eq.${encodeURIComponent(day.id)}&username=eq.${encodeURIComponent(username)}&select=role,block_id`, { headers: restHeaders() }),
          fetch(`${supabaseUrl}/rest/v1/comp_day_blocks?${scope}&session_id=eq.${encodeURIComponent(day.id)}&order=order_index.asc&select=id,is_active`, { headers: restHeaders() }),
        ])
        const assigns = aRes.ok ? await aRes.json() : []
        const blocks = bRes.ok ? await bRes.json() : []
        if (!on || !Array.isArray(assigns) || !assigns.length) return
        const active = (blocks || []).find(b => b.is_active)
        const pick = (active && assigns.find(a => a.block_id === active.id)) || assigns[0]
        if (pick && ROLE_MODE[pick.role]) setFromRole(ROLE_MODE[pick.role])
        setRoles([...new Set(assigns.map(a => a.role).filter(r => ROLE_MODE[r]))])
      } catch { /* fall back to the last-used mode */ }
    })()
    return () => { on = false }
  }, [day?.id, username])
  const setMode = (m) => { setModeState(m); try { localStorage.setItem(MODE_LS, m) } catch { /* ignore */ } }
  // The tabs: one per mode your roles reach, named after the role(s).
  const tabs = useMemo(() => {
    // Leads get every mode; a role of theirs names its tab.
    if (seesAll) return MODES.map(m => { const rs = roles.filter(r => ROLE_MODE[r] === m.id); return { ...m, label: rs.length ? rs.map(r => ROLE_LABEL[r]).join(' / ') : m.label } })
    // Everyone else gets only the modes their roles reach. No role: Scout.
    if (!roles.length) return [MODES[0]]
    return MODES.filter(m => roles.some(r => ROLE_MODE[r] === m.id))
      .map(m => ({ ...m, label: roles.filter(r => ROLE_MODE[r] === m.id).map(r => ROLE_LABEL[r]).join(' / ') }))
  }, [roles, seesAll])
  // A role only sets the mode until you choose one yourself; a saved choice
  // that isn't one of your tabs today falls back to your role.
  const allowed = tabs.map(t => t.id)
  const chosen = (mode && allowed.includes(mode)) ? mode : (fromRole && allowed.includes(fromRole) ? fromRole : allowed[0] || 'scout')
  return { mode: chosen, setMode, tabs }
}

// ── Shared notes for the day ───────────────────────────────────────────────
function useDayNotes(sessionId) {
  const [notes, setNotes] = useState([])
  const load = useCallback(async () => {
    if (!sessionId) return
    try {
      await ensureUserToken()
      const res = await fetch(`${supabaseUrl}/rest/v1/comp_day_notes?${storedTeamScope()}&session_id=eq.${encodeURIComponent(sessionId)}&order=created_at.asc&limit=500`, { headers: restHeaders() })
      if (res.ok) setNotes(await res.json())
    } catch { /* next poll */ }
  }, [sessionId])
  useEffect(() => {
    load()
    const t = setInterval(() => { if (document.visibilityState === 'visible') load() }, 10000)
    return () => clearInterval(t)
  }, [load])
  const add = async (row) => {
    if (!sessionId) return
    await fetch(`${supabaseUrl}/rest/v1/comp_day_notes`, {
      method: 'POST', headers: restHeaders({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
      body: JSON.stringify(stampStored({ session_id: sessionId, ...row })),
    })
    load()
  }
  const patch = async (id, data) => {
    await fetch(`${supabaseUrl}/rest/v1/comp_day_notes?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH', headers: restHeaders({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
      body: JSON.stringify(data),
    })
    load()
  }
  const remove = async (id) => {
    await fetch(`${supabaseUrl}/rest/v1/comp_day_notes?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE', headers: restHeaders({ Prefer: 'return=minimal' }) })
    load()
  }
  return { notes, add, patch, remove, reload: load }
}

// ── Our matches, from the day's schedule ───────────────────────────────────
const SLOTS = [['red1', 'Red 1', 'red'], ['red2', 'Red 2', 'red'], ['blue1', 'Blue 1', 'blue'], ['blue2', 'Blue 2', 'blue']]
// Our matches. When our number sits in a slot, that match is ours and we
// know the colour, partners and opponents. When no match is marked yet, the
// whole schedule is shown the way the scouts see it — every match by number,
// slot not set — so Drive is never blank on a day the scouts can work.
function ourMatches(doc, team) {
  const rows = [...(doc?.matchSchedule || [])].filter(m => String(m.match || '').trim())
    .sort((a, b) => Number(a.match) - Number(b.match))
  const out = []
  rows.forEach(m => {
    const slot = SLOTS.find(([k]) => String(m[k] || '').trim() === String(team))
    if (!slot) return
    const [, label, color] = slot
    const partner = SLOTS.filter(([k, , c]) => c === color && String(m[k] || '').trim() !== String(team)).map(([k]) => String(m[k] || '').trim()).filter(Boolean)
    const opponents = SLOTS.filter(([, , c]) => c !== color).map(([k]) => String(m[k] || '').trim()).filter(Boolean)
    out.push({ match: String(m.match).trim(), position: label, color, partner, opponents, time: m.time || m.start || '' })
  })
  if (out.length) return out
  return rows.map(m => ({
    match: String(m.match).trim(), position: 'slot not set', color: 'none', untagged: true,
    partner: [], opponents: SLOTS.map(([k]) => String(m[k] || '').trim()).filter(Boolean), time: m.time || m.start || '',
  }))
}

// What scouting says about each team so far today: every row, and the two
// things the drive team asked to see first — how accurately they shoot, and
// what their auto does.
// Leave and Park are stored as 1/0; older rows may say Yes/No.
const yes = (v) => v === true || v === 1 || /^(yes|y|true|1)$/i.test(String(v ?? '').trim())
const num = (v) => { const n = Number(v); return v === '' || v == null || Number.isNaN(n) ? null : n }
function useTeamStats(teams, since) {
  const key = teams.slice().sort().join(',')
  const [rows, setRows] = useState([])
  useEffect(() => {
    let on = true
    // Every row of the day, not just the scheduled teams': which matches have
    // started being scouted is read from these too.
    const load = async () => {
      try {
        await ensureUserToken()
        const res = await fetch(`${supabaseUrl}/rest/v1/match_scouting?${storedTeamScope('owner_team')}${since ? `&created_at=gte.${encodeURIComponent(since)}` : ''}&select=*&order=created_at.desc&limit=2000`, { headers: restHeaders() })
        if (on && res.ok) setRows(await res.json())
      } catch { /* leave what we had */ }
    }
    load()
    // Live: new scouting shows up through the day without a reload.
    const t = setInterval(() => { if (document.visibilityState === 'visible') load() }, 20000)
    return () => { on = false; clearInterval(t) }
  }, [key, since])
  return useMemo(() => {
    const by = {}
    rows.forEach(r => { (by[String(r.team_number)] = by[String(r.team_number)] || []).push(r) })
    const sum = (xs, k) => xs.reduce((a, x) => a + (num(x[k]) || 0), 0)
    const pct = (made, shot) => (shot > 0 ? Math.round((made / shot) * 100) : null)
    const share = (xs, f) => (xs.length ? Math.round((xs.filter(f).length / xs.length) * 100) : null)
    const avg = (xs, k) => { const v = xs.map(x => num(x[k])).filter(n => n != null); return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null }
    const out = {}
    // Every row, for working out which matches have started being scouted.
    Object.defineProperty(out, 'all', { value: rows })
    Object.entries(by).forEach(([t, xs]) => {
      const aS = sum(xs, 'auto_shot'), aM = sum(xs, 'auto_made')
      const tS = sum(xs, 'teleop_shot'), tM = sum(xs, 'teleop_made')
      const eS = sum(xs, 'endgame_shot'), eM = sum(xs, 'endgame_made')
      out[t] = {
        n: xs.length, rows: xs,
        accuracy: pct(aM + tM + eM, aS + tS + eS), made: aM + tM + eM, shot: aS + tS + eS,
        autoAcc: pct(aM, aS), teleopAcc: pct(tM, tS), endgameAcc: pct(eM, eS),
        autoMade: avg(xs, 'auto_made'), autoShot: avg(xs, 'auto_shot'),
        leave: share(xs, x => yes(x.auto_leave)), park: share(xs, x => yes(x.auto_park)),
        autoReliability: avg(xs, 'auto_reliability'),
        autoNotes: xs.map(x => String(x.auto_notes || '').trim()).filter(Boolean).slice(0, 3),
      }
    })
    return out
  }, [rows])
}

// ── Drive Team ──────────────────────────────────────────────────────────────
// Two columns. Left, the schedule with our number lit up. Right, what the drive
// team asked for first — shooting accuracy and auto for the four teams in the
// next match — and that match's chat. "Next" is worked out from scouting: the
// first match nobody has sent a scouting entry for yet. Once match 4 has any
// row in, the stats move on to the teams in match 5.
function DriveMode({ day, doc }) {
  const { username, teamNumber } = useUser()
  const team = String(teamNumber || HOME_TEAM_NUMBER)
  const { notes, add } = useDayNotes(day?.id)
  const schedule = useMemo(() => [...(doc?.matchSchedule || [])].filter(m => String(m.match || '').trim())
    .sort((a, b) => Number(a.match) - Number(b.match)), [doc])
  const idOf = (m) => String(m.match).trim()
  const teamsIn = (m) => SLOTS.map(([k, label, color]) => ({ t: String(m[k] || '').trim(), label, color })).filter(x => x.t)
  const isOurs = (m) => teamsIn(m).some(x => x.t === team)
  const teams = useMemo(() => [...new Set(schedule.flatMap(m => SLOTS.map(([k]) => String(m[k] || '').trim())).filter(Boolean))], [schedule])
  const stats = useTeamStats(teams, daySince(day))
  // A match has started being scouted once a row is in for it — and, when its
  // teams are on the schedule, for one of those teams, so a row about another
  // event's match 4 does not count as ours.
  const scouted = useMemo(() => {
    const done = new Set()
    const all = stats.all || []
    schedule.forEach(m => {
      const id = idOf(m), ts = teamsIn(m).map(x => x.t)
      if (all.some(r => String(r.match_number ?? '').trim() === id && (!ts.length || ts.includes(String(r.team_number ?? '').trim())))) done.add(id)
    })
    return done
  }, [stats, schedule]) // eslint-disable-line
  const nextMatch = schedule.find(m => !scouted.has(idOf(m))) || null
  const ourNext = schedule.find(m => isOurs(m) && !scouted.has(idOf(m))) || null
  const [pickedMatch, setPickedMatch] = useState(null)
  const [pickedTeam, setPickedTeam] = useState(null)
  const [showAll, setShowAll] = useState(false)
  // The schedule folds up to just the next match, so it never runs the page
  // long; open, it scrolls inside a box as tall as the right column.
  const [schedOpen, setSchedOpen] = useState(true)
  const nextRowRef = useRef(null)
  // Arrows at the top and bottom of the list once there is more that way.
  const listRef = useRef(null)
  const [edges, setEdges] = useState({ up: false, down: false })
  const measure = () => {
    const el = listRef.current
    if (!el) return
    setEdges({ up: el.scrollTop > 4, down: el.scrollTop + el.clientHeight < el.scrollHeight - 4 })
  }
  const nudge = (dir) => listRef.current?.scrollBy({ top: dir * Math.max(120, (listRef.current.clientHeight || 300) * 0.6), behavior: 'smooth' })
  useEffect(() => {
    // Start the list at the next match, and recheck which arrows show.
    const row = nextRowRef.current, el = listRef.current
    if (row && el) el.scrollTop = Math.max(0, row.offsetTop - 28)
    measure()
  }, [nextMatch && nextMatch.match, schedOpen, schedule.length]) // eslint-disable-line
  const focus = (pickedMatch && schedule.find(m => idOf(m) === pickedMatch)) || nextMatch
  const chatMatch = focus ? idOf(focus) : null
  const pick = (t) => { setPickedTeam(pickedTeam === t ? null : t); setShowAll(false) }

  if (!doc) return <Card title="Drive Team" icon={Gamepad2}><Empty>Loading the day…</Empty></Card>
  if (!schedule.length) return <Card title="Drive Team" icon={Gamepad2}><Empty>No matches in this day's schedule yet. A lead sets them up under Competition Day → Matches.</Empty></Card>

  const teamBtn = (t, color, small) => {
    const us = t === team
    return (
      <button type="button" onClick={() => pick(t)} title={`Team ${t}: all its scouting`}
        className={`${small ? 'w-full min-w-[3.25rem] px-1.5 py-1 text-xs' : 'px-2 py-1 text-sm'} rounded-md font-bold border transition-colors ${
          us ? 'bg-pastel-yellow-dark border-yellow-500 text-gray-900 ring-2 ring-yellow-400'
          : pickedTeam === t ? 'bg-gray-800 border-gray-800 text-white'
          : color === 'red' ? 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'
          : 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'}`}>
        {t}{us ? ' ★' : ''}
      </button>
    )
  }
  const s = pickedTeam ? stats[pickedTeam] : null

  return (
    <div className="grid md:grid-cols-2 gap-4 items-start">
      {/* LEFT — the schedule. On a wide screen it sits in a box pinned to the
          right column's height (absolute, so it never makes the row taller),
          and the list scrolls inside it. */}
      <div className="md:relative md:self-stretch md:min-h-[18rem]">
      <section className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm p-4 flex flex-col md:absolute md:inset-0">
        <button type="button" onClick={() => setSchedOpen(!schedOpen)}
          className="flex items-center justify-between gap-2 mb-2 w-full text-left">
          <h2 className="font-semibold text-gray-800 flex items-center gap-1.5 text-sm">
            <CalendarDays size={15} className="text-pastel-yellow-dark" />Match schedule
            <span className="text-xs font-normal text-gray-400">· {schedule.length} matches</span>
          </h2>
          <span className="flex items-center gap-1 text-xs text-gray-400">{schedOpen ? 'hide' : 'show all'}<ChevronDown size={14} className={`transition-transform ${schedOpen ? 'rotate-180' : ''}`} /></span>
        </button>
        <div className={`relative -mx-1 min-h-0 flex flex-col ${schedOpen ? 'flex-1' : ''}`}>
        {schedOpen && edges.up && (
          <button type="button" onClick={() => nudge(-1)} title="Earlier matches"
            className="absolute top-6 left-1/2 -translate-x-1/2 z-10 w-8 h-8 rounded-full bg-white shadow-md border border-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-800">
            <ChevronDown size={18} className="rotate-180" />
          </button>
        )}
        <div ref={listRef} onScroll={measure} className={`overflow-auto min-h-0 ${schedOpen ? 'flex-1 max-h-80 md:max-h-none' : ''}`}>
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white/95">
              <tr className="text-[11px] text-gray-400 text-left">
                <th className="font-medium px-1 py-1">Match</th>
                <th className="font-medium px-1 py-1 text-red-500" colSpan={2}>Red</th>
                <th className="font-medium px-1 py-1 text-blue-500" colSpan={2}>Blue</th>
              </tr>
            </thead>
            <tbody>
              {(schedOpen ? schedule : schedule.filter(m => nextMatch && idOf(m) === idOf(nextMatch))).map(m => {
                const id = idOf(m)
                const mine = isOurs(m)
                const done = scouted.has(id)
                const isNext = nextMatch && idOf(nextMatch) === id
                return (
                  <tr key={id} ref={isNext ? nextRowRef : undefined} className={`border-t border-gray-100 ${isNext ? 'bg-purple-50' : mine ? 'bg-pastel-yellow/30' : ''} ${done && !isNext ? 'opacity-55' : ''}`}>
                    <td className="px-1 py-1.5">
                      <button type="button" onClick={() => setPickedMatch(id === (nextMatch && idOf(nextMatch)) ? null : id)} title="Show this match's teams and chat"
                        className={`px-2 py-0.5 rounded-md text-xs font-bold ${chatMatch === id ? 'bg-purple-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-purple-100'}`}>
                        M{id}
                      </button>
                      {isNext && <span className="block text-[10px] font-bold text-purple-500 mt-0.5">NEXT</span>}
                      {!isNext && ourNext && idOf(ourNext) === id && <span className="block text-[10px] font-bold text-pastel-yellow-dark mt-0.5">OURS</span>}
                    </td>
                    {SLOTS.map(([k, , color]) => {
                      const t = String(m[k] || '').trim()
                      return <td key={k} className="px-0.5 py-1.5">{t ? teamBtn(t, color, true) : <span className="block text-center text-xs text-gray-300">—</span>}</td>
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {schedOpen && edges.down && (
          <button type="button" onClick={() => nudge(1)} title="Later matches"
            className="absolute bottom-1 left-1/2 -translate-x-1/2 z-10 w-8 h-8 rounded-full bg-white shadow-md border border-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-800">
            <ChevronDown size={18} />
          </button>
        )}
        </div>
        <p className="text-[11px] text-gray-400 mt-2 shrink-0">★ is us ({team}), our matches are gold. NEXT is the first match with no scouting in yet. Tap a team for all its data.</p>
      </section>
      </div>

      {/* RIGHT — the four teams in the next match, then its chat */}
      <div className="space-y-4 min-w-0">
        {pickedTeam ? (
          <Card title={`Team ${pickedTeam}${pickedTeam === team ? ' (us)' : ''}`} icon={Search}
                action={<button type="button" onClick={() => setPickedTeam(null)} className="text-xs text-purple-500 underline">back to match {chatMatch}</button>}>
            {!s ? <Empty>Not scouted yet today.</Empty> : (
              <div className="space-y-2">
                <p className="text-sm text-gray-700"><b>🎯 {s.accuracy ?? '–'}%</b> accuracy ({s.made}/{s.shot}) · <b>🤖 auto {s.autoMade ?? '–'}</b> in of {s.autoShot ?? '–'} · leaves {s.leave ?? '–'}% · parks {s.park ?? '–'}%</p>
                {s.autoNotes.map((n, i) => <p key={i} className="text-xs italic text-gray-500">“{n}”</p>)}
                <button type="button" onClick={() => setShowAll(!showAll)}
                  className="w-full flex items-center justify-center gap-1 text-xs font-semibold text-gray-500 py-1.5 rounded-lg border border-gray-200 hover:bg-white">
                  {showAll ? 'Hide' : 'See'} all scouting data ({s.n}) <ChevronDown size={13} className={showAll ? 'rotate-180' : ''} />
                </button>
                {showAll && s.rows.map((r, i) => (
                  <div key={r.id || i} className="rounded-lg bg-white/80 border border-gray-100 p-2.5 text-xs text-gray-600">
                    <p className="font-bold text-gray-800 mb-1">Match {r.match_number || '?'}{r.scout ? <span className="font-normal text-gray-400"> · {r.scout}</span> : null}</p>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                      {SCOUTING_FIELDS.filter(f => r[f.key] != null && String(r[f.key]).trim() !== '' && !['team_number', 'match_number', 'scout'].includes(f.key)).map(f => (
                        <p key={f.key} className={f.type === 'text' ? 'col-span-2' : ''}>
                          <span className="text-gray-400">{f.label}:</span> {Array.isArray(r[f.key]) ? r[f.key].join(', ') : String(r[f.key])}
                        </p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        ) : focus ? (
          <Card title={`Match ${chatMatch}${focus === nextMatch ? ' · next up' : ''}`} icon={Search}
                action={pickedMatch ? <button type="button" onClick={() => setPickedMatch(null)} className="text-xs text-purple-500 underline">back to next</button> : null}>
            <div className="space-y-2">
              {teamsIn(focus).map(({ t, label, color }) => {
                const ts = stats[t]
                return (
                  <div key={label} className={`rounded-xl border p-2.5 ${color === 'red' ? 'border-red-200 bg-red-50/60' : 'border-blue-200 bg-blue-50/60'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {teamBtn(t, color)}
                        <span className="text-[11px] text-gray-400">{label}</span>
                      </div>
                      <button type="button" onClick={() => pick(t)} className="text-[11px] font-semibold text-gray-500 underline">all data</button>
                    </div>
                    {ts ? (
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <div className="rounded-lg bg-white/80 px-2 py-1.5">
                          <p className="text-lg font-extrabold text-gray-800 leading-tight">{ts.accuracy != null ? `${ts.accuracy}%` : '–'}</p>
                          <p className="text-[11px] text-gray-500">🎯 accuracy · {ts.made}/{ts.shot}</p>
                        </div>
                        <div className="rounded-lg bg-white/80 px-2 py-1.5">
                          <p className="text-lg font-extrabold text-gray-800 leading-tight">{ts.autoMade ?? '–'} <span className="text-xs font-semibold text-gray-500">in auto</span></p>
                          <p className="text-[11px] text-gray-500">🤖 leaves {ts.leave ?? '–'}% · parks {ts.park ?? '–'}%</p>
                        </div>
                        {ts.autoNotes[0] && <p className="col-span-2 text-[11px] italic text-gray-500">“{ts.autoNotes[0]}”</p>}
                      </div>
                    ) : <p className="text-xs text-gray-400 mt-1.5">Not scouted yet today.</p>}
                  </div>
                )
              })}
              {!teamsIn(focus).length && <Empty>No team numbers typed for this match yet.</Empty>}
            </div>
          </Card>
        ) : (
          <Card title="Drive Team" icon={Gamepad2}><Empty>Every match on the schedule has scouting in. That's the day.</Empty></Card>
        )}

        {(() => {
          // Our match to talk about: the one in focus if we're in it, else our next.
          const m = (focus && isOurs(focus)) ? focus : ourNext
          if (!m) return <Card title="Talk strategy with your alliance partner" icon={MessageCircle}><Empty>None of our matches are left to play.</Empty></Card>
          const ourColor = teamsIn(m).find(x => x.t === team)?.color
          const partner = teamsIn(m).find(x => x.color === ourColor && x.t !== team)?.t
          if (!partner) return <Card title={`Talk strategy with your alliance partner · match ${idOf(m)}`} icon={MessageCircle}><Empty>Our partner for match {idOf(m)} isn't on the schedule yet.</Empty></Card>
          return <AllianceChat key={`${idOf(m)}-${partner}`} match={idOf(m)} us={team} partner={partner} />
        })()}
        <ToScoutsComposer day={day} />
      </div>
    </div>
  )
}

// ── Alliance chat ───────────────────────────────────────────────────────────
// Strategy with the partner in one match. The only thing two teams share: the
// rows live in alliance_chat, and the database lets only the two teams on that
// alliance read or write them — opponents and everyone else see nothing. A
// partner who isn't on ETS can't see it yet, and the card says so.
const localYmd = () => { const d = new Date(); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` }
function AllianceChat({ match, us, partner }) {
  const { username } = useUser()
  const [msgs, setMsgs] = useState([])
  const [state, setState] = useState('loading') // loading | ok | missing
  const [onEts, setOnEts] = useState(null)
  const [text, setText] = useState('')
  const pair = [String(us), String(partner)].sort()
  const where = `event_date=eq.${localYmd()}&match=eq.${encodeURIComponent(match)}&team_a=eq.${encodeURIComponent(pair[0])}&team_b=eq.${encodeURIComponent(pair[1])}`
  const load = useCallback(async () => {
    try {
      await ensureUserToken()
      const res = await fetch(`${supabaseUrl}/rest/v1/alliance_chat?${where}&select=*&order=created_at.asc&limit=300`, { headers: restHeaders() })
      if (res.status === 404) { setState('missing'); return }
      if (res.ok) { setMsgs(await res.json()); setState('ok') }
    } catch { /* next poll */ }
  }, [where])
  useEffect(() => {
    setMsgs([]); setState('loading'); load()
    const t = setInterval(() => { if (document.visibilityState === 'visible') load() }, 8000)
    return () => clearInterval(t)
  }, [load])
  useEffect(() => {
    let on = true
    setOnEts(null)
    ;(async () => {
      try {
        const res = await fetch(`${supabaseUrl}/rest/v1/rpc/team_on_ets`, {
          method: 'POST', headers: restHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ t: String(partner) }),
        })
        if (on && res.ok) setOnEts(!!(await res.json()))
      } catch { /* unknown */ }
    })()
    return () => { on = false }
  }, [partner])
  const send = async (e) => {
    e.preventDefault()
    const body = text.trim()
    if (!body) return
    setText('')
    await fetch(`${supabaseUrl}/rest/v1/alliance_chat`, {
      method: 'POST', headers: restHeaders({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
      body: JSON.stringify({ event_date: localYmd(), match: String(match), team_a: pair[0], team_b: pair[1], from_team: String(us), author: username || '', body }),
    }).catch(() => {})
    load()
  }
  return (
    <Card title={`Talk strategy with your alliance partner · match ${match}`} icon={MessageCircle}>
      <p className="text-xs text-gray-500 -mt-1 mb-2">With <b>team {partner}</b>. Only your two teams can see this.</p>
      {onEts === false && (
        <p className="text-[11px] bg-amber-50 text-amber-800 border border-amber-200 rounded-lg px-2 py-1 mb-2">Team {partner} isn't on ETS, so they can't see this yet. Only your team will.</p>
      )}
      {state === 'missing' ? <Empty>Alliance chat is being set up. It will appear here once it's switched on.</Empty> : (
        <>
          <div className="space-y-1.5 mb-2 max-h-56 overflow-y-auto">
            {msgs.length ? msgs.map(n => {
              const ours = String(n.from_team) === String(us)
              return (
                <div key={n.id} className={`text-sm rounded-lg px-2.5 py-1.5 ${ours ? 'bg-purple-50 ml-6' : 'bg-white/80 mr-6 border border-gray-100'}`}>
                  <span className="font-semibold text-gray-700">{n.author || 'someone'} <span className="text-[10px] font-bold text-gray-400">· {n.from_team}</span>:</span> {n.body}
                  <span className="text-[10px] text-gray-400 ml-1">{new Date(n.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                </div>
              )
            }) : <Empty>Nothing yet. Who scores where, who plays defense, what each auto does.</Empty>}
          </div>
          <form onSubmit={send} className="flex gap-2">
            <input value={text} onChange={e => setText(e.target.value)} maxLength={500} placeholder={`Message team ${partner}…`}
                   className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" />
            <button className="px-3 py-2 rounded-lg bg-purple-500 text-white text-sm font-semibold">Send</button>
          </form>
        </>
      )}
    </Card>
  )
}

// ── Drive → scouts ──────────────────────────────────────────────────────────
// The drive team's line to the scouts: "watch 16460's auto", "we need defense
// notes on match 7". Written in Drive, shown at the top of the Scout board on
// every scout's phone, newest first. Kept in comp_day_notes like the chat, so
// it is this team's and this day's only.
const ago = (iso) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}
function ToScoutsComposer({ day }) {
  const { username } = useUser()
  const { notes, add, remove } = useDayNotes(day?.id)
  const [text, setText] = useState('')
  const sent = notes.filter(n => n.kind === 'to-scouts').slice().reverse()
  return (
    <Card title="Tell the scouts" icon={Megaphone}>
      <form onSubmit={(e) => { e.preventDefault(); if (!text.trim()) return; add({ kind: 'to-scouts', body: text.trim(), author: username }); setText('') }} className="flex gap-2">
        <input value={text} onChange={e => setText(e.target.value)} maxLength={300} placeholder="e.g. Watch 16460's auto in match 7"
               className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
        <button className="px-3 py-2 rounded-lg bg-blue-500 text-white text-sm font-semibold">Send</button>
      </form>
      <p className="text-[11px] text-gray-400 mt-1">Shows at the top of every scout's board straight away.</p>
      {sent.length > 0 && (
        <div className="space-y-1 mt-2 max-h-32 overflow-y-auto">
          {sent.map(n => (
            <div key={n.id} className="flex items-start gap-2 text-xs bg-blue-50 rounded-lg px-2 py-1.5">
              <span className="flex-1 text-gray-700">{n.body} <span className="text-gray-400">· {n.author} · {ago(n.created_at)}</span></span>
              {n.author === username && <button type="button" onClick={() => remove(n.id)} title="Take it back" className="text-gray-300 hover:text-red-400"><Trash2 size={12} /></button>}
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

// What the scouts see: the drive team's messages, newest first.
export function ScoutAnnouncements({ day }) {
  const { notes } = useDayNotes(day?.id)
  const msgs = notes.filter(n => n.kind === 'to-scouts').slice().reverse()
  if (!msgs.length) return null
  return (
    <section className="rounded-xl shadow-sm border-2 border-blue-300 bg-blue-50/90 p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-blue-700 flex items-center gap-1.5"><Megaphone size={14} /> From the drive team</p>
      <div className="mt-1.5 space-y-1 max-h-36 overflow-y-auto">
        {msgs.map((n, i) => (
          <p key={n.id} className={`text-sm ${i === 0 ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
            {n.body} <span className="text-[11px] font-normal text-gray-400">· {n.author} · {ago(n.created_at)}</span>
          </p>
        ))}
      </div>
    </section>
  )
}

// ── Pit ─────────────────────────────────────────────────────────────────────
const STATUSES = [
  { id: 'ready', label: 'Ready', cls: 'bg-green-500', soft: 'bg-green-50 text-green-700 border-green-200' },
  { id: 'fixing', label: 'Being fixed', cls: 'bg-amber-500', soft: 'bg-amber-50 text-amber-700 border-amber-200' },
  { id: 'down', label: 'Down', cls: 'bg-red-500', soft: 'bg-red-50 text-red-700 border-red-200' },
]
function PitMode({ day, doc }) {
  const { username, teamNumber } = useUser()
  const team = teamNumber || HOME_TEAM_NUMBER
  const { notes, add, patch, remove } = useDayNotes(day?.id)
  const status = [...notes].reverse().find(n => n.kind === 'status')
  const st = STATUSES.find(s => s.id === status?.body) || null
  const issues = notes.filter(n => n.kind === 'issue')
  const open = issues.filter(n => !n.data?.fixed)
  const matches = useMemo(() => ourMatches(doc, team), [doc, team])
  const played = useMemo(() => new Set(notes.filter(n => n.kind === 'played').map(n => n.match)), [notes])
  const next = matches.find(m => !played.has(m.match)) || null
  const [issue, setIssue] = useState('')
  return (
    <div className="space-y-4">
      <Card title="Robot status" icon={Wrench}
            action={status ? <span className="text-xs text-gray-400">{status.author} · {new Date(status.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span> : null}>
        <div className="grid grid-cols-3 gap-2">
          {STATUSES.map(s => (
            <button key={s.id} type="button" onClick={() => add({ kind: 'status', body: s.id, author: username })}
              className={`rounded-xl py-3 text-sm font-bold border transition-all ${st?.id === s.id ? `${s.cls} text-white border-transparent shadow` : `${s.soft} hover:shadow-sm`}`}>
              {s.label}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-gray-400 mt-2">Everyone on the day sees this. {next ? `Next up: match ${next.match}, ${next.position}.` : ''}</p>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card title={`Issues ${open.length ? `· ${open.length} open` : ''}`} icon={AlertTriangle}>
          <form onSubmit={(e) => { e.preventDefault(); if (!issue.trim()) return; add({ kind: 'issue', body: issue.trim(), author: username, match: next?.match || null }); setIssue('') }} className="flex gap-2 mb-2">
            <input value={issue} onChange={e => setIssue(e.target.value)} maxLength={200} placeholder="What's broken or loose…"
                   className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
            <button className="px-3 py-2 rounded-lg bg-orange-500 text-white text-sm font-semibold"><Plus size={16} /></button>
          </form>
          <ul className="space-y-1.5 max-h-64 overflow-y-auto">
            {issues.length ? [...issues].reverse().map(n => (
              <li key={n.id} className={`flex items-start gap-2 rounded-lg px-2.5 py-1.5 text-sm ${n.data?.fixed ? 'bg-white/40 text-gray-400' : 'bg-white/80'}`}>
                <button type="button" onClick={() => patch(n.id, { data: { ...(n.data || {}), fixed: !n.data?.fixed, fixed_by: username } })}
                  className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${n.data?.fixed ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 bg-white'}`}>{n.data?.fixed ? '✓' : ''}</button>
                <span className={`flex-1 ${n.data?.fixed ? 'line-through' : ''}`}>{n.body} <span className="text-xs text-gray-400">· {n.author}{n.match ? ` · before M${n.match}` : ''}</span></span>
                <button type="button" onClick={() => remove(n.id)} className="text-gray-300 hover:text-red-400"><Trash2 size={14} /></button>
              </li>
            )) : <Empty>Nothing reported. Add one the moment something goes wrong, even if you fix it right away.</Empty>}
          </ul>
        </Card>
        <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm p-1">
          <PitChecklist />
        </div>
      </div>
    </div>
  )
}

// ── Media ───────────────────────────────────────────────────────────────────
const SHOTS = ['Team photo at the pit', 'Robot on the field', 'Drive team at the station', 'Pit crew working', 'Scouts in the stands', 'Alliance partners', 'Awards / closing ceremony', 'Something funny']
function MediaMode({ day }) {
  const { username } = useUser()
  const { notes, add, remove } = useDayNotes(day?.id)
  const shotsDone = notes.filter(n => n.kind === 'shot')
  const done = (label) => shotsDone.find(n => n.body === label)
  const customShots = shotsDone.map(n => n.body).filter(b => !SHOTS.includes(b))
  const [photos, setPhotos] = useState([])
  const [caption, setCaption] = useState('')
  const [uploading, setUploading] = useState(false)
  const [newShot, setNewShot] = useState('')
  const fileRef = useRef(null)
  const todayKey = new Date().toISOString().slice(0, 10)
  const loadPhotos = useCallback(async () => {
    try {
      await ensureUserToken()
      const res = await fetch(`${supabaseUrl}/rest/v1/season_photos?${storedTeamScope()}&created_at=gte.${todayKey}T00:00:00&order=created_at.desc&select=*`, { headers: restHeaders() })
      if (res.ok) setPhotos(await res.json())
    } catch { /* next time */ }
  }, [todayKey])
  useEffect(() => { loadPhotos(); const t = setInterval(() => { if (document.visibilityState === 'visible') loadPhotos() }, 15000); return () => clearInterval(t) }, [loadPhotos])

  const upload = async (e) => {
    const file = e.target.files?.[0]; if (!file) return
    setUploading(true)
    try {
      const url = await uploadImageFile(supabaseUrl, supabaseKey, 'season-photos', file)
      await fetch(`${supabaseUrl}/rest/v1/season_photos`, {
        method: 'POST', headers: restHeaders({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
        body: JSON.stringify(stampStored({ url, caption: [day?.name, caption.trim()].filter(Boolean).join(' · '), uploaded_by: username })),
      })
      setCaption('')
      loadPhotos()
    } catch (err) { console.error('Upload failed:', err) }
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="space-y-4">
      <Card title="Take a photo" icon={Camera}>
        <div className="flex gap-2">
          <input value={caption} onChange={e => setCaption(e.target.value)} maxLength={120} placeholder="Caption (optional) — e.g. Match 12, our auto"
                 className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300" />
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={upload} />
          <button type="button" disabled={uploading} onClick={() => fileRef.current?.click()}
                  className="px-3 py-2 rounded-lg bg-pink-500 text-white text-sm font-semibold disabled:opacity-50 flex items-center gap-1.5">
            <Upload size={16} /> {uploading ? 'Uploading…' : 'Camera'}
          </button>
        </div>
        <p className="text-[11px] text-gray-400 mt-2">Goes straight to the season gallery on Home, tagged with today's day{day?.name ? ` (${day.name})` : ''}.</p>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card title={`Shot list · ${shotsDone.length}/${SHOTS.length + customShots.length}`} icon={CheckCircle2}>
          <ul className="space-y-1.5">
            {[...SHOTS, ...customShots].map(label => {
              const d = done(label)
              return (
                <li key={label}>
                  <button type="button" onClick={() => d ? remove(d.id) : add({ kind: 'shot', body: label, author: username })} className="w-full flex items-center gap-2 text-left text-sm">
                    <span className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${d ? 'bg-pink-500 border-pink-500 text-white' : 'border-gray-300 bg-white'}`}>{d ? '✓' : ''}</span>
                    <span className={d ? 'line-through text-gray-400' : 'text-gray-700'}>{label}</span>
                    {d && <span className="text-[11px] text-gray-400 ml-auto">{d.author}</span>}
                  </button>
                </li>
              )
            })}
          </ul>
          <form onSubmit={(e) => { e.preventDefault(); if (!newShot.trim()) return; add({ kind: 'shot', body: newShot.trim(), author: username, data: { custom: true, pending: true } }); setNewShot('') }} className="flex gap-2 mt-2">
            <input value={newShot} onChange={e => setNewShot(e.target.value)} maxLength={80} placeholder="Add a shot to get…" className="flex-1 px-3 py-1.5 rounded-lg border border-gray-200 text-sm" />
            <button className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm font-semibold text-gray-600"><Plus size={14} /></button>
          </form>
          <p className="text-[11px] text-gray-400 mt-2">Shared with the whole day. Tick one when it's in the bag.</p>
        </Card>
        <Card title={`Today's photos · ${photos.length}`} icon={Camera}>
          {photos.length ? (
            <div className="grid grid-cols-3 gap-1.5">
              {photos.map(p => (
                <a key={p.id} href={p.url} target="_blank" rel="noreferrer" className="block aspect-square rounded-lg overflow-hidden bg-gray-100" title={p.caption || ''}>
                  <img src={p.url} alt={p.caption || ''} className="w-full h-full object-cover" loading="lazy" />
                </a>
              ))}
            </div>
          ) : <Empty>Nothing uploaded yet today.</Empty>}
        </Card>
      </div>
    </div>
  )
}

export function ModePanel({ mode, day, doc }) {
  if (mode === 'drive') return <DriveMode day={day} doc={doc} />
  if (mode === 'pit') return <PitMode day={day} doc={doc} />
  if (mode === 'media') return <MediaMode day={day} />
  return null
}

const Card = ({ title, icon: Icon, action, children }) => (
  <section className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm p-4">
    <div className="flex items-center justify-between gap-2 mb-2">
      <h2 className="font-semibold text-gray-800 flex items-center gap-1.5 text-sm">
        {Icon && <Icon size={15} className="text-pastel-yellow-dark" />}{title}
      </h2>
      {action}
    </div>
    {children}
  </section>
)
const Empty = ({ children }) => <p className="text-sm text-gray-400">{children}</p>
