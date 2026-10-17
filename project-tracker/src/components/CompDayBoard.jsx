import { useState, useMemo, useEffect } from 'react'
import { useUser } from '../contexts/UserContext'
import { ClipboardList, AlertTriangle, Pause, Tent } from 'lucide-react'
import { HONEYCOMB_CELLS, HONEY_WASH } from './HomeView'
import { ALL_TEAMS } from '../data/teams'
import { storedTeamScope } from '../lib/teamScope'
import { restHeaders } from '../lib/restHeaders'
import { supabase } from '../supabase'
import { useDayDoc } from '../hooks/useDayDoc'
import { requestScout, SCOUT_SAVED } from '../lib/scoutHandoff'
import { announceLiveChange } from '../hooks/useLiveCompDay'
import {
  SCOUTING_ROLE, PIT_ROLE, roleMembers, allAssignments, assignmentsFor,
  pitAssignments, pitAssignmentsFor, scoutedKeys, pitScoutedKeys,
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
  const { matches: scouted, pits: pitScouted } = useScouted()

  const matchRows = useMemo(() => allAssignments(doc), [doc])
  const pitRows = useMemo(() => pitAssignments(doc), [doc])
  const mine = useMemo(() => assignmentsFor(doc, username), [doc, username])
  const minePit = useMemo(() => pitAssignmentsFor(doc, username), [doc, username])

  // Tap a job to go and do it: the right form, on that team and match.
  const scout = (job) => {
    requestScout({ team: job.team, match: job.match })
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
              {day?.name ? `${day.name} · ` : ''}What's happening, where to go, and what's next.
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
            <YoursToScout mine={mine} minePit={minePit} scouted={scouted} pitScouted={pitScouted} loaded={!!doc} onScout={scout} />

            {/* The two groups side by side and the same height. items-stretch does
                the lining up; the scroll inside each chart is what keeps them
                even when one group covers far more teams than the other. */}
            <div className="flex flex-col md:flex-row gap-4 items-stretch">
              <div className="w-full md:flex-1 min-w-0">
                <GroupBox title="Pit Group" icon={Tent} people={roleMembers(doc, PIT_ROLE)}
                          rows={pitRows} done={pitScouted} showMatch={false} loaded={!!doc} onScout={scout}
                          button={{ label: 'Pit Scouting', onClick: () => onTabChange('pit-scouting') }} />
              </div>
              <div className="w-full md:flex-1 min-w-0">
                <GroupBox title="Match Scouting Group" icon={ClipboardList} people={roleMembers(doc, SCOUTING_ROLE)}
                          rows={matchRows} done={scouted} loaded={!!doc} onScout={scout}
                          button={{ label: 'Match Scouting', onClick: () => onTabChange('scouting') }} />
              </div>
            </div>
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
function GroupBox({ title, icon, people, rows, done, showMatch = true, button, loaded, onScout }) {
  const { username } = useUser()
  return (
    <Card title={title} icon={icon} fill>
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
        <div className="mt-3 pt-3 border-t border-gray-100 flex-1 min-h-0 overflow-y-auto max-h-64">
          <ScoutChart rows={rows} done={done} showMatch={showMatch} onScout={onScout} />
        </div>
      )}
      {button && (
        // The way out of reading and into doing. Under the chart, because you
        // look to see what is missing and then go and fix it — in that order.
        <button
          onClick={button.onClick}
          className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-colors bg-pastel-yellow hover:bg-pastel-yellow-dark text-gray-800"
        >
          <ClipboardList size={15} /> {button.label}
        </button>
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
function useScouted() {
  const [matches, setMatches] = useState(null)   // null = still loading
  const [pits, setPits] = useState(null)
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const [m, p] = await Promise.all([
          fetch(`${supabaseUrl}/rest/v1/match_scouting?${storedTeamScope('owner_team')}&select=team_number,match_number`, { headers: restHeaders() }),
          fetch(`${supabaseUrl}/rest/v1/pit_scouting?select=team_number`, { headers: restHeaders() }),
        ])
        const mr = m.ok ? await m.json() : []
        const pr = p.ok ? await p.json() : []
        if (cancelled) return
        setMatches(scoutedKeys(Array.isArray(mr) ? mr : []))
        setPits(pitScoutedKeys(Array.isArray(pr) ? pr : []))
      } catch { if (!cancelled) { setMatches(new Set()); setPits(new Set()) } }
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
  }, [])
  return { matches, pits }
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
function statusOf(row, done) {
  if (done === null) return 'loading'
  const key = row.match == null ? row.team : `${row.team}|${row.match}`
  return done.has(key) ? 'done' : 'missing'
}

const STATUS = {
  loading: { row: '',          pill: 'bg-gray-100 text-gray-400',   label: '…' },
  done:    { row: '',          pill: 'bg-green-100 text-green-700', label: 'Scouted' },
  missing: { row: 'bg-red-50', pill: 'bg-red-100 text-red-700',     label: 'Not scouted' },
}

// A row that is not scouted yet is a thing to do, so it is a button: tap it
// and the form opens on that job. A scouted row just sits there, green.
function ScoutChart({ rows, done, showMatch = true, onScout }) {
  if (!rows.length) return <Empty>Nothing assigned yet.</Empty>
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-xs">
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
            const status = statusOf(r, done)
            const st = STATUS[status]
            const todo = status === 'missing' && !!onScout
            return (
              <tr
                key={`${r.team}-${r.match ?? 'pit'}-${i}`}
                onClick={todo ? () => onScout(r) : undefined}
                title={todo ? 'Tap to scout this' : undefined}
                className={`border-t border-gray-100 ${st.row}${todo ? ' cursor-pointer hover:bg-red-100/70 active:bg-red-100' : ''}`}
              >
                <td className="py-1.5 px-1">
                  <span className="font-medium text-gray-700">{r.team}</span>
                  <span className="block text-[10px] text-gray-400 truncate max-w-[8rem]">{teamName(r.team)}</span>
                </td>
                {showMatch && <td className="py-1.5 px-1 text-gray-600">{r.match ?? '—'}</td>}
                <td className="py-1.5 px-1 text-gray-600 truncate max-w-[7rem]">{r.who || '—'}</td>
                <td className="py-1.5 px-1 text-right">
                  <span className={`inline-block px-1.5 py-0.5 rounded-full font-medium ${st.pill}${todo ? ' underline decoration-red-300 underline-offset-2' : ''}`}>
                    {todo ? 'Scout it' : st.label}
                  </span>
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
function YoursToScout({ mine, minePit, scouted, pitScouted, loaded, onScout }) {
  const square = (a, done, i) => {
    const st = statusOf(a, done)
    const todo = st === 'missing'
    const look = st === 'done' ? 'bg-green-100 text-green-700 border-green-200'
      : 'bg-white/80 text-gray-600 border-gray-200 hover:border-pastel-yellow-dark hover:bg-pastel-yellow/40 cursor-pointer'
    const what = a.match == null ? `Pit visit — team ${a.team} (${teamName(a.team)})` : `Match ${a.match} — team ${a.team} (${teamName(a.team)})`
    return (
      <button
        type="button"
        key={`${a.team}-${a.match ?? 'pit'}-${i}`}
        onClick={todo ? () => onScout(a) : undefined}
        disabled={!todo}
        title={todo ? `${what} — tap to scout` : what}
        className={`w-14 h-14 rounded-lg border flex flex-col items-center justify-center leading-tight transition-colors ${look}`}
      >
        <span className="text-base font-bold">{a.match ?? <Tent size={16} />}</span>
        <span className="text-[10px] opacity-70">{a.team}</span>
      </button>
    )
  }
  return (
    <section className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm p-4 text-center">
      <p className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold">Yours to scout</p>
      {!loaded ? (
        <p className="text-sm text-gray-400 mt-1">Loading…</p>
      ) : mine.length + minePit.length === 0 ? (
        <p className="text-sm text-gray-400 mt-1">Nothing assigned to you.</p>
      ) : (
        <div className="mt-2 flex flex-wrap justify-center gap-1.5">
          {minePit.map((a, i) => square(a, pitScouted, i))}
          {mine.map((a, i) => square(a, scouted, i))}
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
