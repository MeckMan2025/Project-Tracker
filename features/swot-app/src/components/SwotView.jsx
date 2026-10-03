import { useState, useEffect, useRef, useCallback } from 'react'
import { TrendingUp, TrendingDown, Sparkles, ShieldAlert, Target, Lock, Unlock, Plus, Trash2, Check, X, Send, Inbox } from 'lucide-react'
import { useUser } from '../contexts/UserContext'
import { usePermissions } from '../hooks/usePermissions'
import { useToast } from './ToastProvider'
import * as swotStore from '../utils/swotStore'

const FOCUS_POPUP_MS = 5000

// Full class strings (not built at runtime) so Tailwind keeps them in the build.
const CATEGORIES = [
  {
    key: 'strengths', label: 'Strengths', singular: 'a strength', icon: TrendingUp,
    prompt: 'What does our team do well?',
    header: 'bg-green-200', soft: 'bg-green-50', text: 'text-green-600', pill: 'bg-green-100 text-green-700',
    button: 'bg-green-200 hover:bg-green-300', ring: 'focus:ring-green-200',
  },
  {
    key: 'weaknesses', label: 'Weaknesses', singular: 'a weakness', icon: TrendingDown,
    prompt: 'Where are we falling short?',
    header: 'bg-red-200', soft: 'bg-red-50', text: 'text-red-500', pill: 'bg-red-100 text-red-600',
    button: 'bg-red-200 hover:bg-red-300', ring: 'focus:ring-red-200',
  },
  {
    key: 'opportunities', label: 'Opportunities', singular: 'an opportunity', icon: Sparkles,
    prompt: 'What could we take advantage of?',
    header: 'bg-blue-200', soft: 'bg-blue-50', text: 'text-blue-500', pill: 'bg-blue-100 text-blue-700',
    button: 'bg-blue-200 hover:bg-blue-300', ring: 'focus:ring-blue-200',
  },
  {
    key: 'threats', label: 'Threats', singular: 'a threat', icon: ShieldAlert,
    prompt: 'What could get in our way?',
    header: 'bg-amber-200', soft: 'bg-amber-50', text: 'text-amber-600', pill: 'bg-amber-100 text-amber-700',
    button: 'bg-amber-200 hover:bg-amber-300', ring: 'focus:ring-amber-200',
  },
]

const getCategory = (key) => CATEGORIES.find(c => c.key === key) || CATEGORIES[0]

// Single-line add/suggest form. onSubmit resolves true when the text was saved.
function InlineForm({ placeholder, buttonLabel, icon: Icon, buttonClass, ringClass, onSubmit }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    const value = text.trim()
    if (!value || busy) return
    setBusy(true)
    const saved = await onSubmit(value)
    setBusy(false)
    if (saved) setText('')
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        maxLength={500}
        className={`flex-1 min-w-0 px-3 py-2 border rounded-lg text-sm focus:ring-2 ${ringClass} focus:border-transparent focus:outline-none`}
      />
      <button
        type="submit"
        disabled={!text.trim() || busy}
        className={`flex items-center gap-1.5 px-3 py-2 ${buttonClass} disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors text-sm font-medium text-gray-700 shrink-0`}
      >
        <Icon size={16} />
        <span className="hidden sm:inline">{buttonLabel}</span>
      </button>
    </form>
  )
}

