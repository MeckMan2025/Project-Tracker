import { useState, useMemo, useEffect } from 'react'
import { useUser } from '../contexts/UserContext'
import { ClipboardList, AlertTriangle, Pause, Tent, BookOpen, Maximize2, X } from 'lucide-react'
import { HONEYCOMB_CELLS, HONEY_WASH } from './HomeView'
import { ALL_TEAMS } from '../data/teams'
import { storedTeamScope } from '../lib/teamScope'
import { restHeaders, ensureUserToken } from '../lib/restHeaders'
import { supabase } from '../supabase'
import { useDayDoc } from '../hooks/useDayDoc'
import { requestScout, SCOUT_SAVED } from '../lib/scoutHandoff'
import { useWhoIsScouting } from '../hooks/useScoutingPresence'
import { announceLiveChange } from '../hooks/useLiveCompDay'
import { ModeBar, ModePanel, useDefaultMode, ScoutAnnouncements } from './CompDayModes'
import {
  SCOUTING_ROLE, roleMembers, allAssignments, assignmentsFor, scoutKey, daySince,
  pitAssignments, pitAssignmentsFor, scoutedKeys, pitScoutedKeys, recordKey,
} from '../lib/dayRota'

// The Competition Day board: everyone's Home while a day is live.
//
// It answers three questions and deliberately nothing else:
//
//   What am I doing?        yours to scout, as squares
//   Is the scouting done?   the pit group and the match group, row by row
//   Where do I go to do it? the two buttons under the charts
//
// Everything on it comes from the day's own prep (the Pit and Scouting tabs
// and the match schedule) and from the scouting rows themselves. Nothing is
// typed in here: the prep is the plan, the rows are the proof.

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL

