import { useState, useRef } from 'react'
import { restHeaders } from '../lib/restHeaders'
import { ArrowLeft, Play, Pause, Music, Sparkles, Send, CheckCircle, Clock, History, ChevronLeft, ChevronRight, ChevronDown, Sun, Moon } from 'lucide-react'
import { SEASON_STARTED, ACTIVE_SEASON, seasonStartLabel } from '../data/season'
import { RUNDOWN_SEASONS, RUNDOWN_KEYS, LATEST_RUNDOWN } from '../data/rundown'
import { HONEYCOMB_CELLS, HONEY_WASH } from './HomeView'

// Amber comb lines on nothing, laid over the honey. Flat-top cells on the same
// 3r x sqrt(3)r tile as the light one.
const HIVE_COMB = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='90' height='52' viewBox='0 0 90 51.96'%3E%3Cg fill='none' stroke='%23f59e0b' stroke-opacity='0.22' stroke-width='1.2'%3E%3Cpolygon points='30,25.98 15,51.96 -15,51.96 -30,25.98 -15,0 15,0'/%3E%3Cpolygon points='120,25.98 105,51.96 75,51.96 60,25.98 75,0 105,0'/%3E%3Cpolygon points='75,51.96 60,77.94 30,77.94 15,51.96 30,25.98 60,25.98'/%3E%3Cpolygon points='75,0 60,25.98 30,25.98 15,0 30,-25.98 60,-25.98'/%3E%3C/g%3E%3C/svg%3E\")"
const HIVE_COMB_LIGHT = HIVE_COMB.replace('%23f59e0b', '%23b45309').replace("stroke-opacity='0.22'", "stroke-opacity='0.26'")

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
    header: 'bg-white/80',
    arrow: 'text-gray-600',
  },
  biobuzz: {
    // Night hive: near-black honey with gold comb lines, vines and flowers,
    // the BIOBUZZ logo's black-and-yellow rather than last year's pastels.
    hive: true,
    bg: 'text-amber-50',
    bgStyle: { backgroundImage: `${HIVE_COMB}, linear-gradient(180deg, #17110a 0%, #221806 50%, #17110a 100%)`, backgroundAttachment: 'fixed' },
    header: 'bg-[#17110a]/85 border-b border-amber-500/30',
    arrow: 'text-amber-200',
    heroSub: 'text-amber-100/90',
    panel: 'relative z-10 bg-black/40 backdrop-blur-md rounded-3xl border border-amber-500/30 shadow-2xl p-6 w-full max-w-4xl mx-auto space-y-6',
    title: 'from-yellow-300 via-amber-400 to-orange-400',
    pill: 'from-amber-500 to-yellow-400',
    frame: 'from-amber-500/50 via-yellow-400/40 to-amber-500/50',
    heroFade: 'from-[#17110a] via-[#17110a]/40',
    box1: 'border-amber-400 bg-amber-500/10',
    box2: 'border-yellow-400 bg-yellow-500/10',
    box3: 'border-orange-400 bg-orange-500/10',
    song: 'border-yellow-400 from-amber-500/15 to-yellow-500/10',
    songBtn: 'bg-amber-500', songIcon: 'text-amber-400', songHover: 'hover:bg-amber-500/30',
    form: 'border-amber-400 from-amber-500/15 to-yellow-500/5', formRing: 'focus:ring-amber-400/60', formLink: 'text-amber-300',
    orb: 'from-amber-400 via-yellow-300 to-orange-400',
    quoteMark: 'text-amber-400/50',
    strong: 'text-yellow-300',
    emoji: '🐝',
  },
  'biobuzz-light': {
    // Golden hive: the same page in daylight — honey and cream, amber comb
    // lines, gold headings. The sun/moon in the header flips between the two.
    hive: true,
    light: true,
    bg: 'text-[#3b2a0a]',
    bgStyle: { backgroundImage: `${HIVE_COMB_LIGHT}, linear-gradient(180deg, #fff3cc 0%, #fbe09a 50%, #f6cd6a 100%)`, backgroundAttachment: 'fixed' },
    header: 'bg-[#fff6dc]/85 border-b border-amber-400/40',
    arrow: 'text-amber-800',
    heroSub: 'text-[#3b2a0a]',
    panel: 'relative z-10 bg-[#fffaf0]/75 backdrop-blur-md rounded-3xl border border-amber-400/50 shadow-xl p-6 w-full max-w-4xl mx-auto space-y-6',
    title: 'from-amber-700 via-orange-500 to-amber-600',
    pill: 'from-amber-500 to-yellow-400',
    frame: 'from-amber-400/60 via-yellow-300/60 to-amber-400/60',
    heroFade: 'from-[#fff3cc] via-[#fff3cc]/40',
    box1: 'border-amber-500 bg-amber-200/40',
    box2: 'border-yellow-500 bg-yellow-200/40',
    box3: 'border-orange-400 bg-orange-200/40',
    song: 'border-yellow-500 from-yellow-200/50 to-amber-200/40',
    songBtn: 'bg-amber-500', songIcon: 'text-amber-700', songHover: 'hover:bg-amber-200',
    form: 'border-amber-500 from-amber-200/40 to-yellow-100/40', formRing: 'focus:ring-amber-400/60', formLink: 'text-amber-800',
    orb: 'from-amber-400 via-yellow-300 to-orange-400',
    quoteMark: 'text-amber-500/50',
    strong: 'text-amber-800',
    emoji: '🐝',
  },
}

