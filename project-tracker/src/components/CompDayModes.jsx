import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { Wrench, Gamepad2, Camera, Search, CheckCircle2, AlertTriangle, Plus, Upload, Flag, Trash2 } from 'lucide-react'
import { useUser } from '../contexts/UserContext'
import { usePermissions } from '../hooks/usePermissions'
import { restHeaders, ensureUserToken } from '../lib/restHeaders'
import { storedTeamScope, stampStored } from '../lib/teamScope'
import { uploadImageFile } from '../lib/photos'
import { HOME_TEAM_NUMBER } from '../data/team'
import PitChecklist from './PitChecklist'

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
  return out
}

// What scouting says about a team, boiled down to a line.
function useTeamSummaries(teams) {
  const key = teams.slice().sort().join(',')
  const [rows, setRows] = useState([])
  useEffect(() => {
    if (!key) { setRows([]); return }
    let on = true
    ;(async () => {
      try {
        await ensureUserToken()
        const list = key.split(',').map(t => `"${t}"`).join(',')
        const res = await fetch(`${supabaseUrl}/rest/v1/match_scouting?${storedTeamScope('owner_team')}&team_number=in.(${list})&select=team_number,auto_made,teleop_made,endgame_made,endgame,defense,breakdowns,driver_skill,parking,penalties`, { headers: restHeaders() })
        if (on && res.ok) setRows(await res.json())
      } catch { /* leave empty */ }
    })()
    return () => { on = false }
  }, [key])
  return useMemo(() => {
    const by = {}
    rows.forEach(r => { (by[r.team_number] = by[r.team_number] || []).push(r) })
    const avg = (xs, k) => { const v = xs.map(x => x[k]).filter(x => x != null && x !== '').map(Number).filter(n => !Number.isNaN(n)); return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null }
    const out = {}
    Object.entries(by).forEach(([t, xs]) => {
      const broke = xs.filter(x => x.breakdowns && !/^(none|no|n\/a)?$/i.test(String(x.breakdowns).trim())).length
      const defense = xs.filter(x => x.defense && !/^(none|no)$/i.test(String(x.defense).trim())).length
      out[t] = { n: xs.length, auto: avg(xs, 'auto_made'), teleop: avg(xs, 'teleop_made'), endgame: avg(xs, 'endgame_made'), driver: avg(xs, 'driver_skill'), broke, defense, penalties: avg(xs, 'penalties') }
    })
    return out
  }, [rows])
}