export default function CompDayBoard({ day, onTabChange, canPause = false }) {
  const { username } = useUser()
  const doc = useDayDoc(day ? `day-comp-${day.id}` : null)
  // Scout, Media, Pit or Drive: your role picks the first one, you pick after.
  const { mode, setMode, tabs: modeTabs } = useDefaultMode(day)
  const { matches: scouted, pits: pitScouted, didBy } = useScouted(daySince(day))
  // Who has a form open on which job, right now.
  const who = useWhoIsScouting(day?.id)
  const busy = useMemo(() => {
    const m = new Map()
    who.forEach(w => m.set(w.kind === 'pit' ? w.team : `${w.team}|${w.match}`, w.username))
    return m
  }, [who])

  const matchRows = useMemo(() => allAssignments(doc), [doc])
  const pitRows = useMemo(() => pitAssignments(doc), [doc])
  const mine = useMemo(() => assignmentsFor(doc, username), [doc, username])
  const minePit = useMemo(() => pitAssignmentsFor(doc, username), [doc, username])

  // Tap a job to go and do it: the right form, on that team and match.
  const scout = (job) => {
    requestScout({ team: job.team || '', match: job.match, position: job.positionLabel || job.position || '' })
    onTabChange(job.match == null ? 'pit-scouting' : 'scouting')
  }

  const pause = async () => {
    if (!day) return
    try {
      await fetch(`${supabaseUrl}/rest/v1/comp_day_sessions?id=eq.${encodeURIComponent(day.id)}`, {
        method: 'PATCH',
        headers: restHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ is_active: false }),
      })
      announceLiveChange()
    } catch { /* the live check will show whether it took */ }
  }

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="px-4 py-3 ml-14 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-bold bg-gradient-to-r from-pastel-yellow-dark via-pastel-orange-dark to-pastel-orange-dark bg-clip-text text-transparent truncate">
              Competition Day{username ? `, ${username}` : ''}! <span title="Competition">🏁</span>
            </h1>
            <p className="text-sm text-gray-500 truncate">
              {day?.name ? `${day.name} · ` : ''}{mode === 'drive' ? 'Our next match, who we are with and against.' : mode === 'pit' ? 'Is the robot ready, and what needs fixing.' : mode === 'media' ? 'The shot list, and the photos going up.' : "What's happening, where to go, and what's next."}
            </p>
          </div>
          {canPause && day && (
            <button
              onClick={pause}
              title="Pause this day — everyone's app goes back to normal; host it again any time to carry on"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 shrink-0"
            >
              <Pause size={15} /> Pause
            </button>
          )}
        </div>
      </header>

      <main
        className="flex-1 p-4 overflow-y-auto space-y-4"
        style={{
          backgroundImage: `${HONEYCOMB_CELLS}, ${HONEY_WASH}`,
          backgroundRepeat: 'repeat, no-repeat',
          backgroundSize: '90px 52px, cover',
        }}
      >
        {!day ? (
          <Card title="No Competition Day is live" icon={AlertTriangle}>
            <Empty>When a lead hosts one, this page becomes its board.</Empty>
          </Card>
        ) : (
          <>
            <ModeBar mode={mode} onChange={setMode} tabs={modeTabs} />
            {mode !== 'scout' ? <ModePanel mode={mode} day={day} doc={doc} /> : (<>
            <ScoutAnnouncements day={day} />

            {/* The rule book, one tap away. Scouts argue about what counted;
                the AI manual settles it faster than finding a referee. */}
            <button
              type="button"
              onClick={() => onTabChange('ai-manual')}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/80 backdrop-blur-sm shadow-sm hover:bg-pastel-blue/20 transition-colors text-sm font-semibold text-gray-800"
            >
              <BookOpen size={16} className="text-pastel-blue-dark" /> AI Game Manual
              <span className="font-normal text-gray-500">— ask it anything about the rules</span>
            </button>

            {/* The two groups side by side and the same height. items-stretch does
                the lining up; the scroll inside each chart is what keeps them
                even when one group covers far more teams than the other. */}
            <div className="flex flex-col md:flex-row gap-4 items-stretch">
              <div className="w-full md:flex-1 min-w-0">
                <GroupBox title="Pit Scouting" icon={Tent} people={roleMembers(doc, SCOUTING_ROLE)}
                          rows={pitRows} done={pitScouted} didBy={didBy} showMatch={false} loaded={!!doc} onScout={scout} busy={busy}
                          button={{ label: 'Pit Scouting', onClick: () => onTabChange('pit-scouting') }} />
              </div>
              <div className="w-full md:flex-1 min-w-0">
                <GroupBox title="Match Scouting Group" icon={ClipboardList} people={roleMembers(doc, SCOUTING_ROLE)}
                          rows={matchRows} done={scouted} didBy={didBy} loaded={!!doc} onScout={scout} busy={busy}
                          button={{ label: 'Match Scouting', onClick: () => onTabChange('scouting') }} />
              </div>
            </div>
            </>)}
          </>
        )}
      </main>
    </div>
  )
}

/* ── Who is where today ──────────────────────────────────────────────────── */

const isMe = (name, username) => {
  const v = String(name || '').trim().toLowerCase()
  const me = String(username || '').trim().toLowerCase()
  return !!v && (v === me || (!v.includes(' ') && v === me.split(/\s+/)[0]))
}

