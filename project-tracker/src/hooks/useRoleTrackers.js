import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../supabase'
import { SEED_TRACKERS } from '../data/roleTrackers'

// All role trackers live in one JSON doc (scouting_schedule row id='role_trackers')
// so the feature needs no new table or migration. Anon REST + realtime.
const DOC_ID = 'role_trackers'

export function useRoleTrackers() {
  const [trackers, setTrackers] = useState(null) // null = loading
  const ref = useRef([])
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY
  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }

  const apply = (list) => { ref.current = list; setTrackers(list) }

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${url}/rest/v1/scouting_schedule?id=eq.${DOC_ID}&select=data`, { headers })
        if (res.ok) {
          const rows = await res.json()
          const t = rows?.[0]?.data?.trackers
          apply(Array.isArray(t) && t.length ? t : SEED_TRACKERS)
        } else apply(SEED_TRACKERS)
      } catch { apply(SEED_TRACKERS) }
    })()
    const ch = supabase
      .channel('role-trackers')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scouting_schedule' }, (p) => {
        if (p.new?.id === DOC_ID && Array.isArray(p.new?.data?.trackers)) apply(p.new.data.trackers)
      })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const persist = useCallback(async (next) => {
    apply(next)
    try {
      await fetch(`${url}/rest/v1/scouting_schedule`, {
        method: 'POST',
        headers: { ...headers, Prefer: 'resolution=merge-duplicates, return=minimal' },
        body: JSON.stringify({ id: DOC_ID, data: { trackers: next } }),
      })
    } catch { /* ignore */ }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const upsertTracker = useCallback((tr) => {
    const cur = ref.current
    const next = cur.some(t => t.id === tr.id) ? cur.map(t => (t.id === tr.id ? tr : t)) : [...cur, tr]
    persist(next)
  }, [persist])

  const removeTracker = useCallback((id) => {
    persist(ref.current.filter(t => t.id !== id))
  }, [persist])

  return { trackers: trackers || [], loading: trackers === null, upsertTracker, removeTracker }
}
