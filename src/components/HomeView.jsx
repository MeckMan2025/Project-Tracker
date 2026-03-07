import { useState, useEffect, useRef } from 'react'
import { Calendar, ArrowRight, Camera, Lightbulb, Send, Trash2, Check, X, Plus, ChevronLeft, ChevronRight } from 'lucide-react'
import { useUser } from '../contexts/UserContext'
import { usePermissions } from '../hooks/usePermissions'
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
  const [quote, setQuote] = useState(null)
  const [ideas, setIdeas] = useState([])
  const [newIdea, setNewIdea] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [photos, setPhotos] = useState([])
  const [uploading, setUploading] = useState(false)
  const [selectedPhoto, setSelectedPhoto] = useState(null)
  const fileInputRef = useRef(null)

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  const headers = { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }

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
      const res = await fetch(`${supabaseUrl}/rest/v1/workshop_ideas?select=*&order=created_at.desc`, { headers })
      if (res.ok) setIdeas(await res.json())
    } catch {}
  }

  useEffect(() => { loadIdeas() }, [])

  const handleSubmitIdea = async () => {
    const text = newIdea.trim()
    if (!text) return
    setSubmitError('')
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/workshop_ideas`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
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
    await fetch(`${supabaseUrl}/rest/v1/workshop_ideas?id=eq.${id}`, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
      body: JSON.stringify({ status }),
    })
    loadIdeas()
  }

  const handleDeleteIdea = async (id) => {
    await fetch(`${supabaseUrl}/rest/v1/workshop_ideas?id=eq.${id}`, {
      method: 'DELETE',
      headers,
    })
    loadIdeas()
  }

  const daysUntil = nextEvent ? Math.ceil((new Date(nextEvent.date_key) - new Date()) / (1000 * 60 * 60 * 24)) : null

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
            <div className="grid grid-cols-3 gap-2">
              {photos.map(photo => (
                <div
                  key={photo.id}
                  className="relative aspect-square rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => setSelectedPhoto(photo)}
                >
                  <img
                    src={photo.url}
                    alt={photo.caption || 'Season photo'}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
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
            <img
              src={selectedPhoto.url}
              alt={selectedPhoto.caption || 'Season photo'}
              className="w-full max-h-[80vh] object-contain rounded-lg"
            />
            <div className="flex items-center justify-between mt-2">
              <p className="text-sm text-white/70">
                {selectedPhoto.uploaded_by && `Uploaded by ${selectedPhoto.uploaded_by}`}
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
