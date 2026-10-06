import { useState, useEffect, useMemo } from 'react'
import { useUser } from '../contexts/UserContext'
import { usePermissions } from '../hooks/usePermissions'
import { ACTIVE_SEASON, seasonOf } from '../data/season'
import { SIGNALS, SIGNAL_BY_KEY, signalsOf, answersFor } from '../data/notebookSignals'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'

// Team Growth reads the engineering notebook and nothing else. Every number on
// this page is a count of entries people actually wrote, which is why clicking
// any of them shows those entries: a number nobody can trace back to the work
// is a number nobody should act on.
//
// Deliberately not a scoreboard. There is no per-member ranking here, no
// scores, and no award predictions — the questions it answers are "is the team
// testing more than it was in September" and "who is helping whom", not "who
// is best".

const COLS = 'id,username,meeting_date,category,custom_category,what_did,' +
  'engagement,engagement_note,project_id,season,created_at,signals,signal_data,next_step'

const ENGAGEMENT_SCORE = { Very: 100, Somewhat: 55, Not: 10 }

// The three answers, with the colours the old Engagement page used.
const BANDS = [
  { key: 'Very',     label: 'Very engaged', colour: '#6ea97f' },
  { key: 'Somewhat', label: 'Somewhat',     colour: '#e0b65c' },
  { key: 'Not',      label: 'Not engaged',  colour: '#d98a8a' },
]

// One topic per screen. Ordered the way you'd actually read it: what happened,
// then how it felt, then each part of the work in turn.
const SECTIONS = [
  { key: 'overview',   emoji: '📋', label: 'Overview',           blurb: 'everything at a glance' },
  { key: 'engagement', emoji: '📈', label: 'Engagement',         blurb: 'how the team has been feeling' },
  { key: 'learning',   emoji: '💡', label: 'Learning',           blurb: 'what people picked up, and how sure they feel' },
  { key: 'help',       emoji: '🤝', label: 'Help & Mentoring',   blurb: 'who helped whom, and what changed' },
  { key: 'testing',    emoji: '🧪', label: 'Testing & Iteration', blurb: 'what we tried, changed, and learned' },
  { key: 'teamwork',   emoji: '👥', label: 'Teamwork',           blurb: 'who worked together, and why it helped' },
  { key: 'initiative', emoji: '🚀', label: 'Initiative',         blurb: 'work people started on their own' },
  { key: 'next',       emoji: '➡️', label: "What's Next",        blurb: 'what people said they\'d pick up' },
]

const prettyDate = (d) => {
  try {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } catch { return d }
}

