import { useState } from 'react'
import { MessageCircle, ClipboardList, LineChart, BookOpen, FolderKanban, HelpCircle, Smartphone, X, Send, CheckCircle, ChevronLeft, ChevronRight } from 'lucide-react'
import { useUser } from '../contexts/UserContext'
import NotificationBell from './NotificationBell'

const TAB_INFO = [
  {
    icon: MessageCircle,
    name: 'Chat',
    color: 'text-pastel-pink-dark',
    bg: 'bg-pastel-pink/20',
    description: 'Talk with other teams in real time. Three channels: All (everyone), Alliances (your alliance partners), and Leagues (teams in your league).',
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
    description: 'View your team\'s scouting data submissions. Only your team can see your data — completely private. Coming next season!',
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
    description: 'Have an idea for a feature or improvement? Submit suggestions and we\'ll review them.',
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

const USAGE_OPTIONS = [
  'Every day',
  'A few times a week',
  'Once a week',
  'At competitions only',
  'Just trying it out',
]

function TeamHomeView({ onTabChange }) {
  const { username, teamNumber } = useUser()
  const storageKey = `team-welcome-seen-${teamNumber || 'default'}`
  const [hasSeenWelcome, setHasSeenWelcome] = useState(() => localStorage.getItem(storageKey) === 'true')
  const [showPopup, setShowPopup] = useState(true)
  const [slide, setSlide] = useState(0)

  // Survey state
  const [featureRequest, setFeatureRequest] = useState('')
  const [usageFrequency, setUsageFrequency] = useState('')
  const [surveySubmitted, setSurveySubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const markSeen = () => {
    localStorage.setItem(storageKey, 'true')
    setHasSeenWelcome(true)
  }

  const closePopup = () => {
    if (!hasSeenWelcome) markSeen()
    setShowPopup(false)
  }

  const handleSurveySubmit = async () => {
    if (!featureRequest.trim() && !usageFrequency) return
    setSubmitting(true)
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
      await fetch(`${supabaseUrl}/rest/v1/team_survey_responses`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({
          team_number: teamNumber || '',
          team_name: username || '',
          feature_request: featureRequest.trim(),
          usage_frequency: usageFrequency,
          submitted_at: new Date().toISOString(),
        }),
      })
    } catch (err) {
      console.error('Failed to submit survey:', err)
    }
    setSurveySubmitted(true)
    setSubmitting(false)
    markSeen()
  }

  const handleSkipSurvey = () => {
    markSeen()
  }

  // Build slides
  const slides = []

  slides.push(
    <div className="flex flex-col items-center justify-center text-center py-6">
      <img src="/ScrumLogo-transparent.png" alt="Scrum Logo" className="w-16 h-16 mb-3 drop-shadow-lg" />
      <h2 className="text-xl font-bold text-gray-800 mb-2">
        Welcome{teamNumber ? `, Team ${teamNumber}` : ''}!
      </h2>
      <p className="text-sm text-gray-600 max-w-xs">
        This is your team's private workspace. Use the arrows to see what you can do.
      </p>
    </div>
  )

  slides.push(
    <div>
      <h3 className="text-base font-bold text-gray-800 text-center mb-3">What each tab does</h3>
      <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
        {TAB_INFO.map(({ icon: Icon, name, color, bg, description }) => (
          <div key={name} className="bg-gray-50 rounded-xl p-3 flex gap-3 items-start">
            <div className={`${bg} p-2 rounded-lg shrink-0`}>
              <Icon size={16} className={color} />
            </div>
            <div>
              <h4 className="font-semibold text-gray-800 text-sm">{name}</h4>
              <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  slides.push(
    <div>
      <div className="flex items-center justify-center gap-2 mb-3">
        <Smartphone size={18} className="text-pastel-blue-dark" />
        <h3 className="text-base font-bold text-gray-800">Add to your phone</h3>
      </div>
      <img
        src="/install-guide.png"
        alt="How to install on your phone"
        className="w-full rounded-lg"
        onError={(e) => { e.target.style.display = 'none' }}
      />
    </div>
  )

  if (!hasSeenWelcome) {
    slides.push(
      <div>
        <h3 className="text-base font-bold text-gray-800 text-center mb-3">Quick Survey</h3>
        {surveySubmitted ? (
          <div className="text-center py-4">
            <CheckCircle size={36} className="text-green-400 mx-auto mb-2" />
            <p className="font-semibold text-gray-800">Thanks for the feedback!</p>
            <p className="text-sm text-gray-500 mt-1">We'll use this to make the app better.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                How often would your team use this app?
              </label>
              <div className="flex flex-wrap gap-2">
                {USAGE_OPTIONS.map(option => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setUsageFrequency(option)}
                    className={`px-3 py-1.5 rounded-full text-xs transition-colors ${
                      usageFrequency === option
                        ? 'bg-pastel-pink text-gray-800 font-medium'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Any features you wish you had?
              </label>
              <textarea
                value={featureRequest}
                onChange={(e) => setFeatureRequest(e.target.value)}
                placeholder="e.g. inventory tracking, meeting notes..."
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-pastel-blue focus:border-transparent resize-none"
                rows={2}
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleSkipSurvey}
                className="flex-1 px-4 py-2 text-sm text-gray-500 hover:bg-gray-50 rounded-lg transition-colors"
              >
                Skip
              </button>
              <button
                onClick={handleSurveySubmit}
                disabled={submitting || (!featureRequest.trim() && !usageFrequency)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm bg-pastel-pink hover:bg-pastel-pink-dark rounded-lg font-medium text-gray-700 transition-colors disabled:opacity-50"
              >
                <Send size={14} />
                {submitting ? 'Sending...' : 'Submit'}
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  slides.push(
    <div>
      <h3 className="text-base font-bold text-gray-800 text-center mb-3">Updates</h3>
      <div className="space-y-3">
        {TEAM_UPDATES.map((update, i) => (
          <div key={i} className="bg-gray-50 rounded-xl p-4">
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
    </div>
  )

  const totalSlides = slides.length
  const currentSlide = Math.min(slide, totalSlides - 1)
  const isLastSlide = currentSlide === totalSlides - 1

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="px-4 py-3 ml-14 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-pastel-blue-dark via-pastel-pink-dark to-pastel-orange-dark bg-clip-text text-transparent">
              Home
            </h1>
          </div>
          <NotificationBell />
        </div>
      </header>
      <main className="flex-1 p-4 pl-14 md:pl-4 overflow-y-auto">
        <div className="max-w-2xl mx-auto space-y-8 pb-8">
          <div className="bg-gradient-to-r from-pastel-blue/30 via-pastel-pink/30 to-pastel-orange/30 rounded-2xl p-6 text-center">
            <img src="/ScrumLogo-transparent.png" alt="Scrum Logo" className="w-14 h-14 mx-auto mb-2 drop-shadow-lg" />
            <h2 className="text-lg font-bold text-gray-800">Welcome{teamNumber ? `, Team ${teamNumber}` : ''}!</h2>
            <p className="text-sm text-gray-600 mt-1">Use the sidebar to navigate. Tap Home anytime to come back here.</p>
          </div>
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

      {/* Slideshow popup overlay */}
      {showPopup && (
        <>
          <div className="fixed inset-0 bg-black/50 z-[100]" onClick={hasSeenWelcome ? closePopup : undefined} />
          <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm pointer-events-auto overflow-hidden relative">
              {/* Header */}
              <div className="px-4 py-3 flex items-center gap-2 bg-gradient-to-r from-pastel-blue/30 via-pastel-pink/30 to-pastel-orange/30">
                <img src="/ScrumLogo-transparent.png" alt="Logo" className="w-5 h-5" />
                <span className="text-sm font-semibold text-gray-700">Getting Started</span>
                {hasSeenWelcome && (
                  <button onClick={closePopup} className="p-1 rounded hover:bg-white/50 transition-colors ml-auto">
                    <X size={16} className="text-gray-500" />
                  </button>
                )}
              </div>

              {/* Slide content */}
              <div className="p-5 max-h-[60vh] overflow-y-auto">
                {slides[currentSlide]}
              </div>

              {/* Footer with arrows, dots, and button */}
              <div className="px-5 pb-4 pt-2 flex items-center gap-3">
                {/* Left arrow */}
                <button
                  onClick={() => setSlide(s => s - 1)}
                  disabled={currentSlide === 0}
                  className="p-2 rounded-full hover:bg-gray-100 transition-colors disabled:opacity-0"
                >
                  <ChevronLeft size={20} className="text-gray-500" />
                </button>

                {/* Dots */}
                <div className="flex-1 flex items-center justify-center gap-1.5">
                  {slides.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setSlide(i)}
                      className={`rounded-full transition-all ${
                        i === currentSlide
                          ? 'w-5 h-2 bg-pastel-pink-dark'
                          : 'w-2 h-2 bg-gray-300 hover:bg-gray-400'
                      }`}
                    />
                  ))}
                </div>

                {/* Right arrow or finish button */}
                {isLastSlide ? (
                  <button
                    onClick={closePopup}
                    className="px-4 py-1.5 rounded-xl text-sm font-semibold text-gray-700 bg-pastel-pink hover:bg-pastel-pink-dark transition-colors"
                  >
                    Got it!
                  </button>
                ) : (
                  <button
                    onClick={() => setSlide(s => s + 1)}
                    className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                  >
                    <ChevronRight size={20} className="text-gray-500" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default TeamHomeView
