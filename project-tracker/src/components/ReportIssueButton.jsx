import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, Send, X, CheckCircle, Check } from 'lucide-react'
import { useUser } from '../contexts/UserContext'
import { usePermissions } from '../hooks/usePermissions'
import { restHeaders, ensureUserToken } from '../lib/restHeaders'
import { stampTeam } from '../lib/teamScope'
import { triggerPush } from '../utils/pushHelper'

// "Something's wrong" from inside Competition Day, straight to the project
// managers, Kayden and Yukti. Saved as a suggestion (cofounders read every
// team's) and pushed to both of their phones, with the mode and the day so
// they know where to look.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
// Profile ids, written down because a member of another team cannot look up
// Radical's profiles to find them.
const PROJECT_MANAGERS = [
  { id: 'f60151cf-97e4-479d-898a-4395dbabfb13', name: 'Kayden' },
  { id: '4360a0de-df24-4331-8879-9eea28170a07', name: 'Yukti' },
]
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

const PREFIX = '🚩 Comp Day issue'
// A panel that drops from the top-right button, above everything, never
// clipped by the header.
const Panel = ({ onClose, children }) => createPortal(
  <div className="fixed inset-0 z-[96]" onClick={onClose}>
    <div className="absolute inset-0 bg-black/20" />
    <div onClick={e => e.stopPropagation()}
      className="absolute right-3 top-16 w-[min(26rem,calc(100vw-1.5rem))] max-h-[calc(100vh-5rem)] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-gray-100 p-4 space-y-3">
      {children}
    </div>
  </div>,
  document.body,
)

export default function ReportIssueButton(props) {
  const { user } = useUser()
  const { isCofounder } = usePermissions()
  // The project managers get the reports, so their button opens the inbox:
  // Kayden and Yukti by account, or anyone the app counts as a cofounder.
  const isPM = isCofounder || PROJECT_MANAGERS.some(pm => pm.id === user?.id)
  return isPM ? <IssueInbox /> : <ReportForm {...props} />
}

