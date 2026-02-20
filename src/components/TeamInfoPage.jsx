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

          <p className="text-gray-700 text-sm leading-relaxed">
            Founded in 2013, Team 7196 has grown through seasons of innovation, competition, and continuous improvement. Over the years, we've learned that building a successful robot requires more than technical skill — it requires organization, accountability, and strong systems behind the scenes.
          </p>

          <p className="text-gray-700 text-sm leading-relaxed">
            This season, we identified one of our biggest challenges: disorganization. As responsibilities expanded across build, programming, business, and scouting, relying on scattered tools and informal communication was limiting our efficiency and clarity.
          </p>

          <p className="text-gray-700 text-sm leading-relaxed">
            In response, we built <span className="font-semibold text-pastel-blue-dark">Everything That's Scrum</span>, our custom team management platform.
          </p>

          <p className="text-gray-700 text-sm leading-relaxed">
            The name reflects both our team identity and our commitment to structured, agile collaboration. Inspired by professional engineering workflows, the app centralizes everything our team needs to function effectively — scouting assignments, task boards, attendance tracking, organizational structure, communication tools, and performance data.
          </p>

          <div className="border-l-4 border-pastel-pink rounded-r-xl bg-pastel-pink/10 p-4">
            <h3 className="font-bold text-gray-800 text-sm mb-2">Scouting System</h3>
            <p className="text-gray-700 text-sm leading-relaxed">
              Our primary focus this season was improving scouting. We developed a structured scouting system that assigns alliance positions (Red 1, Blue 2, etc.), defines scouting groups, tracks submissions during active scouting periods, and ensures that data is reliable and verifiable. This system increases accountability during competition and strengthens our strategic decision-making.
            </p>
          </div>

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
