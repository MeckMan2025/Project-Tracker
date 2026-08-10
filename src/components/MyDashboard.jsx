import { LayoutDashboard } from 'lucide-react'
import RoleDashboard from './RoleDashboard'
import { useRoleTrackers } from '../hooks/useRoleTrackers'
import { useUser } from '../contexts/UserContext'
import { ROLE_NAMES } from '../data/roleTrackers'

// The Home dashboard — combines a dashboard for every role the current user
// holds. Shows ALL of that role's trackers (public + role-only) and lets the
// user enter data. If the user has no dashboard role, nothing renders.
export default function MyDashboard() {
  const { trackers, loading, upsertTracker, removeTracker } = useRoleTrackers()
  const { functionTags } = useUser()
  const myRoles = (functionTags || []).filter(t => ROLE_NAMES.includes(t))

  if (myRoles.length === 0) return null

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <LayoutDashboard size={16} className="text-gray-400" />
        <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-gray-500">My Dashboard</h2>
      </div>
      {loading ? (
        <p className="text-sm text-gray-400 animate-pulse">Loading trackers…</p>
      ) : (
        <div className="space-y-6">
          {myRoles.map(role => (
            <RoleDashboard
              key={role}
              role={role}
              trackers={trackers}
              upsertTracker={upsertTracker}
              removeTracker={removeTracker}
              editable
              collapsible={myRoles.length > 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}
