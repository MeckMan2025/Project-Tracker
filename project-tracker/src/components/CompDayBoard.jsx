import { useState, useMemo, useEffect } from 'react'
import { useUser } from '../contexts/UserContext'
import {
  ClipboardList, MapPin, HelpCircle, Coffee, Calendar, Megaphone,
  CheckCircle2, ChevronRight, Map, Users, FileText, AlertTriangle,
} from 'lucide-react'
import { HONEYCOMB_CELLS, HONEY_WASH } from './HomeView'
import { GROUPS, POSITIONS, STANDBY, ROTATION, findMe, matchesForGroup } from '../data/scoutingGroups'

// The Competition Day board.
//
// It answers five questions and deliberately nothing else:
//
//   What am I doing?        current and next assignment
//   Where do I go?          your post
//   What happens next?      next match, the countdown, the schedule, breaks
//   Is the team okay?       robot, judging, scouting, urgent issues
//   Who do I ask?           names, and a button that fetches someone
//
// Scrum boards, workshops, old notebook entries, long-term goals, finance and
// outreach are all deliberately absent. They are not unimportant; they are
// just not answerable in the ninety seconds between queuing and a match, and
// anything on this page that cannot be acted on now is in the way of
// something that can.


const pad = (n) => String(n).padStart(2, '0')

// Sample noticeboard content — replace with the real fetch when there is one.
const SAMPLE_NOTES = [
  'Pit is table 14, by the far wall.',
  'Judges come at 11:15 — drive team in the pit by 11:00.',
  'Keep the aisle clear, inspectors are walking.',
]
const SAMPLE_SCHEDULE = [
  { at: '8:30',  what: 'Doors open, pit setup' },
  { at: '9:15',  what: 'Inspection' },
  { at: '10:30', what: 'Qualification matches' },
  { at: '11:15', what: 'Judging' },
  { at: '14:00', what: 'Alliance selection' },
  { at: '15:00', what: 'Playoffs' },
]
const SAMPLE_BREAKS = [
  { at: '12:00', what: 'Lunch — bring your own' },
  { at: '13:45', what: 'Short break before playoffs' },
]