function CategoryCard({ cat, items, isFocused, isLead, canSuggest, onFocus, onAdd, onRemove, onSuggest }) {
  const Icon = cat.icon
  const headerContent = (
    <>
      <Icon size={18} />
      {cat.label}
      <span className="text-sm font-normal text-gray-500">({items.length})</span>
      {isFocused ? (
        <span className="ml-auto flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-white/70 text-gray-700">
          {isLead ? <><Target size={12} /> Team focus</> : <><Lock size={12} /> Locked by lead</>}
        </span>
      ) : isLead && (
        <span className="ml-auto text-xs font-normal text-gray-500">Click to focus team</span>
      )}
    </>
  )
  const headerClass = `${cat.header} rounded-t-lg px-4 py-2 font-semibold text-gray-700 flex items-center gap-2`
  return (
    <div className="flex flex-col">
      {isLead ? (
        <button
          onClick={() => onFocus(cat.key)}
          title={`Focus the team on ${cat.label}`}
          className={`${headerClass} text-left w-full hover:brightness-95 transition`}
        >
          {headerContent}
        </button>
      ) : (
        <div className={headerClass}>{headerContent}</div>
      )}
      <div className={`flex-1 bg-white/80 backdrop-blur-sm rounded-b-lg shadow-sm p-3 space-y-2 min-h-[120px] ${isFocused ? 'ring-2 ring-pastel-pink-dark/60' : ''}`}>
        <p className="text-xs text-gray-400">{cat.prompt}</p>
        {items.length === 0 ? (
          <p className="text-sm text-gray-400 py-2 text-center">No {cat.label.toLowerCase()} yet</p>
        ) : (
          <ul className="space-y-2">
            {items.map((item, index) => (
              <li key={`${index}-${item}`} className="bg-white rounded-lg border border-gray-100 px-3 py-2 flex items-start gap-2">
                <span className="flex-1 text-sm text-gray-700 whitespace-pre-wrap break-words">{item}</span>
                {isLead && (
                  <button
                    onClick={() => onRemove(cat.key, index)}
                    className="text-gray-300 hover:text-red-400 transition-colors p-0.5 shrink-0"
                    title="Remove"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {isLead && (
          <InlineForm
            placeholder={`Add ${cat.singular}...`}
            buttonLabel="Add"
            icon={Plus}
            buttonClass={cat.button}
            ringClass={cat.ring}
            onSubmit={(text) => onAdd(cat.key, text)}
          />
        )}
        {!isLead && canSuggest && isFocused && (
          <InlineForm
            placeholder={`Suggest ${cat.singular}...`}
            buttonLabel="Suggest"
            icon={Send}
            buttonClass="bg-pastel-pink hover:bg-pastel-pink-dark"
            ringClass="focus:ring-pastel-pink"
            onSubmit={(text) => onSuggest(cat.key, text)}
          />
        )}
      </div>
    </div>
  )
}

// Shown to members when they arrive and whenever the lead moves the team focus.
function FocusPopup({ section, onDismiss }) {
  const cat = getCategory(section)
  const Icon = cat.icon

  useEffect(() => {
    const timer = setTimeout(onDismiss, FOCUS_POPUP_MS)
    return () => clearTimeout(timer)
  }, [section, onDismiss])

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-[100]" onClick={onDismiss} />
      <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm pointer-events-auto animate-bounce-in overflow-hidden">
          <div className={`px-4 py-3 flex items-center gap-2 ${cat.soft}`}>
            <Target size={20} className={cat.text} />
            <span className="text-sm font-semibold text-gray-700">Team focus</span>
            <button onClick={onDismiss} className="p-1 rounded hover:bg-white/50 transition-colors ml-auto">
              <X size={16} className="text-gray-500" />
            </button>
          </div>
          <div className="p-5 space-y-3 text-center">
            <div className={`w-14 h-14 rounded-full ${cat.header} flex items-center justify-center mx-auto`}>
              <Icon size={28} className="text-gray-700" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800">{cat.label}</h2>
            <p className="text-sm text-gray-600">{cat.prompt} Add your suggestions in the {cat.label} box.</p>
            <button
              onClick={onDismiss}
              className={`w-full py-2.5 rounded-xl font-semibold text-gray-700 transition-colors ${cat.button}`}
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

function SwotView() {
  const { username } = useUser()
  const { hasLeadTag, isGuest } = usePermissions()
  const { addToast } = useToast()
  const [swot, setSwot] = useState({ strengths: [], weaknesses: [], opportunities: [], threats: [] })
  const [suggestions, setSuggestions] = useState({})
  const [activeSection, setActiveSection] = useState(null)
  const [focusPopup, setFocusPopup] = useState(null)
  const lastSectionRef = useRef(null)
  const dismissFocusPopup = useCallback(() => setFocusPopup(null), [])

  const isLead = hasLeadTag

  // Live sync; members get the focus popup on arrival and on every focus change
  useEffect(() => {
    lastSectionRef.current = null
    return swotStore.subscribe((state) => {
      setSwot(state.swot)
      setSuggestions(state.suggestions)
      setActiveSection(state.activeSection)
      if (!isLead && state.activeSection !== lastSectionRef.current) {
        setFocusPopup(state.activeSection)
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
      lastSectionRef.current = state.activeSection
    })
  }, [isLead])

  // Runs a store write and reports failures as a toast. Resolves true on success.
  const run = async (action, successMessage) => {
    try {
      await action()
      if (successMessage) addToast(successMessage, 'success')
      return true
    } catch (err) {
      addToast(err.message || 'Something went wrong', 'error')
      return false
    }
  }

  const handleFocus = (section) => run(() => swotStore.setActiveSection(section))
  const handleAdd = (category, text) => run(() => swotStore.addItem(category, text))
  const handleRemove = (category, index) => run(() => swotStore.removeItem(category, index))
  const handleSuggest = (section, text) =>
    run(() => swotStore.addSuggestion(section, text, username), 'Suggestion sent to the lead')
  const handleApprove = (id) => run(() => swotStore.approveSuggestion(id), 'Suggestion added')
  const handleDeny = (id) => run(() => swotStore.rejectSuggestion(id))

  const pending = Object.entries(suggestions).sort(([, a], [, b]) => a.createdAt - b.createdAt)
  const focusedCat = activeSection ? getCategory(activeSection) : null
  // Leads always see all four; members are locked to the focused section.
  const visibleCategories = isLead || !focusedCat ? CATEGORIES : [focusedCat]

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="py-4 px-4 flex items-center">
          <div className="w-10 shrink-0" />
          <div className="flex-1 text-center">
            <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-pastel-blue-dark via-pastel-pink-dark to-pastel-orange-dark bg-clip-text text-transparent">
              SWOT Analysis
            </h1>
            <p className="text-sm text-gray-500">
              {isLead
                ? 'Guide the team through each section'
                : focusedCat ? `Locked to ${focusedCat.label} by the lead` : 'Team strategic planning'}
            </p>
          </div>
          <div className="w-10 shrink-0" />
        </div>
      </header>

      <main className="flex-1 p-4 overflow-y-auto">
        <div className="max-w-5xl mx-auto space-y-6">
          {isLead && (
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm p-4 space-y-3">
              <div>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
                  <Target size={16} className="text-pastel-pink-dark" /> Team focus
                </h2>
                <p className="text-xs text-gray-400 mt-1">
                  {activeSection
                    ? 'Teammates and guests are locked to the focused section.'
                    : 'No section is locked. Teammates and guests can see all four.'}
                </p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {CATEGORIES.map(cat => {
                  const Icon = cat.icon
                  const active = activeSection === cat.key
                  return (
                    <button
                      key={cat.key}
                      onClick={() => handleFocus(cat.key)}
                      className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                        active ? `${cat.header} text-gray-800 shadow-sm` : 'bg-gray-50 hover:bg-gray-100 text-gray-500'
                      }`}
                    >
                      <Icon size={16} />
                      {cat.label}
                    </button>
                  )
                })}
              </div>
              {activeSection && (
                <button
                  onClick={() => handleFocus(null)}
                  className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <Unlock size={14} /> Unlock all sections
                </button>
              )}
            </div>
          )}

          {isLead && (
            <div className="flex flex-col">
              <div className="bg-pastel-pink rounded-t-lg px-4 py-2 font-semibold text-gray-700 flex items-center gap-2">
                <Inbox size={18} />
                Pending Suggestions
                <span className="text-sm font-normal text-gray-500">({pending.length})</span>
              </div>
              <div className="bg-gray-50 rounded-b-lg p-3 min-h-[60px] space-y-2">
                {pending.length === 0 ? (
                  <p className="text-sm text-gray-400 py-2 text-center">No pending suggestions</p>
                ) : (
                  pending.map(([id, s]) => {
                    const cat = getCategory(s.section)
                    return (
                      <div key={id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cat.pill}`}>{cat.label}</span>
                          {s.author && <span className="text-sm font-semibold text-pastel-pink-dark">{s.author}</span>}
                          <span className="text-xs text-gray-400">
                            {new Date(s.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap break-words mb-3">{s.text}</p>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleApprove(id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 hover:bg-green-100 transition-colors text-green-600 text-xs font-medium"
                          >
                            <Check size={14} />
                            Approve
                          </button>
                          <button
                            onClick={() => handleDeny(id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 transition-colors text-red-500 text-xs font-medium"
                          >
                            <X size={14} />
                            Deny
                          </button>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )}

          {!isLead && isGuest && (
            <p className="text-sm text-gray-400 text-center">You can view the SWOT but need a teammate role to suggest.</p>
          )}

          <div className={`grid gap-4 ${visibleCategories.length > 1 ? 'md:grid-cols-2' : 'max-w-2xl w-full mx-auto'}`}>
            {visibleCategories.map(cat => (
              <CategoryCard
                key={cat.key}
                cat={cat}
                items={swot[cat.key]}
                isFocused={activeSection === cat.key}
                isLead={isLead}
                canSuggest={!isGuest}
                onFocus={handleFocus}
                onAdd={handleAdd}
                onRemove={handleRemove}
                onSuggest={handleSuggest}
              />
            ))}
          </div>
        </div>
      </main>

      {focusPopup && <FocusPopup section={focusPopup} onDismiss={dismissFocusPopup} />}
    </div>
  )
}

export default SwotView