const TeamLine = ({ team, s, ours }) => (
  <div className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm ${ours ? 'bg-white/70' : 'bg-white/40'}`}>
    <span className="font-bold text-gray-800 w-14">{team}</span>
    {s ? (
      <span className="text-xs text-gray-600 truncate">
        auto {s.auto ?? '–'} · teleop {s.teleop ?? '–'} · endgame {s.endgame ?? '–'}
        {s.driver != null ? ` · driver ${s.driver}/5` : ''}{s.defense ? ` · plays defense` : ''}{s.broke ? ` · broke down ${s.broke}×` : ''}
        <span className="text-gray-400"> · {s.n} scouted</span>
      </span>
    ) : <span className="text-xs text-gray-400">not scouted yet</span>}
  </div>
)

// ── Drive Team ──────────────────────────────────────────────────────────────
const DRIVE_CHECK = ['Battery swapped and charged', 'Phone charged, app open', 'Controllers paired', 'Bumpers the right color', 'Code deployed, right OpMode', 'Preload in']
function DriveMode({ day, doc }) {
  const { username, teamNumber } = useUser()
  const team = teamNumber || HOME_TEAM_NUMBER
  const { notes, add } = useDayNotes(day?.id)
  const matches = useMemo(() => ourMatches(doc, team), [doc, team])
  const played = useMemo(() => new Set(notes.filter(n => n.kind === 'played').map(n => n.match)), [notes])
  const next = matches.find(m => !played.has(m.match)) || null
  const after = next ? matches.filter(m => Number(m.match) > Number(next.match)).slice(0, 3) : []
  const teams = useMemo(() => [...new Set(matches.flatMap(m => [...m.partner, ...m.opponents]))], [matches])
  const summaries = useTeamSummaries(teams)
  const [checks, setChecks] = useState({})
  const [note, setNote] = useState('')
  useEffect(() => { try { setChecks(JSON.parse(localStorage.getItem(`drive-check-${day?.id}-${next?.match}`) || '{}')) } catch { setChecks({}) } }, [day?.id, next?.match])
  const toggle = (i) => { const c = { ...checks, [i]: !checks[i] }; setChecks(c); try { localStorage.setItem(`drive-check-${day?.id}-${next?.match}`, JSON.stringify(c)) } catch { /* ignore */ } }
  const driveNotes = notes.filter(n => n.kind === 'drive' && (!next || n.match === next.match))
  const ready = DRIVE_CHECK.every((_, i) => checks[i])

  if (!doc) return <Card title="Drive Team" icon={Gamepad2}><Empty>Loading the day…</Empty></Card>
  if (!matches.length) return <Card title="Drive Team" icon={Gamepad2}><Empty>No matches for team {team} in this day's schedule yet. A lead adds them under Competition Day → Matches.</Empty></Card>
  return (
    <div className="space-y-4">
      {next ? (
        <section className={`rounded-xl shadow-sm p-4 text-white ${next.color === 'red' ? 'bg-gradient-to-br from-red-500 to-rose-600' : 'bg-gradient-to-br from-blue-500 to-indigo-600'}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide opacity-80">Up next</p>
              <h2 className="text-2xl font-extrabold leading-tight">Match {next.match} · {next.position}</h2>
              {next.time && <p className="text-sm opacity-90">{next.time}</p>}
            </div>
            <button type="button" onClick={() => add({ kind: 'played', match: next.match, author: username })}
              className="shrink-0 px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-sm font-semibold">
              <Flag size={14} className="inline mr-1" />Mark played
            </button>
          </div>
          <div className="grid sm:grid-cols-2 gap-3 mt-3">
            <div>
              <p className="text-xs uppercase tracking-wide opacity-80 mb-1">With us</p>
              <div className="space-y-1">{next.partner.map(t => <TeamLine key={t} team={t} s={summaries[t]} ours />)}{!next.partner.length && <p className="text-xs opacity-80">No partner listed.</p>}</div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide opacity-80 mb-1">Against</p>
              <div className="space-y-1">{next.opponents.map(t => <TeamLine key={t} team={t} s={summaries[t]} />)}</div>
            </div>
          </div>
        </section>
      ) : (
        <Card title="Drive Team" icon={Gamepad2}><Empty>Every match on the schedule is marked played. Nice work.</Empty></Card>
      )}

      {next && (
        <div className="grid md:grid-cols-2 gap-4">
          <Card title={`Before match ${next.match}`} icon={CheckCircle2}
                action={<span className={`text-xs font-semibold ${ready ? 'text-green-600' : 'text-gray-400'}`}>{DRIVE_CHECK.filter((_, i) => checks[i]).length}/{DRIVE_CHECK.length}</span>}>
            <ul className="space-y-1.5">
              {DRIVE_CHECK.map((c, i) => (
                <li key={c}>
                  <button type="button" onClick={() => toggle(i)} className="w-full flex items-center gap-2 text-left text-sm">
                    <span className={`w-5 h-5 rounded-md border flex items-center justify-center ${checks[i] ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 bg-white'}`}>{checks[i] ? '✓' : ''}</span>
                    <span className={checks[i] ? 'line-through text-gray-400' : 'text-gray-700'}>{c}</span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-gray-400 mt-2">Resets for each match. Only on this phone.</p>
          </Card>
          <Card title="Strategy notes" icon={Gamepad2}>
            <div className="space-y-1.5 mb-2 max-h-40 overflow-y-auto">
              {driveNotes.length ? driveNotes.map(n => (
                <div key={n.id} className="text-sm bg-white/70 rounded-lg px-2.5 py-1.5"><span className="font-semibold text-gray-700">{n.author}:</span> {n.body}</div>
              )) : <Empty>Nothing yet. Strategy lead, drive coach, scouts: say what matters for this match.</Empty>}
            </div>
            <form onSubmit={(e) => { e.preventDefault(); if (!note.trim()) return; add({ kind: 'drive', match: next.match, body: note.trim(), author: username }); setNote('') }} className="flex gap-2">
              <input value={note} onChange={e => setNote(e.target.value)} maxLength={300} placeholder={`A note for match ${next.match}…`}
                     className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" />
              <button className="px-3 py-2 rounded-lg bg-purple-500 text-white text-sm font-semibold">Post</button>
            </form>
          </Card>
        </div>
      )}

      {after.length > 0 && (
        <Card title="After that" icon={Flag}>
          <div className="space-y-1.5">
            {after.map(m => (
              <div key={m.match} className="flex items-center gap-2 text-sm">
                <span className={`px-2 py-0.5 rounded-md text-white text-xs font-bold ${m.color === 'red' ? 'bg-red-500' : 'bg-blue-500'}`}>M{m.match}</span>
                <span className="text-gray-700">{m.position}</span>
                <span className="text-gray-400">with {m.partner.join(', ') || '—'} · vs {m.opponents.join(', ')}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
      {played.size > 0 && <p className="text-xs text-gray-400 text-center">{played.size} of {matches.length} matches played</p>}
    </div>
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
