import { useState } from 'react'
import { LayoutDashboard, ChevronDown } from 'lucide-react'
import RoleDashboard from './RoleDashboard'
import FinanceDashboard from './FinanceDashboard'
import CommsDashboard from './CommsDashboard'
import RobotDashboard from './RobotDashboard'
import SoftwareDashboard from './SoftwareDashboard'
import { useRoleTrackers } from '../hooks/useRoleTrackers'
import { useRobotStatus } from '../hooks/useRobotStatus'
import { useSoftwareStatus } from '../hooks/useSoftwareStatus'
import { useFinanceLedger } from '../hooks/useFinanceLedger'
import { useCommsBoard } from '../hooks/useCommsBoard'
import { useUser } from '../contexts/UserContext'
import { usePermissions } from '../hooks/usePermissions'
import { ROLE_NAMES, SIDE_THEME, sideForRole } from '../data/roleTrackers'

const money = (n) => '$' + (Number(n) || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })

// The Home dashboard. Each board is a collapsible section: boards for roles you
// actually HOLD start open; division-oversight boards (leads) start collapsed
// to one quiet row, so a lead's Home is a short list instead of a wall.
// Collapsed sections don't mount their board at all — no fetches, no weight.
// Open/closed choice is remembered per section.

const HARDWARE = ['CAD', 'Assembly/Building', 'Wiring']

function Section({ id, title, emoji, side, defaultOpen, summary, children }) {
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
        <span className="shrink-0 text-xs font-bold uppercase tracking-[0.12em] text-gray-600 group-hover:text-gray-800">
          {emoji} {title}
        </span>
        {/* The row carries the board's key figures, so collapsed is still
            informative — expanding is only for working in it. */}
        {!open && summary && (
          <span className="flex-1 min-w-0 text-right text-[11px] text-gray-400 truncate">{summary}</span>
        )}
      </button>
      {open && <div className="mt-2 mb-1">{children}</div>}
    </section>
  )
}

export default function MyDashboard() {
  const { trackers, loading, upsertTracker, removeTracker } = useRoleTrackers()
  const { robot } = useRobotStatus()
  const { software } = useSoftwareStatus()
  const { ledger } = useFinanceLedger()
  const { board: comms } = useCommsBoard()
  const { functionTags } = useUser()
  const { businessDivisionAccess, hardwareDivisionAccess, softwareDivisionAccess } = usePermissions()

  // One-line summaries for collapsed rows — same data the boards render.
  const tv = (id) => trackers.find(t => t.id === id)?.value ?? 0
  const robotReady = (robot.subsystems || []).filter(s => s.status === 'ready').length
  const robotSummary = `${robotReady}/${(robot.subsystems || []).length} ready${(robot.blocked || []).length ? ` · ${(robot.blocked || []).length} blocked` : ''}`
  const swBugs = (software.bugs || []).length
  const swTasks = (software.tasks || []).filter(t => !t.done).length
  const softwareSummary = `${(software.systems || []).filter(s => s.status === 'ready').length}/${(software.systems || []).length} ready · ${swTasks} tasks${swBugs ? ` · ${swBugs} bugs` : ''}`
  const finTx = ledger.transactions || []
  const finBalance = (Number(ledger.startingBalance) || 0)
    + finTx.filter(t => t.kind === 'income').reduce((a, t) => a + (Number(t.amount) || 0), 0)
    - finTx.filter(t => t.kind === 'expense').reduce((a, t) => a + (Number(t.amount) || 0), 0)
  const financeSummary = `${money(finBalance)} balance · ${(ledger.upcoming || []).filter(u => !u.done).length} upcoming`
  const commsSummary = `${(comms.queue || []).filter(q => !q.done).length} to announce · ${(comms.drafts || []).filter(d => d.status === 'pending').length} drafts waiting`
  const outreachSummary = `${tv('out-events')} events · ${tv('out-reached')} reached`
  const scoutingSummary = `${tv('sco-teams')} teams · ${tv('sco-matches')} matches`
  const summaries = {
    robot: robotSummary, Programming: softwareSummary, Finance: financeSummary,
    Communications: commsSummary, Outreach: outreachSummary, Scouting: scoutingSummary,
  }

  const ownRoles = (functionTags || []).filter(t => ROLE_NAMES.includes(t))
  const own = new Set(ownRoles)

  // Everything this person can see: own roles + division oversight.
  const visible = new Set([
    ...ownRoles,
    ...(businessDivisionAccess ? ['Communications', 'Finance', 'Outreach'] : []),
    ...(hardwareDivisionAccess ? ['CAD'] : []),
    ...(softwareDivisionAccess ? ['Programming', 'Scouting'] : []),
  ])
  if (visible.size === 0) return null

  const hasHardware = [...visible].some(r => HARDWARE.includes(r))
  const ownsHardware = ownRoles.some(r => HARDWARE.includes(r))

  // Sections in a stable order; open by default only for roles you hold.
  const sections = []
  if (hasHardware) {
    sections.push({
      id: 'robot', title: 'Robot', emoji: '🤖', side: 'hardware', defaultOpen: ownsHardware, summary: summaries.robot,
      body: <RobotDashboard editable />,
    })
  }
  for (const role of ['Programming', 'Scouting', 'Communications', 'Finance', 'Outreach']) {
    if (!visible.has(role)) continue
    const defaultOpen = own.has(role)
    if (role === 'Finance') {
      sections.push({ id: role, title: 'Finance', emoji: '💵', side: 'business', defaultOpen, summary: summaries[role], body: <FinanceDashboard editable /> })
    } else if (role === 'Communications') {
      sections.push({ id: role, title: 'Communications', emoji: '📣', side: 'business', defaultOpen, summary: summaries[role], body: <CommsDashboard editable /> })
    } else if (role === 'Programming') {
      sections.push({ id: role, title: 'Software', emoji: '💻', side: 'software', defaultOpen, summary: summaries[role], body: <SoftwareDashboard editable /> })
    } else {
      sections.push({
        id: role, title: role, emoji: role === 'Outreach' ? '🎪' : '🔍', side: sideForRole(role), defaultOpen, summary: summaries[role],
        body: loading
          ? <p className="text-sm text-gray-400 animate-pulse">Loading…</p>
          : <RoleDashboard role={role} trackers={trackers} upsertTracker={upsertTracker} removeTracker={removeTracker} editable />,
      })
    }
  }

  return (
    <div className="bg-white rounded-2xl border-2 border-gray-200 shadow-sm p-4">
      <div className="flex items-center gap-2 mb-2">
        <LayoutDashboard size={16} className="text-gray-400" />
        <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-gray-500">My Dashboard</h2>
      </div>
      <div className="divide-y divide-gray-100">
        {sections.map(s => (
          <Section key={s.id} id={s.id} title={s.title} emoji={s.emoji} side={s.side} defaultOpen={s.defaultOpen} summary={s.summary}>
            {s.body}
          </Section>
        ))}
      </div>
    </div>
  )
}
