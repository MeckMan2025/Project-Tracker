import { useState, useEffect } from 'react'
import { Send, Trash2, Check, Clock } from 'lucide-react'
import { supabase } from '../supabase'
import { useUser } from '../contexts/UserContext'
import { usePermissions } from '../hooks/usePermissions'
import { triggerPush } from '../utils/pushHelper'
import NotificationBell from './NotificationBell'

const STATUS_STYLES = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  denied: 'bg-red-100 text-red-600',
}

function SuggestionsView() {
  const { username, user } = useUser()
  const { canReviewSuggestions, canSubmitSuggestions, isGuest } = usePermissions()
  const [suggestions, setSuggestions] = useState([])
  const [newSuggestion, setNewSuggestion] = useState('')
  const [submitError, setSubmitError] = useState('')

  const isReviewer = canReviewSuggestions
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  const headers = { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }

  // Load suggestions via direct fetch
  useEffect(() => {
    async function load() {
      try {
        let url = `${supabaseUrl}/rest/v1/suggestions?select=*&order=created_at.desc`
        if (!isReviewer && username) {
          url += `&author=eq.${encodeURIComponent(username)}`
        }
        const res = await fetch(url, { headers })
        if (res.ok) setSuggestions(await res.json())
      } catch (err) {
        console.error('Failed to load suggestions:', err)
      }
    }
    if (username) load()
  }, [username, isReviewer])

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('suggestions-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'suggestions' }, (payload) => {
        setSuggestions(prev => {
          if (prev.some(s => s.id === payload.new.id)) return prev
          if (isReviewer || payload.new.author === username) {
            return [payload.new, ...prev]
          }
          return prev
        })
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'suggestions' }, (payload) => {
        setSuggestions(prev => prev.map(s => s.id === payload.new.id ? payload.new : s))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'suggestions' }, (payload) => {
        setSuggestions(prev => prev.filter(s => s.id !== payload.old.id))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [isReviewer, username])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!newSuggestion.trim()) return
    setSubmitError('')

    const authorName = username || user?.email || 'Anonymous'
    const suggestion = {
      id: String(Date.now()) + Math.random().toString(36).slice(2),
      author: authorName,
      text: newSuggestion.trim(),
      created_at: new Date().toISOString(),
    }

    setSuggestions(prev => [suggestion, ...prev])
    setNewSuggestion('')

    fetch(`${supabaseUrl}/rest/v1/suggestions`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
      body: JSON.stringify(suggestion),
    }).then(res => {
      if (!res.ok) {
        res.text().then(t => setSubmitError('Failed to save: ' + t))
        setSuggestions(prev => prev.filter(s => s.id !== suggestion.id))
      }
    }).catch(err => {
      setSubmitError('Failed to save: ' + err.message)
      setSuggestions(prev => prev.filter(s => s.id !== suggestion.id))
    })
  }

  const handleSetStatus = async (id, status) => {
    const suggestion = suggestions.find(s => s.id === id)
    setSuggestions(prev => prev.map(s => s.id === id ? { ...s, status } : s))

    fetch(`${supabaseUrl}/rest/v1/suggestions?id=eq.${id}`, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
      body: JSON.stringify({ status }),
    }).catch(err => console.error('Failed to update suggestion:', err))

    // Notify the suggestion author
    if (suggestion?.author) {
      try {
        const profileRes = await fetch(
          `${supabaseUrl}/rest/v1/profiles?display_name=ilike.${encodeURIComponent(suggestion.author)}&select=id`,
          { headers }
        )
        if (!profileRes.ok) {
          console.error('Profile lookup failed:', await profileRes.text())
          return
        }
        const profiles = await profileRes.json()
        if (profiles.length > 0) {
          const notif = {
            id: String(Date.now()) + Math.random().toString(36).slice(2),
            user_id: profiles[0].id,
            type: status === 'approved' ? 'suggestion_approved' : 'suggestion_denied',
            title: status === 'approved' ? 'Suggestion Approved' : 'Suggestion Denied',
            body: `Your suggestion "${suggestion.text.slice(0, 50)}${suggestion.text.length > 50 ? '...' : ''}" was ${status} by ${username}.`,
          }
          const notifRes = await fetch(`${supabaseUrl}/rest/v1/notifications`, {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
            body: JSON.stringify(notif),
          })
          if (!notifRes.ok) {
            console.error('Notification insert failed:', await notifRes.text())
          }
          triggerPush(notif)
        }
      } catch (err) {
        console.error('Failed to notify suggestion author:', err)
      }
    }
  }

  const handleDelete = (id) => {
    setSuggestions(prev => prev.filter(s => s.id !== id))
    fetch(`${supabaseUrl}/rest/v1/suggestions?id=eq.${id}`, {
      method: 'DELETE',
      headers,
    }).catch(err => console.error('Failed to delete suggestion:', err))
  }

  const formatDate = (timestamp) => {
    const date = new Date(timestamp)
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  }

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="py-4 px-4 flex items-center">
          <div className="w-10 shrink-0" />
          <div className="flex-1 text-center">
            <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-pastel-blue-dark via-pastel-pink-dark to-pastel-orange-dark bg-clip-text text-transparent">
              Suggestions
            </h1>
            <p className="text-sm text-gray-500">
              {isReviewer ? 'Review team feedback' : 'How can we make this app better?'}
            </p>
          </div>
          <NotificationBell />
        </div>
      </header>

      {isReviewer ? (
        <main className="flex-1 p-4 overflow-y-auto">
          <div className="max-w-2xl mx-auto space-y-6">
            {suggestions.length > 0 ? (
              <div className="space-y-3">
                {suggestions.map((s) => (
                  <div key={s.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-sm font-semibold text-pastel-pink-dark">{s.author}</span>
                      <span className="text-xs text-gray-400">{formatDate(s.created_at)}</span>
                      {s.status && s.status !== 'pending' && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[s.status] || ''}`}>
                          {s.status === 'approved' ? 'Approved' : 'Denied'}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap break-words mb-3">{s.text}</p>
                    <div className="flex items-center gap-2">
                      {(!s.status || s.status === 'pending') && (
                        <>
                          <button
                            onClick={() => handleSetStatus(s.id, 'approved')}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 hover:bg-green-100 transition-colors text-green-600 text-xs font-medium"
                          >
                            <Check size={14} />
                            Approve
                          </button>
                          <button
                            onClick={() => handleSetStatus(s.id, 'denied')}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 transition-colors text-red-500 text-xs font-medium"
                          >
                            <Trash2 size={14} />
                            Deny
                          </button>
                        </>
                      )}
                      {s.status && s.status !== 'pending' && (
                        <button
                          onClick={() => handleDelete(s.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors text-gray-500 text-xs font-medium"
                        >
                          <Trash2 size={14} />
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-400 mt-20">No suggestions yet.</p>
            )}
          </div>
        </main>
      ) : isGuest ? (
        <main className="flex-1 p-4 overflow-y-auto">
          <div className="max-w-md mx-auto text-center mt-20">
            <p className="text-gray-400">You can view suggestions but need a teammate role to submit.</p>
          </div>
        </main>
      ) : (
        <main className="flex-1 p-4 overflow-y-auto">
          <div className="max-w-md mx-auto space-y-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-700 text-center">
                What would make this app better?
              </h2>
              <textarea
                value={newSuggestion}
                onChange={(e) => setNewSuggestion(e.target.value)}
                placeholder="Type your suggestion here..."
                rows={4}
                className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-pastel-pink focus:border-transparent resize-none text-sm"
              />
              {submitError && <p className="text-sm text-red-500 text-center">{submitError}</p>}
              <button
                type="submit"
                disabled={!newSuggestion.trim()}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-pastel-pink hover:bg-pastel-pink-dark disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-colors font-semibold text-gray-700"
              >
                <Send size={16} />
                Submit Suggestion
              </button>
            </form>

            {suggestions.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Your Suggestions</h3>
                {suggestions.map((s) => (
                  <div key={s.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                        s.status === 'approved' ? 'bg-green-500' :
                        s.status === 'denied' ? 'bg-red-500' :
                        'bg-yellow-400'
                      }`} title={s.status === 'approved' ? 'Approved' : s.status === 'denied' ? 'Denied' : 'Pending'} />
                      <span className="text-xs text-gray-400">{s.created_at ? formatDate(s.created_at) : 'Just now'}</span>
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap break-words mt-1">{s.text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      )}
    </div>
  )
}

export default SuggestionsView
