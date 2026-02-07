import { useState, useRef } from 'react'
import { useUser } from '../contexts/UserContext'

function LoadingScreen({ onComplete, onMusicStart }) {
  const [isVisible, setIsVisible] = useState(true)
  const [isFading, setIsFading] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const tappedRef = useRef(false)
  const audioRef = useRef(null)
  const { username, login } = useUser()

  const handleTap = (e) => {
    e.preventDefault()
    if (tappedRef.current || isFading) return
    tappedRef.current = true

    // Start music
    const songs = ['/Scrum/intro.mp3', '/Scrum/radical-robotics.mp3']
    const audio = new Audio(songs[Math.floor(Math.random() * songs.length)])
    audio.volume = 1
    audio.play().catch(() => {})
    onMusicStart(audio)
    audioRef.current = audio

    // If already logged in, fade out immediately
    if (username) {
      setIsFading(true)
      setTimeout(() => {
        setIsVisible(false)
        onComplete()
      }, 500)
    } else {
      // Show login form on the loading screen
      setShowLogin(true)
    }
  }

  const handleLogin = (e) => {
    e.preventDefault()
    if (!nameInput.trim()) return
    login(nameInput.trim())
    setIsFading(true)
    setTimeout(() => {
      setIsVisible(false)
      onComplete()
    }, 500)
  }

  if (!isVisible) return null

  return (
    <div
      onClick={!showLogin ? handleTap : undefined}
      onTouchEnd={!showLogin ? handleTap : undefined}
      className={`fixed inset-0 z-50 transition-opacity duration-500 flex items-center justify-center ${
        !showLogin ? 'cursor-pointer' : ''
      } ${isFading ? 'opacity-0' : 'opacity-100'}`}
      style={{
        backgroundImage: 'url("/Scrum/Background.png")',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {!isFading && !showLogin && (
        <div className="absolute bottom-16">
          <p className="text-sm font-semibold animate-pulse bg-pastel-pink/80 text-gray-700 px-4 py-2 rounded-full shadow-md">Tap to start</p>
        </div>
      )}

      {showLogin && !isFading && (
        <form onSubmit={handleLogin} className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-8 w-80 space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-pastel-blue-dark via-pastel-pink-dark to-pastel-orange-dark bg-clip-text text-transparent">
              Who is online?
            </h1>
            <p className="text-sm text-gray-500 mt-1">Enter your name to continue</p>
          </div>
          <input
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder="Your name"
            className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-pastel-blue focus:border-transparent text-center text-lg"
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="submit"
            className="w-full py-3 bg-pastel-pink hover:bg-pastel-pink-dark rounded-xl font-semibold text-gray-700 transition-colors text-lg"
          >
            Join
          </button>
        </form>
      )}
    </div>
  )
}

export default LoadingScreen
