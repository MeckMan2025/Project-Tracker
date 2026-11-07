import { useState, useEffect } from 'react'
import { restHeaders } from '../lib/restHeaders'
import { FolderKanban, Smartphone, X, Send, CheckCircle, ChevronLeft, ChevronRight,
  Home, Calendar, Shield, Lightbulb, User, Settings, Megaphone, BookOpen, ScrollText, LineChart, ClipboardCheck, Grid3x3, Bot, MessageCircle, ClipboardList } from 'lucide-react'
import { TEAM_TABS } from '../data/teamTabs'

// The icon each tab is drawn with. Keyed by the name the shared list uses, so
// a new tab names its icon there and this needs no edit.
const TAB_ICONS = {
  Home, FolderKanban, Calendar, Shield, Lightbulb, User, Settings, BookOpen, ScrollText, LineChart, ClipboardCheck, Grid3x3, Bot, MessageCircle, ClipboardList,
}
import { useUser } from '../contexts/UserContext'
import { stampTeam } from '../lib/teamScope'
import NotificationBell from './NotificationBell'
import HomeView from './HomeView'

// Built from the list App.jsx enforces, so the guide and the app can never
// disagree about what a team has.
const TAB_INFO = TEAM_TABS.map(t => ({
  icon: TAB_ICONS[t.icon] || Lightbulb,
  name: t.name,
  color: 'text-pastel-blue-dark',
  bg: 'bg-pastel-blue/25',
  description: t.description,
}))