export default function TeamGrowthView() {
  const { username } = useUser()
  const { canOrganizeNotebook: isLead } = usePermissions()
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  const [entries, setEntries] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [unavailable, setUnavailable] = useState(false)

  // Filters. Season and whole-team are the defaults the spec asks for.
  const [season, setSeason] = useState(ACTIVE_SEASON)
  const [member, setMember] = useState('')
  const [project, setProject] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  // Which series the activity chart is drawing.
  const [series, setSeries] = useState(() => SIGNALS.map(s => s.key))
  // The entries behind a number someone clicked.
  const [drill, setDrill] = useState(null)
  // Which topic is on screen.
  const [section, setSection] = useState(0)

  useEffect(() => {
    let alive = true
    const headers = { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
    ;(async () => {
      try {
        const [eRes, pRes] = await Promise.all([
          fetch(`${supabaseUrl}/rest/v1/notebook_entries?select=${COLS}&order=meeting_date.desc`, { headers }),
          fetch(`${supabaseUrl}/rest/v1/notebook_projects?select=id,name`, { headers }),
        ])
        if (!eRes.ok) {
          // The columns don't exist until the migration runs. Say so plainly
          // rather than drawing a page of zeroes that looks like bad news.
          const body = await eRes.text().catch(() => '')
          if (alive && /signals|signal_data|next_step/.test(body)) setUnavailable(true)
          throw new Error(body)
        }
        const data = await eRes.json()
        if (alive) setEntries(Array.isArray(data) ? data : [])
        if (pRes.ok) {
          const p = await pRes.json()
          if (alive) setProjects(Array.isArray(p) ? p : [])
        }
      } catch (err) {
        console.error('Failed to load notebook entries:', err)
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, []) // eslint-disable-line

  // The notebook's own rule, unchanged: your own entries unless you're a lead.
  // This reads notebook rows, so it must not be looser than the notebook.
  const visible = useMemo(
    () => (isLead ? entries : entries.filter(e => e.username === username)),
    [entries, isLead, username],
  )

  const rows = useMemo(() => {
    let out = visible.filter(e => seasonOf(e) === season)
    if (member) out = out.filter(e => e.username === member)
    if (project) out = out.filter(e => e.project_id === project)
    if (from) out = out.filter(e => (e.meeting_date || '') >= from)
    if (to) out = out.filter(e => (e.meeting_date || '') <= to)
    return out
  }, [visible, season, member, project, from, to])

  const seasons = useMemo(() => {
    const set = new Set([ACTIVE_SEASON])
    visible.forEach(e => set.add(seasonOf(e)))
    return Array.from(set).sort().reverse()
  }, [visible])

  const members = useMemo(
    () => Array.from(new Set(visible.map(e => e.username).filter(Boolean))).sort(),
    [visible],
  )

  // ── The numbers ──────────────────────────────────────────────────────────
  const withSignal = (key) => rows.filter(e => signalsOf(e).includes(key))

  const avgEngagement = useMemo(() => {
    const scored = rows.map(e => ENGAGEMENT_SCORE[e.engagement]).filter(v => v != null)
    if (scored.length === 0) return null
    return Math.round(scored.reduce((a, b) => a + b, 0) / scored.length)
  }, [rows])

  // Counts by meeting date, one row per signal. The chart and the drill-down
  // both read this, so a bar and the entries behind it can never disagree.
  const byDate = useMemo(() => {
    const dates = Array.from(new Set(rows.map(e => e.meeting_date).filter(Boolean))).sort()
    return dates.map(d => {
      const dayEntries = rows.filter(e => e.meeting_date === d)
      const counts = {}
      SIGNALS.forEach(s => { counts[s.key] = dayEntries.filter(e => signalsOf(e).includes(s.key)).length })
      const scored = dayEntries.map(e => ENGAGEMENT_SCORE[e.engagement]).filter(v => v != null)
      // How the answers split, not just what they average to — three people
      // saying "Somewhat" is a different day from one "Not" and two "Very",
      // and the two average the same.
      const bands = {}
      BANDS.forEach(b => { bands[b.key] = dayEntries.filter(e => e.engagement === b.key).length })
      return {
        date: d,
        entries: dayEntries.length,
        rated: scored.length,
        bands,
        counts,
        engagement: scored.length ? Math.round(scored.reduce((a, b) => a + b, 0) / scored.length) : null,
      }
    })
  }, [rows])

  // Tally one follow-up answer across every entry carrying that signal.
  //
  // Seeded with every option the question offers, so the chart shows the whole
  // scale from the start and keeps its shape as answers arrive. A choice
  // nobody picked is a result in its own right — "nothing failed because of
  // wiring this month" is worth seeing, and a list that drops empty rows hides
  // it. Anything written in an "Other" box is appended after.
  const tally = (signalKey, questionId) => {
    const q = (SIGNAL_BY_KEY[signalKey]?.questions || []).find(x => x.id === questionId)
    const counts = new Map((q?.options || []).map(o => [o, 0]))
    withSignal(signalKey).forEach(e => {
      const v = answersFor(e, signalKey)[questionId]
      if (v && String(v).trim()) counts.set(v, (counts.get(v) || 0) + 1)
    })
    // Highest first, but ties keep the order the question asks them in, so the
    // scale reads the way it was written rather than reshuffling each visit.
    const order = q?.options || []
    return Array.from(counts).sort((a, b) =>
      b[1] - a[1] || (order.indexOf(a[0]) - order.indexOf(b[0])))
  }

  const texts = (signalKey, questionId) =>
    withSignal(signalKey)
      .map(e => ({
        key: `${e.id}:${questionId}`,
        date: e.meeting_date,
        who: e.username,
        text: answersFor(e, signalKey)[questionId],
      }))
      .filter(r => r.text && String(r.text).trim())

  // True when not a single entry in view carries a signal — which is the
  // normal state right after the feature ships, not a fault.
  const noSignalsYet = rows.length > 0 && rows.every(e => signalsOf(e).length === 0)

  // How the three answers split. Not a signal, so it has its own tally — and
  // unlike the signals it has history: engagement has been asked, and its note
  // required, since long before any of this.
  const engagementSplit = ['Very', 'Somewhat', 'Not']
    .map(level => [level, rows.filter(e => e.engagement === level).length])

  const engagementNotes = rows
    .filter(e => (e.engagement_note || '').trim())
    .map(e => ({
      key: `${e.id}:note`,
      date: e.meeting_date,
      who: e.username,
      text: e.engagement_note,
      tag: e.engagement,
    }))

  const openDrill = (title, list) => {
    if (!list.length) return
    setDrill({ title, entries: list })
  }

  // A point on a line is one meeting. Clicking it opens that day's entries,
  // the same way clicking a bar opens the entries behind a count.
  const openDay = (date) => openDrill(
    new Date(date + 'T00:00:00').toLocaleDateString('en-US',
      { weekday: 'long', month: 'long', day: 'numeric' }),
    rows.filter(e => e.meeting_date === date),
  )

  const drillAnswer = (title, signalKey, questionId, value) =>
    openDrill(title, withSignal(signalKey).filter(e => answersFor(e, signalKey)[questionId] === value))

  if (loading) {
    return <Frame><p className="text-sm text-gray-400 text-center py-12">Loading…</p></Frame>
  }

  if (unavailable) {
    return (
      <Frame>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-10 text-center">
          <p className="text-gray-600 font-medium">Not set up yet.</p>
          <p className="text-sm text-gray-400 mt-1 max-w-md mx-auto">
            The notebook needs its three evidence columns before this page has
            anything to read. Run <code className="text-gray-500">supabase/notebook_signals.sql</code>,
            then reload.
          </p>
        </div>
      </Frame>
    )
  }

  const sec = SECTIONS[Math.min(section, SECTIONS.length - 1)]
  const go = (delta) => setSection(prev =>
    (prev + delta + SECTIONS.length) % SECTIONS.length)

  return (
    <Frame
      sub={`${rows.length} ${rows.length === 1 ? 'entry' : 'entries'}${isLead ? '' : ' — yours'}`}
      filters={
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
          <Select value={season} onChange={setSeason}
                  options={seasons.map(s => [s, s === ACTIVE_SEASON ? `${s} (current)` : `${s} — archive`])} />
          {isLead && members.length > 1 && (
            <Select value={member} onChange={setMember}
                    options={[['', 'Everyone'], ...members.map(m => [m, m])]} />
          )}
          {projects.length > 0 && (
            <Select value={project} onChange={setProject}
                    options={[['', 'All projects'], ...projects.map(p => [p.id, p.name])]} />
          )}
          <span className="text-gray-400">from</span>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
                 className="border rounded-lg px-2 py-1 text-xs" />
          <span className="text-gray-400">to</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
                 className="border rounded-lg px-2 py-1 text-xs" />
          {(member || project || from || to) && (
            <button onClick={() => { setMember(''); setProject(''); setFrom(''); setTo('') }}
                    className="text-gray-400 hover:text-gray-600 underline">
              clear
            </button>
          )}
        </div>
      }
    >
      {rows.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-10 text-center">
          <p className="text-gray-500 font-medium">Nothing to show for these filters.</p>
          <p className="text-sm text-gray-400 mt-1">
            This page fills itself in from notebook entries — nothing extra to do.
          </p>
        </div>
      ) : (
        <>
          {/* One topic at a time. Ten charts at once is a wall nobody reads;
              a page you can step through is one question at a time. */}
          <div className="flex items-center gap-2 bg-white rounded-xl shadow-sm border border-gray-100 p-2">
            <button onClick={() => go(-1)} title="Previous"
                    className="p-1.5 rounded-lg text-gray-400 hover:bg-pastel-blue/25 hover:text-gray-700 transition-colors">
              <ChevronLeft size={18} />
            </button>

            <select
              value={sec.key}
              onChange={e => setSection(SECTIONS.findIndex(x => x.key === e.target.value))}
              className="flex-1 min-w-0 text-sm font-semibold text-gray-700 bg-transparent text-center focus:outline-none cursor-pointer"
            >
              {SECTIONS.map(x => (
                <option key={x.key} value={x.key}>{x.emoji}  {x.label}</option>
              ))}
            </select>

            <button onClick={() => go(1)} title="Next"
                    className="p-1.5 rounded-lg text-gray-400 hover:bg-pastel-blue/25 hover:text-gray-700 transition-colors">
              <ChevronRight size={18} />
            </button>
          </div>

          <p className="text-[11px] text-gray-400 text-center -mt-1">
            {section + 1} of {SECTIONS.length} · {sec.blurb}
          </p>

          {/* Only on the pages that actually depend on signals. Engagement has
              been asked on every entry for far longer, so it has real history
              and must not be apologised for. */}
          {noSignalsYet && sec.key !== 'engagement' && (
            <div className="bg-pastel-blue/15 border border-pastel-blue/40 rounded-xl p-3 text-center">
              <p className="text-sm text-gray-700 font-medium">
                Nothing to chart yet — and that's expected.
              </p>
              <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
                All {rows.length} entries so far were written before the
                “What happened today?” question existed, so none of them carry
                it. These pages fill in on their own as people write new
                entries.
              </p>
            </div>
          )}

          {/* ── Overview ─────────────────────────────────────────────────── */}
          {sec.key === 'overview' && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                <Stat label="Notebook Entries" value={rows.length}
                      onClick={() => openDrill('Notebook entries', rows)} />
                <Stat label="Average Engagement"
                      value={avgEngagement == null ? '—' : `${avgEngagement}%`} />
                {SIGNALS.map(s => (
                  <Stat key={s.key} label={s.metric} value={withSignal(s.key).length}
                        emoji={s.emoji} tint={s.soft}
                        onClick={() => openDrill(s.metric, withSignal(s.key))} />
                ))}
              </div>

              <Card title="What we've been doing"
                    sub="Entries per meeting carrying each signal. Tap a name to show or hide it, or a point to read that day.">
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {SIGNALS.map(s => {
                    const on = series.includes(s.key)
                    return (
                      <button
                        key={s.key}
                        onClick={() => setSeries(prev =>
                          prev.includes(s.key) ? prev.filter(k => k !== s.key) : [...prev, s.key])}
                        className={`px-2 py-1 rounded-lg text-[11px] font-medium border transition-colors ${
                          on ? 'text-white border-transparent' : 'bg-white text-gray-400 border-gray-200'
                        }`}
                        style={on ? { backgroundColor: s.color } : undefined}
                      >
                        {s.emoji} {s.metric}
                      </button>
                    )
                  })}
                </div>
                <LineChart points={byDate} series={series} onPickDate={openDay} />
              </Card>
            </>
          )}

          {/* ── Engagement ───────────────────────────────────────────────── */}
          {sec.key === 'engagement' && (
            <>
              <Card title="Engagement over the season"
                    sub="Average of what people reported, per meeting. Tap a point to read that day's entries.">
                <LineChart points={byDate.filter(d => d.engagement != null)} series={['__engagement']}
                           getValue={(d) => d.engagement} max={100} suffix="%" onPickDate={openDay} />
              </Card>
              <Card title="How people rated themselves"
                    sub={`Across ${rows.length} ${rows.length === 1 ? 'entry' : 'entries'}.`}>
                <Breakdown
                  rows={engagementSplit}
                  color="#4d7fd6"
                  onPick={v => openDrill(`${v} engaged`, rows.filter(e => e.engagement === v))}
                />
              </Card>
              <Card title="Every meeting"
                    sub="The split of answers per meeting. Tap a row to read that day.">
                <div className="space-y-1.5">
                  {[...byDate].reverse().filter(m => m.rated > 0).map(m => (
                    <button key={m.date} onClick={() => openDay(m.date)}
                            className="w-full flex items-center gap-3 text-left group">
                      <span className="w-16 shrink-0 text-xs text-gray-500 group-hover:text-gray-800">
                        {prettyDate(m.date)}
                      </span>
                      <div className="flex-1 h-5 rounded-full overflow-hidden flex bg-gray-100"
                           title={BANDS.map(b => `${m.bands[b.key]} ${b.label}`).join(' · ')}>
                        {BANDS.map(b => m.bands[b.key] > 0 && (
                          <div key={b.key}
                               style={{ width: `${(m.bands[b.key] / m.rated) * 100}%`, background: b.colour }} />
                        ))}
                      </div>
                      <span className="w-10 shrink-0 text-right text-xs font-semibold text-gray-600">{m.engagement}%</span>
                      <span className="w-14 shrink-0 text-right text-[11px] text-gray-400">
                        {m.rated} {m.rated === 1 ? 'entry' : 'entries'}
                      </span>
                    </button>
                  ))}
                </div>
              </Card>
              <Responses title="Why people felt that way" items={engagementNotes} />
            </>
          )}

          {/* ── Learning ─────────────────────────────────────────────────── */}
          {sec.key === 'learning' && (
            <Card title="How sure people feel afterwards"
                  sub={`${withSignal('learned').length} learning moments. Confidence as people reported it.`}>
              <Breakdown rows={tally('learned', 'confidence')} color={SIGNAL_BY_KEY.learned.color}
                         onPick={v => drillAnswer(v, 'learned', 'confidence', v)} />
            </Card>
          )}
          {sec.key === 'learning' && (
            <Responses title="What people learned" items={texts('learned', 'what')} />
          )}

          {/* ── Help and mentoring ───────────────────────────────────────── */}
          {sec.key === 'help' && (
            <>
              <Pair>
                <Card title="Where help came from" sub={`${withSignal('help').length} times someone helped us.`}>
                  <Breakdown rows={tally('help', 'who')} color={SIGNAL_BY_KEY.help.color}
                             onPick={v => drillAnswer(`Help from ${v}`, 'help', 'who', v)} />
                </Card>
                <Card title="What that help changed">
                  <Breakdown rows={tally('help', 'result')} color={SIGNAL_BY_KEY.help.color}
                             onPick={v => drillAnswer(v, 'help', 'result', v)} />
                </Card>
              </Pair>
              <Pair>
                <Card title="How we helped each other" sub={`${withSignal('helped').length} times.`}>
                  <Breakdown rows={tally('helped', 'how')} color={SIGNAL_BY_KEY.helped.color}
                             onPick={v => drillAnswer(v, 'helped', 'how', v)} />
                </Card>
                <Card title="Could they carry on alone afterwards?"
                      sub="The point of helping someone is that they need less help next time.">
                  <Breakdown rows={tally('helped', 'independent')} color={SIGNAL_BY_KEY.helped.color}
                             onPick={v => drillAnswer(`More independent: ${v}`, 'helped', 'independent', v)} />
                </Card>
              </Pair>
              <Responses title="What people needed help with" items={texts('help', 'what')} />
              <Responses title="What people helped others with" items={texts('helped', 'what')} />
            </>
          )}

          {/* ── Testing and iteration ────────────────────────────────────── */}
          {sec.key === 'testing' && (
            <>
              <Pair>
                <Card title="How tests turned out" sub={`${withSignal('tested').length} tests written up.`}>
                  <Breakdown rows={tally('tested', 'outcome')} color={SIGNAL_BY_KEY.tested.color}
                             onPick={v => drillAnswer(v, 'tested', 'outcome', v)} />
                </Card>
                <Card title="Did the test change the plan?"
                      sub="Testing that fed a decision, rather than testing for its own sake.">
                  <Breakdown rows={tally('tested', 'changed')} color={SIGNAL_BY_KEY.tested.color}
                             onPick={v => drillAnswer(`Test changed the plan: ${v}`, 'tested', 'changed', v)} />
                </Card>
              </Pair>
              <Pair>
                <Card title="Why we changed things" sub={`${withSignal('improved').length} improvements.`}>
                  <Breakdown rows={tally('improved', 'why')} color={SIGNAL_BY_KEY.improved.color}
                             onPick={v => drillAnswer(v, 'improved', 'why', v)} />
                </Card>
                <Card title="What setbacks taught us" sub={`${withSignal('failed').length} written up.`}>
                  <Breakdown rows={tally('failed', 'cause')} color={SIGNAL_BY_KEY.failed.color}
                             onPick={v => drillAnswer(v, 'failed', 'cause', v)} />
                </Card>
              </Pair>
              <Responses title="What was tested" items={texts('tested', 'what')} />
              <Responses title="What a test changed" items={texts('tested', 'changedWhat')} />
              <Responses title="What was changed or improved" items={texts('improved', 'what')} />
              <Responses title="What to try next" items={texts('improved', 'next')} />
              <Responses title="What didn't work" items={texts('failed', 'what')} />
              <Responses title="And what it taught us" items={texts('failed', 'learned')} />
            </>
          )}

          {/* ── Teamwork ─────────────────────────────────────────────────── */}
          {sec.key === 'teamwork' && (
            <Pair>
              <Card title="Who we worked with" sub={`${withSignal('collaborated').length} collaborations.`}>
                <Breakdown rows={tally('collaborated', 'who')} color={SIGNAL_BY_KEY.collaborated.color}
                           onPick={v => drillAnswer(`Worked with ${v}`, 'collaborated', 'who', v)} />
              </Card>
              <Card title="Why working together helped">
                <Breakdown rows={tally('collaborated', 'why')} color={SIGNAL_BY_KEY.collaborated.color}
                           onPick={v => drillAnswer(v, 'collaborated', 'why', v)} />
              </Card>
            </Pair>
          )}
          {sec.key === 'teamwork' && (
            <>
              <Responses title="What people worked on together" items={texts('collaborated', 'what')} />
              <Responses title="What came out of it" items={texts('collaborated', 'outcome')} />
            </>
          )}

          {/* ── Initiative ───────────────────────────────────────────────── */}
          {sec.key === 'initiative' && (
            <Pair>
              <Card title="Initiative people took" sub={`${withSignal('initiative').length} moments.`}>
                <Breakdown rows={tally('initiative', 'did')} color={SIGNAL_BY_KEY.initiative.color}
                           onPick={v => drillAnswer(v, 'initiative', 'did', v)} />
              </Card>
              <Card title="And what came of it">
                <Breakdown rows={tally('initiative', 'result')} color={SIGNAL_BY_KEY.initiative.color}
                           onPick={v => drillAnswer(v, 'initiative', 'result', v)} />
              </Card>
            </Pair>
          )}
          {sec.key === 'initiative' && (
            <Responses title="What people noticed needed doing" items={texts('initiative', 'noticed')} />
          )}

          {/* ── What's next ──────────────────────────────────────────────── */}
          {sec.key === 'next' && (
            <Card title="Picked up next time" sub="What people wrote they'd carry into the next meeting.">
              {rows.some(e => e.next_step) ? (
                <div className="space-y-1.5">
                  {rows.filter(e => e.next_step).slice(0, 25).map(e => (
                    <p key={e.id} className="text-sm text-gray-600">
                      <span className="text-gray-400 text-xs">{prettyDate(e.meeting_date)} · {e.username} — </span>
                      {e.next_step}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400">Nothing written down yet.</p>
              )}
            </Card>
          )}
        </>
      )}

      {drill && <DrillPanel drill={drill} isLead={isLead} onClose={() => setDrill(null)} />}
    </Frame>
  )
}

// ── Layout ─────────────────────────────────────────────────────────────────

function Frame({ sub, filters, children }) {
  return (
    <div className="flex-1 flex flex-col min-w-0">
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="px-4 py-3 ml-14">
          <h1 className="text-xl font-bold bg-gradient-to-r from-pastel-blue-dark via-pastel-pink-dark to-pastel-orange-dark bg-clip-text text-transparent">
            Team Growth
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {sub ? `${sub} · ` : ''}straight from the engineering notebook
          </p>
          {filters}
        </div>
      </header>
      <main className="flex-1 p-4 overflow-y-auto">
        <div className="max-w-3xl mx-auto space-y-3">{children}</div>
      </main>
    </div>
  )
}

const Pair = ({ children }) => (
  <div className="grid md:grid-cols-2 gap-3">{children}</div>
)

const Card = ({ title, sub, children }) => (
  <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
    <h2 className="font-semibold text-gray-700">{title}</h2>
    {sub && <p className="text-xs text-gray-400 mb-2">{sub}</p>}
    <div className={sub ? '' : 'mt-2'}>{children}</div>
  </section>
)

const Select = ({ value, onChange, options }) => (
  <select value={value} onChange={e => onChange(e.target.value)}
          className="border rounded-lg px-2 py-1 text-xs focus:ring-2 focus:ring-pastel-blue focus:border-transparent">
    {options.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
  </select>
)

function Stat({ label, value, emoji, tint, onClick }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      onClick={onClick}
      className={`rounded-xl border border-gray-100 shadow-sm p-3 text-left ${
        onClick ? 'hover:shadow-md hover:scale-[1.02] transition-all cursor-pointer' : ''
      }`}
      style={{ backgroundColor: tint || '#ffffff' }}
      title={onClick ? 'Show the entries behind this' : undefined}
    >
      <p className="text-xl font-bold text-gray-800 leading-none">
        {emoji && <span className="text-sm mr-1">{emoji}</span>}
        {value}
      </p>
      <p className="text-[11px] text-gray-500 mt-1 leading-tight">{label}</p>
    </Tag>
  )
}

// The written answers behind a section. Counts tell you how often something
// happened; this tells you what it actually was, which is the half anyone
// deciding what to do next actually needs. Hidden entirely when nobody has
// written any — an empty "what people learned" box is just noise.
function Responses({ title, items }) {
  const [all, setAll] = useState(false)
  if (!items.length) return null
  const shown = all ? items : items.slice(0, 6)

  return (
    <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-semibold text-gray-700">{title}</h2>
        <span className="text-xs text-gray-400 shrink-0">{items.length}</span>
      </div>
      <div className="mt-2 space-y-2">
        {shown.map(r => (
          <div key={r.key} className="border-l-2 border-pastel-blue/50 pl-2.5">
            <p className="text-sm text-gray-700">{r.text}</p>
            <p className="text-[11px] text-gray-400">
              {prettyDate(r.date)} · {r.who}
              {r.tag && <span className="ml-1 text-gray-300">· {r.tag}</span>}
            </p>
          </div>
        ))}
      </div>
      {items.length > 6 && (
        <button onClick={() => setAll(v => !v)}
                className="mt-2 text-xs text-gray-400 hover:text-gray-600 underline">
          {all ? 'Show fewer' : `Show all ${items.length}`}
        </button>
      )}
    </section>
  )
}

// A horizontal bar per answer. Bars beat a pie for this: the labels are long
// sentences and there are often six of them.
function Breakdown({ rows, color, onPick }) {
  if (!rows.length) return null
  // Never zero: with nothing recorded yet every bar would be NaN wide.
  const max = Math.max(1, ...rows.map(([, n]) => n))
  const total = rows.reduce((sum, [, n]) => sum + n, 0)
  return (
    <div className="space-y-1.5">
      {rows.map(([label, n]) => (
        <button
          key={label}
          onClick={() => onPick?.(label)}
          className="w-full text-left group"
          title="Show the entries behind this"
        >
          <div className="flex items-baseline justify-between gap-2 text-xs">
            <span className="text-gray-600 group-hover:text-gray-900 truncate">{label}</span>
            <span className="text-gray-400 shrink-0">{n}</span>
          </div>
          <div className="h-1.5 rounded-full bg-gray-100 mt-0.5 overflow-hidden">
            <div className="h-full rounded-full transition-all"
                 style={{ width: `${(n / max) * 100}%`, backgroundColor: color }} />
          </div>
        </button>
      ))}
      {total === 0 && (
        <p className="text-[11px] text-gray-400 pt-0.5">
          Nobody has answered this yet — the scale is here, waiting.
        </p>
      )}
    </div>
  )
}

// One SVG, several lines. Matches the engagement chart already in Data rather
// than pulling a chart library in for this one page.
function LineChart({ points, series, getValue, max, suffix = '', onPickDate }) {
  if (points.length === 0) return <p className="text-sm text-gray-400">Nothing yet.</p>

  const W = 700, H = 190, PAD = { l: 28, r: 10, t: 12, b: 26 }
  const iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b

  // Named getValue, not valueOf: `valueOf` is inherited from
  // Object.prototype, so destructuring it from props never yields undefined
  // and the "no custom accessor" branch below could never be reached.
  const valueAt = (d, key) => (getValue ? getValue(d) : (d.counts[key] || 0))
  const top = max || Math.max(1, ...points.flatMap(d => series.map(k => valueAt(d, k))))

  const x = (i) => PAD.l + (points.length === 1 ? iw / 2 : (i / (points.length - 1)) * iw)
  const y = (v) => PAD.t + ih - (v / top) * ih
  const step = Math.ceil(points.length / 8)

  const ticks = max ? [0, 50, 100] : [0, Math.round(top / 2), top].filter((v, i, a) => a.indexOf(v) === i)

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[420px]" role="img" aria-label="Activity over time">
        {ticks.map(v => (
          <g key={v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke="#eceaf5" strokeWidth="1" />
            <text x={PAD.l - 6} y={y(v) + 3} textAnchor="end" fontSize="9" fill="#9ca3af">{v}{suffix}</text>
          </g>
        ))}

        {series.map(key => {
          const sig = SIGNAL_BY_KEY[key]
          const color = sig?.color || '#4d7fd6'
          const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(valueAt(p, key)).toFixed(1)}`).join(' ')
          return (
            <g key={key}>
              {series.length === 1 && (
                <path
                  d={`${d} L ${x(points.length - 1).toFixed(1)} ${(PAD.t + ih).toFixed(1)} L ${x(0).toFixed(1)} ${(PAD.t + ih).toFixed(1)} Z`}
                  fill={color} fillOpacity="0.12"
                />
              )}
              <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
              {points.map((p, i) => (
                <g key={p.date}>
                  {/* A 3px dot is an unfair target, especially on a phone, so
                      an invisible disc around it takes the tap. */}
                  <circle
                    cx={x(i)} cy={y(valueAt(p, key))} r="11" fill="transparent"
                    style={{ cursor: onPickDate ? 'pointer' : 'default' }}
                    onClick={() => onPickDate?.(p.date)}
                  >
                    <title>
                      {`${prettyDate(p.date)} — ${valueAt(p, key)}${suffix}${sig ? ` ${sig.metric.toLowerCase()}` : ''}`
                        + (onPickDate ? ' · tap to read that day' : '')}
                    </title>
                  </circle>
                  <circle
                    cx={x(i)} cy={y(valueAt(p, key))} r="3" fill="#fff" stroke={color} strokeWidth="2"
                    pointerEvents="none"
                  />
                </g>
              ))}
            </g>
          )
        })}

        {points.map((p, i) => i % step === 0 && (
          <text
            key={p.date} x={x(i)} y={H - 8} textAnchor="middle" fontSize="9" fill="#9ca3af"
            style={{ cursor: onPickDate ? 'pointer' : 'default' }}
            onClick={() => onPickDate?.(p.date)}
          >
            {prettyDate(p.date)}
          </text>
        ))}
      </svg>
    </div>
  )
}

// The entries behind a number. This is the whole point of the page: a count
// with no way back to the work is a number nobody can act on.
function DrillPanel({ drill, isLead, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
         onClick={onClose}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-xl"
           onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-2 p-4 border-b border-gray-100">
          <div>
            <h3 className="font-semibold text-gray-800">{drill.title}</h3>
            <p className="text-xs text-gray-400">
              {drill.entries.length} {drill.entries.length === 1 ? 'entry' : 'entries'}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 shrink-0">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto p-4 space-y-2">
          {drill.entries.map(e => (
            <div key={e.id} className="border border-gray-100 rounded-lg p-2.5">
              <p className="text-[11px] text-gray-400">
                {prettyDate(e.meeting_date)}
                {isLead && <> · {e.username}</>}
                {' · '}
                {e.category === 'Custom' ? (e.custom_category || 'Custom') : e.category}
              </p>
              <p className="text-sm text-gray-800 mt-0.5">{e.what_did}</p>
              {/* The note is the half that explains the rating, so it travels
                  with it rather than being left behind on another page. */}
              {e.engagement_note && (
                <p className="text-xs text-gray-500 mt-1 italic">
                  “{e.engagement_note}”
                  {e.engagement && <span className="not-italic text-gray-400"> — {e.engagement}</span>}
                </p>
              )}
              {signalsOf(e).length > 0 && (
                <p className="text-[11px] text-gray-400 mt-1">
                  {signalsOf(e).map(k => {
                    const sig = SIGNAL_BY_KEY[k]
                    return sig ? `${sig.emoji} ${sig.label}` : null
                  }).filter(Boolean).join('  ·  ')}
                </p>
              )}
              {e.next_step && (
                <p className="text-[11px] text-gray-400 mt-1">Next — {e.next_step}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
