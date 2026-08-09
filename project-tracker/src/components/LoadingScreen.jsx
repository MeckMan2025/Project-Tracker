import { useState, useRef, useCallback } from 'react'

// SCRUM letters step across the brand gradient: blue → pink → orange
const SCRUM_COLORS = ['#7EC8E3', '#B9B6CC', '#F4A3B5', '#FAAF93', '#FFBB70']

function LoadingScreen({ onComplete, onMusicStart }) {
  const [isVisible, setIsVisible] = useState(true)
  const [isFading, setIsFading] = useState(false)
  const tappedRef = useRef(false)

  const startMusic = () => {
    const pref = localStorage.getItem('scrum-music-pref') || 'off'
    if (pref === 'off') return
    const SONG_MAP = { 'intro': '/intro.mp3', 'radical-robotics': '/radical-robotics.mp3', 'radical-theme': '/radical-theme.mp3' }
    let src
    if (pref === 'random' || !SONG_MAP[pref]) {
      const songs = Object.values(SONG_MAP)
      src = songs[Math.floor(Math.random() * songs.length)]
    } else { src = SONG_MAP[pref] }
    const audio = new Audio(src)
    audio.volume = 1
    audio.play().catch(() => {})
    onMusicStart(audio)
  }

  const finishLoading = useCallback(() => {
    setIsFading(true)
    setTimeout(() => { setIsVisible(false); onComplete() }, 600)
  }, [onComplete])

  const handleTap = () => {
    if (tappedRef.current) return
    tappedRef.current = true
    startMusic()
    finishLoading()
  }

  if (!isVisible) return null

  return (
    <div
      onClick={handleTap}
      className={`fixed inset-0 z-50 cursor-pointer overflow-hidden transition-opacity duration-[600ms] ${isFading ? 'opacity-0' : 'opacity-100'}`}
      style={{ background: 'radial-gradient(circle at 50% 38%, #141a26 0%, #0a0d14 55%, #05070c 100%)' }}
    >
      <style>{`
        @keyframes glowUp {
          0%   { opacity: 0; transform: translateY(8px) scale(1.28); filter: blur(10px); text-shadow: none; }
          55%  { opacity: 1; filter: blur(0); }
          100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0);
                 text-shadow: 0 0 8px rgba(255,255,255,.75), 0 0 22px var(--c), 0 0 46px var(--c), 0 0 82px var(--c); }
        }
        @keyframes titlePulse {
          0%,100% { filter: drop-shadow(0 0 14px rgba(126,200,227,.4)) drop-shadow(0 0 22px rgba(244,163,181,.3)); }
          50%     { filter: drop-shadow(0 0 26px rgba(244,163,181,.7)) drop-shadow(0 0 40px rgba(255,187,112,.55)); }
        }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
        @keyframes sweep { 0% { transform: translateX(-160%) skewX(-18deg); } 100% { transform: translateX(160%) skewX(-18deg); } }
        .pre { animation: fadeUp .9s ease .15s both; }
        .scrum { animation: titlePulse 3.4s ease-in-out 2s infinite; position: relative; }
        .scrum .ltr { display: inline-block; opacity: 0; animation: glowUp 1.1s cubic-bezier(.2,.8,.2,1) forwards; }
        .shine { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
        .shine::after { content: ''; position: absolute; top: -20%; bottom: -20%; width: 45%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,.4), transparent);
          animation: sweep 2.6s ease-in-out 1.7s infinite; }
        .sub { animation: fadeUp 1s ease 2s both; }
        .cta { animation: fadeUp 1s ease 2.6s both; }
      `}</style>

      {/* faint starfield */}
      <div className="absolute inset-0 opacity-40" style={{ background: 'radial-gradient(1px 1px at 20% 30%, #fff, transparent), radial-gradient(1px 1px at 70% 60%, #fff, transparent), radial-gradient(1px 1px at 40% 80%, #fff, transparent), radial-gradient(1px 1px at 85% 25%, #fff, transparent)' }} />

      <div className="relative h-full flex flex-col items-center justify-center px-6 text-center">
        <p className="pre text-white/60 tracking-[0.55em] text-xs sm:text-sm font-semibold uppercase mb-3 ml-[0.55em]">
          Everything That's
        </p>

        <h1 className="scrum text-[19vw] sm:text-8xl font-black leading-none tracking-tight">
          <span className="shine" />
          {'SCRUM'.split('').map((ch, i) => (
            <span key={i} className="ltr" style={{ color: SCRUM_COLORS[i], '--c': SCRUM_COLORS[i], animationDelay: `${0.4 + i * 0.16}s` }}>{ch}</span>
          ))}
        </h1>

        <p className="sub mt-5 text-xs sm:text-sm font-semibold uppercase tracking-[0.35em]"
           style={{ background: 'linear-gradient(90deg, #7EC8E3, #F4A3B5, #FFBB70)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>
          Team 7196 · Radical Robotics
        </p>

        <div className="cta absolute bottom-14 left-1/2 -translate-x-1/2">
          <span className="text-sm font-bold text-white/90 tracking-widest uppercase border border-white/25 px-6 py-2.5 rounded-full backdrop-blur-sm animate-pulse">
            Tap to enter
          </span>
        </div>
      </div>
    </div>
  )
}

export default LoadingScreen
