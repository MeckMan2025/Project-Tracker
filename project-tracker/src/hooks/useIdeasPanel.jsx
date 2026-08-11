import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

// Co-founder-only "?" panel in the bell: ideas pitched from under-construction
// pages (and anything else in the suggestions box), newest first.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const headers = { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }

const fmt = (ts) => ts ? new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' }) : ''

export function useIdeasPanel(enabled) {
  const [items, setItems] = useState([])

  useEffect(() => {
    if (!enabled) return
    let active = true
    const load = async () => {
      try {
        const res = await fetch(`${supabaseUrl}/rest/v1/suggestions?status=eq.pending&order=created_at.desc&limit=20&select=id,author,text,created_at`, { headers })
        if (res.ok && active) setItems(await res.json())
      } catch { /* ignore */ }
    }
    load()
    const ch = supabase
      .channel('ideas-bell')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'suggestions' }, load)
      .subscribe()
    return () => { active = false; supabase.removeChannel(ch) }
  }, [enabled])

  const dismiss = (id) => {
    setItems(prev => prev.filter(i => i.id !== id))
    fetch(`${supabaseUrl}/rest/v1/suggestions?id=eq.${id}`, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ status: 'reviewed' }),
    }).catch(() => {})
  }

  const panel = items.length === 0 ? (
    <div className="p-6 text-center text-sm text-gray-400">No ideas waiting</div>
  ) : (
    <div className="divide-y divide-gray-100">
      {items.map(i => (
        <div key={i.id} className="p-3 group">
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{i.text}</p>
          <div className="flex items-center justify-between mt-1">
            <p className="text-[10px] text-gray-400">{i.author} · {fmt(i.created_at)}</p>
            <button onClick={() => dismiss(i.id)} className="text-[10px] font-semibold text-gray-300 hover:text-gray-500">
              mark reviewed
            </button>
          </div>
        </div>
      ))}
    </div>
  )

  return { ideaCount: items.length, panel }
}
