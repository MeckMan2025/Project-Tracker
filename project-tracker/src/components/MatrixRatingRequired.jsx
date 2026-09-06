import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useUser } from '../contexts/UserContext'
import { VoteView } from './DesignMatrix'
import { getSession, withSession, hasFinished } from '../lib/matrixSession'

const REST_URL = import.meta.env.VITE_SUPABASE_URL
const REST_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const HEADERS = { apikey: REST_KEY, Authorization: `Bearer ${REST_KEY}` }

// If you've been picked to rate a decision matrix, it comes to you. A
// notification is easy to miss and the library shelf only helps people who
// think to go and look.
export default function MatrixRatingRequired() {
  const { username } = useUser()
  const [pending, setPending] = useState([])
  const [saving, setSaving] = useState(false)

  const load = async () => {
    if (!username) return
    try {
      const res = await fetch(`${REST_URL}/rest/v1/design_matrices?select=*`, { headers: HEADERS })
      if (!res.ok) return
      const rows = await res.json()
      setPending((rows || []).filter(m => {
        const s = getSession(m)
        // An empty matrix has nothing to rate — never trap anyone behind one.
        if (!(m.options || []).length || !(m.criteria || []).length) return false
        return s && s.status === 'open'
          && (s.participants || []).includes(username)
          && !hasFinished(m, s, username)
      }))
    } catch { /* offline — try again on the next change */ }
  }

  useEffect(() => { load() }, [username])

  useEffect(() => {
    if (!username) return
    const ch = supabase
      .channel('matrix-rating-required')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'design_matrices' }, load)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [username])

  const matrix = pending[0]
  if (!matrix) return null
  const session = getSession(matrix)

  const submit = async (votes) => {
    setSaving(true)
    const next = { ...session, votes: { ...(session.votes || {}), [username]: votes } }
    try {
      await fetch(`${REST_URL}/rest/v1/design_matrices?id=eq.${matrix.id}`, {
        method: 'PATCH',
        headers: { ...HEADERS, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ scores: withSession(matrix.scores, next), updated_at: new Date().toISOString() }),
      })
      setPending(prev => prev.filter(m => m.id !== matrix.id))
    } catch (err) {
      console.error('Failed to save ratings:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] bg-gradient-to-br from-pastel-blue/95 via-pastel-pink/90 to-pastel-orange/95 backdrop-blur-sm overflow-y-auto">
      <div className="min-h-full flex items-start justify-center p-4 py-8">
        <div className="w-full max-w-lg bg-white/95 rounded-2xl shadow-xl p-5 space-y-4">
          <div className="text-center">
            <p className="text-xs font-bold uppercase tracking-wider text-pastel-pink-dark">You've been asked to rate this</p>
            <p className="text-xs text-gray-400 mt-1">
              {session.hostedBy} is waiting on you{pending.length > 1 ? ` · ${pending.length - 1} more after this` : ''}
            </p>
          </div>
          {/* No cancel — this is the point of hosting one. */}
          <VoteView
            matrix={matrix}
            session={session}
            username={username}
            onSubmit={submit}
            onCancel={null}
          />
          {saving && <p className="text-center text-xs text-gray-400">Saving…</p>}
        </div>
      </div>
    </div>
  )
}
