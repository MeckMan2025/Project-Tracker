import { useEffect, useRef } from 'react'
import confetti from 'canvas-confetti'
import { Trophy } from 'lucide-react'

// Team colors for confetti
const TEAM_COLORS = ['#A7C7E7', '#F4A7BB', '#FFD4A8', '#FFD700', '#C4A7E7']

function fireConfetti() {
  confetti({
    particleCount: 80,
    spread: 70,
    origin: { x: 0.1, y: 0.6 },
    colors: TEAM_COLORS,
  })
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

// Persistent falling confetti using a dedicated canvas behind everything
function ConfettiBackground() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const myConfetti = confetti.create(canvas, { resize: true, useWorker: true })
    let running = true

    const fall = () => {
      if (!running) return
      myConfetti({
        particleCount: 2,
        startVelocity: 0,
        ticks: 300,
        gravity: 0.4,
        spread: 360,
        origin: { x: Math.random(), y: -0.05 },
        colors: TEAM_COLORS,
        shapes: ['square', 'circle'],
        scalar: 0.8,
        drift: (Math.random() - 0.5) * 0.5,
      })
    }

    // Drop a couple particles every 200ms for a steady stream
    const interval = setInterval(fall, 200)

    return () => {
      running = false
      clearInterval(interval)
      myConfetti.reset()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  )
}

export default function StateCelebration() {
  // Fire big confetti burst on every mount (every refresh)
  useEffect(() => {
    const t = setTimeout(() => {
      fireConfetti()
      setTimeout(fireSchoolPride, 800)
    }, 600)
    return () => clearTimeout(t)
  }, [])

  return (
    <>
      {/* Constant falling confetti behind everything */}
      <ConfettiBackground />

      {/* Banner */}
      <div className="relative bg-gradient-to-r from-yellow-300/90 via-pastel-pink/90 to-pastel-blue/90 text-gray-800 shadow-lg z-20">
        <div className="flex items-center justify-center gap-3 px-4 py-2.5">
          <Trophy size={20} className="text-yellow-700 flex-shrink-0 animate-bounce" />
          <span className="font-bold text-sm md:text-base text-center">
            WE'RE GOING TO STATE!
          </span>
          <Trophy size={20} className="text-yellow-700 flex-shrink-0 animate-bounce" />
        </div>
      </div>
    </>
  )
}
