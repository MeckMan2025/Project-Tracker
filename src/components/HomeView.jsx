import { useState, useEffect, useRef } from 'react'
import { Calendar, ArrowRight, Camera, Lightbulb, Send, Trash2, Check, X, Plus, ChevronLeft, ChevronRight } from 'lucide-react'
import { useUser } from '../contexts/UserContext'
import { usePermissions } from '../hooks/usePermissions'
import { supabase } from '../supabase'
import NotificationBell from './NotificationBell'

const STATUS_STYLES = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  denied: 'bg-red-100 text-red-600',
}

function HomeView({ onTabChange }) {
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

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="px-4 py-3 ml-14 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-pastel-blue-dark via-pastel-pink-dark to-pastel-orange-dark bg-clip-text text-transparent">
              Off-Season HQ
            </h1>
            <p className="text-sm text-gray-500">Welcome back{username ? `, ${username}` : ''}!</p>
          </div>
          <NotificationBell />
        </div>
      </header>

      <main className="flex-1 p-4 overflow-y-auto space-y-4">
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

        {/* 1. Next Event Card */}
        <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <Calendar size={18} className="text-pastel-pink-dark" />
            <h2 className="font-semibold text-gray-700">
              {nextEvent
                ? nextEvent.event_type === 'meeting' ? 'Next Meeting'
                : nextEvent.event_type === 'competition' ? 'Next Competition'
                : 'Next Event'
                : 'Next Event'}
            </h2>
          </div>
          {eventLoading ? (
            <p className="text-sm text-gray-400 animate-pulse">Loading...</p>
          ) : nextEvent ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-gray-800">{nextEvent.title || nextEvent.name}</p>
                {nextEvent.description && (
                  <p className="text-sm text-gray-500">{nextEvent.description}</p>
                )}
                <p className="text-sm text-gray-500 mt-1">{formatDate(nextEvent.date_key)}</p>
              </div>
              <div className="flex items-center gap-3">
                {daysUntil !== null && (
                  <div className="text-center px-4 py-2 bg-pastel-pink/30 rounded-lg">
                    <p className="text-2xl font-bold text-pastel-pink-dark">{daysUntil}</p>
                    <p className="text-xs text-gray-500">{daysUntil === 1 ? 'day' : 'days'} away</p>
                  </div>
                )}
                <button
                  onClick={() => onTabChange('calendar')}
                  className="flex items-center gap-1 px-3 py-2 bg-pastel-blue/30 hover:bg-pastel-blue/50 rounded-lg text-sm text-gray-600 transition-colors"
                >
                  View Calendar <ArrowRight size={14} />
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No upcoming events scheduled</p>
          )}
        </div>

        {/* 2. Season Photos */}
        <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Camera size={18} className="text-pastel-orange-dark" />
              <h2 className="font-semibold text-gray-700">Season Highlights</h2>
            </div>
            {canSubmit && (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-1 px-3 py-1.5 bg-pastel-orange/30 hover:bg-pastel-orange/50 rounded-lg text-sm text-gray-600 transition-colors disabled:opacity-50"
              >
                <Plus size={14} />
                {uploading ? 'Uploading...' : 'Add Photo'}
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleUpload}
              className="hidden"
            />
          </div>

          {photos.length === 0 ? (
            <div
              className="flex items-center justify-center py-10 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={() => canSubmit && fileInputRef.current?.click()}
            >
              <p className="text-gray-400 text-sm">{canSubmit ? 'Tap to add the first photo!' : 'No photos yet'}</p>
            </div>
          ) : (
            <div className="relative">
              <div
                ref={scrollRef}
                className="flex gap-2 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-2"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                {photos.map((photo, i) => (
                  <div
                    key={photo.id}
                    className="flex-shrink-0 w-64 h-48 rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition-opacity snap-center"
                    onClick={() => { setSelectedPhoto(photo); setPhotoIndex(i) }}
                  >
                    <img
                      src={photo.url}
                      alt={photo.caption || 'Season photo'}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
              {photos.length > 1 && (
                <div className="flex justify-center gap-1.5 mt-2">
                  {photos.map((_, i) => (
                    <div
                      key={i}
                      className={`w-1.5 h-1.5 rounded-full transition-colors ${i === photoIndex ? 'bg-pastel-pink-dark' : 'bg-gray-300'}`}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 3. Request Workshops */}
        <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb size={18} className="text-pastel-blue-dark" />
            <h2 className="font-semibold text-gray-700">Request Workshops</h2>
          </div>

          {canSubmit && (
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={newIdea}
                onChange={(e) => setNewIdea(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmitIdea()}
                placeholder="Suggest a workshop idea..."
                className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-pastel-blue focus:border-transparent text-sm"
              />
              <button
                onClick={handleSubmitIdea}
                className="p-2 bg-pastel-pink hover:bg-pastel-pink-dark rounded-lg transition-colors"
              >
                <Send size={16} className="text-gray-700" />
              </button>
            </div>
          )}
          {submitError && <p className="text-xs text-red-500 mb-2">{submitError}</p>}

          <div className="space-y-2">
            {ideas.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No workshop ideas yet. Be the first to suggest one!</p>
            ) : (
              ideas.map(idea => (
                <div key={idea.id} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[idea.status] || STATUS_STYLES.pending}`}>
                    {idea.status}
                  </span>
                  <span className="flex-1 text-sm text-gray-700 truncate">{idea.idea}</span>
                  <span className="text-xs text-gray-400 shrink-0">{idea.submitted_by}</span>
                  {canReview && idea.status === 'pending' && (
                    <>
                      <button onClick={() => handleReview(idea.id, 'approved')} className="p-1 hover:bg-green-100 rounded">
                        <Check size={14} className="text-green-600" />
                      </button>
                      <button onClick={() => handleReview(idea.id, 'denied')} className="p-1 hover:bg-red-100 rounded">
                        <X size={14} className="text-red-500" />
                      </button>
                    </>
                  )}
                  {(canReview || idea.user_id === user?.id) && (
                    <button onClick={() => handleDeleteIdea(idea.id)} className="p-1 hover:bg-red-50 rounded">
                      <Trash2 size={14} className="text-gray-400 hover:text-red-400" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

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