// Kayden and Yukti: every Comp Day issue from every team, newest first.
function IssueInbox() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const [showDone, setShowDone] = useState(false)
  const load = useCallback(async () => {
    try {
      await ensureUserToken()
      const res = await fetch(`${supabaseUrl}/rest/v1/suggestions?text=like.${encodeURIComponent(PREFIX + '*')}&select=*&order=created_at.desc&limit=200`, { headers: restHeaders() })
      if (res.ok) setItems(await res.json())
    } catch { /* keep what we had */ }
  }, [])
  useEffect(() => {
    load()
    const t = setInterval(() => { if (document.visibilityState === 'visible') load() }, 30000)
    return () => clearInterval(t)
  }, [load])
  const open_ = items.filter(i => i.status !== 'resolved')
  const shown = showDone ? items : open_
  const resolve = async (i) => {
    setItems(prev => prev.map(x => x.id === i.id ? { ...x, status: 'resolved' } : x))
    await fetch(`${supabaseUrl}/rest/v1/suggestions?id=eq.${encodeURIComponent(i.id)}`, {
      method: 'PATCH', headers: restHeaders({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }), body: JSON.stringify({ status: 'resolved' }),
    }).catch(() => {})
  }
  // "🚩 Comp Day issue (Competition Day · Pit mode · Bettendorf): text" → where, text
  const parse = (t) => { const m = /^🚩 Comp Day issue \((.*?)\): ([\s\S]*)$/.exec(t || ''); return m ? { where: m[1], body: m[2] } : { where: '', body: t } }
  return (
    <>
      <button type="button" onClick={() => { setOpen(true); load() }} title="Issues people reported"
        className="relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-semibold bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 shrink-0">
        <AlertTriangle size={15} /> <span className="hidden sm:inline">Issues</span>
        {open_.length > 0 && <span className="absolute -top-1.5 -right-1.5 min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">{open_.length}</span>}
      </button>
      {open && (
        <Panel onClose={() => setOpen(false)}>
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-gray-800 flex items-center gap-1.5"><AlertTriangle size={17} className="text-amber-500" /> Reported issues</h2>
            <button type="button" onClick={() => setOpen(false)} className="p-1 rounded hover:bg-gray-100" aria-label="Close"><X size={16} /></button>
          </div>
          {shown.length === 0 ? <p className="text-sm text-gray-400 py-4 text-center">{showDone ? 'No issues yet.' : 'Nothing open. 🎉'}</p> : (
            <div className="space-y-2">
              {shown.map(i => {
                const { where, body } = parse(i.text)
                const done = i.status === 'resolved'
                return (
                  <div key={i.id} className={`rounded-xl border p-2.5 ${done ? 'border-gray-100 bg-gray-50 opacity-60' : 'border-amber-200 bg-amber-50/60'}`}>
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{body}</p>
                    <div className="flex items-center justify-between gap-2 mt-1">
                      <p className="text-[11px] text-gray-500">{i.author || 'Someone'}{where ? ` · ${where}` : ''} · {new Date(i.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</p>
                      {!done && <button type="button" onClick={() => resolve(i)} className="flex items-center gap-1 text-[11px] font-semibold text-green-700 hover:underline shrink-0"><Check size={12} /> Resolved</button>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          <button type="button" onClick={() => setShowDone(!showDone)} className="text-xs text-gray-400 hover:text-gray-600 underline">{showDone ? 'Hide resolved' : 'Show resolved too'}</button>
        </Panel>
      )}
    </>
  )
}

function ReportForm({ where = 'Competition Day', dayName = '' }) {
  const { username, user } = useUser()
  const { myTeamNumber } = usePermissions()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [state, setState] = useState('idle') // idle | sending | sent | error

  const send = async (e) => {
    e.preventDefault()
    const body = text.trim()
    if (!body) return
    setState('sending')
    const context = [where, dayName, myTeamNumber && myTeamNumber !== '7196' ? `Team ${myTeamNumber}` : ''].filter(Boolean).join(' · ')
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/suggestions`, {
        method: 'POST',
        headers: restHeaders({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
        body: JSON.stringify(stampTeam({
          id: uid(), text: `${PREFIX} (${context}): ${body}`, author: username || '', username: username || '',
          author_id: user?.id || null, user_id: user?.id || null, status: 'new',
        }, myTeamNumber)),
      })
      if (!res.ok) throw new Error(await res.text())
      await Promise.all(PROJECT_MANAGERS.map(pm => {
        const notif = { id: uid(), user_id: pm.id, type: 'issue_report', title: `🚩 Issue in ${where}`, body: `${username || 'Someone'}: ${body}`.slice(0, 300), data: { where, dayName }, force: true }
        return fetch(`${supabaseUrl}/rest/v1/notifications`, {
          method: 'POST', headers: restHeaders({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }), body: JSON.stringify(notif),
        }).then(() => triggerPush(notif)).catch(() => {})
      }))
      setState('sent'); setText('')
      setTimeout(() => { setOpen(false); setState('idle') }, 1800)
    } catch (err) {
      console.error('Issue report failed:', err)
      setState('error')
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} title="Report a problem to Kayden and Yukti"
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-semibold bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 shrink-0">
        <AlertTriangle size={15} /> <span className="hidden sm:inline">Report issue</span>
      </button>
      {open && (
        <Panel onClose={() => state !== 'sending' && setOpen(false)}>
          <form onSubmit={send} className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-800 flex items-center gap-1.5"><AlertTriangle size={17} className="text-amber-500" /> Report an issue</h2>
              <button type="button" onClick={() => setOpen(false)} className="p-1 rounded hover:bg-gray-100" aria-label="Close"><X size={16} /></button>
            </div>
            <p className="text-xs text-gray-500">Goes straight to Kayden and Yukti.{username ? <span className="text-gray-400"> You're signed in as {username}.</span> : null}</p>
            {state === 'sent' ? (
              <p className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-lg p-3"><CheckCircle size={16} /> Sent. Thanks — they've been notified.</p>
            ) : (
              <>
                <textarea value={text} onChange={e => setText(e.target.value)} rows={3} maxLength={1000} autoFocus
                  placeholder="What's wrong?"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
                {state === 'error' && <p className="text-xs text-red-600">Couldn't send. Check your connection and try again.</p>}
                <button disabled={!text.trim() || state === 'sending'}
                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold disabled:opacity-50">
                  <Send size={15} /> {state === 'sending' ? 'Sending…' : 'Send'}
                </button>
              </>
            )}
          </form>
        </Panel>
      )}
    </>
  )
}
