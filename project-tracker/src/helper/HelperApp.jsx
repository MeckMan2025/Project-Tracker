import { useState, useEffect, useRef, useCallback } from 'react'
import { Mic, Square, Camera, Loader2, Volume2, X, Check, RotateCcw, Bell, ChevronDown } from 'lucide-react'
import { useUser } from '../contexts/UserContext'
import { usePermissions } from '../hooks/usePermissions'
import { teamScope } from '../lib/teamScope'
import { restHeaders } from '../lib/restHeaders'
import { authLinkError } from '../supabase'
import LoginScreen from '../components/LoginScreen'
import ForcePasswordChange from '../components/ForcePasswordChange'
import { uploadNotebookPhoto } from '../lib/notebookPhoto'
import { thumbUrl } from '../lib/photos'
import { canRecord, startRecording, toWav, MAX_SECONDS } from './recorder'
import {
  voiceBackendReady, queueEntry, pendingEntries, sendEntry, nudgeUnfinished, latestVoiceEntry,
} from './voiceEntries'
import { pushSupported, registerHelperWorker, remindersOn, syncReminders, turnOnReminders } from './helperPush'

// EN Helper: the engineering notebook for students who won't type one.
//
// Three taps: talk, pick a face, Done. The entry saves the moment Done is
// pressed (and wins the meeting's attendance back), and the AI writes it up
// afterwards on the server. Nothing the AI does can hold up or lose a save.
// The design notes and setup are in EN_HELPER.md.

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL

const PROMPT = "Tell your notebook about today. What did you work on? What went wrong, or what did you test? And what's next?"

const FACES = [
  { value: 'Very', emoji: '😄', label: 'Very' },
  { value: 'Somewhat', emoji: '🙂', label: 'Somewhat' },
  { value: 'Not', emoji: '😕', label: 'Not really' },
]

// Local calendar date, not UTC: after about 7pm Central, UTC is already
// tomorrow and an evening entry would land on the wrong meeting.
function todayLocal() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const dayLabel = (d) => d === todayLocal()
  ? 'Today'
  : new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

const clock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

const newId = () => String(Date.now()) + Math.random().toString(36).slice(2)

// Opened inside the Scrum app by a reminder (the app's own notification goes
// to /helper/?from=app). Remembered for the visit, so it survives a reload.
// Only ever true on the Helper's own page, never in the Scrum app's panel.
const openedFromApp = (() => {
  try {
    if (!window.location.pathname.startsWith('/helper')) return false
    if (new URLSearchParams(window.location.search).get('from') === 'app') sessionStorage.setItem('en-helper-from-app', '1')
    return sessionStorage.getItem('en-helper-from-app') === '1'
  } catch { return false }
})()

// Back to the Scrum app, on the notebook.
function backToScrum() {
  try { localStorage.setItem('scrum-active-tab', 'notebook') } catch { /* lands on its usual tab */ }
  window.location.href = '/'
}

const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent)

function Screen({ children }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-pastel-pink/30 via-white to-pastel-blue/30"
         style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="max-w-md mx-auto px-4 py-5 space-y-4">{children}</div>
    </div>
  )
}

function Notice({ title, children }) {
  return (
    <Screen>
      <Header />
      <div className="bg-white rounded-2xl shadow-sm p-6 text-center space-y-2">
        <h2 className="text-lg font-semibold text-gray-700">{title}</h2>
        <div className="text-sm text-gray-500">{children}</div>
      </div>
    </Screen>
  )
}

function Header({ name }) {
  return (
    <div className="flex items-center gap-3">
      {openedFromApp && (
        <button onClick={backToScrum} className="text-sm font-semibold text-gray-600 px-2 py-1.5 rounded-lg bg-white/80 shadow-sm shrink-0">
          ← Scrum
        </button>
      )}
      <img src="/helper/icon-192.png" alt="" className="w-10 h-10 rounded-xl shadow-sm" />
      <div className="min-w-0">
        <h1 className="text-xl font-bold text-gray-800 leading-tight" style={{ fontFamily: "'Kalam', cursive" }}>EN Helper</h1>
        {name && <p className="text-xs text-gray-400 truncate">Signed in as {name}</p>}
      </div>
    </div>
  )
}

