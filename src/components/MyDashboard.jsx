import { useState } from 'react'
import { LayoutDashboard, ChevronDown } from 'lucide-react'
import MeetingRecorder from './MeetingRecorder'
import { usePermissions } from '../hooks/usePermissions'
import { SIDE_THEME } from '../data/roleTrackers'

// The Home dashboard. The per-role boards (Robot, Software, Scouting, Comms,
// Finance, Outreach) are parked while those role experiences are unfinished —
// the components still exist and render under RoleSpec, they're just not shown
// on Home. What remains is the meeting recorder, for Project Managers and
// co-founders (canRunMeetings).

function Section({ id, title, emoji, side, defaultOpen, children }) {
  const [open, setOpen] = useState(() => {
    const saved = localStorage.getItem(`mydash-open-${id}`)
    return saved === null ? defaultOpen : saved === 'true'
  })
  const theme = SIDE_THEME[side]
  const toggle = () => {
    setOpen(o => {
      localStorage.setItem(`mydash-open-${id}`, String(!o))
      return !o
    })
  }
  return (
    <section className="py-1.5">
      <button onClick={toggle} className="w-full flex items-center gap-2 py-1 group">
        <ChevronDown size={15} className={`text-gray-400 transition-transform ${open ? '' : '-rotate-90'}`} />
        <span className={`w-1 h-4 rounded-full ${theme.dot}`} />
        <span className="text-xs font-bold uppercase tracking-[0.12em] text-gray-600 group-hover:text-gray-800">
          {emoji} {title}
        </span>
      </button>
      {open && <div className="mt-2 mb-1">{children}</div>}
    </section>
  )
}

export default function MyDashboard() {
  const { canRunMeetings } = usePermissions()

  // Nothing to show for anyone who can't run meetings.
  if (!canRunMeetings) return null

  return (
    <div className="bg-white rounded-2xl border-2 border-gray-200 shadow-sm p-4">
      <div className="flex items-center gap-2 mb-2">
        <LayoutDashboard size={16} className="text-gray-400" />
        <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-gray-500">My Dashboard</h2>
      </div>
      <div className="divide-y divide-gray-100">
        <Section id="meetings" title="Meetings" emoji="🎙️" side="hardware" defaultOpen>
          <MeetingRecorder />
        </Section>
      </div>
    </div>
  )
}
