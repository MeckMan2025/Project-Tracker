import { useEffect, useState, useCallback } from 'react'
import confetti from 'canvas-confetti'
import { X, Trophy } from 'lucide-react'

// Team colors for confetti — customize these!
const TEAM_COLORS = ['#A7C7E7', '#F4A7BB', '#FFD4A8', '#FFD700', '#C4A7E7']

function fireConfetti() {
  // Big burst from the left
  confetti({
    particleCount: 80,
    spread: 70,
    origin: { x: 0.1, y: 0.6 },
    colors: TEAM_COLORS,
  })
  // Big burst from the right
  confetti({
    particleCount: 80,
    spread: 70,
    origin: { x: 0.9, y: 0.6 },
    colors: TEAM_COLORS,
  })
}

function fireSchoolPride() {
  let end = Date.now() + 1500
  const frame = () => {
    confetti({
      particleCount: 3,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.6 },
      colors: TEAM_COLORS,
    })
    confetti({
      particleCount: 3,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.6 },
      colors: TEAM_COLORS,
    })
    if (Date.now() < end) requestAnimationFrame(frame)
  }
  frame()
}

export default function StateCelebration() {
  const [dismissed, setDismissed] = useState(() => {
    return sessionStorage.getItem('state-banner-dismissed') === 'true'
  })

  const launch = useCallback(() => {
    fireConfetti()
    setTimeout(fireSchoolPride, 800)
  }, [])

  // Fire confetti on mount (once per page load)
  useEffect(() => {
    const alreadyFired = sessionStorage.getItem('state-confetti-fired')
    if (!alreadyFired) {
      // Small delay so the page renders first
      const t = setTimeout(() => {
        launch()
        sessionStorage.setItem('state-confetti-fired', 'true')
      }, 600)
      return () => clearTimeout(t)
    }
  }, [launch])

  // Periodic subtle confetti every 45 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      confetti({
        particleCount: 15,
        spread: 100,
        origin: { x: Math.random(), y: -0.1 },
        colors: TEAM_COLORS,
        gravity: 0.8,
        ticks: 200,
      })
    }, 45000)
    return () => clearInterval(interval)
  }, [])

  if (dismissed) return null

  return (
    <div className="relative bg-gradient-to-r from-yellow-300/90 via-pastel-pink/90 to-pastel-blue/90 text-gray-800 shadow-lg z-20">
      <div className="flex items-center justify-center gap-3 px-4 py-2.5">
        <Trophy size={20} className="text-yellow-700 flex-shrink-0 animate-bounce" />
        <span className="font-bold text-sm md:text-base text-center">
          WE'RE GOING TO STATE!
        </span>
        <Trophy size={20} className="text-yellow-700 flex-shrink-0 animate-bounce" />
        <button
          onClick={() => {
            setDismissed(true)
            sessionStorage.setItem('state-banner-dismissed', 'true')
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-white/30 transition-colors"
          title="Dismiss"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