export default function HelperApp() {
  const { user, username, loading, passwordRecovery, mustChangePassword, updatePassword, sessionExpired } = useUser()
  const { canSubmitNotebook } = usePermissions()

  if (loading) {
    return (
      <Screen>
        <div className="flex flex-col items-center justify-center gap-3 pt-32 text-gray-400">
          <Loader2 className="animate-spin" size={28} />
          <p className="text-sm">Opening your notebook…</p>
        </div>
      </Screen>
    )
  }
  // A home-screen app keeps its own sign-in on an iPhone, so the first open
  // asks once. The same screens as the main app, temporary passwords included.
  if (passwordRecovery) return <LoginScreen sessionExpired={sessionExpired} />
  if (!user) return <LoginScreen sessionExpired={sessionExpired} linkError={authLinkError} />
  if (mustChangePassword) return <ForcePasswordChange updatePassword={updatePassword} />
  if (!username) return <ProfileWait />
  if (!canSubmitNotebook) {
    return <Notice title="Notebook entries are for team members">This account can read the notebook but can't write in it.</Notice>
  }
  return <Recorder />
}

// Signed in, profile not here yet. Supabase's client can sit on its own auth
// lock while it restores a session, which holds up the normal profile load;
// the main app rides that out on its 30 second profile check. A student
// holding a phone shouldn't wait that long, so after a moment ask for the
// profile the lock-free way (the same check, run now).
function ProfileWait() {
  const { user, refreshProfileNow } = useUser()
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        if (user?.id && !localStorage.getItem('scrum-cached-user-id')) localStorage.setItem('scrum-cached-user-id', user.id)
      } catch { /* storage blocked */ }
      refreshProfileNow?.()
    }, 1500)
    return () => clearTimeout(t)
  }, [user?.id]) // eslint-disable-line
  return <Notice title="Almost there">Loading your profile…</Notice>
}

