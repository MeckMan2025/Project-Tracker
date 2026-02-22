import { useState, useRef } from 'react'
import { ArrowLeft, Play, Pause, Music, Sparkles } from 'lucide-react'

function ThemeSongPlayer() {
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef(null)

  const toggle = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio('/radical-theme.mp3')
      audioRef.current.addEventListener('ended', () => setPlaying(false))
    }
    if (playing) {
      audioRef.current.pause()
      setPlaying(false)
    } else {
      audioRef.current.play().catch(() => {})
      setPlaying(true)
    }
  }

  return (
    <div className="border-l-4 border-pastel-pink rounded-r-xl bg-gradient-to-r from-pastel-pink/15 to-pastel-orange/10 p-4">
      <div className="flex items-center gap-3">
        <button
          onClick={toggle}
          className={`w-12 h-12 rounded-full flex items-center justify-center shadow-md transition-all ${
            playing
              ? 'bg-pastel-pink-dark text-white scale-105'
              : 'bg-white text-pastel-pink-dark hover:bg-pastel-pink hover:text-gray-700'
          }`}
        >
          {playing ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-1.5">
            <Music size={14} className="text-pastel-pink-dark" />
            <h3 className="font-bold text-gray-800 text-sm">Our Team's Theme Song</h3>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">Made with AI — listen to the Radical Robotics anthem!</p>
        </div>
      </div>
      {playing && (
        <div className="mt-3 flex gap-1 items-end justify-center h-4">
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className="w-1 bg-pastel-pink-dark rounded-full animate-pulse"
              style={{
                height: `${8 + Math.random() * 12}px`,
                animationDelay: `${i * 0.1}s`,
                animationDuration: `${0.4 + Math.random() * 0.4}s`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function LeaderCard({ name, role, emoji, color, photo, photoPosition, photoFilter, bio, reverse }) {
  const imgStyle = { ...(photoPosition && { objectPosition: photoPosition }), ...(photoFilter && { filter: photoFilter }) }
  return (
    <div className="shadow-md rounded-2xl overflow-hidden md:overflow-visible">
      {/* Mobile: checkerboard — photo offset to one side, bio overlaps the corner */}
      <div className="md:hidden pb-2">
        <div className={`${reverse ? 'ml-auto' : ''} w-[62%] h-52 rounded-2xl overflow-hidden shadow-sm`}>
          <img
            src={photo}
            alt={name}
            style={Object.keys(imgStyle).length ? imgStyle : undefined}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.target.style.display = 'none'
              e.target.parentElement.classList.add('bg-gradient-to-br', 'from-pastel-pink/30', 'to-pastel-blue/30')
              e.target.parentElement.innerHTML = `<div class="w-full h-full flex items-center justify-center"><span class="text-5xl">${emoji}</span></div>`
            }}
          />
        </div>
        <div className={`${reverse ? 'mr-auto' : 'ml-auto'} w-[80%] -mt-5 relative z-10 p-3.5 backdrop-blur-md bg-white/85 rounded-xl shadow-md`}>
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-sm">{emoji}</span>
            <h4 className="font-bold text-gray-800 text-sm">{role}</h4>
          </div>
          <h4 className={`font-bold text-base mb-1 ${color}`}>{name}</h4>
          <p className="text-xs text-gray-700 leading-relaxed">{bio}</p>
        </div>
      </div>

      {/* Desktop: side-by-side with glassmorphism overlap */}
      <div className="hidden md:block relative min-h-[250px]">
        <div className="absolute inset-0 flex" style={{ flexDirection: reverse ? 'row-reverse' : 'row' }}>
          <div className="w-2/5 flex-shrink-0">
            <img
              src={photo}
              alt={name}
              style={Object.keys(imgStyle).length ? imgStyle : undefined}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.target.style.display = 'none'
                e.target.parentElement.classList.add('bg-gradient-to-br', 'from-pastel-pink/30', 'to-pastel-blue/30')
                e.target.parentElement.innerHTML = `<div class="w-full h-full flex items-center justify-center"><span class="text-5xl">${emoji}</span></div>`
              }}
            />
          </div>
          <div className={`flex-1 ${reverse ? 'bg-gradient-to-l' : 'bg-gradient-to-r'} from-white/70 to-white/90`} />
        </div>
        <div className="relative flex" style={{ flexDirection: reverse ? 'row-reverse' : 'row' }}>
          <div className="w-2/5 flex-shrink-0" />
          <div className={`flex-1 p-4 ${reverse ? '-mr-6 rounded-r-2xl text-right' : '-ml-6 rounded-l-2xl'} backdrop-blur-sm bg-white/60`}>
            <div className={`flex items-center gap-1.5 mb-1.5 ${reverse ? 'justify-end' : ''}`}>
              {reverse ? (
                <>
                  <h4 className="font-bold text-gray-800 text-sm">{role}</h4>
                  <span className="text-sm">{emoji}</span>
                </>
              ) : (
                <>
                  <span className="text-sm">{emoji}</span>
                  <h4 className="font-bold text-gray-800 text-sm">{role}</h4>
                </>
              )}
            </div>
            <h4 className={`font-bold text-base mb-1.5 ${color}`}>{name}</h4>
            <p className="text-xs text-gray-700 leading-relaxed">{bio}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function TeamInfoPage({ onBack }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-pastel-blue/30 via-pastel-pink/20 to-pastel-orange/30 flex flex-col">
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl hover:bg-white/60 transition-colors"
          >
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <h1 className="text-xl font-bold bg-gradient-to-r from-pastel-blue-dark via-pastel-pink-dark to-pastel-orange-dark bg-clip-text text-transparent">
            The Radical Rundown
          </h1>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 pb-8">
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-6 w-full max-w-2xl mx-auto space-y-6">
          {/* Hero competition photo */}
          <div className="relative -mx-6 -mt-6 mb-2 overflow-hidden rounded-t-2xl">
            <img
              src="/team-hero.jpg"
              alt="Team 7196"
              className="w-full h-80 md:h-64 object-cover"
              style={{ objectPosition: 'center 20%' }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-white/95 via-white/40 to-transparent" />
            <div className="absolute bottom-3 left-0 right-0 text-center">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-pastel-blue-dark via-pastel-pink-dark to-pastel-orange-dark bg-clip-text text-transparent drop-shadow-sm">
                About Team 7196
              </h2>
              <p className="text-gray-600 text-xs font-medium">
                Everything That's Radical — Pleasant Valley High School, Bettendorf, Iowa
              </p>
            </div>
          </div>

          <div className="border-l-4 border-pastel-orange rounded-r-xl bg-pastel-orange/10 p-4">
            <h3 className="font-bold text-gray-800 text-sm mb-2">Who We Are</h3>
            <p className="text-gray-700 text-sm leading-relaxed">
              We are <span className="font-semibold">Everything That's Radical</span>, FTC Team 7196, based out of Pleasant Valley High School in Bettendorf, Iowa. Established in 2013, our team has grown through seasons of innovation, competition, and continuous improvement.
            </p>
          </div>

          {/* Selfie photo floated with text */}
          <div className="relative">
            <div className="float-right ml-4 mb-2 w-28 h-28 rounded-full overflow-hidden border-4 border-white shadow-lg flex-shrink-0">
              <img
                src="/team-selfie.png"
                alt="Team 7196 group selfie"
                className="w-full h-full object-cover"
              />
            </div>
            <p className="text-gray-700 text-sm leading-relaxed">
              Last season, we won the <span className="font-semibold">Control Award</span> and were chosen as an alliance partner. This year, Everything That's Radical is mainly composed of members that are new to FTC, and the team is ecstatic to learn STEM-based skills with FIRST!
            </p>
            <p className="text-gray-700 text-sm leading-relaxed mt-4">
              Each student grows from the experiences within the FIRST Tech Challenge program, no matter if it is designing and building a robot, putting together a portfolio and presentation, or through outreach. Every student on our team is also able to take advantage of the many Applied Science Classes that Pleasant Valley High School provides, and many of our team members have taken one or more of these classes.
            </p>
          </div>

          {/* Meet Our Leaders */}
          <div className="space-y-5 max-w-lg mx-auto">
            <h3 className="text-lg font-bold text-center bg-gradient-to-r from-pastel-blue-dark via-pastel-pink-dark to-pastel-orange-dark bg-clip-text text-transparent">
              Meet Our Leaders
            </h3>

            <LeaderCard
              name="Harshita"
              role="Team Lead"
              emoji="🚀"
              color="text-pastel-orange-dark"
              photo="/leaders/harshita.jpg"
              photoPosition="center"
              bio="Somebody has to keep all the moving parts aligned — and that's me. I connect our business and technical teams, coordinate responsibilities, and make sure our progress doesn't stall. When deadlines approach or chaos starts creeping in, I focus on keeping us organized, calm, and moving forward together."
            />

            <LeaderCard
              name="Lily"
              role="Business Lead"
              emoji="💼"
              color="text-pastel-pink-dark"
              photo="/leaders/lily.jpg"
              bio="Behind every working robot is a working plan — and that's where I come in. I handle outreach, sponsorships, and presentations, and I make sure our team communicates as well as it competes. While the robot team fine-tunes mechanisms, I'm building connections and making sure we have the resources and strategy to succeed. Organization might not score points directly — but it wins seasons."
              reverse
            />

            <LeaderCard
              name="Nick"
              role="Technical Lead"
              emoji="🔧"
              color="text-pastel-blue-dark"
              photo="/leaders/nick.jpg"
              bio="SNAP! …did you hear that? Don't worry — I probably already fixed it. I oversee build, CAD, and programming to make sure our robot performs the way we designed it to. My job is turning ideas into something precise, reliable, and competition-ready. If it spins, lifts, drives, or occasionally makes a questionable noise — I'm on it."
            />
          </div>

          {/* Co-Founders */}
          <div className="space-y-5 max-w-lg mx-auto">
            <h3 className="text-lg font-bold text-center bg-gradient-to-r from-pastel-blue-dark via-pastel-pink-dark to-pastel-orange-dark bg-clip-text text-transparent">
              The Founders
            </h3>

            <LeaderCard
              name="Kayden"
              role="Cofounder"
              emoji="🧠"
              color="text-pastel-pink-dark"
              photo="/leaders/kayden.jpg"
              photoPosition="center 40%"
              bio={`If you see someone awake at 1:47 a.m. asking Claude to "just fix one more thing," that's probably me. Claude is an AI coding assistant by Anthropic — and my go-to partner for building this app. I led the development of our platform, turning our team's organization challenges into a structured, working system. Beyond building the app myself, I also get teammates involved by helping them create their own small projects within it — because the best way to learn is by doing. The real technical challenge wasn't just building features — it was convincing Claude to properly interpret my late-night grammar mistakes. Somehow, between caffeine and debugging, we built something that actually works.`}
            />

            <LeaderCard
              name="Yukti"
              role="Cofounder"
              emoji="🚀"
              color="text-pastel-blue-dark"
              photo="/leaders/yukti.jpg"
              photoPosition="50% 0%"
              bio="Every system starts with a prototype — and I built the first one. Creating the original version of our team app is what made this whole idea feel real and exciting. Seeing the first prototype come to life showed us that we could actually solve our organization challenges, and that momentum pushed us to keep improving it into what it is today."
              reverse
            />
          </div>

          <p className="text-gray-700 text-sm leading-relaxed">
            Over the years, we've learned that building a successful robot requires more than technical skill — it requires organization, accountability, and strong systems behind the scenes. This season, we identified one of our biggest challenges: disorganization. As responsibilities expanded across build, programming, business, and scouting, relying on scattered tools and informal communication was limiting our efficiency and clarity.
          </p>

          <p className="text-gray-700 text-sm leading-relaxed">
            In response, we built <span className="font-semibold text-pastel-blue-dark">Everything That's Scrum</span>, our custom team management platform. The name reflects both our team identity and our commitment to structured, agile collaboration. Inspired by professional engineering workflows, the app centralizes everything our team needs to function effectively — scouting assignments, task boards, attendance tracking, organizational structure, communication tools, and performance data.
          </p>

          <div className="border-l-4 border-pastel-pink rounded-r-xl bg-pastel-pink/10 p-4 space-y-3">
            <h3 className="font-bold text-gray-800 text-sm">What's Inside the App</h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                ['🔍', 'Scouting Forms', 'Submit and track match scouting data with assigned alliance positions'],
                ['📅', 'Scouting Schedule', 'Organized scouting groups and rotation assignments for competitions'],
                ['📊', 'Scouting Data', 'View, analyze, and verify collected scouting submissions'],
                ['📋', 'Task Boards', 'Kanban-style boards for managing build, programming, and business tasks'],
                ['✅', 'To-Do Lists', 'Personal and team task tracking with assignments and priorities'],
                ['📓', 'Engineering Notebook', 'Document build progress, decisions, and meeting notes with photo uploads'],
                ['🏗️', 'Org Chart', 'Visual team hierarchy from Co-Founders down to members'],
                ['📆', 'Calendar', 'Shared team calendar for meetings, competitions, and deadlines'],
                ['📥', 'Suggestions', 'Submit ideas and feedback for the team or the app'],
                ['💡', 'Workshop Ideas', 'Plan and organize team workshops and skill-building sessions'],
              ].map(([emoji, title, desc]) => (
                <div key={title} className="bg-white/60 rounded-lg p-2">
                  <p className="text-xs font-semibold text-gray-800">{emoji} {title}</p>
                  <p className="text-xs text-gray-500 leading-snug">{desc}</p>
                </div>
              ))}
            </div>
          </div>

          <p className="text-gray-700 text-sm leading-relaxed">
            Our primary focus this season was improving scouting. We developed a structured scouting system that assigns alliance positions (Red 1, Blue 2, etc.), defines scouting groups, tracks submissions during active scouting periods, and ensures that data is reliable and verifiable. This system increases accountability during competition and strengthens our strategic decision-making.
          </p>

          <p className="text-gray-700 text-sm leading-relaxed">
            Beyond scouting, the app brings clarity to leadership roles, creates visibility in task management, and reinforces responsibility across both business and technical teams. Instead of adapting to generic tools, we built a system tailored specifically to Team 7196's workflow.
          </p>

          <ThemeSongPlayer />

          <div className="border-l-4 border-pastel-blue rounded-r-xl bg-pastel-blue/10 p-4">
            <p className="text-gray-700 text-sm leading-relaxed italic">
              Everything That's Scrum represents our commitment to growth — evolving from informal coordination to intentional, professional-level team management. By strengthening our internal systems, we strengthen our performance on the field.
            </p>
          </div>

          <div className="relative mt-4 rounded-2xl overflow-hidden bg-gradient-to-r from-pastel-blue/20 via-pastel-pink/20 to-pastel-orange/20 p-[1px]">
            <div className="rounded-2xl bg-white/80 backdrop-blur-sm px-5 py-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pastel-blue via-pastel-pink to-pastel-orange flex items-center justify-center flex-shrink-0 shadow-md">
                <Sparkles size={18} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-gray-700">Crafted with a little help from AI</p>
                <p className="text-[11px] text-gray-500 leading-snug mt-0.5">
                  This page was written and designed collaboratively with Claude, an AI assistant by Anthropic — because even robots need a hand sometimes.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TeamInfoPage
