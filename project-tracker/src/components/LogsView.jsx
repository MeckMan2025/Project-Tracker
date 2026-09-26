import { Globe, Receipt, GraduationCap } from 'lucide-react'
import OutreachLog from './OutreachLog'
import ExpenseLog from './ExpenseLog'

// One page per log, chosen from the sidebar the way Data's pages are. The
// shape is here; what fills each one hasn't been decided yet, so each says so
// plainly rather than showing an empty table and looking broken.
export const LOGS = [
  { id: 'logs-outreach', label: 'Outreach', icon: Globe,
    blurb: 'Events, demos and the people reached at them.' },
  { id: 'logs-expenses', label: 'Expenses', icon: Receipt,
    blurb: 'What was spent, on what, and who approved it.' },
  { id: 'logs-mentor',   label: 'Mentor',   icon: GraduationCap,
    blurb: 'Time mentors put in and what they helped with.' },
]

export default function LogsView({ log }) {
  const active = LOGS.find(l => l.id === log) || LOGS[0]
  const Icon = active.icon

  // The two that are built bring their own page. Mentor is still a placeholder.
  if (active.id === 'logs-outreach') return <OutreachLog />
  if (active.id === 'logs-expenses') return <ExpenseLog />

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="px-4 py-3 ml-14">
          <h1 className="text-xl font-bold bg-gradient-to-r from-pastel-blue-dark via-pastel-pink-dark to-pastel-orange-dark bg-clip-text text-transparent">
            {active.label} Log
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">{active.blurb}</p>
        </div>
      </header>

      <main className="flex-1 p-4 overflow-y-auto">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
            <Icon size={36} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">
              Nothing in the {active.label.toLowerCase()} log yet.
            </p>
            <p className="text-sm text-gray-400 mt-1 max-w-sm mx-auto">
              This log is set up and ready — it just needs to be told what to
              keep track of.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
