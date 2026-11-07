import { useState } from 'react'
import { AlertTriangle, Send, X, CheckCircle } from 'lucide-react'
import { useUser } from '../contexts/UserContext'
import { usePermissions } from '../hooks/usePermissions'
import { restHeaders } from '../lib/restHeaders'
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

export default function ReportIssueButton({ where = 'Competition Day', dayName = '' }) {
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
          id: uid(), text: `🚩 Comp Day issue (${context}): ${body}`, author: username || '', username: username || '',
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
        <div className="fixed inset-0 z-[96] bg-black/40 flex items-start sm:items-center justify-center p-4 pt-20" onClick={() => state !== 'sending' && setOpen(false)}>
          <form onSubmit={send} onClick={e => e.stopPropagation()} className="w-full max-w-md bg-white rounded-2xl shadow-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-800 flex items-center gap-1.5"><AlertTriangle size={17} className="text-amber-500" /> Report an issue</h2>
              <button type="button" onClick={() => setOpen(false)} className="p-1 rounded hover:bg-gray-100" aria-label="Close"><X size={16} /></button>
            </div>
            <p className="text-xs text-gray-500">Goes straight to Kayden and Yukti, the project managers, with where you were ({where}{dayName ? ` · ${dayName}` : ''}).</p>
            {state === 'sent' ? (
              <p className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-lg p-3"><CheckCircle size={16} /> Sent. Thanks — they've been notified.</p>
            ) : (
              <>
                <textarea value={text} onChange={e => setText(e.target.value)} rows={4} maxLength={1000} autoFocus
                  placeholder="What's wrong? What were you doing when it happened?"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
                {state === 'error' && <p className="text-xs text-red-600">Couldn't send. Check your connection and try again.</p>}
                <button disabled={!text.trim() || state === 'sending'}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold disabled:opacity-50">
                  <Send size={15} /> {state === 'sending' ? 'Sending…' : 'Send to Kayden & Yukti'}
                </button>
              </>
            )}
          </form>
        </div>
      )}
    </>
  )
}
