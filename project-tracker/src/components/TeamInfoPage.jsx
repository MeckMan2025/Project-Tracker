import { useState, useRef } from 'react'
import { restHeaders } from '../lib/restHeaders'
import { ArrowLeft, Play, Pause, Music, Sparkles, Send, CheckCircle, Clock, History, ChevronLeft, ChevronRight } from 'lucide-react'
import { SEASON_STARTED, ACTIVE_SEASON, seasonStartLabel } from '../data/season'
import { RUNDOWN_SEASONS, RUNDOWN_KEYS, LATEST_RUNDOWN } from '../data/rundown'
import { HONEYCOMB_CELLS, HONEY_WASH } from './HomeView'

// Each season's page is dressed for its game. 2025-26 keeps the team pastels;
// BIOBUZZ (2026-27) is honey and comb, the same comb the Home page sits on.
// Everything that colours the page comes from here, so a season picks a look
// with one word in data/rundown.js.
const THEMES = {
  pastel: {
    bg: 'bg-gradient-to-br from-pastel-blue/30 via-pastel-pink/20 to-pastel-orange/30',
    bgStyle: undefined,
    title: 'from-pastel-blue-dark via-pastel-pink-dark to-pastel-orange-dark',
    pill: 'from-pastel-blue-dark to-pastel-pink-dark',
    frame: 'from-pastel-blue/20 via-pastel-pink/20 to-pastel-orange/20',
    heroFade: 'from-white/95 via-white/40',
    box1: 'border-pastel-orange bg-pastel-orange/10',
    box2: 'border-pastel-pink bg-pastel-pink/10',
    box3: 'border-pastel-blue bg-pastel-blue/10',
    song: 'border-pastel-pink from-pastel-pink/15 to-pastel-orange/10',
    songBtn: 'bg-pastel-pink-dark', songIcon: 'text-pastel-pink-dark', songHover: 'hover:bg-pastel-pink',
    form: 'border-pastel-blue from-pastel-blue/10 to-pastel-pink/5', formRing: 'focus:ring-pastel-blue/50', formLink: 'text-pastel-blue-dark',
    orb: 'from-pastel-blue via-pastel-pink to-pastel-orange',
    quoteMark: 'text-pastel-pink/40',
    strong: 'text-pastel-blue-dark',
    emoji: '',
  },
  biobuzz: {
    bg: '',
    bgStyle: { backgroundImage: `${HONEYCOMB_CELLS}, ${HONEY_WASH}`, backgroundAttachment: 'fixed' },
    title: 'from-amber-700 via-yellow-500 to-amber-600',
    pill: 'from-amber-500 to-yellow-400',
    frame: 'from-amber-300/50 via-yellow-200/60 to-amber-300/50',
    heroFade: 'from-amber-50/95 via-amber-50/40',
    box1: 'border-amber-400 bg-amber-100/50',
    box2: 'border-yellow-400 bg-yellow-100/50',
    box3: 'border-orange-300 bg-orange-100/50',
    song: 'border-yellow-400 from-yellow-100/70 to-amber-100/50',
    songBtn: 'bg-amber-500', songIcon: 'text-amber-600', songHover: 'hover:bg-yellow-200',
    form: 'border-amber-400 from-amber-100/60 to-yellow-50/60', formRing: 'focus:ring-amber-300/60', formLink: 'text-amber-700',
    orb: 'from-amber-400 via-yellow-300 to-orange-300',
    quoteMark: 'text-amber-400/50',
    strong: 'text-amber-700',
    emoji: '🐝',
  },
}

// What stands in for a photo that isn't there yet, per theme.
const PASTEL_TILE = ['from-pastel-pink/30', 'to-pastel-blue/30']
const HONEY_TILE = ['from-amber-200/70', 'to-yellow-100/70']

// A flat-top honeycomb cell, the shape every BIOBUZZ photo frame takes.
const HEX = { clipPath: 'polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%)' }