const TEAM_UPDATES = [
  {
    date: 'Now',
    items: [
      'Your boards are yours. Make tasks, drag them along, and nobody outside your team can see any of it.',
      'Your coach adds your members and mentors from User Management — you run your own roster.',
      'The calendar carries meetings, competitions and deadlines.',
      'Suggestions goes straight to us. If something is missing, that is where to say so.',
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
  const { user, username, teamNumber } = useUser()
  // The profile is stored as "Team <number> - <name>", so the name is whatever
  // follows the dash. Blank when it does not parse, rather than showing the
  // raw display name back at them.
  const teamName = (username || '').includes(' - ')
    ? username.split(' - ').slice(1).join(' - ').trim()
    : ''
  const storageKey = `team-welcome-seen-${teamNumber || 'default'}`
  const [hasSeenWelcome, setHasSeenWelcome] = useState(() => localStorage.getItem(storageKey) === 'true')
  // "Don't show again" is kept twice: on this device, so the popup never
  // flashes up, and on the account (profiles.notification_prefs), so it stays
  // gone on every other phone and laptop the team signs in on.
  const hiddenKey = `team-welcome-hidden-${teamNumber || 'default'}`
  const [showPopup, setShowPopup] = useState(() => { try { return localStorage.getItem(hiddenKey) !== 'true' } catch { return true } })
  useEffect(() => {
    if (!user?.id || !showPopup) return
    let alive = true
    fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}&select=notification_prefs`, { headers: restHeaders() })
      .then(r => (r.ok ? r.json() : []))
      .then(rows => {
        if (alive && rows?.[0]?.notification_prefs?.hide_team_welcome) {
          try { localStorage.setItem(hiddenKey, 'true') } catch {}
          setShowPopup(false)
        }
      })
      .catch(() => {})
    return () => { alive = false }
  }, [user?.id]) // eslint-disable-line
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
          ...restHeaders(),
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        // Radical's own answers stay unstamped (NULL), like every other table;
        // '' was a third spelling of Radical.
        body: JSON.stringify(stampTeam({
          team_name: username || '',
          feature_request: featureRequest.trim(),
          usage_frequency: usageFrequency,
          submitted_at: new Date().toISOString(),
        }, teamNumber)),
      })
    } catch (err) {
      console.error('Failed to submit survey:', err)
    }
    setSurveySubmitted(true)
    setSubmitting(false)
    markSeen()
  }

  const neverShowAgain = async () => {
    try { localStorage.setItem(hiddenKey, 'true') } catch {}
    markSeen()
    setShowPopup(false)
    if (!user?.id) return
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}`
      const rows = await fetch(`${url}&select=notification_prefs`, { headers: restHeaders() }).then(r => (r.ok ? r.json() : []))
      const prefs = { ...(rows?.[0]?.notification_prefs || {}), hide_team_welcome: true }
      await fetch(url, {
        method: 'PATCH',
        headers: { ...restHeaders(), 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ notification_prefs: prefs }),
      })
    } catch (err) {
      console.error('Could not save "don\'t show again":', err)
    }
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

  // The guide: every feature a team has, as a grid of tiles on notebook paper.
  // Tap one and its page opens underneath — what it is for, how to use it, and
  // a button straight to it — so it reads one feature at a time, not a wall.
  const [guidePick, setGuidePick] = useState(null)
  const guideTabs = TEAM_TABS.filter(t => t.id !== 'home')
  const picked = guideTabs.find(t => t.id === guidePick)
  const guideCard = (
    <section className="relative rounded-xl shadow-md border-2 border-pastel-orange-dark/60 bg-white overflow-hidden"
      style={{ backgroundImage: 'repeating-linear-gradient(to bottom, transparent 0, transparent 27px, rgba(125,170,220,.25) 27px, rgba(125,170,220,.25) 28px)' }}>
      <div className="absolute top-0 bottom-0 left-6 w-px bg-red-300/70" aria-hidden="true" />
      <div className="pl-9 pr-4 pt-3 pb-2 border-b border-pastel-orange/40 bg-pastel-orange/15">
        <h2 className="font-extrabold text-gray-800">📒 How your team uses ETS</h2>
        <p className="text-xs text-gray-600">Tap a feature to see how it works.</p>
      </div>
      <div className="pl-9 pr-3 py-3 grid grid-cols-3 sm:grid-cols-5 gap-2">
        {guideTabs.map(t => {
          const Icon = TAB_ICONS[t.icon] || Home
          const on = t.id === guidePick
          return (
            <button key={t.id} onClick={() => setGuidePick(on ? null : t.id)}
              className={`flex flex-col items-center gap-1 py-2 px-1 rounded-lg border text-center transition-all ${on
                ? 'border-pastel-orange-dark bg-pastel-orange/30 shadow-sm'
                : 'border-gray-200 bg-white/80 hover:border-pastel-orange hover:bg-pastel-orange/10'}`}>
              <Icon size={18} className="text-pastel-orange-dark" />
              <span className="text-[11px] font-bold text-gray-700 leading-tight">{t.name}</span>
            </button>
          )
        })}
      </div>
      {picked && (
        <div className="mx-3 mb-3 ml-9 rounded-lg border border-pastel-orange/60 bg-pastel-orange/10 p-3 space-y-1.5">
          <p className="font-bold text-gray-800 text-sm">{picked.name}</p>
          <p className="text-xs text-gray-600 leading-relaxed">{picked.description}</p>
          {(picked.how || []).map((line, j) => (
            <p key={j} className="text-xs text-gray-700 leading-relaxed">👉 {line}</p>
          ))}
          <button onClick={() => onTabChange?.(picked.id)}
            className="mt-1 px-3 py-1.5 rounded-lg bg-pastel-orange hover:bg-pastel-orange-dark text-xs font-bold text-gray-800 shadow-sm transition-colors">
            Open {picked.name} →
          </button>
        </div>
      )}
    </section>
  )

  // The guide lives behind a notebook by the bell rather than on the page, so
  // Home stays Home and the manual is one tap away from anywhere on it.
  const [guideOpen, setGuideOpen] = useState(false)
  const guideButton = (
    <button type="button" onClick={() => setGuideOpen(true)} title="How your team uses ETS" aria-label="How your team uses ETS"
      className="p-2 rounded-lg hover:bg-pastel-orange/20 transition-colors">
      <BookOpen size={20} className="text-pastel-orange-dark" />
    </button>
  )

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <HomeView visiting onTabChange={onTabChange} headerExtra={guideButton} />
      {guideOpen && (
        <>
          <div className="fixed inset-0 bg-black/40 z-[90]" onClick={() => setGuideOpen(false)} />
          <div className="fixed inset-0 z-[90] flex items-start sm:items-center justify-center p-4 pt-16 pointer-events-none">
            <div className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto pointer-events-auto">
              <button type="button" onClick={() => setGuideOpen(false)} aria-label="Close"
                className="absolute top-2 right-2 z-10 p-1 rounded-lg bg-white/80 hover:bg-white shadow-sm">
                <X size={16} className="text-gray-500" />
              </button>
              {guideCard}
            </div>
          </div>
        </>
      )}

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
              <div className="p-5 h-[60vh] overflow-y-auto">
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
              <div className="px-5 pb-4 -mt-1 text-center">
                <button onClick={neverShowAgain} className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2">
                  Don't show again
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default TeamHomeView