// What stands in for a photo that isn't there yet, per theme.
const PASTEL_TILE = ['from-pastel-pink/30', 'to-pastel-blue/30']
const HONEY_TILE = ['from-amber-200/70', 'to-yellow-100/70']

// The hive page tints the greys the shared sections use toward brown, and
// the white glass toward cream. One sheet instead of a theme key on every
// paragraph.
const HIVE_CSS_LIGHT = `
  .hive .text-gray-800, .hive .text-gray-700 { color: #3b2a0a }
  .hive .text-gray-600, .hive .text-gray-500 { color: #7c5a14 }
  .hive .text-gray-400 { color: #9a7a3a }
  .hive .bg-white\\/60, .hive .bg-white\\/70, .hive .bg-white\\/80 { background-color: rgba(255,250,240,.72) }
  .hive .bg-white\\/85 { background-color: rgba(255,250,240,.88) }
  .hive .border-amber-200 { border-color: rgba(217,119,6,.45) }
  .hive .border-gray-200 { border-color: rgba(217,119,6,.4) }
  .hive input { background-color: rgba(255,255,255,.6); color: #3b2a0a }
  .hive input::placeholder { color: #a08455 }
  .hive .bg-gray-300 { background-color: rgba(217,119,6,.3) }
  .hive .bg-amber-100\\/60, .hive .bg-yellow-100\\/60, .hive .bg-orange-100\\/60 { background-color: rgba(245,158,11,.22) }
  .hive .bg-amber-200\\/70 { background-color: rgba(217,119,6,.35) }
  .hive .text-amber-500 { color: #b45309 } .hive .hover\\:text-amber-400:hover { color: #92400e }
`
const HIVE_CSS = `
  .hive .text-gray-800, .hive .text-gray-700 { color: #fdf3dc }
  .hive .text-gray-600, .hive .text-gray-500 { color: #e3cfa6 }
  .hive .text-gray-400 { color: #c9ae7a }
  .hive .bg-white\\/60, .hive .bg-white\\/70, .hive .bg-white\\/80 { background-color: rgba(0,0,0,.42) }
  .hive .bg-white\\/85 { background-color: rgba(12,8,2,.78) }
  .hive .border-amber-200 { border-color: rgba(245,158,11,.45) }
  .hive .border-amber-300\\/50 { border-color: rgba(245,158,11,.35) }
  .hive .border-gray-200 { border-color: rgba(245,158,11,.4) }
  .hive input { background-color: rgba(0,0,0,.35); color: #fdf3dc }
  .hive input::placeholder { color: #a8905f }
  .hive .bg-gray-300 { background-color: rgba(245,158,11,.35) }
  .hive .bg-amber-100\\/60, .hive .bg-yellow-100\\/60, .hive .bg-orange-100\\/60 { background-color: rgba(245,158,11,.18) }
  .hive .text-amber-700 { color: #fbbf24 } .hive .text-yellow-700 { color: #fde047 } .hive .text-orange-700 { color: #fb923c }
  .hive .bg-amber-200\\/70 { background-color: rgba(245,158,11,.22) }
  .hive .bg-amber-100 { background-color: #3a2a0c }
  .hive .bg-green-50 { background-color: rgba(34,197,94,.12) }
`

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

