import { useState, useEffect } from 'react'
import { Calendar, ArrowRight, Camera, Lightbulb, Send, Trash2, Check, X } from 'lucide-react'
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

  const handleDelete = async (id) => {
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
          <div className="flex items-center gap-2 mb-3">
            <Camera size={18} className="text-pastel-orange-dark" />
            <h2 className="font-semibold text-gray-700">Season Highlights</h2>
          </div>
          <div className="flex items-center justify-center py-10 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
            <p className="text-gray-400 text-sm">Add photos</p>
          </div>
        </div>

        {/* 3. Request Workshops */}
        <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb size={18} className="text-pastel-blue-dark" />
            <h2 className="font-semibold text-gray-700">Request Workshops</h2>
          </div>

          {/* Submit input */}
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

          {/* Ideas list */}
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
                    <button onClick={() => handleDelete(idea.id)} className="p-1 hover:bg-red-50 rounded">
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
    </div>
  )
}

export default HomeView
