import { useState, useRef } from 'react'

function LoadingScreen({ onComplete }) {
  const [isVisible, setIsVisible] = useState(true)
  const [isFading, setIsFading] = useState(false)
  const [hasStarted, setHasStarted] = useState(false)
  const audioRef = useRef(null)

  const handleTap = () => {
    // First tap: start the audio
    if (!hasStarted) {
      setHasStarted(true)
      const audio = new Audio('/Scrum/intro.mp3')
      audio.volume = 1
      audioRef.current = audio
      audio.play().catch(() => {})
      return
    }

    // Second tap: fade out screen and audio
    if (isFading) return
    setIsFading(true)

    // Fade audio out over 500ms
    const audio = audioRef.current
    if (audio) {
      const fadeInterval = setInterval(() => {
        if (audio.volume > 0.05) {
          audio.volume = Math.max(0, audio.volume - 0.05)
        } else {
          audio.pause()
          clearInterval(fadeInterval)
        }
      }, 25)
    }

    setTimeout(() => {
      setIsVisible(false)
      onComplete()
    }, 500)
  }

  if (!isVisible) return null

  return (
    <div
      onClick={handleTap}
      onTouchStart={handleTap}
      className={`fixed inset-0 z-50 cursor-pointer transition-opacity duration-500 flex items-end justify-center pb-16 ${
        isFading ? 'opacity-0' : 'opacity-100'
      }`}
      style={{
        backgroundImage: 'url("/Scrum/Background.png")',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {!hasStarted && (
        <p className="text-white/80 text-sm animate-pulse">Tap to start</p>
      )}
      {hasStarted && !isFading && (
        <p className="text-white/80 text-sm animate-pulse">Tap to continue</p>
      )}
    </div>
  )
}

export default LoadingScreen
