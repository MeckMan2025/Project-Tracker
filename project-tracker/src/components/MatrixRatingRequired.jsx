import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'
import { useUser } from '../contexts/UserContext'
import { VoteView, RevealCeremony } from './DesignMatrix'
import { getSession, withSession, hasFinished, tally } from '../lib/matrixSession'

const REST_URL = import.meta.env.VITE_SUPABASE_URL
const REST_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const HEADERS = { apikey: REST_KEY, Authorization: `Bearer ${REST_KEY}` }

// If you've been picked to rate a decision matrix, it comes to you. A
// notification is easy to miss and the library shelf only helps people who
// think to go and look.
export default function MatrixRatingRequired() {
  const { username } = useUser()
  const [pending, setPending] = useState([])
  const [reveal, setReveal] = useState(null)
  const [results, setResults] = useState(null)
  const [saving, setSaving] = useState(false)

  // Matrices this device has just submitted. The poll runs every few seconds,
  // so a request already in flight when you hit Submit comes back holding the
  // state from before your vote and would put you straight back into the form.
  // Anything in here stays out of the queue until the server is seen to have
  // caught up.
  const justSubmitted = useRef(new Set())

  // One reveal each, remembered per device — the moment shouldn't replay every
  // time someone reloads.
  const seenKey = (id) => `matrix-revealed-${id}`
  const alreadySeen = (id) => { try { return localStorage.getItem(seenKey(id)) === '1' } catch { return true } }
  const markSeen = (id) => { try { localStorage.setItem(seenKey(id), '1') } catch { /* private mode */ } }

  const load = async () => {
    if (!username) return
    // Only the columns needed to decide what to show — this runs every few
    // seconds, so don't drag whole matrices across for it.
    try {
      const res = await fetch(`${REST_URL}/rest/v1/design_matrices?select=*`, { headers: HEADERS })
      if (!res.ok) return
      const rows = await res.json()
      // An empty matrix has nothing to rate — never trap anyone behind one.
      const real = (rows || []).filter(m => (m.options || []).length && (m.criteria || []).length)
      setPending(real.filter(m => {
        const s = getSession(m)
        if (!s || s.status !== 'open') return false
        if (!(s.participants || []).includes(username)) return false
        if (hasFinished(m, s, username)) {
          justSubmitted.current.delete(m.id)   // server has it — guard can go
          return false
        }
        return !justSubmitted.current.has(m.id)
      }))
      // A decision you helped make gets announced to you too, drumroll and all.
      const justDecided = real.find(m => {
        const s = getSession(m)
        return s && s.status === 'closed'
          && (s.participants || []).includes(username)
          && !alreadySeen(m.id)
      })
      if (justDecided) {
        const se = getSession(justDecided)
        const t = tally(justDecided, se)
        // Held on "Are you ready?" until the host reveals it, so everyone's
        // drumroll starts together — but only when the session actually says
        // it's unrevealed. A closed session with no flag was closed before the
        // flag existed; its host has long since had their reveal and will never
        // press the button again, so waiting on them is waiting forever.
        setReveal({
          id: justDecided.id,
          title: justDecided.title,
          winner: t.winner,
          tied: t.tied,
          byOption: t.byOption,
          criteria: justDecided.criteria || [],
          waiting: se.revealed === false,
        })
      } else {
        setReveal(null)
      }
    } catch { /* offline — try again on the next change */ }
  }

  useEffect(() => { load() }, [username])

  // Three ways in, because only the first is instant and none is guaranteed:
  // the app tells us directly when it hosts or records a vote, realtime covers
  // other people's devices, and a slow poll catches the case where
  // design_matrices never made it into the realtime publication.
  useEffect(() => {
    if (!username) return
    const onSignal = () => load()
    window.addEventListener('matrix-session-changed', onSignal)
    const ch = supabase
      .channel('matrix-rating-required')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'design_matrices' }, load)
      .subscribe()
    // Fast, because this is how the drumroll reaches everyone else's screen
    // when the host presses reveal. Realtime would be instant, but it only
    // fires if design_matrices actually made it into the publication, which
    // can't be checked from here — so the poll has to be quick enough to carry
    // a shared moment on its own.
    const poll = setInterval(load, 3000)
    return () => {
      window.removeEventListener('matrix-session-changed', onSignal)
      supabase.removeChannel(ch)
      clearInterval(poll)
    }
  }, [username])

  if (reveal) {
    return (
      <RevealCeremony
        winner={reveal.winner}
        tied={reveal.tied}
        autoStart
        waiting={reveal.waiting}
        // "See the numbers" used to just close, dropping people back on
        // whichever page they were on — the table is on the Decision Matrix
        // page they were never taken to. Show it here instead.
        onDone={() => { markSeen(reveal.id); setResults(reveal); setReveal(null) }}
      />
    )
  }

  if (results) {
    return (
      <div className="fixed inset-0 z-[60] bg-gray-900/80 backdrop-blur-sm overflow-y-auto">
        <div className="min-h-full flex items-start justify-center p-4 py-8">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl p-5 space-y-4">
            <div>
              <h2 className="text-lg font-bold text-gray-800">{results.title}</h2>
              <p className="text-xs text-gray-400">Everyone's ratings, averaged</p>
            </div>
            {results.winner && (
              <div className="rounded-xl border-2 border-pastel-pink bg-pastel-pink/10 p-3 text-center">
                <p className="text-lg font-black text-gray-800">🏆 {results.winner.name}</p>
                <p className="text-xs text-gray-500">{results.winner.total.toFixed(1)} total</p>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400">
                    <th className="text-left p-2">Option</th>
                    {results.criteria.map(c => <th key={c.id} className="p-2 font-semibold">{c.name}</th>)}
                    <th className="p-2 font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {results.byOption.map((o, i) => (
                    <tr key={o.id} className={i === 0 && o.total > 0 ? 'bg-pastel-pink/10' : ''}>
                      <td className="p-2 font-semibold text-gray-700">{o.name}</td>
                      {o.perCriterion.map(c => (
                        <td key={c.id} className="p-2 text-center text-gray-600">{c.count ? c.avg.toFixed(1) : '—'}</td>
                      ))}
                      <td className="p-2 text-center font-bold text-gray-800">{o.total.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button onClick={() => setResults(null)}
              className="w-full py-2.5 rounded-xl bg-pastel-pink hover:bg-pastel-pink-dark text-sm font-semibold">
              Done
            </button>
          </div>
        </div>
      </div>
    )
  }

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
      justSubmitted.current.add(matrix.id)
      setPending(prev => prev.filter(m => m.id !== matrix.id))
      // Tell the Decision Matrix page, which is sitting behind this overlay
      // holding a copy of the matrix from before the vote. Without this it
      // keeps offering "Rate this matrix" and it reads as being asked twice.
      window.dispatchEvent(new Event('matrix-session-changed'))
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
            key={matrix.id}
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
