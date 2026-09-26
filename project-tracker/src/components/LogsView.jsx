import { useState } from 'react'
import { Globe, Receipt, GraduationCap } from 'lucide-react'

// Three logs, each its own sub-tab. The tabs and the shape are here; what
// fills them hasn't been decided yet, so each one says so plainly rather than
// showing an empty table and looking broken.
const LOGS = [
  { id: 'outreach', label: 'Outreach', icon: Globe,
    blurb: 'Events, demos and the people reached at them.' },
  { id: 'expenses', label: 'Expenses', icon: Receipt,
    blurb: 'What was spent, on what, and who approved it.' },
  { id: 'mentor',   label: 'Mentor',   icon: GraduationCap,
    blurb: 'Time mentors put in and what they helped with.' },
]

export default function LogsView() {
  const [tab, setTab] = useState('outreach')
  const active = LOGS.find(l => l.id === tab) || LOGS[0]
  const Icon = active.icon

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="px-4 py-3 ml-14">
          <h1 className="text-xl font-bold bg-gradient-to-r from-pastel-blue-dark via-pastel-pink-dark to-pastel-orange-dark bg-clip-text text-transparent">
            Logs
          </h1>

          <div className="flex gap-1 mt-2 overflow-x-auto">
            {LOGS.map(l => {
              const TabIcon = l.icon
              return (
                <button
                  key={l.id}
                  onClick={() => setTab(l.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                    tab === l.id ? 'bg-pastel-pink text-gray-800' : 'text-gray-500 hover:bg-pastel-blue/30'
                  }`}
                >
                  <TabIcon size={14} />
                  {l.label}
                </button>
              )
            })}
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 overflow-y-auto">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
            <Icon size={36} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">
              Nothing in the {active.label.toLowerCase()} log yet.
            </p>
            <p className="text-sm text-gray-400 mt-1 max-w-sm mx-auto">{active.blurb}</p>
          </div>
        </div>
      </main>
    </div>
  )
}
