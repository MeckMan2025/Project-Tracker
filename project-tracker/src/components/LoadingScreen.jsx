import { useState, useRef, useEffect, useCallback } from 'react'

function LoadingScreen({ onComplete, onMusicStart }) {
  const [isVisible, setIsVisible] = useState(true)
  const [isFading, setIsFading] = useState(false)
  const [shown, setShown] = useState(false)
  const tappedRef = useRef(false)

  useEffect(() => { const t = setTimeout(() => setShown(true), 60); return () => clearTimeout(t) }, [])

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
    setTimeout(() => { setIsVisible(false); onComplete() }, 500)
  }, [onComplete])

  const handleTap = () => {
    if (tappedRef.current) return
    tappedRef.current = true
    startMusic()
    finishLoading()
  }

  if (!isVisible) return null

  const rise = (delay = 0) => ({
    opacity: shown ? 1 : 0,
    transform: shown ? 'translateY(0)' : 'translateY(16px)',
    transition: `opacity .6s ease ${delay}ms, transform .6s cubic-bezier(.2,.8,.2,1) ${delay}ms`,
  })

  return (
    <div
      onClick={handleTap}
      className={`fixed inset-0 z-50 transition-opacity duration-500 cursor-pointer overflow-hidden ${isFading ? 'opacity-0' : 'opacity-100'}`}
      style={{ backgroundImage: 'url("/Background.png")', backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }}
    >
      {/* scrim so content always reads well over the photo */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-900/40 via-slate-900/15 to-slate-900/55" />

      <div className="relative h-full flex flex-col items-center justify-center px-5">
        <div className="flex flex-col items-center text-center pointer-events-none" style={rise(0)}>
          <div className="mb-4 w-24 h-24 rounded-[28px] bg-white/15 backdrop-blur-md ring-1 ring-white/40 flex items-center justify-center shadow-2xl">
            <img src="/ScrumLogo-transparent.png" alt="Logo" className="w-16 h-16 drop-shadow-lg" />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.55)]">
            Everything That's Scrum
          </h1>
          <p className="text-sm text-white/85 mt-2 font-semibold tracking-[0.15em] uppercase">Team 7196 · Radical Robotics</p>
        </div>

        {/* Tap to start */}
        <div className="absolute bottom-14 left-1/2 -translate-x-1/2" style={rise(400)}>
          <span className="animate-pulse text-sm font-bold text-slate-800 bg-white/90 backdrop-blur px-7 py-3 rounded-full shadow-2xl ring-1 ring-white/60">
            Tap anywhere to start ✨
          </span>
        </div>
      </div>
    </div>
  )
}

export default LoadingScreen
