import { useState } from 'react'
import { Sparkles, X } from 'lucide-react'
import { useUser } from '../contexts/UserContext'

// Add new entries at the TOP with the next id. Everything else is automatic.
const CHANGELOG = [
  {
    id: 39,
    date: '2026-03-06',
    items: [
      '📝 Task assignee is now a text input instead of a dropdown',
    ],
  },
  {
    id: 38,
    date: '2026-03-06',
    items: [
      '📐 Added divider line between AI Manual and Boards in sidebar',
      '🔤 Fixed Boards tab appearing bold in sidebar',
    ],
  },
  {
    id: 37,
    date: '2026-03-06',
    items: [
      '⚡ Removed 5-second countdown from loading screen — tap to start goes straight in',
    ],
  },
  {
    id: 36,
    date: '2026-03-04',
    items: [
      '🏟️ Adding teams now requires selecting a league from a dropdown',
    ],
  },
  {
    id: 35,
    date: '2026-03-04',
    items: [
      '🔒 Team accounts no longer flash Radical tabs/goals on refresh',
      '🚫 Team accounts skip the loading screen entirely',
    ],
  },
  {
    id: 34,
    date: '2026-03-04',
    items: [
      '📋 Team sidebar now uses the same Boards tab as members (Chat + Boards only)',
      '🔧 Moved team Logout into the three-dots menu',
    ],
  },
  {
    id: 33,
    date: '2026-03-04',
    items: [
      '🔒 Fixed team accounts seeing Radical tabs/loading screen on refresh',
      '💬 Fixed team chat messages incorrectly showing as Radical',
      '📋 Fixed Radical members seeing other teams\' tasks',
    ],
  },
  {
    id: 32,
    date: '2026-03-04',
    items: [
      '📋 Team accounts now have a collapsible Boards dropdown matching the member sidebar style',
    ],
  },
  {
    id: 31,
    date: '2026-03-03',
    items: [
      '💬 Chat is back! Quick Chat restored for all members and team accounts',
      '📢 Channel selector — switch between All, Alliances, and Leagues channels',
    ],
  },
  {
    id: 30,
    date: '2026-03-02',
    items: [
      '🤝 Team accounts — add external FRC teams with number, name, and password from User Management',
      '🔑 Team login — teams sign in with just their team number and password',
      '📋 Separate team boards — each team gets their own private boards',
    ],
  },
  {
    id: 29,
    date: '2026-03-02',
    items: [
      '📱 Added native app support — coming soon to the App Store and Google Play!',
    ],
  },
  {
    id: 28,
    date: '2026-02-22',
    items: [
      '🔒 Role changes now take effect immediately — no refresh needed',
    ],
  },
  {
    id: 27,
    date: '2026-02-22',
    items: [
      '🧑‍🏫 Added coach quote about AI on the Radical Rundown page',
    ],
  },
  {
    id: 26,
    date: '2026-02-21',
    items: [
      '🔄 Spinning logo on the loading screen with transparent background',
      '🤘 Random radical loading messages — "Getting Radical...", "Revving the robots...", and more!',
    ],
  },
  {
    id: 24,
    date: '2026-02-21',
    items: [
      '🏁 Added Comp Day tab in Special Controls (leads/mentors only) — coming soon',
    ],
  },
  {
    id: 23,
    date: '2026-02-21',
    items: [
      '🔊 Sound effects on Add Task, Add Board, and Notebook entry submit — toggle on/off in Profile settings',
      '🔄 Spinning logo on loading screen',
    ],
  },
  {
    id: 22,
    date: '2026-02-21',
    items: [
      '🏆 WE\'RE GOING TO STATE! Confetti celebration + banner added — good luck team!',
    ],
  },
  {
    id: 21,
    date: '2026-02-21',
    items: [
      '⚡ Fixed account creation being slow/failing — now shows actual error messages instead of generic "non-2xx" error',
    ],
  },
  {
    id: 20,
    date: '2026-02-21',
    items: [
      '📝 Task descriptions are now required when creating or editing tasks',
    ],
  },
  {
    id: 19,
    date: '2026-02-21',
    items: [
      '🔧 Fixed whitelist & account creation not working due to auth token issue',
    ],
  },
  {
    id: 18,
    date: '2026-02-21',
    items: [
      '👑 Harshita (Team Lead) now appears first in Meet Our Leaders section',
    ],
  },
  {
    id: 17,
    date: '2026-02-21',
    items: [
      '🔀 Tasks page now has an All / Mine toggle to quickly see only your assigned tasks',
    ],
  },
  {
    id: 16,
    date: '2026-02-20',
    items: [
      '📱 Leader & Founder cards now show full photos on mobile with overlapping glassmorphism bio cards',
      '🎨 Fixed blue tint on Kayden\'s photo with color correction filter',
    ],
  },
  {
    id: 15,
    date: '2026-02-20',
    items: [
      '🧠 Radical Rundown now includes "The Founders" section — Kayden and Yukti bios with photo spots',
    ],
  },
  {
    id: 14,
    date: '2026-02-20',
    items: [
      '👥 Radical Rundown now features "Meet Our Leaders" — bios for Team Lead, Business Lead, and Technical Lead with photo spots',
    ],
  },
  {
    id: 13,
    date: '2026-02-20',
    items: [
      '🎵 New "Theme Song" added to the music playlist — AI-generated team anthem',
      '🎧 Radical Rundown now has a "Listen to our theme song" player for visitors',
    ],
  },
  {
    id: 12,
    date: '2026-02-20',
    items: [
      '📷 Upload a profile photo from your phone — shows on your profile, Org Chart cards, and modals',
    ],
  },
  {
    id: 11,
    date: '2026-02-20',
    items: [
      '📖 "The Radical Rundown" now shows a full About page for Team 7196 and Everything That\'s Scrum',
    ],
  },
  {
    id: 10,
    date: '2026-02-20',
    items: [
      '🏗️ Org Chart redesigned with proper tiers: Co-Founders → Coaches & Mentors → Team Lead → Business/Technical Leads → Members',
    ],
  },
  {
    id: 9,
    date: '2026-02-20',
    items: [
      '🔗 Org Chart "View Full Profile" button now opens a dedicated profile page for any team member',
    ],
  },
  {
    id: 8,
    date: '2026-02-20',
    items: [
      '👤 Org Chart now shows full profiles — status, skills, tools, systems, and more',
    ],
  },
  {
    id: 7,
    date: '2026-02-20',
    items: [
      '🚀 New welcome screen with "Get Radical" sign-in and "The Radical Rundown" for scouts & visitors',
    ],
  },
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
