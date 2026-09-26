import { useState, useEffect, useMemo } from 'react'
import { ArrowLeft, CalendarX, Clock, Check, AlertTriangle } from 'lucide-react'
import { useUser } from '../contexts/UserContext'

const REST_URL = import.meta.env.VITE_SUPABASE_URL
const REST_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const HEADERS = { apikey: REST_KEY, Authorization: `Bearer ${REST_KEY}` }
const JSON_HEADERS = { ...HEADERS, 'Content-Type': 'application/json' }

// The rule. Filing this far ahead is what makes a notice count for anything.
const NOTICE_HOURS = 24
// Meetings that aren't on the calendar still need a time to measure against,
// and the team's meetings start at four.
const DEFAULT_START = '16:00'

const genId = () => String(Date.now()) + Math.random().toString(36).slice(2, 8)

const prettyDay = (d) =>
  new Date(d + 'T00:00:00').toLocaleDateString('en-US',
    { weekday: 'long', month: 'long', day: 'numeric' })

// A date the browser's date input will accept, in local time — toISOString()
// is UTC and rolls over to tomorrow after about 7pm here.
const localDay = (offsetDays = 0) => {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Lives inside the Attendance tab, so it takes `embedded` and drops its own
// page chrome — no back button, no outer padding, no duplicate heading.
export default function AbsenceNotice({ onBack, embedded = false }) {
  const { username } = useUser()
  const [events, setEvents] = useState([])
  const [mine, setMine] = useState([])
  const [date, setDate] = useState(localDay(2))
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const today = localDay()
    fetch(`${REST_URL}/rest/v1/calendar_events?select=id,name,date_key,start_time,event_type&date_key=gte.${today}&order=date_key`,
      { headers: HEADERS })
      .then(r => (r.ok ? r.json() : []))
      .then(rows => setEvents(Array.isArray(rows) ? rows : []))
      .catch(() => {})
  }, [])

  const loadMine = () => {
    if (!username) return
    fetch(`${REST_URL}/rest/v1/absence_notices?username=eq.${encodeURIComponent(username)}&select=*&order=meeting_date.desc`,
      { headers: HEADERS })
      .then(r => (r.ok ? r.json() : []))
      .then(rows => setMine(Array.isArray(rows) ? rows : []))
      .catch(() => {})
  }
  useEffect(loadMine, [username])

  // Meetings on the calendar, offered as shortcuts. There often aren't any —
  // meetings get added late or not at all — so the date picker is the real
  // control and these are a convenience on top of it.
  const meetings = useMemo(
    () => events.filter(e => e.event_type === 'meeting').slice(0, 6),
    [events])

  // The meeting being reported on, and therefore what the 24 hours counts
  // against: the calendar's start time if the day is on there, else the usual one.
  const target = useMemo(() => {
    const ev = events.find(e => e.date_key === date && e.event_type === 'meeting')
      || events.find(e => e.date_key === date)
    const time = (ev?.start_time || DEFAULT_START).slice(0, 5)
    return { ev, at: new Date(`${date}T${time}:00`), time, assumed: !ev?.start_time }
  }, [events, date])

  const hoursAhead = useMemo(
    () => (target.at - new Date()) / 3600000,
    [target, date]) // eslint-disable-line
  const inTime = hoursAhead >= NOTICE_HOURS
  const past = hoursAhead <= 0

  const submit = async () => {
    setError('')
    if (!reason.trim()) { setError('Say why, even briefly — a lead has to make a call on it.'); return }
    setSaving(true)
    const row = {
      id: genId(),
      username,
      meeting_date: date,
      meeting_at: target.at.toISOString(),
      event_id: target.ev?.id || null,
      event_name: target.ev?.name || null,
      reason: reason.trim(),
      hours_before: Math.round(hoursAhead * 10) / 10,
      on_time: inTime,
    }
    try {
      // Filing again for the same day corrects the first notice rather than
      // adding a second — but the clock restarts, so a late correction is late.
      const res = await fetch(`${REST_URL}/rest/v1/absence_notices?on_conflict=username,meeting_date`, {
        method: 'POST',
        headers: { ...JSON_HEADERS, Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(row),
      })
      if (!res.ok) throw new Error(await res.text())
      setDone({ date, inTime })
      setReason('')
      loadMine()
    } catch (err) {
      console.error('Failed to file the notice:', err)
      setError("Couldn't save that. Check your connection and try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Shell embedded={embedded} onBack={onBack}>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-pastel-blue to-pastel-pink flex items-center justify-center shrink-0">
              <CalendarX size={20} className="text-gray-700" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-800 leading-tight">Let us know you'll be out</h1>
              <p className="text-xs text-gray-400">
                Tell us {NOTICE_HOURS} hours before a meeting and a lead can excuse you.
              </p>
            </div>
          </div>

          {/* The rule, up front. Reading it after being marked absent is no use. */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2">
            <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-900 leading-snug">
              Under {NOTICE_HOURS} hours and it counts as an absence — that part isn't a
              judgement call, so file it as soon as you know.
            </p>
          </div>

          {done ? (
            <div className={`rounded-xl p-4 border ${done.inTime ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <div className="flex items-center gap-2 mb-1">
                {done.inTime
                  ? <Check size={16} className="text-green-600" />
                  : <AlertTriangle size={16} className="text-red-500" />}
                <p className={`font-semibold text-sm ${done.inTime ? 'text-green-800' : 'text-red-800'}`}>
                  {done.inTime ? 'Filed in time' : 'Filed, but late'}
                </p>
              </div>
              <p className={`text-xs ${done.inTime ? 'text-green-700' : 'text-red-700'}`}>
                {done.inTime
                  ? `Your leads will see this before ${prettyDay(done.date)}.`
                  : `This is under ${NOTICE_HOURS} hours before the meeting, so it counts absent. Your leads will still see the reason.`}
              </p>
              <button onClick={() => setDone(null)}
                className="mt-3 text-xs font-semibold text-gray-600 hover:text-gray-800 underline">
                File another
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-3">

              {meetings.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Upcoming meetings</label>
                  <div className="flex flex-wrap gap-2">
                    {meetings.map(m => (
                      <button key={m.id} onClick={() => setDate(m.date_key)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                          date === m.date_key ? 'bg-pastel-blue text-gray-800' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}>
                        {new Date(m.date_key + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Which day will you miss?</label>
                <input type="date" value={date} min={localDay()}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-pastel-blue focus:border-transparent" />
              </div>

              {/* What the 24 hours is being measured against, before they commit
                  to it — so a late notice is never a surprise. */}
              <div className={`rounded-lg px-3 py-2 flex items-start gap-2 text-xs ${
                past ? 'bg-gray-100 text-gray-500'
                  : inTime ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                <Clock size={14} className="shrink-0 mt-0.5" />
                <span>
                  {past
                    ? 'That meeting has already started.'
                    : <>
                        <b>{Math.floor(hoursAhead)} hours</b> before {prettyDay(date)}
                        {' '}at {target.time}
                        {target.assumed && <span className="opacity-70"> (assumed start time — it isn't on the calendar)</span>}.
                        {' '}{inTime ? 'That counts.' : `Under ${NOTICE_HOURS} hours, so this would count absent.`}
                      </>}
                </span>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Why?</label>
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
                  placeholder="Doctor's appointment, family thing, away game…"
                  className="w-full px-3 py-2 border rounded-lg text-sm resize-none focus:ring-2 focus:ring-pastel-blue focus:border-transparent" />
              </div>

              {error && <p className="text-xs text-red-500">{error}</p>}

              <button onClick={submit} disabled={saving || past}
                className="w-full py-2.5 rounded-xl bg-pastel-blue hover:bg-pastel-blue-dark disabled:opacity-40 text-sm font-semibold transition-colors">
                {saving ? 'Sending…' : past ? 'That day has passed' : "Let them know"}
              </button>
            </div>
          )}

          {mine.length > 0 && (
            <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <h2 className="font-semibold text-gray-700 mb-2 text-sm">What you've filed</h2>
              <div className="space-y-2">
                {mine.map(n => (
                  <div key={n.id} className="flex items-start gap-2 text-xs">
                    <span className={`shrink-0 mt-0.5 px-1.5 py-0.5 rounded font-semibold ${
                      n.on_time ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {n.on_time ? 'in time' : 'late'}
                    </span>
                    <div className="min-w-0">
                      <p className="text-gray-700 font-medium">
                        {new Date(n.meeting_date + 'T00:00:00').toLocaleDateString('en-US',
                          { weekday: 'short', month: 'short', day: 'numeric' })}
                      </p>
                      <p className="text-gray-400 break-words">{n.reason}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
    </Shell>
  )
}

// A page when it's opened on its own, a plain block when it sits in a tab.
function Shell({ embedded, onBack, children }) {
  if (embedded) return <div className="space-y-4">{children}</div>
  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="flex-1 p-4 sm:p-6 overflow-y-auto">
        <div className="max-w-lg mx-auto space-y-4">
          <button onClick={onBack}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors">
            <ArrowLeft size={14} /> Back
          </button>
          {children}
        </div>
      </div>
    </div>
  )
}