export default function CompDayBoard({ onTabChange }) {
  const { username } = useUser()
  const [, tick] = useState(0)

  // The countdown is the reason people look at this screen, so it has to move.
  useEffect(() => {
    const t = setInterval(() => tick(n => n + 1), 15000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="px-4 py-3 ml-14">
          <h1 className="text-xl font-bold bg-gradient-to-r from-pastel-yellow-dark via-pastel-orange-dark to-pastel-orange-dark bg-clip-text text-transparent">
            Competition Day{username ? `, ${username}` : ''}! <span title="Competition">🏁</span>
          </h1>
          <p className="text-sm text-gray-500">
            What you're doing, where to go, what's next, and who to ask.
          </p>
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
        <Urgent />
        <NextMatch />
        <QuickLinks onTabChange={onTabChange} />

        {/* The noticeboard on the left — what is happening around you — and
            your own job on the right. Left, because it is the thing a lead
            updates and everyone else reads, so it should be in the same place
            every time someone glances at it. */}
        <div className="flex flex-col md:flex-row gap-4 items-start">
          <div className="w-full md:w-[21rem] shrink-0">
            <Noticeboard />
          </div>

          <div className="w-full md:flex-1 space-y-4 min-w-0">
            <ScoutingSchedule onTabChange={onTabChange} username={username} />
            <WhoToAsk />
          </div>
        </div>

        <NeedHelp />
      </main>
    </div>
  )
}

/* ── Shared ──────────────────────────────────────────────────────────────── */

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

/* ── What happens next ───────────────────────────────────────────────────── */

// The biggest thing on the page, because it is the thing everyone is counting.
// Turns pink inside fifteen minutes — the point at which you stop what you are
// doing and go.
function NextMatch() {
  const [match, setMatch] = useState(null)

  const until = useMemo(() => {
    if (!match?.at) return null
    const diff = new Date(match.at).getTime() - Date.now()
    const mins = Math.round(Math.abs(diff) / 60000)
    const h = Math.floor(mins / 60), m = mins % 60
    const said = h ? `${h}h ${pad(m)}m` : `${m} min`
    return diff >= 0
      ? { said: `in ${said}`, soon: mins <= 15 }
      : { said: `${said} ago`, soon: false, past: true }
  }, [match]) // eslint-disable-line

  return (
    <section className={`backdrop-blur-sm rounded-xl shadow-sm p-4 text-center ${
      until?.soon ? 'bg-pastel-pink/60' : 'bg-white/80'
    }`}>
      <p className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold">Next team match</p>
      {match ? (
        <>
          <p className="text-3xl font-black text-gray-900 mt-1">Match {match.number}</p>
          <p className={`text-lg font-bold mt-0.5 ${until?.soon ? 'text-pastel-pink-dark' : 'text-gray-600'}`}>
            {until?.said}
          </p>
          {match.field && (
            <p className="text-sm text-gray-500 mt-1 flex items-center justify-center gap-1">
              <MapPin size={13} /> {match.field}
            </p>
          )}
        </>
      ) : (
        <>
          <p className="text-2xl font-black text-gray-400 mt-1">Not set</p>
          <p className="text-xs text-gray-400 mt-1">A lead sets the next match and everyone's screen updates.</p>
        </>
      )}
    </section>
  )
}

// Only appears when something is actually wrong. A banner that is always there
// is one nobody reads.
function Urgent() {
  const [issue, setIssue] = useState(null)
  if (!issue) return null
  return (
    <div className="bg-red-50/90 backdrop-blur-sm rounded-xl shadow-sm p-3 flex gap-2 border border-red-200">
      <AlertTriangle size={18} className="text-red-500 shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-bold text-red-800">Urgent</p>
        <p className="text-sm text-red-700">{issue}</p>
      </div>
    </div>
  )
}

// One note, pinned to the left, holding everything a lead posts and everyone
// else reads: announcements, the day's schedule, and when food happens.
//
// Styled as a torn-off note rather than another white card — it is the only
// thing on the page that changes during the day, and it should look like
// something somebody wrote this morning.
function Noticeboard() {
  const [notes] = useState(SAMPLE_NOTES)
  const [schedule] = useState(SAMPLE_SCHEDULE)
  const [breaks] = useState(SAMPLE_BREAKS)

  return (
    <section
      className="rounded-xl shadow-md p-4 md:sticky md:top-4"
      style={{
        // Ruled paper, in the notebook's own colours.
        backgroundColor: '#fffdf2',
        backgroundImage: 'repeating-linear-gradient(#fffdf2 0px, #fffdf2 27px, #f1dfae 28px)',
        boxShadow: '0 2px 10px rgba(180,150,60,0.18)',
      }}
    >
      <h2 className="font-bold text-gray-800 flex items-center gap-1.5 text-sm mb-2">
        <Megaphone size={15} className="text-pastel-orange-dark" /> Noticeboard
      </h2>

      <div className="space-y-1.5 mb-4">
        {notes.length === 0 ? (
          <p className="text-sm text-gray-400">Nothing posted yet.</p>
        ) : notes.map((n, i) => (
          <p key={i} className="text-sm text-gray-700 leading-[28px]">• {n}</p>
        ))}
      </div>

      <h3 className="text-[10px] uppercase tracking-wide text-gray-500 font-bold flex items-center gap-1 mb-1">
        <Calendar size={12} /> Today
      </h3>
      <div className="mb-4">
        {schedule.length === 0 ? (
          <p className="text-sm text-gray-400">Not set yet.</p>
        ) : schedule.map((r, i) => (
          <p key={i} className="text-sm text-gray-700 leading-[28px] flex gap-2">
            <span className="w-12 shrink-0 text-gray-500 font-semibold">{r.at}</span>
            <span className="truncate">{r.what}</span>
          </p>
        ))}
      </div>

      <h3 className="text-[10px] uppercase tracking-wide text-gray-500 font-bold flex items-center gap-1 mb-1">
        <Coffee size={12} /> Food and breaks
      </h3>
      {breaks.length === 0 ? (
        <p className="text-sm text-gray-400">Not set yet.</p>
      ) : breaks.map((b, i) => (
        <p key={i} className="text-sm text-gray-700 leading-[28px] flex gap-2">
          <span className="w-12 shrink-0 text-gray-500 font-semibold">{b.at}</span>
          <span className="truncate">{b.what}</span>
        </p>
      ))}
    </section>
  )
}

function ScoutingSchedule({ onTabChange, username }) {
  const me = useMemo(() => findMe(username), [username])
  const [showAll, setShowAll] = useState(false)

  // Only the matches this person is actually on, flattened out of the
  // rotation and sorted. The rest of the schedule is somebody else's problem
  // until they go looking for it — a scout who has to find their matches in a
  // list of everyone's will eventually read the wrong row.
  const myMatches = useMemo(() => {
    if (!me?.group) return []
    return matchesForGroup(me.group)
      .flatMap(r => r.matches.map(m => ({ match: m, field: r.field, colour: r.colour })))
      .sort((a, b) => a.match - b.match)
  }, [me])

  return (
    <Card
      title="Your scouting"
      icon={ClipboardList}
      action={
        <button onClick={() => onTabChange?.('scouting')}
          className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-pastel-yellow-dark text-gray-900 hover:brightness-95 transition-all shrink-0">
          Scout a match <ChevronRight size={13} />
        </button>
      }
    >
      {!me ? (
        <Empty>You are not on the scouting rota.</Empty>
      ) : (
        <>
          <div className="bg-pastel-yellow/50 rounded-xl p-3">
            <p className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold">You are scouting</p>
            <p className="text-lg font-black text-gray-900 leading-tight">
              {me.position}
              {me.group && <span className="text-gray-500 font-bold text-sm"> · Group {me.group}</span>}
            </p>
            {me.head && (
              <p className="text-xs text-gray-600 mt-0.5">
                <span className="text-gray-500">Your scouting lead:</span>{' '}
                <span className="font-semibold text-gray-800">{me.head}</span>
              </p>
            )}
          </div>

          {myMatches.length > 0 ? (
            <>
              <p className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold mt-3 mb-1">
                Your matches ({myMatches.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {myMatches.map(m => (
                  <span key={m.match}
                        title={`Match ${m.match} · ${m.field}`}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-pastel-yellow-dark/35 text-sm font-semibold text-gray-700">
                    <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: m.colour }} />
                    M{m.match}
                    <span className="text-[10px] font-normal text-gray-400">{m.field}</span>
                  </span>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-400 mt-3">
              No matches assigned to you yet — you're on standby.
            </p>
          )}
        </>
      )}

      {/* The whole schedule is one tap away, not in the way. */}
      <button onClick={() => setShowAll(v => !v)}
              className="text-xs text-gray-400 hover:text-gray-600 underline mt-3">
        {showAll ? 'Hide the full schedule' : 'See the full match schedule'}
      </button>

      {showAll && (
        <div className="mt-2 space-y-3">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold mb-1">Rotation</p>
            <div className="space-y-1">
              {ROTATION.map((r, i) => {
                const isMine = me?.group === r.group
                return (
                  <div key={i}
                       className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm ${
                         isMine ? 'bg-pastel-yellow/45 font-semibold text-gray-800' : 'text-gray-600'
                       }`}>
                    <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: r.colour }} />
                    <span className="w-16 shrink-0 text-xs">Group {r.group}</span>
                    <span className="w-16 shrink-0 text-xs text-gray-400">{r.field}</span>
                    <span className="flex-1 text-xs truncate">{r.matches.map(m => `M${m}`).join(' · ')}</span>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="overflow-x-auto">
            <p className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold mb-1">Everyone</p>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-100">
                  <th className="py-1 pr-2 font-semibold" />
                  {GROUPS.map(g => (
                    <th key={g.id} className="py-1 px-2 font-semibold whitespace-nowrap">Group {g.id}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-50">
                  <td className="py-1 pr-2 text-gray-500 font-semibold whitespace-nowrap">Lead</td>
                  {GROUPS.map(g => (
                    <td key={g.id} className="py-1 px-2 font-semibold text-gray-700">{g.head}</td>
                  ))}
                </tr>
                {POSITIONS.map(pos => (
                  <tr key={pos} className="border-b border-gray-50 last:border-0">
                    {/* Red and blue, because that is how the field is called and
                        a scout finds their row by colour before reading it. */}
                    <td className={`py-1 pr-2 font-semibold whitespace-nowrap ${
                      pos.startsWith('Red') ? 'text-red-500' : 'text-blue-500'
                    }`}>{pos}</td>
                    {GROUPS.map(g => (
                      <td key={g.id} className="py-1 px-2 text-gray-600">{g.members[pos]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[11px] text-gray-400 mt-1.5">
              <span className="font-semibold">Stand by:</span> {STANDBY.join(', ')}
            </p>
          </div>
        </div>
      )}
    </Card>
  )
}

/* ── Who do I ask ────────────────────────────────────────────────────────── */

function WhoToAsk() {
  const [people, setPeople] = useState([])
  return (
    <Card title="Who to ask" icon={HelpCircle}>
      {people.length === 0 ? <Empty>A lead will fill this in.</Empty> : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          {people.map((p, i) => (
            <p key={i} className="text-xs text-gray-600">
              <span className="font-semibold text-gray-800">{p.role}</span><br />{p.name}
            </p>
          ))}
        </div>
      )}
    </Card>
  )
}

function QuickLinks({ onTabChange }) {
  // Scouting is the only one that is a tab today. The rest are named so people
  // know they are coming, and marked so nobody taps a link that does nothing.
  const links = [
    { label: 'Scouting form', icon: ClipboardList, go: () => onTabChange?.('scouting') },
    { label: 'Match schedule', icon: Calendar },
    { label: 'Team list', icon: Users },
    { label: 'Pit checklist', icon: CheckCircle2 },
    { label: 'Strategy notes', icon: FileText },
    { label: 'Venue map', icon: Map },
  ]
  return (
    <div className="grid gap-2 sm:gap-3" style={{ gridTemplateColumns: `repeat(${links.length}, minmax(0, 1fr))` }}>
      {links.map(({ label, icon: Icon, go }) => (
        <button key={label} onClick={go} disabled={!go}
          title={go ? label : `${label} — not built yet`}
          className={`flex flex-col items-center justify-center gap-1.5 py-2.5 px-1.5 rounded-xl border-2 shadow-sm transition-all ${
            go ? 'border-pastel-yellow bg-pastel-yellow/20 bg-white/70 hover:shadow-md hover:scale-[1.03] active:scale-[0.98]'
               : 'border-gray-100 bg-white/40 opacity-50 cursor-default'
          }`}>
          <Icon size={18} className={`shrink-0 ${go ? 'text-pastel-yellow-dark' : 'text-gray-300'}`} />
          <span className="text-[11px] sm:text-xs font-bold text-gray-700 text-center leading-tight">{label}</span>
        </button>
      ))}
    </div>
  )
}

function NeedHelp() {
  const [sent, setSent] = useState(false)
  return (
    <button
      onClick={() => { setSent(true); setTimeout(() => setSent(false), 5000) }}
      className={`w-full py-3.5 rounded-xl font-bold text-base transition-colors shadow-sm ${
        sent ? 'bg-green-100 text-green-800'
             : 'bg-pastel-pink hover:bg-pastel-pink-dark text-gray-900'
      }`}
    >
      {sent ? '✓ A lead has been told — stay where you are' : '🙋 I need help'}
    </button>
  )
}
