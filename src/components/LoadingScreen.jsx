import { useState, useRef } from 'react'

function LoadingScreen({ onComplete, onMusicStart }) {
  const [isVisible, setIsVisible] = useState(true)
  const [isFading, setIsFading] = useState(false)
  const [hasStarted, setHasStarted] = useState(false)
  const audioRef = useRef(null)
  const tappedRef = useRef(false)

  const handleTap = (e) => {
    e.preventDefault()

    // Prevent double-firing from touch + click
    if (tappedRef.current) return
    tappedRef.current = true
    setTimeout(() => { tappedRef.current = false }, 300)

    // First tap: start the audio
    if (!hasStarted) {
      setHasStarted(true)
      const audio = new Audio('/Scrum/intro.mp3')
      audio.volume = 1
      audioRef.current = audio
      audio.play().catch(() => {})
      onMusicStart(audio)
      return
    }

    // Second tap: fade out screen (audio keeps playing)
    if (isFading) return
    setIsFading(true)

    setTimeout(() => {
      setIsVisible(false)
      onComplete()
    }, 500)
  }

  if (!isVisible) return null

  return (
    <div
      onClick={handleTap}
      onTouchEnd={handleTap}
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
        <p className="text-sm font-semibold animate-pulse bg-pastel-pink/80 text-gray-700 px-4 py-2 rounded-full shadow-md">Tap to start</p>
      )}
      {hasStarted && !isFading && (
        <p className="text-sm font-semibold animate-pulse bg-pastel-blue/80 text-gray-700 px-4 py-2 rounded-full shadow-md">Tap to continue</p>
      )}
    </div>
  )
}

export default LoadingScreen