// A group for the day: who is in it, and every job it covers, row by row.
function GroupBox({ title, icon, people, rows, done, didBy, showMatch = true, button, loaded, onScout, busy }) {
  const { username } = useUser()
  // Full screen: the whole chart, no inner scroll, for reading from across
  // the pit or handing the phone round. Escape or the X closes it.
  const [big, setBig] = useState(false)
  useEffect(() => {
    if (!big) return
    const onKey = (e) => { if (e.key === 'Escape') setBig(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [big])
  const expand = (
    <button type="button" onClick={() => setBig(true)} title="Full screen" aria-label={`${title} full screen`}
            className="p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100">
      <Maximize2 size={15} />
    </button>
  )
  if (big) {
    return (
      <>
        <Card title={title} icon={icon} fill action={expand}>
          <Empty>Open full screen.</Empty>
        </Card>
        <div className="fixed inset-0 z-50 bg-white flex flex-col">
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800 flex items-center gap-1.5">
              {icon && (() => { const Icon = icon; return <Icon size={16} className="text-pastel-yellow-dark" /> })()}{title}
            </h2>
            <button type="button" onClick={() => setBig(false)} aria-label="Close" className="p-1.5 rounded-lg hover:bg-gray-100"><X size={18} className="text-gray-500" /></button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-3">
            <div className="flex flex-wrap gap-1.5 mb-3">
              {people.map(name => {
                const me = isMe(name, username)
                return <span key={name} className={`text-sm px-2.5 py-1 rounded-full ${me ? 'bg-pastel-yellow text-gray-800 font-semibold' : 'bg-gray-100 text-gray-600'}`}>{name}{me ? ' (you)' : ''}</span>
              })}
            </div>
            <div className="text-sm">
              <ScoutChart rows={rows} done={done} didBy={didBy} showMatch={showMatch} onScout={(job) => { setBig(false); onScout?.(job) }} busy={busy} big />
            </div>
          </div>
          {button && (
            <div className="p-3 border-t border-gray-100">
              <button onClick={() => { setBig(false); button.onClick() }}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-3 rounded-xl text-sm font-semibold bg-pastel-yellow hover:bg-pastel-yellow-dark text-gray-800">
                <ClipboardList size={15} /> {button.label}
              </button>
            </div>
          )}
        </div>
      </>
    )
  }
  return (
    <Card title={title} icon={icon} fill action={expand}>
      {!loaded ? <Empty>Loading…</Empty> : people.length === 0 ? <Empty>A lead will fill this in.</Empty> : (
        <div className="flex flex-wrap gap-1.5">
          {people.map(name => {
            const me = isMe(name, username)
            return (
              <span
                key={name}
                className={`text-xs px-2 py-1 rounded-full ${
                  me ? 'bg-pastel-yellow text-gray-800 font-semibold' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {name}{me ? ' (you)' : ''}
              </span>
            )
          })}
        </div>
      )}
      {loaded && (
        // A fixed height, scrolling inside. The two groups cover different
        // numbers of teams, and without this the longer one dragged its card
        // down past the other and the row looked broken.
        <div className="mt-3 pt-3 border-t border-gray-100 min-h-0 overflow-y-auto max-h-64">
          <ScoutChart rows={rows} done={done} didBy={didBy} showMatch={showMatch} onScout={onScout} busy={busy} />
        </div>
      )}
      {button && (
        // The way out of reading and into doing. Under the chart, because you
        // look to see what is missing and then go and fix it — in that order.
        // Pinned to the foot of the card (mt-auto), so the two buttons sit on
        // the same line however much each chart above them has to say.
        <div className="mt-auto pt-3">
          <button
            onClick={button.onClick}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-colors bg-pastel-yellow hover:bg-pastel-yellow-dark text-gray-800"
          >
            <ClipboardList size={15} /> {button.label}
          </button>
        </div>
      )}
    </Card>
  )
}

/* ── What is left to scout ───────────────────────────────────────────────── */

// Which jobs already have a submission, read from the scouting tables
// themselves rather than kept as a list somebody ticks: the only thing that
// proves a match was scouted is the scouting. Match rows are keyed by team
// and match so a team scouted in match 3 does not mark match 5 done; pit
// rows by team alone, since a pit is visited once. Kept current: a saved
// form anywhere on the team turns its row green here within a moment.
function useScouted(since) {
  const [matches, setMatches] = useState(null)   // null = still loading
  const [pits, setPits] = useState(null)
  // Who actually sent each one: team|match -> names, and pit|team -> names.
  const [didBy, setDidBy] = useState(new Map())
  useEffect(() => {
    let cancelled = false
    // Wait for the user's token before asking. Without one the request goes
    // out as the public key, the tables (authenticated only) answer with an
    // empty list rather than an error, and every row here reads "Scout it"
    // for work that was done. An empty answer is asked again for the same
    // reason: it is almost always a token that was not ready yet.
    const load = async () => {
      for (let attempt = 0; attempt < 3 && !cancelled; attempt++) {
        if (attempt) await new Promise(r => setTimeout(r, 800))
        try {
          await ensureUserToken()
          const [m, p] = await Promise.all([
            fetch(`${supabaseUrl}/rest/v1/match_scouting?${storedTeamScope('owner_team')}${since ? `&created_at=gte.${encodeURIComponent(since)}` : ''}&select=team_number,match_number,scout`, { headers: restHeaders() }),
            fetch(`${supabaseUrl}/rest/v1/pit_scouting?${storedTeamScope('owner_team')}&select=team_number,scout_name${since ? `&created_at=gte.${encodeURIComponent(since)}` : ''}`, { headers: restHeaders() }),
          ])
          const mr = m.ok ? await m.json() : []
          const pr = p.ok ? await p.json() : []
          if (cancelled) return
          const mList = Array.isArray(mr) ? mr : []
          const pList = Array.isArray(pr) ? pr : []
          setMatches(scoutedKeys(mList))
          setPits(pitScoutedKeys(pList))
          const by = new Map()
          const note = (k, name) => { if (!name) return; const v = by.get(k) || []; if (!v.includes(name)) v.push(name); by.set(k, v) }
          mList.forEach(r => note(recordKey(r.team_number, r.match_number), String(r.scout || '').trim()))
          pList.forEach(r => note(`pit|${String(r.team_number || '').trim()}`, String(r.scout_name || '').trim()))
          setDidBy(by)
          if (mList.length || pList.length) return
        } catch { if (!cancelled) { setMatches(new Set()); setPits(new Set()) } }
      }
    }
    load()
    const interval = setInterval(load, 60000)
    // A form on this device just saved, or the app came back to the front:
    // ask again now. Realtime covers everyone else's saves; the poll is the
    // safety net under both.
    const onVisible = () => { if (document.visibilityState === 'visible') load() }
    window.addEventListener(SCOUT_SAVED, load)
    document.addEventListener('visibilitychange', onVisible)
    const channel = supabase
      .channel('comp-day-board-scouted')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'match_scouting' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pit_scouting' }, load)
      .subscribe()
    return () => {
      cancelled = true
      clearInterval(interval)
      window.removeEventListener(SCOUT_SAVED, load)
      document.removeEventListener('visibilitychange', onVisible)
      supabase.removeChannel(channel)
    }
  }, [since])
  return { matches, pits, didBy }
}

const teamName = (num) =>
  (ALL_TEAMS.find(t => String(t.number) === String(num)) || {}).name || '—'

// Two states, and the row is coloured by which one it is:
//
//   green   a submission exists for this job. Done.
//   red     nobody has scouted it. This is the one worth seeing from across
//           the pit, which is why it is red.
//
// Loading is its own state and shows as neither: an empty database for half a
// second should not paint the whole chart red.
// A job with no team yet is matched by who was down for it and the match.
const jobKey = (row) => (row.match == null ? row.team : row.team ? `${row.team}|${row.match}` : scoutKey(row.who, row.match))

// Three states, and the row is coloured by which one it is:
//   green   a submission exists. Done.
//   amber   somebody has the form open on it right now. In hand.
//   red     nobody has scouted it and nobody is on it. The one to see.
function statusOf(row, done, busy) {
  if (done === null) return 'loading'
  if (done.has(jobKey(row))) return 'done'
  if (busy && busy.has(jobKey(row))) return 'now'
  return 'missing'
}

const STATUS = {
  loading: { row: '',            pill: 'bg-gray-100 text-gray-400',    label: '…' },
  done:    { row: '',            pill: 'bg-green-100 text-green-700',  label: 'Scouted' },
  now:     { row: 'bg-amber-50', pill: 'bg-amber-100 text-amber-800',  label: 'Scouting now' },
  missing: { row: 'bg-red-50',   pill: 'bg-red-100 text-red-700',      label: 'Not scouted' },
}

// A row that is not scouted yet is a thing to do, so it is a button: tap it
// and the form opens on that job. A scouted row just sits there, green.
// Same person, however the name was typed: full name, or first name only.
const samePerson = (a, b) => {
  const x = String(a || '').trim().toLowerCase(), y = String(b || '').trim().toLowerCase()
  if (!x || !y) return false
  return x === y || x.split(/\s+/)[0] === y.split(/\s+/)[0]
}
function ScoutChart({ rows, done, didBy, showMatch = true, onScout, busy, big = false }) {
  if (!rows.length) return <Empty>Nothing assigned yet.</Empty>
  return (
    <div className="overflow-x-auto -mx-1">
      <table className={`w-full ${big ? 'text-sm' : 'text-xs'}`}>
        <thead>
          <tr className="text-gray-400 text-left">
            <th className="font-medium py-1 px-1">Team</th>
            {showMatch && <th className="font-medium py-1 px-1">Match</th>}
            <th className="font-medium py-1 px-1">Who</th>
            <th className="font-medium py-1 px-1 text-right">Scouted</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const status = statusOf(r, done, busy)
            const st = STATUS[status]
            const todo = status === 'missing' && !!onScout
            const onIt = status === 'now' ? busy.get(jobKey(r)) : null
            return (
              <tr
                key={`${r.team}-${r.match ?? 'pit'}-${i}`}
                onClick={todo ? () => onScout(r) : undefined}
                title={todo ? 'Tap to scout this' : undefined}
                className={`border-t border-gray-100 ${st.row}${todo ? ' cursor-pointer hover:bg-red-100/70 active:bg-red-100' : ''}`}
              >
                <td className="py-1.5 px-1">
                  <span className="font-medium text-gray-700">{r.team || r.positionLabel || r.position || '—'}</span>
                  <span className="block text-[10px] text-gray-400 truncate max-w-[8rem]">{r.team ? teamName(r.team) : 'team TBD'}</span>
                </td>
                {showMatch && <td className="py-1.5 px-1 text-gray-600">{r.match ?? '—'}</td>}
                <td className="py-1.5 px-1 text-gray-600 max-w-[9rem]">
                  {(() => {
                    // Who was down for it, and — when someone else sent it —
                    // who actually did, so covering for a teammate is on record.
                    const did = r.team ? (didBy?.get(r.match == null ? `pit|${r.team}` : recordKey(r.team, r.match)) || []) : []
                    const covered = status === 'done' && did.length && !did.some(n => samePerson(n, r.who))
                    return covered ? (
                      <>
                        <span className="block truncate line-through text-gray-400">{r.who || 'nobody assigned'}</span>
                        <span className="block truncate text-[11px] font-semibold text-amber-700">scouted by {did.join(', ')}</span>
                      </>
                    ) : <span className="block truncate">{r.who || '—'}</span>
                  })()}
                </td>
                <td className="py-1.5 px-1 text-right">
                  <span className={`inline-block px-1.5 py-0.5 rounded-full font-medium ${st.pill}${todo ? ' underline decoration-red-300 underline-offset-2' : ''}`}>
                    {todo ? 'Scout it' : st.label}
                  </span>
                  {onIt && <span className="block text-[10px] text-amber-700 truncate max-w-[7rem] ml-auto">{onIt}</span>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// The biggest thing on the page, because it is the thing you are counting.
// One square per job of yours, in match order, so the next one to worry about
// is simply the next square along. Green once a submission exists for it.
// Everyone's jobs for the day, person by person, so the whole group can keep
// track of who still has what. Yours is first and highlighted. One square per
// job in match order, green once a submission exists, and any square that is
// still open can be tapped to go and scout it.
function YoursToScout({ mine, minePit, everyone = [], everyonePit = [], scouted, pitScouted, loaded, onScout, busy }) {
  const { username } = useUser()
  const square = (a, done, i) => {
    const st = statusOf(a, done, busy)
    const todo = st === 'missing' || st === 'now'
    const look = st === 'done' ? 'bg-green-100 text-green-700 border-green-200'
      : st === 'now' ? 'bg-amber-100 text-amber-800 border-amber-300 cursor-pointer'
      : 'bg-white/80 text-gray-600 border-gray-200 hover:border-pastel-yellow-dark hover:bg-pastel-yellow/40 cursor-pointer'
    const what = a.match == null ? `Pit visit — team ${a.team} (${teamName(a.team)})` : a.team ? `Match ${a.match} — team ${a.team} (${teamName(a.team)})` : `Match ${a.match} — ${a.positionLabel || a.position}, team not on the schedule yet`
    return (
      <button
        type="button"
        key={`${a.team}-${a.match ?? 'pit'}-${i}`}
        onClick={todo ? () => onScout(a) : undefined}
        disabled={!todo}
        title={todo ? `${what} — tap to scout` : what}
        className={`w-12 h-12 rounded-lg border flex flex-col items-center justify-center leading-tight transition-colors ${look}`}
      >
        <span className="text-sm font-bold">{a.match ?? <Tent size={14} />}</span>
        <span className="text-[9px] opacity-70">{a.team || a.positionLabel || a.position}</span>
      </button>
    )
  }
  // One line per person who is down for anything, in the order they first
  // come up; nobody-assigned jobs are left to the charts below.
  const people = []
  ;[...everyonePit, ...everyone].forEach(a => { const w = String(a.who || '').trim(); if (w && !people.some(p => samePerson(p, w))) people.push(w) })
  const meFirst = [...people.filter(p => isMe(p, username)), ...people.filter(p => !isMe(p, username))]
  return (
    <section className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm p-4">
      <p className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold text-center">Who is scouting what</p>
      {!loaded ? (
        <p className="text-sm text-gray-400 mt-1 text-center">Loading…</p>
      ) : !meFirst.length ? (
        <p className="text-sm text-gray-400 mt-1 text-center">Nothing assigned yet.</p>
      ) : (
        <div className="mt-2 space-y-2 max-h-80 overflow-y-auto">
          {meFirst.map(p => {
            const me = isMe(p, username)
            const pit = everyonePit.filter(a => samePerson(a.who, p))
            const jobs = everyone.filter(a => samePerson(a.who, p))
            const left = pit.filter(a => statusOf(a, pitScouted, busy) !== 'done').length + jobs.filter(a => statusOf(a, scouted, busy) !== 'done').length
            return (
              <div key={p} className={`rounded-lg px-2 py-1.5 ${me ? 'bg-pastel-yellow/40 ring-1 ring-pastel-yellow-dark/40' : ''}`}>
                <p className="text-xs font-semibold text-gray-700 mb-1">{p}{me ? ' (you)' : ''}<span className="font-normal text-gray-400"> · {left ? `${left} to go` : 'all done ✓'}</span></p>
                <div className="flex flex-wrap gap-1">
                  {pit.map((a, i) => square(a, pitScouted, i))}
                  {jobs.map((a, i) => square(a, scouted, i))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

/* ── Shared ──────────────────────────────────────────────────────────────── */

const Card = ({ title, icon: Icon, action, children, fill }) => (
  <section className={`bg-white/80 backdrop-blur-sm rounded-xl shadow-sm p-4${
    fill ? ' h-full flex flex-col' : ''}`}>
    <div className="flex items-center justify-between gap-2 mb-2">
      <h2 className="font-semibold text-gray-800 flex items-center gap-1.5 text-sm">
        {Icon && <Icon size={15} className="text-pastel-yellow-dark" />}{title}
      </h2>
      {action}
    </div>
    {fill ? <div className="flex-1 flex flex-col min-h-0">{children}</div> : children}
  </section>
)

const Empty = ({ children }) => <p className="text-sm text-gray-400">{children}</p>
