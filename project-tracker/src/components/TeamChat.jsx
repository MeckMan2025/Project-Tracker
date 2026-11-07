import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { MessageCircle, Send, Trash2, ArrowLeft } from 'lucide-react'
import { usePermissions } from '../hooks/usePermissions'
import { restHeaders, ensureUserToken } from '../lib/restHeaders'
import { HOME_TEAM_NUMBER } from '../data/team'
import { ALL_TEAMS } from '../data/teams'
import NotificationBell from './NotificationBell'

// Team Chat: one team talking to another, as the team. A message carries only
// which team sent it and which it is for — never a person — and the database
// lets only those two teams read it (supabase/team_messages.sql). The list is
// every team that has signed up, plus Radical, and never a testing account
// (supabase/chat_teams.sql): a new team shows up here on its own.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const nameOf = (n) => (ALL_TEAMS.find(t => String(t.number) === String(n)) || {}).name || ''
const when = (iso) => {
  const d = new Date(iso)
  const today = new Date().toDateString() === d.toDateString()
  return today ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export default function TeamChat() {
  const { myTeamNumber } = usePermissions()
  const us = String(myTeamNumber || HOME_TEAM_NUMBER)
  const [all, setAll] = useState([])
  const [state, setState] = useState('loading') // loading | ok | missing
  const [open, setOpen] = useState(null)        // the other team's number
  const [text, setText] = useState('')
  const [teams, setTeams] = useState([])      // [{ team_number, team_name }]
  const endRef = useRef(null)

  const load = useCallback(async () => {
    try {
      await ensureUserToken()
      const res = await fetch(`${supabaseUrl}/rest/v1/team_messages?select=*&order=created_at.asc&limit=2000`, { headers: restHeaders() })
      if (res.status === 404) { setState('missing'); return }
      if (res.ok) { setAll(await res.json()); setState('ok') }
    } catch { /* next poll */ }
  }, [])
  useEffect(() => {
    load()
    const t = setInterval(() => { if (document.visibilityState === 'visible') load() }, 8000)
    return () => clearInterval(t)
  }, [load])
  useEffect(() => {
    ;(async () => {
      try {
        await ensureUserToken()
        const res = await fetch(`${supabaseUrl}/rest/v1/rpc/chat_teams`, { method: 'POST', headers: restHeaders({ 'Content-Type': 'application/json' }), body: '{}' })
        if (res.status === 404) { setState('missing'); return }
        if (res.ok) setTeams(await res.json())
      } catch { /* leave empty */ }
    })()
  }, [])

  // One row per team on the list, in the order they signed up — Radical, then
  // Prime Suspects, then whoever joins next. Your own team's row stays in
  // place, marked as you; the others open a conversation.
  const threads = useMemo(() => {
    const by = {}
    all.forEach(m => {
      const other = m.from_team === us ? m.to_team : m.from_team
      ;(by[other] = by[other] || []).push(m)
    })
    return teams.map(t => {
      const msgs = by[String(t.team_number)] || []
      return { team: String(t.team_number), name: t.team_name || nameOf(t.team_number), msgs, last: msgs[msgs.length - 1] || null, me: String(t.team_number) === us }
    })
  }, [all, us, teams])
  const thread = open ? (threads.find(t => t.team === open)?.msgs || []) : []
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }) }, [open, thread.length])

  const send = async (e) => {
    e.preventDefault()
    const body = text.trim()
    if (!body || !open) return
    setText('')
    await fetch(`${supabaseUrl}/rest/v1/team_messages`, {
      method: 'POST', headers: restHeaders({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
      body: JSON.stringify({ from_team: us, to_team: open, body }),
    }).catch(() => {})
    load()
  }
  const unsend = async (id) => {
    await fetch(`${supabaseUrl}/rest/v1/team_messages?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE', headers: restHeaders({ Prefer: 'return=minimal' }) }).catch(() => {})
    load()
  }

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="px-4 py-3 ml-14 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-pastel-blue-dark via-pastel-pink-dark to-pastel-orange-dark bg-clip-text text-transparent">Team Chat</h1>
            <p className="text-xs text-gray-400">You speak as Team {us}. Only the two teams in a chat can see it.</p>
          </div>
          <NotificationBell />
        </div>
      </header>
      <main className="flex-1 p-4 overflow-hidden flex flex-col min-h-0">
        <div className="flex-1 min-h-0 max-w-2xl w-full mx-auto flex flex-col">
        {state === 'missing' ? (
          <p className="text-sm text-gray-400 text-center mt-10">Team Chat is being set up. It will open here once it's switched on.</p>
        ) : !open ? (
          // The list: one row per team, Radical first, then each team as it signs up.
          <div className="space-y-2">
            {threads.map(t => (
              <button key={t.team} type="button" onClick={() => !t.me && setOpen(t.team)} disabled={t.me}
                className={`w-full flex items-center gap-3 text-left rounded-xl px-4 py-3 shadow-sm border transition-colors ${t.me
                  ? 'bg-gray-50 border-gray-100 cursor-default'
                  : 'bg-white/90 border-gray-100 hover:border-pastel-blue hover:bg-pastel-blue/10'}`}>
                <span className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${t.me ? 'bg-gray-200' : 'bg-pastel-blue/40'}`}>
                  <MessageCircle size={18} className={t.me ? 'text-gray-400' : 'text-pastel-blue-dark'} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block font-semibold text-gray-800">Team {t.team} <span className="font-normal text-gray-500">· {t.name}</span></span>
                  <span className="block text-xs text-gray-500 truncate">{t.me ? 'Your team' : t.last ? `${t.last.from_team === us ? 'You: ' : ''}${t.last.body}` : 'No messages yet'}</span>
                </span>
                {!t.me && t.last && <span className="text-[11px] text-gray-400 shrink-0">{when(t.last.created_at)}</span>}
              </button>
            ))}
            {state === 'ok' && threads.length <= 2 && <p className="text-xs text-gray-400 text-center pt-1">More teams show up here as they sign up.</p>}
          </div>
        ) : (
          // One conversation, full width.
          <section className="flex-1 min-h-0 bg-white/80 rounded-xl shadow-sm p-3 flex flex-col">
            <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
              <button type="button" onClick={() => setOpen(null)} className="p-1 rounded hover:bg-gray-100" aria-label="Back"><ArrowLeft size={16} /></button>
              <p className="font-semibold text-gray-800">Team {open} <span className="text-xs font-normal text-gray-400">{threads.find(t => t.team === open)?.name || nameOf(open)}</span></p>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto py-2 space-y-1.5">
              {thread.length === 0 && <p className="text-xs text-gray-400 text-center py-6">Say hello to Team {open}.</p>}
              {thread.map(m => {
                const mine = m.from_team === us
                return (
                  <div key={m.id} className={`group flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-xl px-3 py-1.5 text-sm ${mine ? 'bg-pastel-blue/50 text-gray-800' : 'bg-white border border-gray-100 text-gray-800'}`}>
                      <p className="text-[10px] font-bold text-gray-500">Team {m.from_team}</p>
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                      <p className="text-[10px] text-gray-400 text-right">{when(m.created_at)}
                        {mine && <button type="button" onClick={() => unsend(m.id)} title="Unsend" className="ml-1 opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400"><Trash2 size={10} className="inline" /></button>}
                      </p>
                    </div>
                  </div>
                )
              })}
              <div ref={endRef} />
            </div>
            <form onSubmit={send} className="flex gap-2 pt-2 border-t border-gray-100">
              <input value={text} onChange={e => setText(e.target.value)} maxLength={1000} placeholder={`Message Team ${open} as Team ${us}…`}
                     className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-pastel-blue" />
              <button className="px-3 py-2 rounded-lg bg-pastel-blue hover:bg-pastel-blue-dark text-gray-800 text-sm font-semibold flex items-center gap-1"><Send size={14} /> Send</button>
            </form>
          </section>
        )}
        </div>
      </main>
    </div>
  )
}
