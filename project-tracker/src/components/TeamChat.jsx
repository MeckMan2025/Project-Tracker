import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { MessageCircle, Send, Plus, Trash2, ArrowLeft } from 'lucide-react'
import { usePermissions } from '../hooks/usePermissions'
import { restHeaders, ensureUserToken } from '../lib/restHeaders'
import { HOME_TEAM_NUMBER } from '../data/team'
import { ALL_TEAMS } from '../data/teams'
import NotificationBell from './NotificationBell'

// Team Chat: one team talking to another, as the team. A message carries only
// which team sent it and which it is for — never a person — and the database
// lets only those two teams read it (supabase/team_messages.sql). A team can
// only start a chat with a team that is on ETS.
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
  const [newTeam, setNewTeam] = useState('')
  const [newError, setNewError] = useState('')
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

  // One conversation per other team, newest first.
  const threads = useMemo(() => {
    const by = {}
    all.forEach(m => {
      const other = m.from_team === us ? m.to_team : m.from_team
      ;(by[other] = by[other] || []).push(m)
    })
    return Object.entries(by).map(([team, msgs]) => ({ team, msgs, last: msgs[msgs.length - 1] }))
      .sort((a, b) => String(b.last.created_at).localeCompare(String(a.last.created_at)))
  }, [all, us])
  const thread = open ? (threads.find(t => t.team === open)?.msgs || []) : []
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }) }, [open, thread.length])

  const start = async (e) => {
    e.preventDefault()
    const t = newTeam.trim()
    setNewError('')
    if (!/^\d{2,6}$/.test(t)) { setNewError('Type a team number.'); return }
    if (t === us) { setNewError("That's your own team."); return }
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/rpc/team_on_ets`, {
        method: 'POST', headers: restHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ t }),
      })
      if (res.ok && !(await res.json())) { setNewError(`Team ${t} isn't on ETS yet, so they couldn't read it.`); return }
    } catch { /* let the send decide */ }
    setOpen(t); setNewTeam('')
  }
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
        {state === 'missing' ? (
          <p className="text-sm text-gray-400 text-center mt-10">Team Chat is being set up. It will open here once it's switched on.</p>
        ) : (
          <div className="flex-1 min-h-0 max-w-4xl w-full mx-auto grid md:grid-cols-[16rem_1fr] gap-3">
            {/* Conversations */}
            <section className={`bg-white/80 rounded-xl shadow-sm p-3 flex flex-col min-h-0 ${open ? 'hidden md:flex' : 'flex'}`}>
              <form onSubmit={start} className="flex gap-1.5 mb-1">
                <input value={newTeam} onChange={e => setNewTeam(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="Team number"
                       className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-pastel-blue" />
                <button className="px-2.5 py-1.5 rounded-lg bg-pastel-blue hover:bg-pastel-blue-dark text-sm font-semibold text-gray-800 flex items-center gap-1"><Plus size={14} /> Chat</button>
              </form>
              {newError && <p className="text-[11px] text-amber-700 mb-1">{newError}</p>}
              <div className="flex-1 min-h-0 overflow-y-auto space-y-1 mt-1">
                {threads.length === 0 && state === 'ok' && <p className="text-xs text-gray-400 text-center py-6">No chats yet. Type a team number to start one.</p>}
                {threads.map(t => (
                  <button key={t.team} type="button" onClick={() => setOpen(t.team)}
                    className={`w-full text-left rounded-lg px-2.5 py-2 transition-colors ${open === t.team ? 'bg-pastel-blue/40' : 'hover:bg-pastel-blue/20'}`}>
                    <p className="text-sm font-semibold text-gray-800">Team {t.team} <span className="text-[11px] font-normal text-gray-400">{nameOf(t.team)}</span></p>
                    <p className="text-xs text-gray-500 truncate">{t.last.from_team === us ? 'You: ' : ''}{t.last.body}</p>
                  </button>
                ))}
              </div>
            </section>

            {/* One conversation */}
            <section className={`bg-white/80 rounded-xl shadow-sm p-3 flex flex-col min-h-0 ${open ? 'flex' : 'hidden md:flex'}`}>
              {!open ? (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-400 text-sm gap-2">
                  <MessageCircle size={28} /> Pick a chat, or start one with a team number.
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                    <button type="button" onClick={() => setOpen(null)} className="md:hidden p-1 rounded hover:bg-gray-100" aria-label="Back"><ArrowLeft size={16} /></button>
                    <p className="font-semibold text-gray-800">Team {open} <span className="text-xs font-normal text-gray-400">{nameOf(open)}</span></p>
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
                </>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  )
}
