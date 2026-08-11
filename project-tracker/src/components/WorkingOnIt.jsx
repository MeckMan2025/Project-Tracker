import { useState } from 'react'
import { Lightbulb, Send } from 'lucide-react'
import NotificationBell from './NotificationBell'
import { useUser } from '../contexts/UserContext'
import { triggerPush } from '../utils/pushHelper'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const headers = { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' }

// The standard "not built yet" screen — the one AI Manual has always used.
// Any tab that needs a placeholder renders this so they all stay identical.
// Visitors can pitch what THEY want the page to be — ideas land in the
// suggestions box and ping the co-founders' 💡 panel in the bell.
export default function WorkingOnIt({ title }) {
  const { username, user } = useUser()
  const [idea, setIdea] = useState('')
  const [sent, setSent] = useState(false)

  const submit = async () => {
    const text = idea.trim()
    if (!text) return
    setIdea(''); setSent(true)
    setTimeout(() => setSent(false), 4000)
    try {
      await fetch(`${supabaseUrl}/rest/v1/suggestions`, {
        method: 'POST', headers,
        body: JSON.stringify({
          id: String(Date.now()) + Math.random().toString(36).slice(2),
          author: username || 'Anonymous',
          author_id: user?.id || null,
          text: `[${title}] ${text}`,
          status: 'pending',
        }),
      })
      // Ping the co-founders so ideas don't sit unseen.
      const res = await fetch(`${supabaseUrl}/rest/v1/profiles?select=id,function_tags`, { headers })
      if (res.ok) {
        for (const pr of await res.json()) {
          if (!(pr.function_tags || []).includes('Co-Founder')) continue
          const notif = {
            id: String(Date.now()) + Math.random().toString(36).slice(2) + pr.id.slice(0, 4),
            user_id: pr.id,
            type: 'idea',
            title: `💡 Idea for ${title}`,
            body: `${username}: ${text}`,
          }
          await fetch(`${supabaseUrl}/rest/v1/notifications`, { method: 'POST', headers, body: JSON.stringify(notif) })
          triggerPush(notif)
        }
      }
    } catch { /* ignore */ }
  }

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="px-4 py-3 ml-14 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-pastel-blue-dark via-pastel-pink-dark to-pastel-orange-dark bg-clip-text text-transparent">
              {title}
            </h1>
          </div>
          <NotificationBell />
        </div>
      </header>
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <div className="text-7xl mb-5 animate-bounce">🚧</div>
        <h2 className="text-2xl md:text-3xl font-bold text-gray-700 mb-2">Under Construction</h2>
        <p className="text-gray-500 max-w-sm">
          <span className="font-semibold text-pastel-blue-dark">Kayden</span> and{' '}
          <span className="font-semibold text-pastel-pink-dark">Yukti</span> are working on it 🛠️
        </p>

        {/* Pitch what this page should be */}
        <div className="mt-8 w-full max-w-sm">
          <p className="flex items-center justify-center gap-1.5 text-sm font-semibold text-gray-600 mb-2">
            <Lightbulb size={15} className="text-pastel-orange-dark" /> Have an idea for this page?
          </p>
          {sent ? (
            <p className="text-sm text-green-600 font-medium py-2">Sent to the co-founders 💌</p>
          ) : (
            <div className="flex gap-1.5">
              <input
                value={idea}
                onChange={e => setIdea(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submit()}
                placeholder="What should this page do?"
                className="flex-1 min-w-0 text-sm border rounded-xl px-3 py-2 focus:ring-2 focus:ring-pastel-blue focus:border-transparent"
              />
              <button
                onClick={submit}
                disabled={!idea.trim()}
                className="shrink-0 flex items-center gap-1 px-3 py-2 bg-pastel-orange/60 hover:bg-pastel-orange disabled:opacity-40 rounded-xl text-sm font-semibold text-gray-700 transition-colors"
              >
                <Send size={13} /> Send
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
