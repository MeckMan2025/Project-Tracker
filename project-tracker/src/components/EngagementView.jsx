import { useState, useEffect, useMemo } from 'react'
import { Activity, Users, TrendingUp } from 'lucide-react'
import NotificationBell from './NotificationBell'
import { ACTIVE_SEASON } from '../data/season'

const REST_URL = import.meta.env.VITE_SUPABASE_URL
const REST_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const headers = { apikey: REST_KEY, Authorization: `Bearer ${REST_KEY}` }

// How engaged people said they felt, as a number we can average. The notebook
// only offers these three, so the scale is 0–100 with nothing in between.
const SCORE = { Very: 100, Somewhat: 50, Not: 0 }
const BANDS = [
  { key: 'Very', label: 'Very', colour: '#63c39a' },
  { key: 'Somewhat', label: 'Somewhat', colour: '#f0a868' },
  { key: 'Not', label: 'Not', colour: '#f28fb4' },
]

const prettyDate = (d) =>
  new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

export default function EngagementView() {
  const [entries, setEntries] = useState(null)
  const [season, setSeason] = useState(ACTIVE_SEASON)

  useEffect(() => {
    let live = true
    fetch(`${REST_URL}/rest/v1/notebook_entries?select=meeting_date,engagement,username,season&order=meeting_date`,
      { headers })
      .then(r => (r.ok ? r.json() : []))
      .then(rows => { if (live) setEntries(Array.isArray(rows) ? rows : []) })
      .catch(() => { if (live) setEntries([]) })
    return () => { live = false }
  }, [])

  const seasons = useMemo(() => {
    const s = [...new Set((entries || []).map(e => e.season).filter(Boolean))]
    return s.sort().reverse()
  }, [entries])

  // One point per meeting: the average of what everyone who wrote an entry
  // that day said. A meeting nobody logged simply isn't a point — inventing a
  // zero for it would read as the team having a terrible day.
  const meetings = useMemo(() => {
    if (!entries) return []
    const byDate = {}
    entries
      .filter(e => e.meeting_date && SCORE[e.engagement] !== undefined)
      .filter(e => season === 'all' || e.season === season)
      .forEach(e => {
        const d = (byDate[e.meeting_date] ||= { date: e.meeting_date, total: 0, n: 0, Very: 0, Somewhat: 0, Not: 0 })
        d.total += SCORE[e.engagement]
        d.n += 1
        d[e.engagement] += 1
      })
    return Object.values(byDate)
      .map(d => ({ ...d, avg: Math.round(d.total / d.n) }))
      .sort((a, b) => (a.date < b.date ? -1 : 1))
  }, [entries, season])

  const stats = useMemo(() => {
    if (meetings.length === 0) return null
    const all = meetings.reduce((a, m) => a + m.total, 0) / meetings.reduce((a, m) => a + m.n, 0)
    const people = new Set(entries.filter(e => season === 'all' || e.season === season).map(e => e.username))
    // Last three against the three before, so "trending" means something more
    // than one good meeting.
    const recent = meetings.slice(-3)
    const prior = meetings.slice(-6, -3)
    const mean = (xs) => xs.reduce((a, m) => a + m.avg, 0) / (xs.length || 1)
    return {
      avg: Math.round(all),
      meetings: meetings.length,
      people: people.size,
      trend: prior.length ? Math.round(mean(recent) - mean(prior)) : null,
    }
  }, [meetings, entries, season])

  if (entries === null) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-gray-400 animate-pulse">Loading engagement…</p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="px-4 py-3 ml-14 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-pastel-blue-dark via-pastel-pink-dark to-pastel-orange-dark bg-clip-text text-transparent">
              Engagement
            </h1>
            <p className="text-sm text-gray-500">How engaged people said they felt, meeting by meeting</p>
          </div>
          <NotificationBell />
        </div>
      </header>

      <main className="flex-1 p-4 overflow-y-auto space-y-4">

        {seasons.length > 1 && (
          <div className="flex gap-2 flex-wrap">
            {['all', ...seasons].map(s => (
              <button
                key={s}
                onClick={() => setSeason(s)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  season === s ? 'bg-pastel-blue text-gray-800' : 'bg-white text-gray-500 hover:bg-gray-100 border border-gray-100'
                }`}
              >
                {s === 'all' ? 'All seasons' : s}
              </button>
            ))}
          </div>
        )}

        {meetings.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
            <Activity size={34} className="mx-auto text-gray-300 mb-2" />
            <p className="text-gray-500 font-medium">No engagement logged yet</p>
            <p className="text-sm text-gray-400 mt-1">
              It comes from the engagement question on an Engineering Notebook entry.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: Activity, label: 'Average', value: `${stats.avg}%`, hint: 'across every entry' },
                { icon: Users, label: 'People', value: stats.people, hint: 'have logged one' },
                {
                  icon: TrendingUp,
                  label: 'Trend',
                  value: stats.trend === null ? '—' : `${stats.trend > 0 ? '+' : ''}${stats.trend}`,
                  hint: stats.trend === null ? 'needs 6 meetings' : 'last 3 vs previous 3',
                },
              ].map(({ icon: Icon, label, value, hint }) => (
                <div key={label} className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 text-center">
                  <Icon size={16} className="mx-auto text-pastel-blue-dark mb-1" />
                  <p className="text-xl font-bold text-gray-700 leading-none">{value}</p>
                  <p className="text-[11px] font-semibold text-gray-500 mt-1">{label}</p>
                  <p className="text-[10px] text-gray-400">{hint}</p>
                </div>
              ))}
            </div>

            <Chart meetings={meetings} />

            <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <h2 className="font-semibold text-gray-700 mb-3">Every meeting</h2>
              <div className="space-y-1.5">
                {[...meetings].reverse().map(m => (
                  <div key={m.date} className="flex items-center gap-3">
                    <span className="w-16 shrink-0 text-xs text-gray-500">{prettyDate(m.date)}</span>
                    {/* The split of answers, not just the average — three people
                        saying "Somewhat" is a different day from one "Not" and
                        two "Very", and they average the same. */}
                    <div className="flex-1 h-5 rounded-full overflow-hidden flex bg-gray-100" title={
                      BANDS.map(b => `${m[b.key]} ${b.label}`).join(' · ')
                    }>
                      {BANDS.map(b => m[b.key] > 0 && (
                        <div
                          key={b.key}
                          style={{ width: `${(m[b.key] / m.n) * 100}%`, background: b.colour }}
                        />
                      ))}
                    </div>
                    <span className="w-10 shrink-0 text-right text-xs font-semibold text-gray-600">{m.avg}%</span>
                    <span className="w-14 shrink-0 text-right text-[11px] text-gray-400">
                      {m.n} {m.n === 1 ? 'entry' : 'entries'}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex gap-4 mt-3 pt-3 border-t border-gray-100">
                {BANDS.map(b => (
                  <span key={b.key} className="flex items-center gap-1.5 text-[11px] text-gray-500">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: b.colour }} />
                    {b.label}
                  </span>
                ))}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  )
}

// A plain SVG line, because one dependency-free chart beats pulling a library
// in for a single screen.
function Chart({ meetings }) {
  const W = 700, H = 180, PAD = { l: 30, r: 10, t: 12, b: 26 }
  const iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b
  const x = (i) => PAD.l + (meetings.length === 1 ? iw / 2 : (i / (meetings.length - 1)) * iw)
  const y = (v) => PAD.t + ih - (v / 100) * ih

  const line = meetings.map((m, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(m.avg).toFixed(1)}`).join(' ')
  const area = `${line} L ${x(meetings.length - 1).toFixed(1)} ${(PAD.t + ih).toFixed(1)} L ${x(0).toFixed(1)} ${(PAD.t + ih).toFixed(1)} Z`
  // A label under every point turns to mush past a dozen meetings.
  const step = Math.ceil(meetings.length / 8)

  return (
    <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <h2 className="font-semibold text-gray-700 mb-1">Across the season</h2>
      <p className="text-xs text-gray-400 mb-2">Average per meeting. Hover a point for the day.</p>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[420px]" role="img"
             aria-label="Average engagement per meeting">
          {[0, 50, 100].map(v => (
            <g key={v}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke="#eceaf5" strokeWidth="1" />
              <text x={PAD.l - 6} y={y(v) + 3} textAnchor="end" fontSize="9" fill="#9ca3af">{v}</text>
            </g>
          ))}
          <path d={area} fill="#7aa7f0" fillOpacity="0.12" />
          <path d={line} fill="none" stroke="#4d7fd6" strokeWidth="2"
                strokeLinejoin="round" strokeLinecap="round" />
          {meetings.map((m, i) => (
            <g key={m.date}>
              <circle cx={x(i)} cy={y(m.avg)} r="3.5" fill="#fff" stroke="#4d7fd6" strokeWidth="2">
                <title>{`${prettyDate(m.date)} — ${m.avg}% from ${m.n} ${m.n === 1 ? 'entry' : 'entries'}`}</title>
              </circle>
              {i % step === 0 && (
                <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="9" fill="#9ca3af">
                  {prettyDate(m.date)}
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>
    </section>
  )
}
