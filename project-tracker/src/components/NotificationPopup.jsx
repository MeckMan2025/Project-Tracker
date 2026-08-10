import { useEffect } from 'react'
import { X } from 'lucide-react'

// Emoji per role (matches the app's role emojis)
const ROLE_EMOJI = {
  'Co-Founder': '👑', 'Project Manager': '🚀', 'Mentor': '🎓', 'Coach': '🏆',
  'Business Lead': '💼', 'Technical Lead': '🔧',
  'Communications': '📣', 'Finance': '💰', 'Outreach': '🌍',
  'CAD': '📐', 'Assembly/Building': '🔧', 'Wiring': '🔌', 'Programming': '⌨️', 'Scouting': '🔍',
  'Guest': '👋',
}

const TYPE_EMOJI = {
  role_change: '🎉',
  task_completed: '✅',
  task_assigned: '📋',
  task_request: '📥',
  role_request: '📥',
  announcement: '📣',
  quote_approved: '💬',
}

function pickEmoji(n) {
  if (n?.type === 'role_change') {
    try {
      const d = typeof n.data === 'string' ? JSON.parse(n.data) : (n.data || {})
      if (d.role && ROLE_EMOJI[d.role]) return ROLE_EMOJI[d.role]
    } catch { /* ignore */ }
    return '🎉'
  }
  return TYPE_EMOJI[n?.type] || '🔔'
}

// A cute white notification card that slides in and auto-dismisses.
export default function NotificationPopup({ notification, onClose }) {
  useEffect(() => {
    if (!notification) return
    const t = setTimeout(onClose, 7000)
    return () => clearTimeout(t)
  }, [notification, onClose])

  if (!notification) return null

  return (
    <div className="fixed z-[100] top-4 left-1/2 -translate-x-1/2 sm:left-auto sm:right-4 sm:translate-x-0 w-[calc(100%-2rem)] sm:w-80 animate-slide-in-right">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-4 flex items-start gap-3">
        <div className="text-3xl leading-none shrink-0 mt-0.5">{pickEmoji(notification)}</div>
        <div className="flex-1 min-w-0">
          {notification.title && (
            <p className="text-sm font-bold text-gray-800 leading-snug">{notification.title}</p>
          )}
          {notification.body && (
            <p className="text-sm text-gray-500 leading-snug mt-0.5">{notification.body}</p>
          )}
        </div>
        <button onClick={onClose} className="p-1 -mr-1 -mt-1 rounded-lg hover:bg-gray-100 shrink-0" title="Dismiss">
          <X size={16} className="text-gray-400" />
        </button>
      </div>
    </div>
  )
}
