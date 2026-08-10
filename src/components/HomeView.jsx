import { useState, useEffect, useRef } from 'react'
import { Calendar, ArrowRight, Camera, Lightbulb, Send, Trash2, Check, X, Plus, ChevronLeft, ChevronRight, Rocket, Target, Trophy } from 'lucide-react'
import { useUser } from '../contexts/UserContext'
import { usePermissions } from '../hooks/usePermissions'
import { supabase } from '../supabase'
import NotificationBell from './NotificationBell'
import NotebookGallery from './NotebookGallery'
import SeasonTimeline from './SeasonTimeline'
import MyDashboard from './MyDashboard'

const STATUS_STYLES = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  denied: 'bg-red-100 text-red-600',
}

// Season kickoff date — change this to your real kickoff date/time.
const SEASON_KICKOFF = new Date('2026-09-06T09:00:00')
const FIRST_MEET = new Date('2026-10-19T09:00:00')

// Cleanup assignment status styling (mirrors CleanUpChart)
const CLEANUP_STATUS = {
  assigned: { label: 'Assigned', cls: 'bg-blue-100 text-blue-700' },
  pending_confirmation: { label: 'Pending', cls: 'bg-yellow-100 text-yellow-700' },
  confirmed: { label: 'Confirmed', cls: 'bg-green-100 text-green-700' },
  denied: { label: 'Denied', cls: 'bg-red-100 text-red-700' },
}