// A bio that opens on a tap: the first sentence shows, the rest unfolds
// underneath with a smooth slide, and the chevron turns.
function Expandable({ text, align = 'left', className = '' }) {
  const [open, setOpen] = useState(false)
  // Teaser = whole sentences until there's at least a line's worth, so a
  // "SNAP!" opener doesn't stand alone.
  const parts = text.trim().split(/(?<=[.!?])\s+/)
  let teaser = ''
  let k = 0
  while (k < parts.length && teaser.length < 70) { teaser += (teaser ? ' ' : '') + parts[k]; k++ }
  const rest = parts.slice(k).join(' ')
  if (!rest) return <p className={`text-xs text-gray-700 leading-relaxed ${className}`}>{text}</p>
  return (
    <div className={className}>
      <p className="text-xs text-gray-700 leading-relaxed">{teaser}</p>
      <div className="grid transition-[grid-template-rows] duration-300 ease-out" style={{ gridTemplateRows: open ? '1fr' : '0fr' }}>
        <div className="overflow-hidden">
          <p className="text-xs text-gray-700 leading-relaxed pt-1">{rest}</p>
        </div>
      </div>
      <button onClick={() => setOpen(!open)}
        className={`mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-amber-500 hover:text-amber-400 ${align === 'right' ? 'flex-row-reverse' : ''}`}>
        {open ? 'Less' : 'Read more'}
        <ChevronDown size={13} className={`transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
      </button>
    </div>
  )
}

// Lead and co-lead as two cells of one comb: same size, the co-lead nested
// against the lead the way honeycomb cells sit (three quarters of a cell
// across, half a cell down), with an empty cell closing the cluster.
function CombPair({ lead, colead, emoji, flip, size = 124 }) {
  const w = size, h = size
  const dx = Math.round(w * 0.76), dy = Math.round(h * 0.5)
  // flip mirrors the cluster so the photos face the text on right-hand bands
  const x = (v) => (flip ? { right: v } : { left: v })
  const cell = (v) => ({ position: 'absolute', top: v.top, ...x(v.x) })
  return (
    <div className="relative flex-shrink-0 -mt-8 md:-my-8" style={{ width: w + dx, height: h + dy + h * 0.5 }}>
      <div className="bg-amber-200/70 flex items-center justify-center" style={{ ...HEX, ...cell({ top: h, x: 0 }), width: w, height: h }}>
        <svg viewBox="0 0 40 40" width={w * 0.42} height={h * 0.42} aria-hidden="true"><Leaf x={12} y={30} a={-30} s={0.7} /><Leaf x={28} y={30} a={30} s={0.7} /><Bloom x={20} y={18} r={11} c={1} /></svg>
      </div>
      <HexPhoto src={lead.photo} alt={lead.name} position={lead.photoPosition} emoji={emoji} size={size}
        style={cell({ top: 0, x: 0 })} />
      <HexPhoto src={colead.photo} alt={colead.name} position={colead.photoPosition} emoji={emoji} size={size} ring="bg-yellow-300"
        style={cell({ top: dy, x: dx })} />
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
    <section className="relative z-10 w-full max-w-5xl mx-auto my-8 space-y-6">
      <Heading>{t.emoji} Meet Our Leaders {t.emoji}</Heading>

      {managers && (
        <div className="relative max-w-2xl mx-auto !mt-16 bg-white/80 backdrop-blur-sm rounded-3xl border border-amber-200 shadow-lg p-5 md:p-6">
          <Sprig className="absolute -bottom-5 -left-4 w-20 h-20" flip />
          <Sprig className="absolute -top-3 -right-4 w-16 h-16" />
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
            <Expandable text={managers.bio} className="mt-3 max-w-lg mx-auto" />
          </div>
        </div>
      )}

      {departments && (
        <div className="space-y-6 pt-4">
          {departments.map((d, i) => {
            const flip = i % 2 === 1
            return (
              <div key={d.name}
                className={`md:w-[82%] ${flip ? 'md:ml-auto' : 'md:mr-auto'} rounded-3xl border-2 ${d.accent} bg-white/80 backdrop-blur-sm shadow-lg p-4 md:p-5
                  flex flex-col ${flip ? 'md:flex-row-reverse' : 'md:flex-row'} items-center gap-4 md:gap-6`}>
                <CombPair lead={d.lead} colead={d.colead} emoji={d.emoji} flip={flip} />
                <div className={`flex-1 min-w-0 w-full ${flip ? 'md:text-right' : ''}`}>
                  <span className={`inline-block rounded-full ${d.tint} px-3 py-1 mb-2`}>
                    <span className={`font-extrabold text-sm ${d.color}`}>{d.emoji} {d.name}</span>
                  </span>
                  <div className="space-y-3">
                    <div>
                      <p className={`font-extrabold text-base leading-tight ${d.color}`}>{d.lead.name}</p>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{d.lead.role}</p>
                      <Expandable text={d.lead.bio} align={flip ? 'right' : 'left'} className="mt-1" />
                    </div>
                    <div className={`border-t-2 border-dashed ${d.accent} opacity-60`} />
                    <div>
                      <p className={`font-extrabold text-base leading-tight ${d.color}`}>{d.colead.name}</p>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{d.colead.role}</p>
                      <Expandable text={d.colead.bio} align={flip ? 'right' : 'left'} className="mt-1" />
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
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

// What's inside, as two honey panels: what Radical runs on, and what a team
// that signs in with its own number gets.
function InsideTheApp({ inside, t }) {
  const Tile = ([emoji, title, desc]) => (
    <div key={title} className="bg-white/70 rounded-xl p-2.5 border border-amber-300/50">
      <p className="text-xs font-bold text-gray-800">{emoji} {title}</p>
      <p className="text-[11px] text-gray-600 leading-snug mt-0.5">{desc}</p>
    </div>
  )
  return (
    <div className="space-y-4">
      <div className={`relative border-l-4 rounded-r-xl p-4 space-y-3 ${t.box2}`}>
        <Sprig className="absolute -top-5 -right-3 w-16 h-16" />
        <h3 className="font-bold text-gray-800 text-sm">What's Inside the App</h3>
        <p className="text-xs text-gray-600 leading-relaxed">Everything Team 7196 runs on, all in one place.</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">{inside.ours.map(Tile)}</div>
      </div>
      <div className={`relative border-l-4 rounded-r-xl p-4 space-y-3 ${t.box1}`}>
        <Sprig className="absolute -bottom-4 -right-3 w-14 h-14" flip />
        <h3 className="font-bold text-gray-800 text-sm">What a Team Account Gets</h3>
        <p className="text-xs text-gray-600 leading-relaxed">{inside.team.intro}</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">{inside.team.tabs.map(Tile)}</div>
        {inside.team.note && <p className="text-xs text-gray-700 leading-relaxed italic">{inside.team.note}</p>}
      </div>
    </div>
  )
}

// What ETS is for, and why to put it on your phone: two columns of short
// points, each with a tile.
function GoalsSection({ goals, t }) {
  const Col = ({ title, items, box }) => (
    <div className={`relative border-l-4 rounded-r-xl p-4 space-y-2 ${box}`}>
      <h3 className="font-bold text-gray-800 text-sm">{title}</h3>
      {items.map(([emoji, head, body]) => (
        <div key={head} className="flex gap-2.5 bg-white/70 rounded-xl p-2.5 border border-amber-300/50">
          <span className="text-xl leading-none mt-0.5">{emoji}</span>
          <div>
            <p className="text-xs font-bold text-gray-800">{head}</p>
            <p className="text-[11px] text-gray-600 leading-snug mt-0.5">{body}</p>
          </div>
        </div>
      ))}
    </div>
  )
  return (
    <div className="relative">
      <Sprig className="absolute -top-6 -left-5 w-16 h-16 z-10" flip />
      <h3 className={`text-base font-extrabold text-center bg-gradient-to-r ${t.title} bg-clip-text text-transparent mb-3`}>
        {t.emoji} What Everything That's Scrum Is For {t.emoji}
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Col title="Our goals this season" items={goals.goals} box={t.box2} />
        <Col title="Why put it on your phone" items={goals.why} box={t.box1} />
      </div>
    </div>
  )
}

// ---- bees: a few flying across the page, wings going ----
function Bee({ size = 34 }) {
  return (
    <svg viewBox="0 0 48 40" width={size} height={size * 40 / 48} aria-hidden="true">
      <g className="bee-wing" style={{ transformOrigin: '22px 14px' }}>
        <ellipse cx="18" cy="11" rx="9" ry="6" fill="#dff3ff" fillOpacity=".85" stroke="#9cc8e8" strokeWidth=".8" />
        <ellipse cx="30" cy="10" rx="8" ry="5.5" fill="#dff3ff" fillOpacity=".85" stroke="#9cc8e8" strokeWidth=".8" />
      </g>
      <ellipse cx="24" cy="24" rx="15" ry="10" fill="#F6C445" />
      <path d="M15 15.5 q-2 8.5 0 17 M22 14 q-2.5 10 0 20 M29 14 q-2.5 10 0 20" stroke="#1f1a0a" strokeWidth="3.2" strokeLinecap="round" fill="none" />
      <circle cx="39" cy="22" r="6" fill="#1f1a0a" />
      <circle cx="41" cy="20.5" r="1.3" fill="#fff" />
      <path d="M40 16 l3 -5 M43 17 l4 -3" stroke="#1f1a0a" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M9 24 l-5 1" stroke="#1f1a0a" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
// Each bee gets its own path across the viewport, speed and start, so they
// never line up. Fixed to the viewport so they drift over whatever you're
// reading. Off for anyone who asked their device for less motion.
const BEE_FLIGHTS = [
  { top: '14%', dur: 38, delay: 0,   size: 34, rev: false },
  { top: '42%', dur: 46, delay: -18, size: 28, rev: true },
  { top: '68%', dur: 52, delay: -7,  size: 30, rev: false },
  { top: '28%', dur: 60, delay: -33, size: 22, rev: true },
]
function Bees() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
      {BEE_FLIGHTS.map((b, i) => (
        <div key={i} className="absolute left-0" style={{ top: b.top, animation: `bee-cross ${b.dur}s linear ${b.delay}s infinite`, animationDirection: b.rev ? 'reverse' : 'normal' }}>
          <div style={{ animation: `bee-bob ${2.2 + i * 0.5}s ease-in-out infinite`, transform: b.rev ? 'scaleX(-1)' : undefined }}>
            <Bee size={b.size} />
          </div>
        </div>
      ))}
      <style>{`
        @keyframes bee-cross {
          0%   { transform: translate(-8vw, 0) rotate(-6deg) }
          20%  { transform: translate(18vw, -9vh) rotate(8deg) }
          40%  { transform: translate(42vw, 6vh) rotate(-10deg) }
          60%  { transform: translate(62vw, -7vh) rotate(6deg) }
          80%  { transform: translate(86vw, 5vh) rotate(-8deg) }
          100% { transform: translate(108vw, -3vh) rotate(4deg) }
        }
        @keyframes bee-bob { 0%,100% { translate: 0 0 } 50% { translate: 0 -9px } }
        @keyframes bee-flap { 0%,100% { transform: scaleY(1) } 50% { transform: scaleY(.35) } }
        .bee-wing { animation: bee-flap .12s ease-in-out infinite }
        @media (prefers-reduced-motion: reduce) { .bee-wing, [style*="bee-cross"], [style*="bee-bob"] { animation: none !important } }
      `}</style>
    </div>
  )
}

// ---- nature: vines down the sides, flower sprigs on corners ----
// Petals carry the team colours, the heart is always honey.
const PETALS = ['#FFB3C6', '#8FC9E8', '#FFC27A']
function Bloom({ x, y, r = 7, c = 0 }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      {[0, 72, 144, 216, 288].map((a) => (
        <ellipse key={a} cx="0" cy={-r * 0.55} rx={r * 0.36} ry={r * 0.5} fill={PETALS[c % 3]} transform={`rotate(${a})`} />
      ))}
      <circle r={r * 0.3} fill="#F6C445" stroke="#E0A92E" strokeWidth="0.6" />
    </g>
  )
}
function Leaf({ x, y, a = 0, s = 1 }) {
  return <ellipse cx={x} cy={y} rx={9 * s} ry={4 * s} fill="#7fae4e" transform={`rotate(${a} ${x} ${y})`} />
}
// A sprig: a curling stem with leaves and three blooms. Sits on a corner.
function Sprig({ className = '', flip = false }) {
  return (
    <svg viewBox="0 0 80 80" className={`${className} pointer-events-none`} style={flip ? { transform: 'scaleX(-1)' } : undefined} aria-hidden="true">
      <path d="M8 74 C 20 60, 18 40, 36 30 S 62 24, 70 8" fill="none" stroke="#6f9a3f" strokeWidth="2.2" strokeLinecap="round" />
      <Leaf x={22} y={52} a={-40} /><Leaf x={38} y={34} a={20} /><Leaf x={56} y={24} a={-30} s={0.8} />
      <Bloom x={30} y={44} c={0} /><Bloom x={50} y={28} r={6} c={1} /><Bloom x={70} y={9} r={6.5} c={2} />
    </svg>
  )
}
// A vine tile that repeats down the page edge: a wavy stem with leaves and a
// bloom every so often. Used as a repeat-y background so it costs nothing.
const VINE_TILE = (() => {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='90' height='300' viewBox='0 0 90 300'>
    <path d='M45 0 C 20 50, 70 100, 45 150 S 20 250, 45 300' fill='none' stroke='#6f9a3f' stroke-width='2.4' stroke-linecap='round'/>
    <g fill='#7fae4e'>
      <ellipse cx='30' cy='40' rx='11' ry='5' transform='rotate(-35 30 40)'/>
      <ellipse cx='60' cy='95' rx='11' ry='5' transform='rotate(30 60 95)'/>
      <ellipse cx='32' cy='170' rx='11' ry='5' transform='rotate(-25 32 170)'/>
      <ellipse cx='58' cy='235' rx='11' ry='5' transform='rotate(35 58 235)'/>
      <ellipse cx='36' cy='280' rx='9' ry='4' transform='rotate(-40 36 280)'/>
    </g>
    <g transform='translate(58 130)'>
      <ellipse cx='0' cy='-4' rx='2.6' ry='3.6' fill='#FFB3C6'/><ellipse cx='0' cy='-4' rx='2.6' ry='3.6' fill='#FFB3C6' transform='rotate(72)'/><ellipse cx='0' cy='-4' rx='2.6' ry='3.6' fill='#FFB3C6' transform='rotate(144)'/><ellipse cx='0' cy='-4' rx='2.6' ry='3.6' fill='#FFB3C6' transform='rotate(216)'/><ellipse cx='0' cy='-4' rx='2.6' ry='3.6' fill='#FFB3C6' transform='rotate(288)'/><circle r='2.2' fill='#F6C445'/>
    </g>
    <g transform='translate(30 215)'>
      <ellipse cx='0' cy='-4' rx='2.6' ry='3.6' fill='#8FC9E8'/><ellipse cx='0' cy='-4' rx='2.6' ry='3.6' fill='#8FC9E8' transform='rotate(72)'/><ellipse cx='0' cy='-4' rx='2.6' ry='3.6' fill='#8FC9E8' transform='rotate(144)'/><ellipse cx='0' cy='-4' rx='2.6' ry='3.6' fill='#8FC9E8' transform='rotate(216)'/><ellipse cx='0' cy='-4' rx='2.6' ry='3.6' fill='#8FC9E8' transform='rotate(288)'/><circle r='2.2' fill='#F6C445'/>
    </g>
  </svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg.replace(/\s+/g, ' '))}")`
})()
function Vines() {
  const strip = (side) => (
    <div className={`hidden lg:block absolute top-0 bottom-0 ${side} w-[90px] pointer-events-none opacity-80`}
      style={{ backgroundImage: VINE_TILE, backgroundRepeat: 'repeat-y', backgroundPosition: 'top center', transform: side === 'right-2' ? 'scaleX(-1)' : undefined }} />
  )
  return <>{strip('left-2')}{strip('right-2')}</>
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
  // Night or day for the hive. Remembered on this device.
  const [mode, setMode] = useState(() => { try { return localStorage.getItem('rundown-mode') || 'dark' } catch { return 'dark' } })
  const toggleMode = () => { const m = mode === 'dark' ? 'light' : 'dark'; setMode(m); try { localStorage.setItem('rundown-mode', m) } catch {} }
  const themeKey = page.theme === 'biobuzz' && mode === 'light' ? 'biobuzz-light' : page.theme
  const t = THEMES[themeKey] || THEMES.pastel
  const hex = page.theme === 'biobuzz'
  // The department structure (leads with co-leads) gets the full-width hive
  // layout; the older one-card-per-leader list stays inside the white card.
  const hive = !!page.departments

  if (holding) {
    return (
      <div className={`min-h-screen flex flex-col ${t.bg}`} style={t.bgStyle}>
        <header className={`${t.header} backdrop-blur-sm shadow-sm sticky top-0 z-10`}>
          <div className="px-4 py-3 flex items-center gap-3">
            <button onClick={onBack} className="p-2 rounded-xl hover:bg-white/60 transition-colors">
              <ArrowLeft size={20} className={t.arrow} />
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
      <header className={`${t.header} backdrop-blur-sm shadow-sm sticky top-0 z-10`}>
        <div className="px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => (showPast ? setShowPast(false) : onBack())}
            className="p-2 rounded-xl hover:bg-white/60 transition-colors"
          >
            <ArrowLeft size={20} className={t.arrow} />
          </button>
          <div>
            <h1 className={`text-xl font-bold bg-gradient-to-r ${t.title} bg-clip-text text-transparent`}>
              The Radical Rundown {t.emoji}
            </h1>
            {(showPast || !isLatest) && <p className="text-xs text-gray-400 -mt-0.5">Looking back at the {page.label} season</p>}
          </div>
          <div className="ml-auto flex items-center gap-2">
            {t.hive && (
              <button onClick={toggleMode} aria-label={mode === 'dark' ? 'Switch to light' : 'Switch to dark'} title={mode === 'dark' ? 'Light mode' : 'Dark mode'}
                className={`w-8 h-8 rounded-full flex items-center justify-center shadow-sm transition-colors ${mode === 'dark' ? 'bg-amber-400 text-[#17110a] hover:bg-yellow-300' : 'bg-[#2a1d08] text-amber-300 hover:bg-[#3a2a0c]'}`}>
                {mode === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
              </button>
            )}
            <SeasonSwitch season={season} onChange={setSeason} t={t} />
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 pb-8">
        {t.hive && <style>{t.light ? HIVE_CSS_LIGHT : HIVE_CSS}</style>}
        {hive ? (
          <div className={t.hive ? 'hive relative' : ''}>
            {t.hive && <Vines />}
            {t.hive && <Bees />}
            {/* Full-bleed team photo, fading into the dark */}
            <div className="relative z-10 -mx-4 -mt-4 mb-6 h-72 md:h-[440px] overflow-hidden">
              <img src={page.hero || '/team-hero.jpg'} alt="Team 7196" className="w-full h-full object-cover"
                style={{ objectPosition: page.heroPosition || 'center 35%' }} />
              <div className={`absolute inset-0 bg-gradient-to-t ${t.heroFade} to-transparent`} />
              <div className="absolute bottom-5 left-0 right-0 text-center px-4">
                <h2 className={`text-3xl md:text-5xl font-extrabold bg-gradient-to-r ${t.title} bg-clip-text text-transparent drop-shadow`}>
                  About Team 7196
                </h2>
                <p className={`${t.heroSub} text-xs md:text-sm font-semibold mt-1`}>
                  Everything That's Radical — Pleasant Valley High School, Bettendorf, Iowa
                </p>
              </div>
            </div>

            <div className={t.panel}>
              <Sprig className="absolute -top-6 -left-5 w-24 h-24 z-10" flip />
              <Sprig className="absolute -bottom-6 -right-5 w-20 h-20 z-10" />
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

            <div className={t.panel}>
              {page.storySlides && <StorySlides slides={page.storySlides} t={t} />}

              {page.goals && <GoalsSection goals={page.goals} t={t} />}

              {page.inside ? <InsideTheApp inside={page.inside} t={t} /> : (
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


              )}

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
          </div>
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