function ThemeSongPlayer({ t }) {
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef(null)

  const toggle = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio('/radical-theme.mp3')
      audioRef.current.addEventListener('ended', () => setPlaying(false))
    }
    if (playing) {
      audioRef.current.pause()
      setPlaying(false)
    } else {
      audioRef.current.play().catch(() => {})
      setPlaying(true)
    }
  }

  return (
    <div className={`border-l-4 rounded-r-xl bg-gradient-to-r p-4 ${t.song}`}>
      <div className="flex items-center gap-3">
        <button
          onClick={toggle}
          className={`w-12 h-12 rounded-full flex items-center justify-center shadow-md transition-all ${
            playing
              ? `${t.songBtn} text-white scale-105`
              : `bg-white ${t.songIcon} ${t.songHover} hover:text-gray-700`
          }`}
        >
          {playing ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-1.5">
            <Music size={14} className={t.songIcon} />
            <h3 className="font-bold text-gray-800 text-sm">Our Team's Theme Song</h3>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">Made with AI — listen to the Radical Robotics anthem!</p>
        </div>
      </div>
      {playing && (
        <div className="mt-3 flex gap-1 items-end justify-center h-4">
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className={`w-1 ${t.songBtn} rounded-full animate-pulse`}
              style={{
                height: `${8 + Math.random() * 12}px`,
                animationDelay: `${i * 0.1}s`,
                animationDuration: `${0.4 + Math.random() * 0.4}s`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function LeaderCard({ name, role, emoji, color, photo, photoPosition, photoFilter, bio, reverse, tile = PASTEL_TILE }) {
  const imgStyle = { ...(photoPosition && { objectPosition: photoPosition }), ...(photoFilter && { filter: photoFilter }) }
  return (
    <div className="shadow-md rounded-2xl overflow-hidden md:overflow-visible">
      {/* Mobile: checkerboard — photo offset to one side, bio overlaps the corner */}
      <div className="md:hidden pb-2">
        <div className={`${reverse ? 'ml-auto' : ''} w-[62%] h-52 rounded-2xl overflow-hidden shadow-sm`}>
          <img
            src={photo}
            alt={name}
            style={Object.keys(imgStyle).length ? imgStyle : undefined}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.target.style.display = 'none'
              e.target.parentElement.classList.add('bg-gradient-to-br', ...tile)
              e.target.parentElement.innerHTML = `<div class="w-full h-full flex items-center justify-center"><span class="text-5xl">${emoji}</span></div>`
            }}
          />
        </div>
        <div className={`${reverse ? 'mr-auto' : 'ml-auto'} w-[80%] -mt-5 relative z-10 p-3.5 backdrop-blur-md bg-white/85 rounded-xl shadow-md`}>
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-sm">{emoji}</span>
            <h4 className="font-bold text-gray-800 text-sm">{role}</h4>
          </div>
          <h4 className={`font-bold text-base mb-1 ${color}`}>{name}</h4>
          <p className="text-xs text-gray-700 leading-relaxed">{bio}</p>
        </div>
      </div>

      {/* Desktop: side-by-side with glassmorphism overlap */}
      <div className="hidden md:block relative min-h-[250px]">
        <div className="absolute inset-0 flex" style={{ flexDirection: reverse ? 'row-reverse' : 'row' }}>
          <div className="w-2/5 flex-shrink-0">
            <img
              src={photo}
              alt={name}
              style={Object.keys(imgStyle).length ? imgStyle : undefined}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.target.style.display = 'none'
                e.target.parentElement.classList.add('bg-gradient-to-br', ...tile)
                e.target.parentElement.innerHTML = `<div class="w-full h-full flex items-center justify-center"><span class="text-5xl">${emoji}</span></div>`
              }}
            />
          </div>
          <div className={`flex-1 ${reverse ? 'bg-gradient-to-l' : 'bg-gradient-to-r'} from-white/70 to-white/90`} />
        </div>
        <div className="relative flex" style={{ flexDirection: reverse ? 'row-reverse' : 'row' }}>
          <div className="w-2/5 flex-shrink-0" />
          <div className={`flex-1 p-4 ${reverse ? '-mr-6 rounded-r-2xl text-right' : '-ml-6 rounded-l-2xl'} backdrop-blur-sm bg-white/60`}>
            <div className={`flex items-center gap-1.5 mb-1.5 ${reverse ? 'justify-end' : ''}`}>
              {reverse ? (
                <>
                  <h4 className="font-bold text-gray-800 text-sm">{role}</h4>
                  <span className="text-sm">{emoji}</span>
                </>
              ) : (
                <>
                  <span className="text-sm">{emoji}</span>
                  <h4 className="font-bold text-gray-800 text-sm">{role}</h4>
                </>
              )}
            </div>
            <h4 className={`font-bold text-base mb-1.5 ${color}`}>{name}</h4>
            <p className="text-xs text-gray-700 leading-relaxed">{bio}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// A photo that falls back to an emoji tile when the file isn't there yet
function Photo({ src, alt, position, emoji, className, tile = PASTEL_TILE }) {
  return (
    <img
      src={src}
      alt={alt}
      style={position ? { objectPosition: position } : undefined}
      className={className}
      onError={(e) => {
        e.target.style.display = 'none'
        e.target.parentElement.classList.add('bg-gradient-to-br', ...tile)
        e.target.parentElement.innerHTML = `<div class="w-full h-full flex items-center justify-center"><span class="text-5xl">${emoji}</span></div>`
      }}
    />
  )
}

// Two people, one role, one bio — the project managers share a card.
function PairCard({ role, emoji, color, people, bio, hex }) {
  return (
    <div className={`shadow-md rounded-2xl overflow-hidden bg-white/70 backdrop-blur-sm ${hex ? 'border border-amber-200' : ''}`}>
      <div className="flex h-56 md:h-64">
        {people.map((p) => (
          <div key={p.name} className="relative flex-1 overflow-hidden">
            <Photo src={p.photo} alt={p.name} position={p.photoPosition} emoji={emoji} className="w-full h-full object-cover" tile={hex ? HONEY_TILE : PASTEL_TILE} />
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/55 to-transparent px-3 pt-8 pb-2">
              <p className="text-white font-bold text-sm drop-shadow">{p.name}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="p-4">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-sm">{emoji}</span>
          <h4 className="font-bold text-gray-800 text-sm">{role}</h4>
        </div>
        <h4 className={`font-bold text-base mb-1.5 ${color}`}>{people.map((p) => p.name).join(' and ')}</h4>
        <p className="text-xs text-gray-700 leading-relaxed">{bio}</p>
      </div>
    </div>
  )
}

// A department: the lead gets the big card, the co-lead sits underneath in a
// compact one, so a lead-plus-co-lead pair reads as one group rather than two
// unrelated people.
function DepartmentCard({ dept, hex }) {
  const { name, emoji, color, accent, tint, lead, colead } = dept
  return (
    <div className={`border-l-4 ${accent} rounded-r-2xl ${tint} p-3 space-y-3`}>
      <div className="flex items-center gap-2 px-1">
        <span className="text-base">{emoji}</span>
        <h4 className={`font-bold text-sm ${color}`}>{name}</h4>
      </div>
      <LeaderCard
        name={lead.name}
        role={lead.role}
        emoji={emoji}
        color={color}
        photo={lead.photo}
        photoPosition={lead.photoPosition}
        bio={lead.bio}
        tile={hex ? HONEY_TILE : PASTEL_TILE}
      />
      <div className="flex gap-3 items-start bg-white/80 backdrop-blur-sm rounded-xl shadow-sm p-3">
        <div className={`w-16 h-16 overflow-hidden flex-shrink-0 ${hex ? 'bg-amber-300' : 'rounded-full border-2 border-white shadow'}`} style={hex ? HEX : undefined}>
          <Photo src={colead.photo} alt={colead.name} position={colead.photoPosition} emoji={emoji} className="w-full h-full object-cover" tile={hex ? HONEY_TILE : PASTEL_TILE} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{colead.role}</p>
          <h4 className={`font-bold text-base ${color}`}>{colead.name}</h4>
          <p className="text-xs text-gray-700 leading-relaxed mt-1">{colead.bio}</p>
        </div>
      </div>
    </div>
  )
}

// Shift between seasons. The newest is the default; older ones stay exactly
// as they were written.
function SeasonSwitch({ season, onChange, t }) {
  if (RUNDOWN_KEYS.length < 2) return null
  return (
    <div className="flex items-center gap-1 bg-white/70 rounded-full p-1 shadow-sm">
      {RUNDOWN_KEYS.map((k) => (
        <button
          key={k}
          onClick={() => onChange(k)}
          className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
            k === season
              ? `bg-gradient-to-r ${t.pill} text-white shadow-sm`
              : 'text-gray-600 hover:bg-white'
          }`}
        >
          {RUNDOWN_SEASONS[k].label}
        </button>
      ))}
    </div>
  )
}

// A photo cut as a honeycomb cell with a honey ring round it. The ring is the
// outer hex showing through the padding.
function HexPhoto({ src, alt, position, emoji, size = 128, ring = 'bg-amber-400', className = '', style }) {
  return (
    <div className={`${ring} ${className}`} style={{ ...HEX, width: size, height: size, padding: Math.max(3, size / 32), ...style }}>
      <div className="w-full h-full overflow-hidden bg-amber-100" style={HEX}>
        <Photo src={src} alt={alt} position={position} emoji={emoji} className="w-full h-full object-cover" tile={HONEY_TILE} />
      </div>
    </div>
  )
}

// The leaders as a hive: wider than the page's white card, so the cells sit
// out on the comb. Project managers in the middle, then one cell per
// department with the lead's photo and the co-lead's tucked into its corner,
// then the founders.
function HiveLeaders({ page, t }) {
  const { managers, departments, founders } = page
  const Heading = ({ children }) => (
    <h3 className={`text-xl font-extrabold text-center bg-gradient-to-r ${t.title} bg-clip-text text-transparent drop-shadow-sm`}>
      {children}
    </h3>
  )
  return (
    <section className="w-full max-w-5xl mx-auto my-8 space-y-6">
      <Heading>{t.emoji} Meet Our Leaders {t.emoji}</Heading>

      {managers && (
        <div className="max-w-2xl mx-auto !mt-16 bg-white/80 backdrop-blur-sm rounded-3xl border border-amber-200 shadow-lg p-5 md:p-6">
          <div className="flex items-end justify-center gap-6 md:gap-10 -mt-12 md:-mt-14 mb-3">
            {managers.people.map((p) => (
              <div key={p.name} className="text-center">
                <HexPhoto src={p.photo} alt={p.name} position={p.photoPosition} emoji={managers.emoji} size={132} />
                <p className={`mt-2 font-extrabold text-base ${managers.color}`}>{p.name}</p>
              </div>
            ))}
          </div>
          <div className="text-center">
            <span className={`inline-block px-3 py-1 rounded-full text-[11px] font-bold text-white bg-gradient-to-r ${t.pill}`}>
              {managers.emoji} {managers.role}
            </span>
            {managers.tagline && <p className="text-[11px] font-semibold text-gray-500 mt-1.5">{managers.tagline}</p>}
            <p className="text-xs text-gray-700 leading-relaxed mt-3 max-w-lg mx-auto">{managers.bio}</p>
          </div>
        </div>
      )}

      {departments && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-4 pt-10">
          {departments.map((d) => (
            <div key={d.name} className={`relative rounded-3xl border-2 ${d.accent} bg-white/80 backdrop-blur-sm shadow-lg p-4 pt-0`}>
              {/* lead cell with the co-lead cell tucked into its corner */}
              <div className="relative h-32 -mt-12 mb-2">
                <HexPhoto src={d.lead.photo} alt={d.lead.name} position={d.lead.photoPosition} emoji={d.emoji} size={128}
                  className="absolute left-1/2" style={{ transform: 'translateX(-62%)' }} />
                <HexPhoto src={d.colead.photo} alt={d.colead.name} position={d.colead.photoPosition} emoji={d.emoji} size={84} ring="bg-yellow-300"
                  className="absolute left-1/2 top-12" style={{ transform: 'translateX(18%)' }} />
              </div>
              <div className={`rounded-2xl ${d.tint} px-3 py-2 text-center mb-3`}>
                <p className={`font-extrabold text-sm ${d.color}`}>{d.emoji} {d.name}</p>
              </div>
              <div className="space-y-3">
                <div>
                  <p className={`font-extrabold text-base leading-tight ${d.color}`}>{d.lead.name}</p>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{d.lead.role}</p>
                  <p className="text-xs text-gray-700 leading-relaxed mt-1">{d.lead.bio}</p>
                </div>
                <div className={`border-t-2 border-dashed ${d.accent} opacity-60`} />
                <div>
                  <p className={`font-extrabold text-base leading-tight ${d.color}`}>{d.colead.name}</p>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{d.colead.role}</p>
                  <p className="text-xs text-gray-700 leading-relaxed mt-1">{d.colead.bio}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {founders && (
        <>
          <Heading>The Founders</Heading>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-4 max-w-4xl mx-auto">
            {founders.map((f) => (
              <div key={f.name} className="bg-white/80 backdrop-blur-sm rounded-3xl border border-amber-200 shadow-lg p-4">
                <div className="flex items-center gap-3 mb-2">
                  <HexPhoto src={f.photo} alt={f.name} position={f.photoPosition} emoji={f.emoji} size={88} ring="bg-orange-300" />
                  <div>
                    <p className={`font-extrabold text-lg leading-tight ${f.color}`}>{f.name}</p>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{f.emoji} {f.role}</p>
                  </div>
                </div>
                <p className="text-xs text-gray-700 leading-relaxed">{f.bio}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  )
}

// The story of the app as slides: one idea per screen, arrows either side,
// dots underneath, swipe on a phone.
function StorySlides({ slides, t }) {
  const [i, setI] = useState(0)
  const [dir, setDir] = useState(1)
  const touchX = useRef(null)
  const n = slides.length
  const go = (k, d) => { setDir(d); setI((k + n) % n) }
  const next = () => go(i + 1, 1)
  const prev = () => go(i - 1, -1)
  const slide = slides[i]
  return (
    <div className={`relative rounded-2xl overflow-hidden bg-gradient-to-r ${t.frame} p-[1px]`}>
      <div className="rounded-2xl bg-white/85 backdrop-blur-sm p-5">
        <h3 className={`text-base font-extrabold text-center bg-gradient-to-r ${t.title} bg-clip-text text-transparent`}>
          The Story of Everything That's Scrum
        </h3>
        <p className="text-[11px] text-center text-gray-400 mt-0.5 mb-3">tap the arrows, or swipe</p>

        <div
          className="relative flex items-stretch gap-2"
          onTouchStart={(e) => { touchX.current = e.touches[0].clientX }}
          onTouchEnd={(e) => {
            if (touchX.current == null) return
            const dx = e.changedTouches[0].clientX - touchX.current
            touchX.current = null
            if (dx < -40) next(); else if (dx > 40) prev()
          }}
        >
          <button onClick={prev} aria-label="Previous"
            className={`self-center w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-white shadow bg-gradient-to-r ${t.pill} hover:opacity-90`}>
            <ChevronLeft size={18} />
          </button>

          <div key={i} className="flex-1 min-h-[180px] flex flex-col items-center justify-center text-center px-1"
            style={{ animation: `slide-in-${dir > 0 ? 'r' : 'l'} .25s ease-out` }}>
            <div className="text-4xl mb-2">{slide.emoji}</div>
            <p className={`font-extrabold text-sm mb-1.5 ${t.strong}`}>{slide.title}</p>
            <p className="text-xs text-gray-700 leading-relaxed max-w-md">{slide.text}</p>
          </div>

          <button onClick={next} aria-label="Next"
            className={`self-center w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-white shadow bg-gradient-to-r ${t.pill} hover:opacity-90`}>
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="flex items-center justify-center gap-1.5 mt-3">
          {slides.map((_, k) => (
            <button key={k} onClick={() => go(k, k > i ? 1 : -1)} aria-label={`Slide ${k + 1}`}
              className={`h-2 rounded-full transition-all ${k === i ? `w-6 bg-gradient-to-r ${t.pill}` : 'w-2 bg-gray-300 hover:bg-gray-400'}`} />
          ))}
        </div>
        <p className="text-[11px] text-center text-gray-400 mt-1">{i + 1} of {n}</p>
      </div>
      <style>{`
        @keyframes slide-in-r { from { opacity: 0; transform: translateX(18px) } to { opacity: 1; transform: none } }
        @keyframes slide-in-l { from { opacity: 0; transform: translateX(-18px) } to { opacity: 1; transform: none } }
      `}</style>
    </div>
  )
}

function InterestForm({ t }) {
  const [teamName, setTeamName] = useState('')
  const [contactName, setContactName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!teamName.trim() || !contactName.trim()) return
    setSubmitting(true)
    setError('')

    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/interested_teams`, {
        method: 'POST',
        headers: {
          ...restHeaders(),
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({
          team_name: teamName.trim(),
          contact_name: contactName.trim(),
        }),
      })
      if (!res.ok) throw new Error('Submit failed')
      setSubmitted(true)
      setTeamName('')
      setContactName('')
    } catch (err) {
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="border-l-4 border-green-400 rounded-r-xl bg-green-50 p-5 text-center space-y-2">
        <CheckCircle size={28} className="mx-auto text-green-500" />
        <p className="font-semibold text-gray-800 text-sm">Thanks for your interest!</p>
        <p className="text-xs text-gray-500">Our co-founders will see your submission.</p>
        <button
          onClick={() => setSubmitted(false)}
          className={`text-xs ${t.formLink} underline mt-1`}
        >
          Submit another team
        </button>
      </div>
    )
  }

  return (
    <div className={`border-l-4 rounded-r-xl bg-gradient-to-r p-4 space-y-3 ${t.form}`}>
      <h3 className="font-bold text-gray-800 text-sm">Interested in Using This App for Your Team?</h3>
      <p className="text-xs text-gray-600 leading-relaxed">
        If your FTC team would like to use Everything That's Scrum, let us know! Drop your team name and your name below.
      </p>
      <form onSubmit={handleSubmit} className="space-y-2">
        <input
          type="text"
          value={teamName}
          onChange={(e) => setTeamName(e.target.value)}
          placeholder="Team name (e.g. Team 12345 — Cool Bots)"
          maxLength={100}
          className={`w-full px-3 py-2 text-sm rounded-lg border border-gray-200 bg-white/80 focus:outline-none focus:ring-2 ${t.formRing}`}
        />
        <input
          type="text"
          value={contactName}
          onChange={(e) => setContactName(e.target.value)}
          placeholder="Your name"
          maxLength={80}
          className={`w-full px-3 py-2 text-sm rounded-lg border border-gray-200 bg-white/80 focus:outline-none focus:ring-2 ${t.formRing}`}
        />
        {error && <p className="text-xs text-red-500">{error}</p>}
        <button
          type="submit"
          disabled={submitting || !teamName.trim() || !contactName.trim()}
          className={`flex items-center gap-2 px-4 py-2 bg-gradient-to-r ${t.pill} text-white text-sm font-semibold rounded-lg shadow-sm hover:shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          <Send size={14} />
          {submitting ? 'Submitting...' : "I'm Interested!"}
        </button>
      </form>
    </div>
  )
}

function TeamInfoPage({ onBack, initialSeason }) {
  // Before kickoff there's no season to write about yet, so visitors get a
  // holding page rather than last year's page pretending to be this year's.
  // Everything that's already written stays one tap away.
  const [showPast, setShowPast] = useState(false)
  const holding = !SEASON_STARTED && !showPast
  // Which season's page is showing. Before kickoff "look at past seasons"
  // opens the one before the active season; otherwise the newest written.
  const [season, setSeason] = useState(() =>
    (initialSeason && RUNDOWN_SEASONS[initialSeason] && initialSeason)
    || (!SEASON_STARTED && RUNDOWN_KEYS.find((k) => k < ACTIVE_SEASON))
    || LATEST_RUNDOWN)
  const page = RUNDOWN_SEASONS[season]
  const isLatest = season === LATEST_RUNDOWN
  const t = THEMES[page.theme] || THEMES.pastel
  const hex = page.theme === 'biobuzz'
  // The department structure (leads with co-leads) gets the full-width hive
  // layout; the older one-card-per-leader list stays inside the white card.
  const hive = !!page.departments

  if (holding) {
    return (
      <div className={`min-h-screen flex flex-col ${t.bg}`} style={t.bgStyle}>
        <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
          <div className="px-4 py-3 flex items-center gap-3">
            <button onClick={onBack} className="p-2 rounded-xl hover:bg-white/60 transition-colors">
              <ArrowLeft size={20} className="text-gray-600" />
            </button>
            <h1 className={`text-xl font-bold bg-gradient-to-r ${t.title} bg-clip-text text-transparent`}>
              The Radical Rundown
            </h1>
          </div>
        </header>

        <div className="flex-1 flex items-center justify-center p-6">
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-8 w-full max-w-lg text-center space-y-5">
            <div className="text-6xl">🛠️</div>
            <h2 className="text-2xl font-bold text-gray-800">Woops! Our season hasn't started yet.</h2>
            <p className="text-gray-600 leading-relaxed">
              The {ACTIVE_SEASON} season kicks off on <span className="font-semibold">{seasonStartLabel()}</span>.
              Come back then and this page will be full of what we're building — the robot,
              the team, and everything we get up to along the way.
            </p>
            <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
              <Clock size={15} /> Check back after kickoff
            </div>
            <button
              onClick={() => setShowPast(true)}
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r ${t.pill} transition-opacity hover:opacity-90 font-semibold text-white`}
            >
              <History size={17} /> Look at past seasons
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen flex flex-col ${t.bg}`} style={t.bgStyle}>
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => (showPast ? setShowPast(false) : onBack())}
            className="p-2 rounded-xl hover:bg-white/60 transition-colors"
          >
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <div>
            <h1 className={`text-xl font-bold bg-gradient-to-r ${t.title} bg-clip-text text-transparent`}>
              The Radical Rundown {t.emoji}
            </h1>
            {(showPast || !isLatest) && <p className="text-xs text-gray-400 -mt-0.5">Looking back at the {page.label} season</p>}
          </div>
          <div className="ml-auto">
            <SeasonSwitch season={season} onChange={setSeason} t={t} />
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 pb-8">
        {hive ? (
          <>
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-6 w-full max-w-2xl mx-auto space-y-6">
          {/* Hero competition photo */}
          <div className="relative -mx-6 -mt-6 mb-2 overflow-hidden rounded-t-2xl">
            <img
              src={page.hero || '/team-hero.jpg'}
              alt="Team 7196"
              className="w-full h-80 md:h-64 object-cover"
              style={{ objectPosition: page.heroPosition || 'center 35%' }}
            />
            <div className={`absolute inset-0 bg-gradient-to-t ${t.heroFade} to-transparent`} />
            <div className="absolute bottom-3 left-0 right-0 text-center">
              <h2 className={`text-2xl font-bold bg-gradient-to-r ${t.title} bg-clip-text text-transparent drop-shadow-sm`}>
                About Team 7196
              </h2>
              <p className="text-gray-600 text-xs font-medium">
                Everything That's Radical — Pleasant Valley High School, Bettendorf, Iowa
              </p>
            </div>
          </div>

          <div className={`border-l-4 rounded-r-xl p-4 ${t.box1}`}>
            <h3 className="font-bold text-gray-800 text-sm mb-2">Who We Are</h3>
            <p className="text-gray-700 text-sm leading-relaxed">
              We are <span className="font-semibold">Everything That's Radical</span>, FTC Team 7196, based out of Pleasant Valley High School in Bettendorf, Iowa. Established in 2013, our team has grown through seasons of innovation, competition, and continuous improvement.
            </p>
          </div>

          {/* Selfie photo floated with text */}
          <div className="relative">
            <div className={`float-right ml-4 mb-2 w-28 h-28 overflow-hidden flex-shrink-0 ${hex ? 'bg-amber-300' : 'rounded-full border-4 border-white shadow-lg'}`} style={hex ? HEX : undefined}>
              <img
                src="/team-selfie.png"
                alt="Team 7196 group selfie"
                className="w-full h-full object-cover"
              />
            </div>
            {page.story.map((text, i) => (
              <p key={i} className={`text-gray-700 text-sm leading-relaxed ${i ? 'mt-4' : ''}`}>{text}</p>
            ))}
          </div>

            </div>

            <HiveLeaders page={page} t={t} />

            <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-6 w-full max-w-2xl mx-auto space-y-6">
              {page.storySlides && <StorySlides slides={page.storySlides} t={t} />}

          <div className={`border-l-4 rounded-r-xl p-4 space-y-3 ${t.box2}`}>
            <h3 className="font-bold text-gray-800 text-sm">What's Inside the App</h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                ['🔍', 'Scouting Forms', 'Submit and track match scouting data with assigned alliance positions'],
                ['📅', 'Scouting Schedule', 'Organized scouting groups and rotation assignments for competitions'],
                ['📊', 'Scouting Data', 'View, analyze, and verify collected scouting submissions'],
                ['📋', 'Task Boards', 'Kanban-style boards for managing build, programming, and business tasks'],
                ['✅', 'To-Do Lists', 'Personal and team task tracking with assignments and priorities'],
                ['📓', 'Engineering Notebook', 'Document build progress, decisions, and meeting notes with photo uploads'],
                ['🏗️', 'Org Chart', 'Visual team hierarchy from Co-Founders down to members'],
                ['📆', 'Calendar', 'Shared team calendar for meetings, competitions, and deadlines'],
                ['📥', 'Suggestions', 'Submit ideas and feedback for the team or the app'],
                ['💡', 'Workshop Ideas', 'Plan and organize team workshops and skill-building sessions'],
              ].map(([emoji, title, desc]) => (
                <div key={title} className="bg-white/60 rounded-lg p-2">
                  <p className="text-xs font-semibold text-gray-800">{emoji} {title}</p>
                  <p className="text-xs text-gray-500 leading-snug">{desc}</p>
                </div>
              ))}
            </div>
          </div>


          <InterestForm t={t} />

          <ThemeSongPlayer t={t} />

          <div className={`border-l-4 rounded-r-xl p-4 ${t.box3}`}>
            <p className="text-gray-700 text-sm leading-relaxed italic">
              Everything That's Scrum represents our commitment to growth — evolving from informal coordination to intentional, professional-level team management. By strengthening our internal systems, we strengthen our performance on the field.
            </p>
          </div>


          {/* Phone Install Tutorial */}
          <div className={`border-l-4 rounded-r-xl p-4 space-y-3 ${t.box1}`}>
            <h3 className="font-bold text-gray-800 text-sm">How to Add the App to Your Phone</h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              Follow these steps to install Everything That's Scrum on your home screen — no app store needed!
            </p>
            <div className="rounded-xl overflow-hidden shadow-sm">
              <img
                src="/phone-tutorial.png"
                alt="Step-by-step tutorial for adding the app to your phone home screen"
                className="w-full object-contain"
              />
            </div>
          </div>

          {/* Coach Quote on AI */}
          <div className={`relative rounded-2xl overflow-hidden bg-gradient-to-r ${t.frame} p-[1px]`}>
            <div className="rounded-2xl bg-white/80 backdrop-blur-sm p-5">
              <h3 className={`text-sm font-bold text-center bg-gradient-to-r ${t.title} bg-clip-text text-transparent mb-4`}>
                What Our Coach Thinks of AI
              </h3>
              <div className="flex flex-col sm:flex-row items-center gap-5">
                {/* Coach photo placeholder */}
                <div className={`w-28 h-28 overflow-hidden flex-shrink-0 ${hex ? 'bg-amber-300' : 'rounded-xl border-2 border-white shadow-lg bg-gradient-to-br from-pastel-blue/30 to-pastel-pink/30'}`} style={hex ? HEX : undefined}>
                  <img
                    src="/leaders/coach.jpg"
                    alt="Our Coach"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none'
                      e.target.parentElement.innerHTML = '<div class="w-full h-full flex items-center justify-center"><span class="text-4xl">🧑‍🏫</span></div>'
                    }}
                  />
                </div>
                {/* Quote */}
                <div className="flex-1">
                  <div className="relative">
                    <span className={`absolute -top-3 -left-2 text-4xl ${t.quoteMark} font-serif leading-none`}>&ldquo;</span>
                    <p className="text-gray-700 text-sm leading-relaxed italic pl-4">
                      It's not leaving — it's here to stay, so we might as well use it to our advantage. We need to learn how to work with it and let it help us, but not to cheat — just to help.
                    </p>
                    <span className={`text-4xl ${t.quoteMark} font-serif leading-none`}>&rdquo;</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className={`relative mt-4 rounded-2xl overflow-hidden bg-gradient-to-r ${t.frame} p-[1px]`}>
            <div className="rounded-2xl bg-white/80 backdrop-blur-sm px-5 py-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${t.orb} flex items-center justify-center flex-shrink-0 shadow-md`}>
                <Sparkles size={18} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-gray-700">Crafted with a little help from AI</p>
                <p className="text-[11px] text-gray-500 leading-snug mt-0.5">
                  This page was written and designed collaboratively with Claude, an AI assistant by Anthropic, guided by the ideas and input of our students — because even robots need a hand sometimes.
                </p>
              </div>
            </div>
          </div>
            </div>
          </>
        ) : (
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-6 w-full max-w-2xl mx-auto space-y-6">
          {/* Hero competition photo */}
          <div className="relative -mx-6 -mt-6 mb-2 overflow-hidden rounded-t-2xl">
            <img
              src={page.hero || '/team-hero.jpg'}
              alt="Team 7196"
              className="w-full h-80 md:h-64 object-cover"
              style={{ objectPosition: page.heroPosition || 'center 35%' }}
            />
            <div className={`absolute inset-0 bg-gradient-to-t ${t.heroFade} to-transparent`} />
            <div className="absolute bottom-3 left-0 right-0 text-center">
              <h2 className={`text-2xl font-bold bg-gradient-to-r ${t.title} bg-clip-text text-transparent drop-shadow-sm`}>
                About Team 7196
              </h2>
              <p className="text-gray-600 text-xs font-medium">
                Everything That's Radical — Pleasant Valley High School, Bettendorf, Iowa
              </p>
            </div>
          </div>

          <div className={`border-l-4 rounded-r-xl p-4 ${t.box1}`}>
            <h3 className="font-bold text-gray-800 text-sm mb-2">Who We Are</h3>
            <p className="text-gray-700 text-sm leading-relaxed">
              We are <span className="font-semibold">Everything That's Radical</span>, FTC Team 7196, based out of Pleasant Valley High School in Bettendorf, Iowa. Established in 2013, our team has grown through seasons of innovation, competition, and continuous improvement.
            </p>
          </div>

          {/* Selfie photo floated with text */}
          <div className="relative">
            <div className={`float-right ml-4 mb-2 w-28 h-28 overflow-hidden flex-shrink-0 ${hex ? 'bg-amber-300' : 'rounded-full border-4 border-white shadow-lg'}`} style={hex ? HEX : undefined}>
              <img
                src="/team-selfie.png"
                alt="Team 7196 group selfie"
                className="w-full h-full object-cover"
              />
            </div>
            {page.story.map((text, i) => (
              <p key={i} className={`text-gray-700 text-sm leading-relaxed ${i ? 'mt-4' : ''}`}>{text}</p>
            ))}
          </div>

          {/* Meet Our Leaders */}
          <div className="space-y-5 max-w-lg mx-auto">
            <h3 className={`text-lg font-bold text-center bg-gradient-to-r ${t.title} bg-clip-text text-transparent`}>
              {t.emoji} Meet Our Leaders {t.emoji}
            </h3>

            {page.managers && <PairCard {...page.managers} hex={hex} />}

            {page.departments && page.departments.map((d) => <DepartmentCard key={d.name} dept={d} hex={hex} />)}

            {page.leaders && page.leaders.map((l) => <LeaderCard key={l.name} {...l} />)}
          </div>

          {/* Co-Founders */}
          <div className="space-y-5 max-w-lg mx-auto">
            <h3 className={`text-lg font-bold text-center bg-gradient-to-r ${t.title} bg-clip-text text-transparent`}>
              The Founders
            </h3>
            {page.founders.map((f) => <LeaderCard key={f.name} {...f} />)}
          </div>

          <p className="text-gray-700 text-sm leading-relaxed">
            Over the years, we've learned that building a successful robot requires more than technical skill — it requires organization, accountability, and strong systems behind the scenes. This season, we identified one of our biggest challenges: disorganization. As responsibilities expanded across build, programming, business, and scouting, relying on scattered tools and informal communication was limiting our efficiency and clarity.
          </p>

          <p className="text-gray-700 text-sm leading-relaxed">
            In response, we built <span className={`font-semibold ${t.strong}`}>Everything That's Scrum</span>, our custom team management platform. The name reflects both our team identity and our commitment to structured, agile collaboration. Inspired by professional engineering workflows, the app centralizes everything our team needs to function effectively — scouting assignments, task boards, attendance tracking, organizational structure, communication tools, and performance data.
          </p>

          <div className={`border-l-4 rounded-r-xl p-4 space-y-3 ${t.box2}`}>
            <h3 className="font-bold text-gray-800 text-sm">What's Inside the App</h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                ['🔍', 'Scouting Forms', 'Submit and track match scouting data with assigned alliance positions'],
                ['📅', 'Scouting Schedule', 'Organized scouting groups and rotation assignments for competitions'],
                ['📊', 'Scouting Data', 'View, analyze, and verify collected scouting submissions'],
                ['📋', 'Task Boards', 'Kanban-style boards for managing build, programming, and business tasks'],
                ['✅', 'To-Do Lists', 'Personal and team task tracking with assignments and priorities'],
                ['📓', 'Engineering Notebook', 'Document build progress, decisions, and meeting notes with photo uploads'],
                ['🏗️', 'Org Chart', 'Visual team hierarchy from Co-Founders down to members'],
                ['📆', 'Calendar', 'Shared team calendar for meetings, competitions, and deadlines'],
                ['📥', 'Suggestions', 'Submit ideas and feedback for the team or the app'],
                ['💡', 'Workshop Ideas', 'Plan and organize team workshops and skill-building sessions'],
              ].map(([emoji, title, desc]) => (
                <div key={title} className="bg-white/60 rounded-lg p-2">
                  <p className="text-xs font-semibold text-gray-800">{emoji} {title}</p>
                  <p className="text-xs text-gray-500 leading-snug">{desc}</p>
                </div>
              ))}
            </div>
          </div>

          <p className="text-gray-700 text-sm leading-relaxed">
            Our primary focus this season was improving scouting. We developed a structured scouting system that assigns alliance positions (Red 1, Blue 2, etc.), defines scouting groups, tracks submissions during active scouting periods, and ensures that data is reliable and verifiable. This system increases accountability during competition and strengthens our strategic decision-making.
          </p>

          <p className="text-gray-700 text-sm leading-relaxed">
            Beyond scouting, the app brings clarity to leadership roles, creates visibility in task management, and reinforces responsibility across both business and technical teams. Instead of adapting to generic tools, we built a system tailored specifically to Team 7196's workflow.
          </p>

          <InterestForm t={t} />

          <ThemeSongPlayer t={t} />

          <div className={`border-l-4 rounded-r-xl p-4 ${t.box3}`}>
            <p className="text-gray-700 text-sm leading-relaxed italic">
              Everything That's Scrum represents our commitment to growth — evolving from informal coordination to intentional, professional-level team management. By strengthening our internal systems, we strengthen our performance on the field.
            </p>
          </div>

          {/* Phone Install Tutorial */}
          <div className={`border-l-4 rounded-r-xl p-4 space-y-3 ${t.box1}`}>
            <h3 className="font-bold text-gray-800 text-sm">How to Add the App to Your Phone</h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              Follow these steps to install Everything That's Scrum on your home screen — no app store needed!
            </p>
            <div className="rounded-xl overflow-hidden shadow-sm">
              <img
                src="/phone-tutorial.png"
                alt="Step-by-step tutorial for adding the app to your phone home screen"
                className="w-full object-contain"
              />
            </div>
          </div>

          {/* Coach Quote on AI */}
          <div className={`relative rounded-2xl overflow-hidden bg-gradient-to-r ${t.frame} p-[1px]`}>
            <div className="rounded-2xl bg-white/80 backdrop-blur-sm p-5">
              <h3 className={`text-sm font-bold text-center bg-gradient-to-r ${t.title} bg-clip-text text-transparent mb-4`}>
                What Our Coach Thinks of AI
              </h3>
              <div className="flex flex-col sm:flex-row items-center gap-5">
                {/* Coach photo placeholder */}
                <div className={`w-28 h-28 overflow-hidden flex-shrink-0 ${hex ? 'bg-amber-300' : 'rounded-xl border-2 border-white shadow-lg bg-gradient-to-br from-pastel-blue/30 to-pastel-pink/30'}`} style={hex ? HEX : undefined}>
                  <img
                    src="/leaders/coach.jpg"
                    alt="Our Coach"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none'
                      e.target.parentElement.innerHTML = '<div class="w-full h-full flex items-center justify-center"><span class="text-4xl">🧑‍🏫</span></div>'
                    }}
                  />
                </div>
                {/* Quote */}
                <div className="flex-1">
                  <div className="relative">
                    <span className={`absolute -top-3 -left-2 text-4xl ${t.quoteMark} font-serif leading-none`}>&ldquo;</span>
                    <p className="text-gray-700 text-sm leading-relaxed italic pl-4">
                      It's not leaving — it's here to stay, so we might as well use it to our advantage. We need to learn how to work with it and let it help us, but not to cheat — just to help.
                    </p>
                    <span className={`text-4xl ${t.quoteMark} font-serif leading-none`}>&rdquo;</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className={`relative mt-4 rounded-2xl overflow-hidden bg-gradient-to-r ${t.frame} p-[1px]`}>
            <div className="rounded-2xl bg-white/80 backdrop-blur-sm px-5 py-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${t.orb} flex items-center justify-center flex-shrink-0 shadow-md`}>
                <Sparkles size={18} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-gray-700">Crafted with a little help from AI</p>
                <p className="text-[11px] text-gray-500 leading-snug mt-0.5">
                  This page was written and designed collaboratively with Claude, an AI assistant by Anthropic, guided by the ideas and input of our students — because even robots need a hand sometimes.
                </p>
              </div>
            </div>
          </div>
        </div>
        )}
      </div>
    </div>
  )
}

export default TeamInfoPage
