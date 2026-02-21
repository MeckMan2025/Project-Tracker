import { useState, useRef, useMemo } from 'react'

const TEAM_GOALS = [
  'Create 1 social media post per week to connect with our community and spread FIRST throughout the season',
  'By January 1st, have at least 250 hours of outreach as a team by participating in at least 8 outreach events',
  'Participate in the final tournament at the league qualifiers',
  'Help strengthen and uplift other FIRST Teams by volunteering and collaborating with FLL teams and at least 3 other FTC teams',
  'Have a successful intake system by the first comp — human player can load balls and cycle within 15 seconds',
  'Keep an active engineering notebook the entire season — everyone at the meeting every night updates it with their tasks',
  'Score over 60 points per match individually (across Auto, TeleOp, and End Game)',
  'Have each team member rotate once a week across business, technical, and programming so everyone can confidently work in each department by end of season',
  'By February 14th, drivers need to score 100 on a rules test and get at least 1 hour of driver practice per meeting, 2–3 times a week',
  'Try to save money by not going below 25% of our budget by end of season',
  'Win over 4 matches per competition',
]

function pickRandomGoals(arr, count) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}

function LoadingScreen({ onComplete, onMusicStart }) {
  const [isVisible, setIsVisible] = useState(true)
  const [isFading, setIsFading] = useState(false)
  const tappedRef = useRef(false)
  const randomGoals = useMemo(() => pickRandomGoals(TEAM_GOALS, 3), [])

  const startMusic = () => {
    const pref = localStorage.getItem('scrum-music-pref') || 'off'
    if (pref === 'off') return

    const SONG_MAP = {
      'intro': '/intro.mp3',
      'radical-robotics': '/radical-robotics.mp3',
      'radical-theme': '/radical-theme.mp3',
    }

    let src
    if (pref === 'random' || !SONG_MAP[pref]) {
      const songs = Object.values(SONG_MAP)
      src = songs[Math.floor(Math.random() * songs.length)]
    } else {
      src = SONG_MAP[pref]
    }

    const audio = new Audio(src)
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
      className={`fixed inset-0 z-50 transition-opacity duration-500 flex flex-col items-center justify-center ${
        isFading ? 'opacity-0' : 'opacity-100'
      }`}
      style={{
        backgroundImage: 'url("/Background.png")',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {!isFading && (
        <>
          <button
            type="button"
            onClick={handleTap}
            className="absolute inset-0 w-full h-full cursor-pointer bg-transparent z-0"
          />

          <div className="pointer-events-none z-10 flex flex-col items-center gap-5 px-4 w-full max-w-sm">
            {/* Logo + Title */}
            <div className="text-center">
              <img src="/ScrumLogo-transparent.png" alt="Logo" className="w-16 h-16 mx-auto mb-2 drop-shadow-lg" />
              <h1 className="text-2xl font-extrabold bg-gradient-to-r from-pastel-blue-dark via-pastel-pink-dark to-pastel-orange-dark bg-clip-text text-transparent drop-shadow-sm">
                Everything That's Scrum
              </h1>
              <p className="text-xs text-gray-500 mt-1 font-medium">Team 7196 — Radical Robotics</p>
            </div>

            {/* Goals card */}
            <div className="w-full bg-white/80 backdrop-blur-md rounded-2xl shadow-xl border border-white/50 overflow-hidden">
              <div className="bg-gradient-to-r from-pastel-blue/40 via-pastel-pink/40 to-pastel-orange/40 px-4 py-2">
                <p className="text-xs font-bold text-gray-600 uppercase tracking-widest text-center">Team Goals</p>
              </div>
              <div className="p-4 space-y-3">
                {randomGoals.map((goal, i) => (
                  <div key={i} className="flex gap-3 items-start">
                    <span className="shrink-0 w-6 h-6 rounded-full bg-gradient-to-br from-pastel-pink to-pastel-orange flex items-center justify-center text-xs font-bold text-white shadow-sm">
                      {i + 1}
                    </span>
                    <p className="text-sm text-gray-700 leading-snug pt-0.5">{goal}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <span className="absolute bottom-12 left-1/2 -translate-x-1/2 text-sm font-semibold animate-pulse bg-pastel-pink/80 text-gray-700 px-6 py-2.5 rounded-full shadow-lg pointer-events-none z-10">
            Tap to start
          </span>
        </>
      )}
    </div>
  )
}

export default LoadingScreen
