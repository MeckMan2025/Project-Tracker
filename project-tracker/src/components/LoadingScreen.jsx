import { useState, useRef, useCallback } from 'react'

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
      style={{ background: 'linear-gradient(140deg, #eef7fb 0%, #fdeef3 52%, #fff6ea 100%)' }}
    >
      <style>{`
        @keyframes reveal {
          0%   { opacity: 0; transform: scale(1.22); letter-spacing: .18em; filter: blur(8px); }
          60%  { opacity: 1; filter: blur(0); }
          100% { opacity: 1; transform: scale(1); letter-spacing: -.02em; filter: blur(0); }
        }
        @keyframes ombre { 0% { background-position: 0% 50%; } 100% { background-position: 200% 50%; } }
        @keyframes floaty { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
        @keyframes sweep { 0% { transform: translateX(-160%) skewX(-18deg); } 100% { transform: translateX(160%) skewX(-18deg); } }
        .pre { animation: fadeUp .9s ease .15s both; }
        .scrum {
          background: linear-gradient(100deg, #7EC8E3 0%, #F4A3B5 45%, #FFBB70 90%, #7EC8E3 130%);
          background-size: 220% auto;
          -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; color: transparent;
          animation: reveal 1.2s cubic-bezier(.2,.8,.2,1) both, ombre 6s linear 1.2s infinite, floaty 5s ease-in-out 1.2s infinite;
          filter: drop-shadow(0 8px 22px rgba(244,163,181,.35));
          position: relative;
        }
        .shine { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
        .shine::after { content: ''; position: absolute; top: -20%; bottom: -20%; width: 40%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,.6), transparent);
          animation: sweep 3s ease-in-out 1.6s infinite; }
        .sub { animation: fadeUp 1s ease 1.7s both; }
        .cta { animation: fadeUp 1s ease 2.2s both; }
      `}</style>

      <div className="relative h-full flex flex-col items-center justify-center px-6 text-center">
        <p className="pre text-gray-400 tracking-[0.5em] text-xs sm:text-sm font-bold uppercase mb-2 ml-[0.5em]">
          Everything That's
        </p>

        <h1 className="scrum text-[20vw] sm:text-9xl font-black leading-none">
          SCRUM
          <span className="shine" />
        </h1>

        <p className="sub text-gray-400 tracking-[0.3em] text-xs sm:text-sm font-bold uppercase mt-4">
          Team 7196 · Radical Robotics
        </p>

        <div className="cta absolute bottom-14 left-1/2 -translate-x-1/2">
          <span className="text-sm font-bold text-white tracking-widest uppercase px-7 py-3 rounded-full shadow-lg animate-pulse"
                style={{ background: 'linear-gradient(90deg, #7EC8E3, #F4A3B5, #FFBB70)' }}>
            Tap to enter
          </span>
        </div>
      </div>
    </div>
  )
}

export default LoadingScreen
