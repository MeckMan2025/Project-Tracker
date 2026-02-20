import { useState } from 'react'
import { Sparkles, X } from 'lucide-react'
import { useUser } from '../contexts/UserContext'

// Add new entries at the TOP with the next id. Everything else is automatic.
const CHANGELOG = [
  {
    id: 6,
    date: '2026-02-20',
    items: [
      '🔢 Scouting counters now have a text box — type any number directly, or use -/+ buttons',
    ],
  },
  {
    id: 5,
    date: '2026-02-20',
    items: [
      '🛡️ Removed "Make Admin" button from User Management',
    ],
  },
  {
    id: 4,
    date: '2026-02-20',
    items: [
      '👁️ Password fields now have a show/hide toggle so you can see what you type',
    ],
  },
  {
    id: 3,
    date: '2026-02-19',
    items: [
      '📸 Notebook entries now support photo uploads directly from your device',
    ],
  },
  {
    id: 2,
    date: '2026-02-18',
    items: [
      '✅ Scouting is now fully functional — go scout some teams!',
      '🔭 Considered teams are now dynamic — add, remove, and re-rank from the Data tab',
      '⚠️ Error alerts when adding a considered team fails',
    ],
  },
  {
    id: 1,
    date: '2026-02-18',
    items: [
      '💡 Leads can now submit workshop ideas (not just review them)',
      '📋 Suggestions & Requests now show Pending / Approved / Denied sections',
      '🗑️ Workshop ideas can be deleted with confirmation',
    ],
  },
]

const LATEST_ID = CHANGELOG[0].id

function ChangelogPopup() {
  const { user } = useUser()
  const [dismissed, setDismissed] = useState(false)

  if (!user?.id || dismissed) return null

  const key = `changelog-last-seen-${user.id}`
  const lastSeen = parseInt(localStorage.getItem(key) || '0', 10)
  if (LATEST_ID <= lastSeen) return null

  const newEntries = CHANGELOG.filter(e => e.id > lastSeen)

  const dismiss = () => {
    localStorage.setItem(key, String(LATEST_ID))
    setDismissed(true)
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-[100]" onClick={dismiss} />
      <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm pointer-events-auto animate-bounce-in overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 flex items-center gap-2 bg-pastel-orange/30">
            <Sparkles size={20} className="text-pastel-orange-dark" />
            <span className="text-sm font-semibold text-gray-700">What's New</span>
            <button onClick={dismiss} className="p-1 rounded hover:bg-white/50 transition-colors ml-auto">
              <X size={16} className="text-gray-500" />
            </button>
          </div>

          <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
            {newEntries.map(entry => (
              <div key={entry.id}>
                <p className="text-xs text-gray-400 font-medium mb-1.5">{entry.date}</p>
                <ul className="space-y-1.5">
                  {entry.items.map((item, i) => (
                    <li key={i} className="text-sm text-gray-700">{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="px-5 pb-5">
            <button
              onClick={dismiss}
              className="w-full py-2.5 rounded-xl font-semibold text-gray-700 bg-pastel-orange hover:bg-pastel-orange-dark transition-colors"
            >
              Got it!
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

export default ChangelogPopup
