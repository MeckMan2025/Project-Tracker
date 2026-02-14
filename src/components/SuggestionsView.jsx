import { useState, useEffect } from 'react'
import { Send, Trash2, Check, Clock } from 'lucide-react'
import { supabase } from '../supabase'
import { useUser } from '../contexts/UserContext'
import { usePermissions } from '../hooks/usePermissions'

const STATUS_STYLES = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  dismissed: 'bg-red-100 text-red-600',
}

function SuggestionsView() {
  const { username, user } = useUser()
  const { canReviewSuggestions } = usePermissions()
  const [suggestions, setSuggestions] = useState([])
  const [newSuggestion, setNewSuggestion] = useState('')
  const [submitError, setSubmitError] = useState('')

  const isReviewer = canReviewSuggestions

  // Load suggestions
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  useEffect(() => {
    async function load() {
      try {
        let token = supabaseKey
        try {
          const { data } = await supabase.auth.getSession()
          if (data?.session?.access_token) token = data.session.access_token
        } catch (e) { /* fall back to anon key */ }

        let url = `${supabaseUrl}/rest/v1/suggestions?select=*&order=created_at.desc`
        if (!isReviewer && user) {
          url += `&user_id=eq.${user.id}`
        }
        const res = await fetch(url, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${token}`,
          },
        })
        if (res.ok) {
          const data = await res.json()
          setSuggestions(data)
        }
      } catch (err) {
        console.error('Failed to load suggestions:', err)
      }
    }
    if (user) load()
  }, [user, isReviewer])

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('suggestions-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'suggestions' }, (payload) => {
        setSuggestions(prev => {
          if (prev.some(s => s.id === payload.new.id)) return prev
          if (isReviewer || payload.new.user_id === user?.id) {
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
  }, [isReviewer, user])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!newSuggestion.trim()) return
    setSubmitError('')

    const suggestion = {
      id: String(Date.now()) + Math.random().toString(36).slice(2),
      author: username,
      user_id: user.id,
      text: newSuggestion.trim(),
      status: 'pending',
      created_at: new Date().toISOString(),
    }

    setSuggestions(prev => [suggestion, ...prev])
    setNewSuggestion('')

    // Use Supabase client with timeout to prevent hanging
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
    Promise.race([
      supabase.from('suggestions').insert(suggestion),
      timeout,
    ]).then(result => {
      if (result?.error) {
        setSubmitError('Failed to save: ' + result.error.message)
        setSuggestions(prev => prev.filter(s => s.id !== suggestion.id))
      }
    }).catch(err => {
      if (err.message === 'timeout') {
        // Timed out but suggestion may still save — keep it optimistically
        console.warn('Suggestion insert timed out, may still save')
      } else {
        setSubmitError('Failed to save: ' + err.message)
        setSuggestions(prev => prev.filter(s => s.id !== suggestion.id))
      }
    })
  }

  const handleApprove = async (s) => {
    setSuggestions(prev => prev.map(x => x.id === s.id ? { ...x, status: 'approved' } : x))
    const { error } = await supabase.from('suggestions').update({ status: 'approved' }).eq('id', s.id)
    if (error) {
      console.error('Failed to approve suggestion:', error.message)
      setSuggestions(prev => prev.map(x => x.id === s.id ? { ...x, status: s.status } : x))
      return
    }
    if (s.user_id) {
      supabase.from('notifications').insert({
        user_id: s.user_id,
        title: 'Suggestion approved!',
        body: `Your suggestion was approved: "${s.text.slice(0, 80)}${s.text.length > 80 ? '...' : ''}"`,
      }).catch(() => {})
    }
  }

  const handleDismiss = async (s) => {
    setSuggestions(prev => prev.map(x => x.id === s.id ? { ...x, status: 'dismissed' } : x))
    const { error } = await supabase.from('suggestions').update({ status: 'dismissed' }).eq('id', s.id)
    if (error) {
      console.error('Failed to dismiss suggestion:', error.message)
      setSuggestions(prev => prev.map(x => x.id === s.id ? { ...x, status: s.status } : x))
      return
    }
    if (s.user_id) {
      supabase.from('notifications').insert({
        user_id: s.user_id,
        title: 'Suggestion reviewed',
        body: `Your suggestion was dismissed: "${s.text.slice(0, 80)}${s.text.length > 80 ? '...' : ''}"`,
      }).catch(() => {})
    }
  }

  const handleDelete = async (id) => {
    const { error } = await supabase.from('suggestions').delete().eq('id', id)
    if (error) {
      console.error('Failed to delete suggestion:', error.message)
      return
    }
    setSuggestions(prev => prev.filter(s => s.id !== id))
  }

  const formatDate = (timestamp) => {
    const date = new Date(timestamp)
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  }

  const pending = suggestions.filter(s => s.status === 'pending' || !s.status)
  const reviewed = suggestions.filter(s => s.status === 'approved' || s.status === 'dismissed')

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
          <div className="w-10 shrink-0" />
        </div>
      </header>

      {isReviewer ? (
        <main className="flex-1 p-4 overflow-y-auto">
          <div className="max-w-2xl mx-auto space-y-6">
            {pending.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
                  <Clock size={14} />
                  Pending ({pending.length})
                </h2>
                {pending.map((s) => (
                  <div key={s.id} className="bg-white rounded-xl shadow-sm border border-yellow-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-semibold text-pastel-pink-dark">{s.author}</span>
                          <span className="text-xs text-gray-400">{formatDate(s.created_at)}</span>
                        </div>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">{s.text}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleApprove(s)}
                          className="p-2 rounded-lg hover:bg-green-50 transition-colors"
                          title="Approve"
                        >
                          <Check size={16} className="text-green-500" />
                        </button>
                        <button
                          onClick={() => handleDismiss(s)}
                          className="p-2 rounded-lg hover:bg-red-50 transition-colors"
                          title="Dismiss"
                        >
                          <Trash2 size={16} className="text-red-400" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {reviewed.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                  Reviewed ({reviewed.length})
                </h2>
                {reviewed.map((s) => (
                  <div key={s.id} className="group bg-white rounded-xl shadow-sm border border-gray-100 p-4 opacity-75">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-semibold text-pastel-pink-dark">{s.author}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[s.status]}`}>
                            {s.status}
                          </span>
                          <span className="text-xs text-gray-400">{formatDate(s.created_at)}</span>
                        </div>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">{s.text}</p>
                      </div>
                      <button
                        onClick={() => handleDelete(s.id)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-50 transition-opacity shrink-0"
                        title="Delete permanently"
                      >
                        <Trash2 size={14} className="text-gray-400 hover:text-red-400" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {suggestions.length === 0 && (
              <p className="text-center text-gray-400 mt-20">No suggestions yet.</p>
            )}
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
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="text-xs text-gray-400">{s.created_at ? formatDate(s.created_at) : 'Just now'}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[s.status || 'pending']}`}>
                        {(s.status || 'pending') === 'pending' ? 'Pending Review' : s.status === 'approved' ? 'Approved' : 'Dismissed'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">{s.text}</p>
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
