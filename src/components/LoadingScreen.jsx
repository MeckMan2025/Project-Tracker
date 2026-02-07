import { useState, useRef } from 'react'

function LoadingScreen({ onComplete, onMusicStart }) {
  const [isVisible, setIsVisible] = useState(true)
  const [isFading, setIsFading] = useState(false)
  const tappedRef = useRef(false)

  const startMusic = () => {
    const songs = ['/Project-Tracker/intro.mp3', '/Project-Tracker/radical-robotics.mp3']
    const audio = new Audio(songs[Math.floor(Math.random() * songs.length)])
    audio.volume = 1
    audio.play().catch(() => {})
    onMusicStart(audio)
  }

  const handleTap = () => {
    if (tappedRef.current || isFading) return
    tappedRef.current = true
    startMusic()
    setIsFading(true)
    setTimeout(() => {
      setIsVisible(false)
      onComplete()
    }, 500)
  }

  if (!isVisible) return null

  return (
    <div
      className={`fixed inset-0 z-50 transition-opacity duration-500 flex items-center justify-center ${
        isFading ? 'opacity-0' : 'opacity-100'
      }`}
      style={{
        backgroundImage: 'url("/Project-Tracker/Background.png")',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {!isFading && (
        <button
          type="button"
          onClick={handleTap}
          className="absolute inset-0 w-full h-full cursor-pointer bg-transparent"
        >
          <span className="absolute bottom-16 left-1/2 -translate-x-1/2 text-sm font-semibold animate-pulse bg-pastel-pink/80 text-gray-700 px-4 py-2 rounded-full shadow-md">
            Tap to start
          </span>
        </button>
      )}
    </div>
  )
}

export default LoadingScreen