// The recorder itself. The Helper page shows it full screen; the Scrum app's
// Notebook tab shows it as a panel (embedded), where the app already handles
// sign-in, notifications and the way back.
export function Recorder({ embedded = false }) {
  const { user, username } = useUser()
  const { myTeamNumber } = usePermissions()
  const SCOPE = teamScope(myTeamNumber)

  const [ready, setReady] = useState(null) // null = checking
  const [stage, setStage] = useState('idle') // idle | recording | recorded | saving | saved
  const [seconds, setSeconds] = useState(0)
  const [clip, setClip] = useState(null)
  const [engagement, setEngagement] = useState('')
  const [photo, setPhoto] = useState({ url: '', uploading: false, error: '' })
  const [error, setError] = useState('')
  const [claimed, setClaimed] = useState(false)
  const [waiting, setWaiting] = useState(0) // recordings still on this phone
  const [last, setLast] = useState(null)
  const [showLast, setShowLast] = useState(false)
  const [reminders, setReminders] = useState(true)
  const [days, setDays] = useState([todayLocal()])
  const [meetingDate, setMeetingDate] = useState(todayLocal())
  const [pickingDay, setPickingDay] = useState(false)
  const [installHint, setInstallHint] = useState(false)

  const recRef = useRef(null)
  const timerRef = useRef(null)

  // ── On open ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!embedded) registerHelperWorker()
    voiceBackendReady().then(setReady)
    try {
      setInstallHint(isIos() && !isStandalone() && !embedded && !openedFromApp && localStorage.getItem('en-helper-install-hint') !== 'hidden')
    } catch { /* storage blocked */ }
  }, [])

  useEffect(() => {
    if (!user?.id || embedded) return
    syncReminders(user.id)
    remindersOn().then(setReminders)
  }, [user?.id])

  // Send anything left on the phone from last time, then show how the last
  // entry is doing.
  const flushWaiting = useCallback(async () => {
    const queued = await pendingEntries(username)
    let left = queued.length
    setWaiting(left)
    for (const item of queued) {
      try { await sendEntry(item, SCOPE); left -= 1 } catch (err) { console.warn('[EN Helper] still waiting:', err.message) }
    }
    setWaiting(left)
    return left
  }, [username, SCOPE])

  useEffect(() => {
    if (!ready || !username) return
    flushWaiting().finally(() => {
      nudgeUnfinished(username, SCOPE)
      latestVoiceEntry(username, SCOPE).then(setLast)
    })
  }, [ready, username]) // eslint-disable-line

  // Which meeting this is for. Today, unless today is already written up and
  // an earlier meeting isn't: then that one, since it's what the attendance
  // rule is counting against. The same rules as the typed form.
  useEffect(() => {
    if (!username) return
    let live = true
    const h = restHeaders()
    const name = encodeURIComponent(username)
    Promise.all([
      fetch(`${supabaseUrl}/rest/v1/attendance_sessions?${SCOPE}&select=id,session_date&order=session_date.desc&limit=60`, { headers: h }).then(r => (r.ok ? r.json() : [])),
      fetch(`${supabaseUrl}/rest/v1/attendance_records?${SCOPE}&username=eq.${name}&select=session_id,status,marked_by`, { headers: h }).then(r => (r.ok ? r.json() : [])),
      fetch(`${supabaseUrl}/rest/v1/notebook_entries?${SCOPE}&username=eq.${name}&select=meeting_date`, { headers: h }).then(r => (r.ok ? r.json() : [])),
    ]).then(([sessions, records, written]) => {
      if (!live) return
      const today = todayLocal()
      const mine = Object.fromEntries((records || []).map(r => [r.session_id, r]))
      const wrote = new Set((written || []).map(e => e.meeting_date))
      const blocked = new Set()
      const missing = []
      for (const s of sessions || []) {
        const r = mine[s.id]
        if (!r) continue // not on that meeting's roster
        // A lead marked them absent, or they were excused: nothing to write up.
        if (r.status === 'excused' || (r.status === 'absent' && r.marked_by !== 'notebook-rule')) { blocked.add(s.session_date); continue }
        if (s.session_date <= today && !wrote.has(s.session_date)) missing.push(s.session_date)
      }
      const options = [...new Set([...(blocked.has(today) ? [] : [today]), ...missing])].slice(0, 6)
      setDays(options.length ? options : [today])
      setMeetingDate(missing.includes(today) || !missing.length ? (options[0] || today) : missing[0])
    }).catch(() => {})
    return () => { live = false }
  }, [username]) // eslint-disable-line

  // ── Recording ─────────────────────────────────────────────────────────
  const stopTimer = () => { clearInterval(timerRef.current); timerRef.current = null }

  const stop = async () => {
    stopTimer()
    const rec = recRef.current
    recRef.current = null
    if (!rec) return
    const raw = await rec.stop()
    if (raw.size < 2000) {
      setStage('idle')
      setError("That was too short to hear. Tap the mic and try again.")
      return
    }
    setClip(raw)
    setStage('recorded')
  }

  const start = async () => {
    setError('')
    if (speaking) { audioRef.current?.pause(); setSpeaking(false) }
    try {
      recRef.current = await startRecording()
    } catch (err) {
      setError(err?.name === 'NotAllowedError'
        ? "EN Helper needs your microphone. Tap the mic again and choose Allow. If it doesn't ask, turn the microphone on for this site in your phone's settings."
        : "Your phone wouldn't start recording. Close EN Helper and open it again.")
      return
    }
    setSeconds(0)
    setStage('recording')
    const began = Date.now()
    timerRef.current = setInterval(() => {
      const s = Math.floor((Date.now() - began) / 1000)
      setSeconds(s)
      if (s >= MAX_SECONDS) stop()
    }, 250)
  }

  useEffect(() => () => { stopTimer(); recRef.current?.cancel() }, [])

  const redo = () => { setClip(null); setStage('idle'); setSeconds(0) }

  // The prompt never changes, so it's a recorded clip (public/helper/prompt.mp3,
  // made once with Cloudflare's text-to-speech) rather than the browser's own
  // voice. On an iPhone that voice is unreliable in home-screen apps and goes
  // quiet with the silent switch on; an ordinary audio clip plays either way.
  // Tap again to stop. The browser's voice is only the fallback.
  const audioRef = useRef(null)
  const [speaking, setSpeaking] = useState(false)
  const speak = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio('/helper/prompt.mp3')
      audioRef.current.onended = () => setSpeaking(false)
    }
    const a = audioRef.current
    if (speaking) { a.pause(); a.currentTime = 0; setSpeaking(false); return }
    a.currentTime = 0
    setSpeaking(true)
    a.play().catch(() => {
      setSpeaking(false)
      try {
        const u = new SpeechSynthesisUtterance(PROMPT)
        u.rate = 0.95
        window.speechSynthesis.speak(u)
      } catch { /* no voice on this device */ }
    })
  }

  // ── Photo (optional), the same upload as the typed form ────────────────
  const pickPhoto = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setPhoto({ url: '', uploading: true, error: '' })
    uploadNotebookPhoto(file)
      .then(url => setPhoto({ url, uploading: false, error: '' }))
      .catch(err => setPhoto({ url: '', uploading: false, error: err.message }))
  }

  // ── Done ──────────────────────────────────────────────────────────────
  const done = async () => {
    if (!clip || !engagement || photo.uploading || stage === 'saving') return
    setStage('saving')
    setError('')
    const audio = (await toWav(clip)) || clip
    const item = {
      id: newId(),
      username,
      team_number: myTeamNumber || '',
      meeting_date: meetingDate,
      engagement,
      photo_url: photo.url,
      created_at: new Date().toISOString(),
      audio: await audio.arrayBuffer(),
      audioType: audio.type,
    }
    // On the phone first, so nothing after this line can lose it.
    await queueEntry(item).catch(err => console.warn('[EN Helper] could not keep a copy on the phone:', err))
    try {
      const { claimed: won } = await sendEntry(item, SCOPE)
      setClaimed(won)
      setStage('saved')
      latestVoiceEntry(username, SCOPE).then(setLast)
    } catch (err) {
      console.warn('[EN Helper] save failed, kept on the phone:', err)
      setStage('recorded')
      setError("Couldn't reach the notebook. Your recording is safe on this phone. Tap Done again when you have signal.")
    }
    setWaiting((await pendingEntries(username)).length)
  }

  const another = () => {
    setClip(null); setEngagement(''); setPhoto({ url: '', uploading: false, error: '' })
    setClaimed(false); setSeconds(0); setError(''); setStage('idle')
  }

  // ── Screens ───────────────────────────────────────────────────────────
  if (ready === false) {
    return (
      <Notice title="EN Helper isn't switched on yet">
        Your coach needs to finish setting it up. Until then, write today's entry in the Notebook tab of the Scrum app.
      </Notice>
    )
  }

  if (stage === 'saved') {
    return (
      <Screen>
        <Header name={username} />
        <div className="bg-white rounded-2xl shadow-sm p-6 text-center space-y-3">
          <div className="w-16 h-16 mx-auto rounded-full bg-green-100 flex items-center justify-center">
            <Check className="text-green-600" size={34} />
          </div>
          <h2 className="text-xl font-semibold text-gray-800">Saved to your notebook</h2>
          <p className="text-sm text-gray-500">
            {claimed ? "You're marked present for that meeting again. " : ''}
            Your words are being written up now. Both versions will be in the notebook in a minute or two.
          </p>
          {!reminders && !embedded && !openedFromApp && pushSupported() && (
            <button
              onClick={async () => {
                const on = await turnOnReminders(user.id).catch(() => false)
                setReminders(on)
              }}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-pastel-blue/40 hover:bg-pastel-blue/60 font-semibold text-gray-700"
            >
              <Bell size={18} /> Remind me after meetings
            </button>
          )}
          <button onClick={another} className="w-full py-3 rounded-xl border-2 border-gray-200 text-gray-600 font-medium">
            Record another
          </button>
        </div>
      </Screen>
    )
  }

  const recording = stage === 'recording'
  const recorded = stage === 'recorded' || stage === 'saving'
  const saving = stage === 'saving'

  return (
    <Screen>
      <Header name={username} />

      {installHint && (
        <div className="bg-white/90 rounded-xl shadow-sm p-3 text-xs text-gray-600 flex items-start gap-2">
          <span className="flex-1">
            <b>Put EN Helper on your Home Screen:</b> tap the Share button, then <b>Add to Home Screen</b>.
          </span>
          <button
            aria-label="Hide"
            onClick={() => { setInstallHint(false); try { localStorage.setItem('en-helper-install-hint', 'hidden') } catch { /* fine */ } }}
            className="text-gray-400"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {waiting > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800 flex items-center gap-2">
          <span className="flex-1">{waiting === 1 ? 'A recording is' : `${waiting} recordings are`} waiting on this phone to be saved.</span>
          <button onClick={flushWaiting} className="px-3 py-1 rounded-lg bg-amber-200/70 font-semibold">Send</button>
        </div>
      )}

      {/* The prompt, and the day it's for. */}
      <div className="bg-white rounded-2xl shadow-sm p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => setPickingDay(p => !p)}
            disabled={recording || saving || days.length < 2}
            className="flex items-center gap-1 text-sm font-semibold text-gray-600 disabled:opacity-100"
          >
            {dayLabel(meetingDate)}
            {days.length > 1 && <ChevronDown size={16} className="text-gray-400" />}
          </button>
          <button onClick={speak} aria-label={speaking ? 'Stop reading' : 'Read the question out loud'}
            className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg ${speaking ? 'bg-pastel-pink/50 text-gray-700' : 'bg-gray-100 text-gray-500'}`}>
            <Volume2 size={16} /> {speaking ? 'Stop' : 'Hear it'}
          </button>
        </div>
        {pickingDay && (
          <div className="flex flex-wrap gap-2">
            {days.map(d => (
              <button key={d} onClick={() => { setMeetingDate(d); setPickingDay(false) }}
                className={`px-3 py-1.5 rounded-lg text-sm ${d === meetingDate ? 'bg-pastel-pink font-semibold' : 'bg-gray-100 text-gray-600'}`}>
                {dayLabel(d)}
              </button>
            ))}
          </div>
        )}
        <p className="text-lg text-gray-800 leading-snug" style={{ fontFamily: "'Kalam', cursive" }}>
          Tell your notebook about today.
        </p>
        <ul className="text-sm text-gray-500 space-y-1">
          <li>• What did you work on?</li>
          <li>• What went wrong, or what did you test?</li>
          <li>• What's next?</li>
        </ul>
      </div>

      {/* Tap 1: talk. */}
      <div className="flex flex-col items-center gap-2 py-2">
        {!canRecord() ? (
          <p className="text-sm text-gray-500 text-center">
            This browser can't record audio. Open EN Helper in Safari on an iPhone, or Chrome on Android.
          </p>
        ) : recorded ? (
          <div className="flex items-center gap-3 bg-white rounded-full shadow-sm pl-4 pr-2 py-2">
            <Check className="text-green-600" size={20} />
            <span className="text-sm text-gray-700 font-medium">Recorded {clock(seconds)}</span>
            <button onClick={redo} disabled={saving}
              className="flex items-center gap-1 text-xs text-gray-500 px-3 py-1.5 rounded-full bg-gray-100">
              <RotateCcw size={14} /> Redo
            </button>
          </div>
        ) : (
          <>
            <button
              onClick={recording ? stop : start}
              aria-label={recording ? 'Stop recording' : 'Start recording'}
              className={`w-32 h-32 rounded-full shadow-lg flex items-center justify-center transition-transform active:scale-95 ${
                recording ? 'bg-red-500 animate-pulse' : 'bg-gray-800'
              }`}
            >
              {recording ? <Square className="text-white" size={44} fill="white" /> : <Mic className="text-white" size={56} />}
            </button>
            <p className="text-sm text-gray-500">
              {recording ? `${clock(seconds)}  ·  tap to stop` : 'Tap to talk'}
            </p>
          </>
        )}
      </div>

      {error && <p className="text-sm text-red-500 text-center">{error}</p>}

      {/* Tap 2: how it went. Tap 3: Done. */}
      {recorded && (
        <div className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
          <div>
            <p className="text-sm font-semibold text-gray-600 mb-2">How engaged did you feel?</p>
            <div className="grid grid-cols-3 gap-2">
              {FACES.map(f => (
                <button key={f.value} onClick={() => setEngagement(f.value)} disabled={saving}
                  className={`rounded-xl py-3 border-2 flex flex-col items-center gap-1 ${
                    engagement === f.value ? 'border-pastel-pink-dark bg-pastel-pink/30' : 'border-gray-200'
                  }`}>
                  <span className="text-3xl leading-none">{f.emoji}</span>
                  <span className="text-xs text-gray-600">{f.label}</span>
                </button>
              ))}
            </div>
          </div>

          {photo.url ? (
            <div className="flex items-center gap-3">
              <img src={thumbUrl(photo.url)} onError={e => { e.currentTarget.src = photo.url }} alt=""
                className="h-16 w-16 rounded-lg object-cover border" />
              <button onClick={() => setPhoto({ url: '', uploading: false, error: '' })} disabled={saving}
                className="text-xs text-gray-500 underline">Remove photo</button>
            </div>
          ) : (
            <label className="flex items-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-gray-200 text-sm text-gray-500">
              <Camera size={18} className="text-gray-400" />
              <span className="flex-1">Add a photo <span className="text-gray-400">(optional)</span></span>
              {photo.uploading && <Loader2 size={16} className="animate-spin text-pastel-blue-dark" />}
              <input type="file" accept="image/*" className="hidden" onChange={pickPhoto} disabled={saving} />
            </label>
          )}
          {photo.error && <p className="text-xs text-red-500">{photo.error}</p>}

          <button
            onClick={done}
            disabled={!engagement || photo.uploading || saving}
            className="w-full py-4 rounded-xl bg-pastel-pink hover:bg-pastel-pink-dark disabled:opacity-40 text-lg font-bold text-gray-800 flex items-center justify-center gap-2"
          >
            {saving ? <><Loader2 className="animate-spin" size={20} /> Saving…</> : 'Done'}
          </button>
          {!engagement && <p className="text-xs text-gray-400 text-center -mt-2">Pick a face, then tap Done.</p>}
        </div>
      )}

      {/* How the last one is doing, so nobody wonders whether it worked. */}
      {last && !recording && !recorded && (
        <div className="bg-white/80 rounded-xl p-3 text-sm text-gray-600">
          <button onClick={() => setShowLast(s => !s)} className="w-full text-left flex items-center gap-2">
            <span className="flex-1">
              Last entry ({dayLabel(last.meeting_date)}):{' '}
              {last.ai_status === 'done' ? <span className="text-green-700">in your notebook</span>
                : last.ai_status === 'empty' ? <span className="text-amber-700">no speech was heard</span>
                  : <span className="text-gray-500">being written up…</span>}
            </span>
            {last.ai_status === 'done' && <ChevronDown size={16} className={`text-gray-400 transition-transform ${showLast ? 'rotate-180' : ''}`} />}
          </button>
          {showLast && last.ai_status === 'done' && (
            <p className="mt-2 text-gray-700 whitespace-pre-line">{last.polished}</p>
          )}
        </div>
      )}
    </Screen>
  )
}
