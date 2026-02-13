import { useState, useEffect } from 'react'
import { Send, Trash2 } from 'lucide-react'
import { supabase } from '../supabase'
import { useUser } from '../contexts/UserContext'
import { usePermissions } from '../hooks/usePermissions'

function SuggestionsView() {
  const { username } = useUser()
  const { canReviewSuggestions } = usePermissions()
  const [suggestions, setSuggestions] = useState([])
  const [newSuggestion, setNewSuggestion] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const isReviewer = canReviewSuggestions

  // Load suggestions from Supabase on mount
  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('suggestions')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) {
        console.error('Failed to load suggestions:', error.message)
        return
      }
      if (data) setSuggestions(data)
    }
    load()
  }, [])

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('suggestions-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'suggestions' }, (payload) => {
        setSuggestions(prev => {
          if (prev.some(s => s.id === payload.new.id)) return prev
          return [payload.new, ...prev]
        })
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'suggestions' }, (payload) => {
        setSuggestions(prev => prev.filter(s => s.id !== payload.old.id))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!newSuggestion.trim()) return

    const suggestion = {
      id: String(Date.now()) + Math.random().toString(36).slice(2),
      username,
      content: newSuggestion.trim(),
      created_at: new Date().toISOString(),
    }

    const { error } = await supabase.from('suggestions').insert(suggestion)
    if (error) {
      console.error('Failed to save suggestion:', error.message)
      return
    }

    setSuggestions(prev => [suggestion, ...prev])
    setNewSuggestion('')
    setSubmitted(true)
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

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="py-4 px-4 flex items-center">
          <div className="w-10 shrink-0" />
          <div className="flex-1 text-center">
            <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-pastel-blue-dark via-pastel-pink-dark to-pastel-orange-dark bg-clip-text text-transparent">
              Suggestions
            </h1>
            <p className="text-sm text-gray-500">
              {isReviewer ? 'Team feedback' : 'Help us improve'}
            </p>
          </div>
          <div className="w-10 shrink-0" />
        </div>
      </header>

      {isReviewer ? (
        /* Kayden & Yukti see all suggestions */
        <main className="flex-1 p-4 overflow-y-auto">
          <div className="max-w-2xl mx-auto space-y-3">
            {suggestions.length === 0 ? (
              <p className="text-center text-gray-400 mt-20">No suggestions yet.</p>
            ) : (
              suggestions.map((s) => (
                <div
                  key={s.id}
                  className="group relative bg-white rounded-xl shadow-sm border border-gray-100 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold text-pastel-pink-dark">{s.username}</span>
                        <span className="text-xs text-gray-400">{formatDate(s.created_at)}</span>
                      </div>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">{s.content}</p>
                    </div>
                    <button
                      onClick={() => handleDelete(s.id)}
                      className="opacity-60 md:opacity-0 md:group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-50 transition-opacity shrink-0"
                      title="Delete suggestion"
                    >
                      <Trash2 size={14} className="text-gray-400 hover:text-red-400" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </main>
      ) : (
        /* Everyone else sees the submission form */
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="max-w-md w-full">
            {submitted ? (
              <div className="text-center space-y-3">
                <div className="text-4xl">&#10003;</div>
                <h2 className="text-xl font-semibold text-gray-700">Thanks for your suggestion!</h2>
                <p className="text-sm text-gray-500">Kayden and Yukti will review it.</p>
                <button
                  onClick={() => setSubmitted(false)}
                  className="mt-4 px-4 py-2 bg-pastel-blue hover:bg-pastel-blue-dark rounded-lg transition-colors text-sm text-gray-700"
                >
                  Submit another
                </button>
              </div>
            ) : (
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
                <button
                  type="submit"
                  disabled={!newSuggestion.trim()}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-pastel-pink hover:bg-pastel-pink-dark disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-colors font-semibold text-gray-700"
                >
                  <Send size={16} />
                  Submit Suggestion
                </button>
              </form>
            )}
          </div>
        </main>
      )}
    </div>
  )
}

export default SuggestionsView
