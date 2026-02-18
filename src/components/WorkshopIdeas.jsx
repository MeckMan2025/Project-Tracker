import { useState, useEffect } from 'react'
import { Send, Trash2, Check, X, Lightbulb } from 'lucide-react'
import { supabase } from '../supabase'
import { useUser } from '../contexts/UserContext'
import { usePermissions } from '../hooks/usePermissions'
import NotificationBell from './NotificationBell'

const STATUS_STYLES = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  denied: 'bg-red-100 text-red-600',
}

export default function WorkshopIdeas() {
  const { username, user } = useUser()
  const { hasLeadTag, isCofounder, isGuest } = usePermissions()
  const [ideas, setIdeas] = useState([])
  const [newIdea, setNewIdea] = useState('')
  const [submitError, setSubmitError] = useState('')

  const canReview = hasLeadTag
  const canSubmit = !isGuest && !isCofounder

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  const headers = { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }

  const loadIdeas = async () => {
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/workshop_ideas?select=*&order=created_at.desc`, { headers })
      if (res.ok) {
        setIdeas(await res.json())
      } else {
        console.error('Failed to fetch workshop ideas:', res.status, await res.text())
      }
    } catch (err) {
      console.error('Failed to load workshop ideas:', err)
    }
  }

  useEffect(() => {
    loadIdeas()
    const onFocus = () => loadIdeas()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [username, canReview])

  useEffect(() => {
    const channel = supabase
      .channel('workshop-ideas-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'workshop_ideas' }, (payload) => {
        setIdeas(prev => prev.some(i => i.id === payload.new.id) ? prev : [payload.new, ...prev])
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'workshop_ideas' }, (payload) => {
        setIdeas(prev => prev.some(i => i.id === payload.new.id)
          ? prev.map(i => i.id === payload.new.id ? payload.new : i)
          : [payload.new, ...prev]
        )
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'workshop_ideas' }, (payload) => {
        setIdeas(prev => prev.filter(i => i.id !== payload.old.id))
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [canReview, username])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!newIdea.trim()) return
    setSubmitError('')

    const idea = {
      id: String(Date.now()) + Math.random().toString(36).slice(2),
      author: username || user?.email || 'Anonymous',
      text: newIdea.trim(),
      status: 'pending',
      created_at: new Date().toISOString(),
    }

    setIdeas(prev => [idea, ...prev])
    setNewIdea('')

    fetch(`${supabaseUrl}/rest/v1/workshop_ideas`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
      body: JSON.stringify(idea),
    }).then(res => {
      if (!res.ok) {
        res.text().then(t => setSubmitError('Failed to save: ' + t))
        setIdeas(prev => prev.filter(i => i.id !== idea.id))
      }
    }).catch(err => {
      setSubmitError('Failed to save: ' + err.message)
      setIdeas(prev => prev.filter(i => i.id !== idea.id))
    })
  }

  const handleSetStatus = (id, status) => {
    setIdeas(prev => prev.map(i => i.id === id ? { ...i, status } : i))
    fetch(`${supabaseUrl}/rest/v1/workshop_ideas?id=eq.${id}`, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
      body: JSON.stringify({ status }),
    }).then(res => {
      if (!res.ok) res.text().then(t => console.error('PATCH failed:', res.status, t))
    }).catch(err => console.error('Failed to update workshop idea:', err))
  }

  const handleDelete = (id) => {
    if (!window.confirm('Delete this workshop idea?')) return
    setIdeas(prev => prev.filter(i => i.id !== id))
    fetch(`${supabaseUrl}/rest/v1/workshop_ideas?id=eq.${id}`, {
      method: 'DELETE',
      headers,
    }).then(res => {
      if (!res.ok) res.text().then(t => console.error('DELETE failed:', res.status, t))
    }).catch(err => console.error('Failed to delete workshop idea:', err))
  }

  const formatDate = (timestamp) => {
    const date = new Date(timestamp)
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  }

  // Split ideas for non-reviewers
  const myIdeas = ideas.filter(i => i.author === username)
  const approvedIdeas = ideas.filter(i => i.status === 'approved')

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="px-4 py-3 ml-14 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-pastel-blue-dark via-pastel-pink-dark to-pastel-orange-dark bg-clip-text text-transparent">
              Workshops
            </h1>
            <p className="text-sm text-gray-500">
              {canReview ? 'Review workshop ideas from the team' : 'What workshops do you want to see?'}
            </p>
          </div>
          <NotificationBell />
        </div>
      </header>

      {canReview ? (
        <main className="flex-1 p-4 overflow-y-auto">
          <div className="max-w-2xl mx-auto space-y-6">
            {ideas.length > 0 ? (
              <div className="space-y-3">
                {ideas.map(idea => (
                  <div key={idea.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Lightbulb size={14} className="text-pastel-orange-dark" />
                      <span className="text-sm font-semibold text-pastel-pink-dark">{idea.author}</span>
                      <span className="text-xs text-gray-400">{formatDate(idea.created_at)}</span>
                      {idea.status && idea.status !== 'pending' && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[idea.status] || ''}`}>
                          {idea.status === 'approved' ? 'Approved' : 'Denied'}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap break-words mb-3">{idea.text}</p>
                    <div className="flex items-center gap-2">
                      {(!idea.status || idea.status === 'pending') && (
                        <>
                          <button
                            onClick={() => handleSetStatus(idea.id, 'approved')}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 hover:bg-green-100 transition-colors text-green-600 text-xs font-medium"
                          >
                            <Check size={14} />
                            Approve
                          </button>
                          <button
                            onClick={() => handleSetStatus(idea.id, 'denied')}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 transition-colors text-red-500 text-xs font-medium"
                          >
                            <X size={14} />
                            Deny
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handleDelete(idea.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors text-gray-500 text-xs font-medium"
                      >
                        <Trash2 size={14} />
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-400 mt-20">No workshop ideas submitted yet.</p>
            )}
          </div>
        </main>
      ) : (
        <main className="flex-1 p-4 overflow-y-auto">
          <div className="max-w-md mx-auto space-y-6">
            {/* Submit form (everyone except co-founders) */}
            {canSubmit && (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="text-center">
                  <Lightbulb size={32} className="mx-auto text-pastel-orange-dark mb-2" />
                  <h2 className="text-xl font-semibold text-gray-700">
                    Submit a Workshop Idea
                  </h2>
                  <p className="text-sm text-gray-400 mt-1">What topic would you like a workshop on?</p>
                </div>
                <textarea
                  value={newIdea}
                  onChange={(e) => setNewIdea(e.target.value)}
                  placeholder="e.g. How to use Git, Intro to CAD, Fundraising strategies..."
                  rows={4}
                  className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-pastel-pink focus:border-transparent resize-none text-sm"
                />
                {submitError && <p className="text-sm text-red-500 text-center">{submitError}</p>}
                <button
                  type="submit"
                  disabled={!newIdea.trim()}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-pastel-pink hover:bg-pastel-pink-dark disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-colors font-semibold text-gray-700"
                >
                  <Send size={16} />
                  Submit Idea
                </button>
              </form>
            )}

            {/* Approved ideas */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Approved Workshop Ideas</h3>
              {approvedIdeas.length > 0 ? (
                approvedIdeas.map(idea => (
                  <div key={idea.id} className="bg-green-50/50 rounded-xl shadow-sm border border-green-100 p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Lightbulb size={14} className="text-green-500" />
                      <span className="text-sm font-semibold text-gray-600">{idea.author}</span>
                      <span className="text-xs text-gray-400">{formatDate(idea.created_at)}</span>
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">{idea.text}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-400 text-center py-4">No approved ideas yet.</p>
              )}
            </div>

            {/* Your submitted ideas */}
            {myIdeas.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Your Submissions</h3>
                {myIdeas.map(idea => (
                  <div key={idea.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                        idea.status === 'approved' ? 'bg-green-500' :
                        idea.status === 'denied' ? 'bg-red-500' :
                        'bg-yellow-400'
                      }`} title={idea.status === 'approved' ? 'Approved' : idea.status === 'denied' ? 'Denied' : 'Pending'} />
                      <span className="text-xs text-gray-400">{idea.created_at ? formatDate(idea.created_at) : 'Just now'}</span>
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap break-words mt-1">{idea.text}</p>
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
