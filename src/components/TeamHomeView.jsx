import { useState } from 'react'
import { MessageCircle, ClipboardList, LineChart, BookOpen, FolderKanban, HelpCircle, ChevronDown, ChevronUp, Smartphone } from 'lucide-react'
import { useUser } from '../contexts/UserContext'
import NotificationBell from './NotificationBell'

const TAB_INFO = [
  {
    icon: MessageCircle,
    name: 'Chat',
    color: 'text-pastel-pink-dark',
    bg: 'bg-pastel-pink/20',
    description: 'Talk with other teams in real time. There are three channels: All (everyone), Alliances (your alliance partners), and Leagues (teams in your league).',
  },
  {
    icon: ClipboardList,
    name: 'Scouting',
    color: 'text-pastel-orange-dark',
    bg: 'bg-pastel-orange/20',
    description: 'Submit match scouting forms during competitions. Track team performance, auto/teleop stats, and observations. Coming next season!',
  },
  {
    icon: LineChart,
    name: 'Data',
    color: 'text-pastel-blue-dark',
    bg: 'bg-pastel-blue/20',
    description: 'View your team\'s scouting data submissions. Only your team can see your data — it\'s completely private. Coming next season!',
  },
  {
    icon: BookOpen,
    name: 'AI Manual',
    color: 'text-pastel-orange-dark',
    bg: 'bg-pastel-orange/20',
    description: 'Ask questions about the FTC Competition Manual using FIRST\'s official AI chatbot. Great for quick rule lookups.',
  },
  {
    icon: FolderKanban,
    name: 'Boards',
    color: 'text-pastel-blue-dark',
    bg: 'bg-pastel-blue/20',
    description: 'Kanban-style task boards for your team. Create boards for different projects, add tasks, and track progress with drag-and-drop.',
  },
  {
    icon: HelpCircle,
    name: 'Suggestions',
    color: 'text-pastel-orange-dark',
    bg: 'bg-pastel-orange/20',
    description: 'Have an idea for a feature or improvement? Submit suggestions and our team will review them.',
  },
]

const TEAM_UPDATES = [
  {
    date: '2026-03-07',
    items: [
      'Your team account is live! You can now use Boards, Chat, AI Manual, and Suggestions.',
      'Scouting Form and Scouting Data are coming next season — stay tuned!',
      'Your boards and data are private to your team. No other team can see them.',
    ],
  },
]

const FAQ = [
  {
    q: 'Is our data private?',
    a: 'Yes! Your boards, tasks, and scouting data are completely isolated to your team. No other team can see your information.',
  },
  {
    q: 'Can we create multiple boards?',
    a: 'Absolutely. Use the "+ Add Board" button in the sidebar to create as many boards as you need — one for each subteam, project, or competition.',
  },
  {
    q: 'How do we add team members?',
    a: 'Team accounts are shared — everyone on your team uses the same login. Share your team number and password with your members.',
  },
  {
    q: 'When will scouting be available?',
    a: 'Scouting forms and data will be enabled next season. You\'ll be able to submit match scouting data and view it privately.',
  },
  {
    q: 'How do I report a bug or request a feature?',
    a: 'Use the Suggestions tab in the sidebar! Describe the issue or feature and our team will review it.',
  },
]

function TeamHomeView({ onTabChange }) {
  const { username, teamNumber } = useUser()
  const [expandedFaq, setExpandedFaq] = useState(null)

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="px-4 py-3 ml-14 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-pastel-blue-dark via-pastel-pink-dark to-pastel-orange-dark bg-clip-text text-transparent">
              Welcome{teamNumber ? `, Team ${teamNumber}` : ''}!
            </h1>
            <p className="text-xs text-gray-500">Everything That's Scrum</p>
          </div>
          <NotificationBell />
        </div>
      </header>

      <main className="flex-1 p-4 pl-14 md:pl-4 overflow-y-auto">
        <div className="max-w-2xl mx-auto space-y-8 pb-8">

          {/* Welcome banner */}
          <div className="bg-gradient-to-r from-pastel-blue/30 via-pastel-pink/30 to-pastel-orange/30 rounded-2xl p-6 text-center">
            <img src="/ScrumLogo-transparent.png" alt="Scrum Logo" className="w-16 h-16 mx-auto mb-3 drop-shadow-lg" />
            <h2 className="text-lg font-bold text-gray-800">Your team hub is ready</h2>
            <p className="text-sm text-gray-600 mt-1 max-w-md mx-auto">
              This is your team's private workspace. Use the tabs in the sidebar to navigate between features. Here's what's available:
            </p>
          </div>

          {/* Tab guide */}
          <section>
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">What each tab does</h3>
            <div className="space-y-2">
              {TAB_INFO.map(({ icon: Icon, name, color, bg, description }) => (
                <div key={name} className="bg-white rounded-xl shadow-sm border p-4 flex gap-4 items-start">
                  <div className={`${bg} p-2.5 rounded-xl shrink-0`}>
                    <Icon size={20} className={color} />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-800 text-sm">{name}</h4>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{description}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Install on phone */}
          <section>
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">
              <Smartphone size={14} className="inline mr-1.5 -mt-0.5" />
              Add to your phone
            </h3>
            <div className="bg-white rounded-xl shadow-sm border p-4">
              <p className="text-sm text-gray-600 mb-3">
                You can add this app to your phone's home screen for quick access — no app store needed!
              </p>
              <img
                src="/install-guide.png"
                alt="How to install on your phone"
                className="w-full rounded-lg border"
                onError={(e) => { e.target.style.display = 'none' }}
              />
              <div className="mt-3 space-y-2 text-xs text-gray-500">
                <p><strong>iPhone:</strong> Open in Safari, tap the Share button, then "Add to Home Screen"</p>
                <p><strong>Android:</strong> Open in Chrome, tap the three dots menu, then "Add to Home Screen"</p>
              </div>
            </div>
          </section>

          {/* FAQ */}
          <section>
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">Frequently Asked Questions</h3>
            <div className="space-y-2">
              {FAQ.map((item, i) => (
                <div key={i} className="bg-white rounded-xl shadow-sm border overflow-hidden">
                  <button
                    onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
                    className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                  >
                    <span className="text-sm font-medium text-gray-800">{item.q}</span>
                    {expandedFaq === i ? <ChevronUp size={16} className="text-gray-400 shrink-0" /> : <ChevronDown size={16} className="text-gray-400 shrink-0" />}
                  </button>
                  {expandedFaq === i && (
                    <div className="px-4 pb-3 border-t bg-gray-50/50">
                      <p className="text-sm text-gray-600 pt-2 leading-relaxed">{item.a}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Team updates */}
          <section>
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">Updates for Teams</h3>
            <div className="space-y-3">
              {TEAM_UPDATES.map((update, i) => (
                <div key={i} className="bg-white rounded-xl shadow-sm border p-4">
                  <p className="text-xs font-medium text-gray-400 mb-2">{update.date}</p>
                  <ul className="space-y-1.5">
                    {update.items.map((item, j) => (
                      <li key={j} className="flex gap-2 text-sm text-gray-700">
                        <span className="text-pastel-pink-dark shrink-0 mt-0.5">-</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

        </div>
      </main>
    </div>
  )
}

export default TeamHomeView