function HomeView({ onTabChange, onOpenTask }) {
  const { username, user } = useUser()
  const { isGuest, hasLeadTag } = usePermissions()

  const [nextEvent, setNextEvent] = useState(null)
  const [eventLoading, setEventLoading] = useState(true)
  const [compDayActive, setCompDayActive] = useState(false)
  const [compDayPreview, setCompDayPreview] = useState(null) // { sessionName, roles: [{blockName, role, emoji}] }
  const [quote, setQuote] = useState(null)
  const [ideas, setIdeas] = useState([])
  const [newIdea, setNewIdea] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [photos, setPhotos] = useState([])
  const [uploading, setUploading] = useState(false)
  const [selectedPhoto, setSelectedPhoto] = useState(null)
  const [photoIndex, setPhotoIndex] = useState(0)
  const fileInputRef = useRef(null)
  const scrollRef = useRef(null)
  const [now, setNow] = useState(() => new Date())
  const [myTasks, setMyTasks] = useState([])
  const [cleanupRows, setCleanupRows] = useState([])

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  const headers = { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }

  const getAuthHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token || supabaseKey
    return { 'apikey': supabaseKey, 'Authorization': `Bearer ${token}` }
  }

  const ROLE_EMOJIS = { 'scouting': '🔍', 'pit-crew': '🔧', 'drive-team': '🎮', 'spirit': '📣', 'bag-watch': '🎒', 'break': '☕', 'strategy': '🧠', 'safety': '🦺' }
  const ROLE_LABELS = { 'scouting': 'Scouting', 'pit-crew': 'Pit Crew', 'drive-team': 'Drive Team', 'spirit': 'Spirit', 'bag-watch': 'Bag Watch', 'break': 'Break', 'strategy': 'Strategy Lead', 'safety': 'Safety Monitor' }

  // Live-ticking clock for the season kickoff countdown
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Load the tasks assigned to me from the Scrum board (active tasks only)
  useEffect(() => {
    async function loadMyTasks() {
      if (!username) { setMyTasks([]); return }
      try {
        const res = await fetch(`${supabaseUrl}/rest/v1/tasks?assignee=ilike.${encodeURIComponent(username)}&select=*`, { headers })
        if (!res.ok) return
        const data = await res.json()
        const active = (Array.isArray(data) ? data : []).filter(t => t.status !== 'done' && t.status !== 'completed')
        setMyTasks(active)
      } catch (err) {
        console.error('Failed to load assigned tasks:', err)
      }
    }
    loadMyTasks()
  }, [username])

  // Load the latest cleanup session's assignments for the homepage chart
  useEffect(() => {
    (async () => {
      try {
        const [sess, asg, jobs] = await Promise.all([
          fetch(`${supabaseUrl}/rest/v1/cleanup_sessions?select=id&order=created_at.desc&limit=1`, { headers }).then(r => r.ok ? r.json() : []),
          fetch(`${supabaseUrl}/rest/v1/cleanup_assignments?select=*`, { headers }).then(r => r.ok ? r.json() : []),
          fetch(`${supabaseUrl}/rest/v1/cleanup_jobs?select=id,name`, { headers }).then(r => r.ok ? r.json() : []),
        ])
        const latestId = Array.isArray(sess) && sess[0] ? sess[0].id : null
        const jobName = (id) => (Array.isArray(jobs) ? jobs.find(j => j.id === id)?.name : null) || 'Cleanup job'
        const rows = latestId
          ? (Array.isArray(asg) ? asg : [])
              .filter(a => a.cleanup_session_id === latestId)
              .map(a => ({ id: a.id, job: jobName(a.job_id), who: a.assigned_username, status: a.status }))
          : []
        setCleanupRows(rows)
      } catch (err) {
        console.error('Failed to load cleanup chart:', err)
      }
    })()
  }, [])

  // Check for active/upcoming comp day session + role preview
  useEffect(() => {
    const fetchCompDay = async () => {
      try {
        // Check active session
        const activeRes = await fetch(`${supabaseUrl}/rest/v1/comp_day_sessions?is_active=eq.true&limit=1&select=id`, { headers })
        const activeData = await activeRes.json()
        setCompDayActive(Array.isArray(activeData) && activeData.length > 0)

        // Find upcoming or most recent session for role preview
        if (!username) return
        const sessRes = await fetch(`${supabaseUrl}/rest/v1/comp_day_sessions?order=created_at.desc&limit=1&select=id,name,session_date`, { headers })
        const sessions = await sessRes.json()
        if (!Array.isArray(sessions) || sessions.length === 0) return

        const session = sessions[0]
        // Get my assignments for this session
        const assignRes = await fetch(`${supabaseUrl}/rest/v1/comp_day_assignments?session_id=eq.${session.id}&username=eq.${encodeURIComponent(username)}&select=role,block_id`, { headers })
        const assigns = await assignRes.json()
        if (!Array.isArray(assigns) || assigns.length === 0) { setCompDayPreview(null); return }

        // Get block names
        const blockIds = [...new Set(assigns.map(a => a.block_id))]
        const blocksRes = await fetch(`${supabaseUrl}/rest/v1/comp_day_blocks?session_id=eq.${session.id}&order=order_index.asc&select=id,name`, { headers })
        const blocks = await blocksRes.json()
        const blockMap = Object.fromEntries((blocks || []).map(b => [b.id, b.name]))

        setCompDayPreview({
          sessionName: session.name,
          sessionDate: session.session_date,
          roles: assigns.map(a => ({ blockName: blockMap[a.block_id] || '?', role: a.role, emoji: ROLE_EMOJIS[a.role] || '❓', label: ROLE_LABELS[a.role] || a.role })),
        })
      } catch { setCompDayActive(false) }
    }
    fetchCompDay()
  }, [username])

  // Fetch next event + quote
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]

    fetch(`${supabaseUrl}/rest/v1/calendar_events?date_key=gte.${today}&order=date_key.asc&limit=1&select=*`, { headers })
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        setNextEvent(data && data.length > 0 ? data[0] : null)
        setEventLoading(false)
      })
      .catch(() => setEventLoading(false))

    fetch(`${supabaseUrl}/rest/v1/fun_quotes?approved=eq.true&select=*`, { headers })
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        if (data && data.length > 0) {
          setQuote(data[Math.floor(Math.random() * data.length)])
        }
      })
      .catch(() => {})
  }, [])

  // Fetch photos
  const loadPhotos = async () => {
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/season_photos?select=*&order=created_at.desc`, { headers })
      if (res.ok) setPhotos(await res.json())
    } catch {}
  }

  useEffect(() => { loadPhotos() }, [])

  // Upload photo
  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)

    const ext = file.name.split('.').pop()
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    try {
      // Upload to storage
      const uploadRes = await fetch(
        `${supabaseUrl}/storage/v1/object/season-photos/${fileName}`,
        {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': file.type,
          },
          body: file,
        }
      )

      if (!uploadRes.ok) {
        console.error('Upload failed:', await uploadRes.text())
        setUploading(false)
        return
      }

      // Get public URL
      const publicUrl = `${supabaseUrl}/storage/v1/object/public/season-photos/${fileName}`

      // Save record
      await fetch(`${supabaseUrl}/rest/v1/season_photos`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
        body: JSON.stringify({
          url: publicUrl,
          caption: '',
          uploaded_by: username,
        }),
      })

      loadPhotos()
    } catch (err) {
      console.error('Upload error:', err)
    }

    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Delete photo
  const handleDeletePhoto = async (photo) => {
    // Extract filename from URL
    const fileName = photo.url.split('/season-photos/').pop()

    // Delete from storage
    await fetch(`${supabaseUrl}/storage/v1/object/season-photos/${fileName}`, {
      method: 'DELETE',
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` },
    }).catch(() => {})

    // Delete record
    await fetch(`${supabaseUrl}/rest/v1/season_photos?id=eq.${photo.id}`, {
      method: 'DELETE',
      headers,
    })

    setSelectedPhoto(null)
    loadPhotos()
  }

  // Fetch workshop ideas
  const loadIdeas = async () => {
    try {
      const authHeaders = await getAuthHeaders()
      const res = await fetch(`${supabaseUrl}/rest/v1/workshop_ideas?select=*&order=created_at.desc`, { headers: authHeaders })
      if (res.ok) setIdeas(await res.json())
    } catch {}
  }

  useEffect(() => { loadIdeas() }, [])

  const handleSubmitIdea = async () => {
    const text = newIdea.trim()
    if (!text) return
    setSubmitError('')
    try {
      const authHeaders = await getAuthHeaders()
      const res = await fetch(`${supabaseUrl}/rest/v1/workshop_ideas`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
        body: JSON.stringify({
          idea: text,
          submitted_by: username,
          user_id: user?.id,
          status: 'pending',
        }),
      })
      if (res.ok) {
        setNewIdea('')
        loadIdeas()
      } else {
        setSubmitError('Failed to submit.')
      }
    } catch {
      setSubmitError('Failed to submit.')
    }
  }

  const handleReview = async (id, status) => {
    const authHeaders = await getAuthHeaders()
    await fetch(`${supabaseUrl}/rest/v1/workshop_ideas?id=eq.${id}`, {
      method: 'PATCH',
      headers: { ...authHeaders, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
      body: JSON.stringify({ status }),
    })
    loadIdeas()
  }

  const handleDeleteIdea = async (id) => {
    const authHeaders = await getAuthHeaders()
    await fetch(`${supabaseUrl}/rest/v1/workshop_ideas?id=eq.${id}`, {
      method: 'DELETE',
      headers: authHeaders,
    })
    loadIdeas()
  }

  const daysUntil = nextEvent ? Math.ceil((new Date(nextEvent.date_key) - new Date()) / (1000 * 60 * 60 * 24)) : null

  // Mini week calendar data
  const today = new Date()
  const dayOfWeek = today.getDay() // 0=Sun
  const weekStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - dayOfWeek)
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    return { date: d, key, dayName: d.toLocaleDateString('en-US', { weekday: 'short' }), dayNum: d.getDate(), isToday: i === dayOfWeek }
  })

  // Fetch events for this week
  const [weekEvents, setWeekEvents] = useState({})
  useEffect(() => {
    const startKey = weekDays[0].key
    const endKey = weekDays[6].key
    fetch(`${supabaseUrl}/rest/v1/calendar_events?date_key=gte.${startKey}&date_key=lte.${endKey}&select=id,name,date_key,event_type`, { headers })
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        const grouped = {}
        data.forEach(ev => {
          if (!grouped[ev.date_key]) grouped[ev.date_key] = []
          grouped[ev.date_key].push(ev)
        })
        setWeekEvents(grouped)
      })
      .catch(() => {})
  }, [])

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  const canReview = hasLeadTag
  const canSubmit = !isGuest

  // Season kickoff countdown
  const kickoffMs = SEASON_KICKOFF - now
  const kickoffPassed = kickoffMs <= 0

  // First meet countdown — whole days, so it doesn't tick like the kickoff clock.
  const firstMeetDays = Math.ceil((FIRST_MEET - now) / 86400000)
  const firstMeetPassed = firstMeetDays < 0
  const countdown = {
    days: Math.max(0, Math.floor(kickoffMs / 86400000)),
    hours: Math.max(0, Math.floor((kickoffMs % 86400000) / 3600000)),
    mins: Math.max(0, Math.floor((kickoffMs % 3600000) / 60000)),
    secs: Math.max(0, Math.floor((kickoffMs % 60000) / 1000)),
  }

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="px-4 py-3 ml-14 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-pastel-blue-dark via-pastel-pink-dark to-pastel-orange-dark bg-clip-text text-transparent">
              Home Page
            </h1>
            <p className="text-sm text-gray-500">Welcome back{username ? `, ${username}` : ''}!</p>
          </div>
          <NotificationBell />
        </div>
      </header>

      <main className="flex-1 p-4 overflow-y-auto space-y-4">
        {/* Mini Week Calendar */}
        <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm p-3">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">This Week</h2>
            <button
              onClick={() => onTabChange('calendar')}
              className="text-xs text-pastel-blue-dark hover:underline flex items-center gap-0.5"
            >
              Full Calendar <ArrowRight size={10} />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {weekDays.map(day => {
              const dayEvts = weekEvents[day.key] || []
              const hasEvents = dayEvts.length > 0
              const isPast = day.date < new Date(today.getFullYear(), today.getMonth(), today.getDate())
              return (
                <div
                  key={day.key}
                  className={`flex flex-col items-center py-2 rounded-lg transition-colors ${
                    day.isToday
                      ? 'bg-pastel-blue/30 ring-2 ring-pastel-blue-dark/40'
                      : isPast
                        ? 'opacity-40'
                        : 'hover:bg-gray-50'
                  }`}
                >
                  <span className="text-[10px] text-gray-400 font-medium">{day.dayName}</span>
                  <span className={`text-sm font-semibold mt-0.5 ${day.isToday ? 'text-pastel-blue-dark' : 'text-gray-700'}`}>
                    {day.dayNum}
                  </span>
                  {hasEvents && (
                    <div className="flex gap-0.5 mt-1">
                      {dayEvts.slice(0, 3).map(ev => {
                        const colors = { meeting: 'bg-pastel-blue-dark', competition: 'bg-pastel-pink-dark', other: 'bg-pastel-orange-dark' }
                        return <span key={ev.id} className={`w-1 h-1 rounded-full ${colors[ev.event_type] || colors.other}`} />
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Role dashboard(s) for the current user */}
        <MyDashboard />
        {/* Sticky-note board: Assigned Objective (big notebook) + Season Kickoff + Next Meeting */}
        <div className="flex flex-col md:flex-row gap-5 md:gap-6 items-stretch pt-2">

          {/* BIG notebook-paper sticky note — My Assigned Objective */}
          <div className="relative w-full md:flex-1 flex -rotate-[0.4deg]">
            {/* piece of tape */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-28 h-6 bg-amber-200/50 border border-amber-100/70 rotate-2 shadow-sm rounded-[2px] z-10" />
            <div
              className="relative flex-1 rounded-md shadow-[0_8px_24px_rgba(0,0,0,0.12)] pt-7 pb-6 pl-12 pr-5 min-h-[240px] overflow-hidden"
              style={{ background: '#ffffff' }}
            >
              {/* pink margin line */}
              <div className="absolute top-0 bottom-0 left-9 w-[2px] bg-pink-300/60" />
              <div className="flex items-center gap-2 mb-2">
                <Target size={20} className="text-pastel-blue-dark" />
                <h2 className="text-3xl leading-none text-gray-700" style={{ fontFamily: "'Kalam', cursive" }}>
                  My Assigned Objective
                </h2>
              </div>
              <div className="mt-1">
                {myTasks.length === 0 && (
                  <div className="flex items-center h-9" style={{ borderBottom: '1px solid rgba(59,130,246,0.45)' }}>
                    <span className="text-2xl text-gray-400" style={{ fontFamily: "'Kalam', cursive" }}>Nothing assigned yet…</span>
                  </div>
                )}
                {myTasks.map((task, i) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-2.5 h-9"
                    style={{ borderBottom: `1px solid ${i % 2 === 0 ? 'rgba(59,130,246,0.45)' : 'rgba(236,72,153,0.45)'}` }}
                  >
                    <span className="w-2.5 h-2.5 rounded-full border-2 border-pastel-blue-dark shrink-0" />
                    <span
                      className="flex-1 text-2xl text-gray-700 truncate"
                      style={{ fontFamily: "'Kalam', cursive" }}
                    >
                      {task.title}
                    </span>
                    <button
                      onClick={() => onOpenTask?.(task.board_id, task.id)}
                      className="shrink-0 flex items-center gap-0.5 text-sm font-semibold text-pastel-blue-dark hover:underline"
                    >
                      View <ArrowRight size={13} />
                    </button>
                  </div>
                ))}
                {/* filler ruled lines so it always looks like notebook paper */}
                {Array.from({ length: Math.max(0, (myTasks.length === 0 ? 5 : 6) - myTasks.length) }).map((_, i) => {
                  const idx = myTasks.length + i + (myTasks.length === 0 ? 1 : 0)
                  return (
                    <div
                      key={`filler-${i}`}
                      className="h-9"
                      style={{ borderBottom: `1px solid ${idx % 2 === 0 ? 'rgba(59,130,246,0.45)' : 'rgba(236,72,153,0.45)'}` }}
                    />
                  )
                })}
              </div>
            </div>
          </div>

          {/* RIGHT column — smaller sticky notes */}
          <div className="w-full md:w-56 flex flex-col gap-5 shrink-0">

            {/* Season Kickoff sticky note (blue→pink→orange ombre) */}
            <div
              className="relative rounded-md shadow-[0_6px_18px_rgba(0,0,0,0.12)] rotate-1 p-4 text-center"
              style={{ background: 'linear-gradient(140deg, #dbeafe 0%, #fce7f3 55%, #ffedd5 100%)' }}
            >
              <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-14 h-5 bg-white/50 border border-white/60 -rotate-3 rounded-[2px]" />
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <Rocket size={15} className="text-pastel-blue-dark" />
                <p className="text-lg leading-none text-gray-700" style={{ fontFamily: "'Kalam', cursive" }}>Season Kickoff</p>
              </div>
              {kickoffPassed ? (
                <p className="text-xl text-gray-700 py-2" style={{ fontFamily: "'Kalam', cursive" }}>🎉 Kicked off!</p>
              ) : (
                <>
                  <p className="text-4xl font-bold text-gray-700 tabular-nums leading-tight" style={{ fontFamily: "'Kalam', cursive" }}>
                    {countdown.days}
                  </p>
                  <p className="text-xs text-gray-500 -mt-1">
                    {countdown.days === 1 ? 'day' : 'days'} · {String(countdown.hours).padStart(2, '0')}:{String(countdown.mins).padStart(2, '0')}:{String(countdown.secs).padStart(2, '0')}
                  </p>
                </>
              )}
              <p className="text-[11px] text-gray-500 mt-2">
                {SEASON_KICKOFF.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            </div>

            {/* First Meet sticky note — same for everyone, fixed date */}
            <div
              className="relative rounded-md shadow-[0_6px_18px_rgba(0,0,0,0.12)] -rotate-1 p-4 text-center"
              style={{ background: 'linear-gradient(140deg, #ffedd5 0%, #fce7f3 55%, #dbeafe 100%)' }}
            >
              <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-14 h-5 bg-white/50 border border-white/60 rotate-2 rounded-[2px]" />
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <Trophy size={15} className="text-pastel-orange-dark" />
                <p className="text-lg leading-none text-gray-700" style={{ fontFamily: "'Kalam', cursive" }}>First Meet</p>
              </div>
              {firstMeetPassed ? (
                <p className="text-xl text-gray-700 py-2" style={{ fontFamily: "'Kalam', cursive" }}>🏆 It happened!</p>
              ) : (
                <>
                  <p className="text-4xl font-bold text-gray-700 tabular-nums leading-tight" style={{ fontFamily: "'Kalam', cursive" }}>
                    {firstMeetDays}
                  </p>
                  <p className="text-xs text-gray-500 -mt-1">{firstMeetDays === 1 ? 'day away' : 'days away'}</p>
                </>
              )}
              <p className="text-[11px] text-gray-500 mt-2">
                {FIRST_MEET.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            </div>

            {/* Next Meeting sticky note (blue→pink→orange ombre) */}
            <button
              onClick={() => onTabChange('calendar')}
              className="relative rounded-md shadow-[0_6px_18px_rgba(0,0,0,0.12)] -rotate-1 p-4 text-left w-full hover:brightness-[0.98] transition-all"
              style={{ background: 'linear-gradient(140deg, #dbeafe 0%, #fce7f3 55%, #ffedd5 100%)' }}
            >
              <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-14 h-5 bg-white/50 border border-white/60 rotate-3 rounded-[2px]" />
              <div className="flex items-center gap-1.5 mb-1">
                <Calendar size={15} className="text-pastel-pink-dark" />
                <p className="text-lg leading-none text-gray-700" style={{ fontFamily: "'Kalam', cursive" }}>
                  {nextEvent?.event_type === 'competition' ? 'Next Competition' : 'Next Meeting'}
                </p>
              </div>
              {eventLoading ? (
                <p className="text-sm text-gray-500 animate-pulse">Loading…</p>
              ) : nextEvent ? (
                <>
                  <p className="text-xl text-gray-800 leading-tight truncate" style={{ fontFamily: "'Kalam', cursive" }}>
                    {nextEvent.title || nextEvent.name}
                  </p>
                  <p className="text-[11px] text-gray-500 mt-0.5">{formatDate(nextEvent.date_key)}</p>
                  {daysUntil !== null && (
                    <p className="text-2xl font-bold text-gray-700 leading-tight mt-1" style={{ fontFamily: "'Kalam', cursive" }}>
                      {daysUntil === 0 ? 'Today!' : <>{daysUntil} <span className="text-lg font-normal">{daysUntil === 1 ? 'day' : 'days'} away</span></>}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-gray-500" style={{ fontFamily: "'Kalam', cursive" }}>No meetings scheduled</p>
              )}
            </button>
          </div>
        </div>

        {/* Season Timeline (top of the Home Page) */}
        <SeasonTimeline />

        {/* Cleanup Chart — current cleanup duty assignments */}
        {cleanupRows.length > 0 && (
          <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Trash2 size={18} className="text-pastel-blue-dark" />
              <h2 className="font-semibold text-gray-700">Cleanup Duty</h2>
              <span className="text-xs text-gray-400">
                · {cleanupRows.filter(r => r.status === 'confirmed').length}/{cleanupRows.length} done
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {cleanupRows.map(r => {
                const s = CLEANUP_STATUS[r.status] || { label: r.status, cls: 'bg-gray-100 text-gray-500' }
                return (
                  <div key={r.id} className="flex items-center justify-between gap-2 bg-gray-50 rounded-lg px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-700 truncate">{r.job}</p>
                      <p className="text-xs text-gray-400 truncate">{r.who || 'Unassigned'}</p>
                    </div>
                    <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold ${s.cls}`}>{s.label}</span>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Comp Day Banner */}
        {compDayActive && (
          <button
            onClick={() => onTabChange('comp-day')}
            className="w-full bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500 text-white rounded-xl p-4 shadow-lg hover:shadow-xl transition-shadow text-left"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-bold flex items-center gap-2">
                  <span className="animate-pulse">🏁</span> Competition Day is LIVE
                </p>
                <p className="text-white/80 text-sm">Tap to see your role assignment</p>
              </div>
              <ArrowRight size={20} />
            </div>
          </button>
        )}

        {/* Comp Day Role Preview */}
        {!compDayActive && compDayPreview && !isGuest && (
          <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Your Comp Day Roles</h3>
              <span className="text-xs text-gray-400">{compDayPreview.sessionName}</span>
            </div>
            <div className="space-y-1.5">
              {compDayPreview.roles.map((r, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 border border-gray-200">
                  <span className="text-sm text-gray-600">{r.blockName}</span>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-pastel-blue/30 text-gray-700">
                    {r.emoji} {r.label}
                  </span>
                </div>
              ))}
            </div>
            <button
              onClick={() => onTabChange('comp-day')}
              className="w-full mt-3 py-2 rounded-lg bg-pastel-pink/50 hover:bg-pastel-pink text-gray-700 text-sm font-medium transition-colors"
            >
              View Competition Day
            </button>
          </div>
        )}

        {/* Engineering Notebook photo gallery */}
        <NotebookGallery onTabChange={onTabChange} />

        {/* 4. Random Quote Footer */}
        {!isGuest && (
          <div className="text-center py-3">
            {quote ? (
              <p className="text-sm italic text-gray-400">
                "{quote.content}"
                {quote.submitted_by && <span className="not-italic"> — {quote.submitted_by}</span>}
              </p>
            ) : (
              <p className="text-sm italic text-gray-400">No fun quotes yet — submit one!</p>
            )}
          </div>
        )}
      </main>

      {/* Photo lightbox */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <div className="relative max-w-3xl max-h-[85vh] w-full" onClick={(e) => e.stopPropagation()}>
            {/* Left arrow */}
            {photos.length > 1 && (
              <button
                onClick={() => {
                  const prev = (photoIndex - 1 + photos.length) % photos.length
                  setPhotoIndex(prev)
                  setSelectedPhoto(photos[prev])
                }}
                className="absolute left-2 top-1/2 -translate-y-1/2 z-10 p-2 bg-black/40 hover:bg-black/60 rounded-full transition-colors"
              >
                <ChevronLeft size={24} className="text-white" />
              </button>
            )}

            {/* Right arrow */}
            {photos.length > 1 && (
              <button
                onClick={() => {
                  const next = (photoIndex + 1) % photos.length
                  setPhotoIndex(next)
                  setSelectedPhoto(photos[next])
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 z-10 p-2 bg-black/40 hover:bg-black/60 rounded-full transition-colors"
              >
                <ChevronRight size={24} className="text-white" />
              </button>
            )}

            <img
              src={selectedPhoto.url}
              alt={selectedPhoto.caption || 'Season photo'}
              className="w-full max-h-[80vh] object-contain rounded-lg"
            />
            <div className="flex items-center justify-between mt-2">
              <p className="text-sm text-white/70">
                {selectedPhoto.uploaded_by && `Uploaded by ${selectedPhoto.uploaded_by}`}
                {photos.length > 1 && <span className="ml-2">{photoIndex + 1} / {photos.length}</span>}
              </p>
              <div className="flex gap-2">
                {(hasLeadTag || selectedPhoto.uploaded_by === username) && (
                  <button
                    onClick={() => handleDeletePhoto(selectedPhoto)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-red-500/80 hover:bg-red-500 rounded-lg text-sm text-white transition-colors"
                  >
                    <Trash2 size={14} />
                    Delete
                  </button>
                )}
                <button
                  onClick={() => setSelectedPhoto(null)}
                  className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm text-white transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default HomeView
