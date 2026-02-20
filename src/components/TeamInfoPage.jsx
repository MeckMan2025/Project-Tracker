import { ArrowLeft } from 'lucide-react'

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
          <h2 className="text-2xl font-bold text-center bg-gradient-to-r from-pastel-blue-dark via-pastel-pink-dark to-pastel-orange-dark bg-clip-text text-transparent">
            About Team 7196
          </h2>
          <p className="text-center text-gray-500 text-xs font-medium -mt-4">
            Everything That's Radical — Pleasant Valley High School, Bettendorf, Iowa
          </p>

          <div className="border-l-4 border-pastel-orange rounded-r-xl bg-pastel-orange/10 p-4">
            <h3 className="font-bold text-gray-800 text-sm mb-2">Who We Are</h3>
            <p className="text-gray-700 text-sm leading-relaxed">
              We are <span className="font-semibold">Everything That's Radical</span>, FTC Team 7196, based out of Pleasant Valley High School in Bettendorf, Iowa. Established in 2013, our team has grown through seasons of innovation, competition, and continuous improvement.
            </p>
          </div>

          <p className="text-gray-700 text-sm leading-relaxed">
            Last season, we won the <span className="font-semibold">Control Award</span> and were chosen as an alliance partner. This year, Everything That's Radical is mainly composed of members that are new to FTC, and the team is ecstatic to learn STEM-based skills with FIRST!
          </p>

          <p className="text-gray-700 text-sm leading-relaxed">
            Each student grows from the experiences within the FIRST Tech Challenge program, no matter if it is designing and building a robot, putting together a portfolio and presentation, or through outreach. Every student on our team is also able to take advantage of the many Applied Science Classes that Pleasant Valley High School provides, and many of our team members have taken one or more of these classes.
          </p>

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
                ['📢', 'Announcements', 'Team-wide announcements and notifications'],
                ['💬', 'Quick Chat', 'Real-time messaging for fast team communication'],
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

          <div className="border-l-4 border-pastel-blue rounded-r-xl bg-pastel-blue/10 p-4">
            <p className="text-gray-700 text-sm leading-relaxed italic">
              Everything That's Scrum represents our commitment to growth — evolving from informal coordination to intentional, professional-level team management. By strengthening our internal systems, we strengthen our performance on the field.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TeamInfoPage
