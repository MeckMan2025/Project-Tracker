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
        <LayoutDashboard size={20} className="text-pastel-pink-dark" />
        <h2 className="text-lg font-black bg-gradient-to-r from-pastel-blue-dark via-pastel-pink-dark to-pastel-orange-dark bg-clip-text text-transparent">
          My Dashboard
        </h2>
        <span className="text-xs text-gray-400">{myRoles.length > 1 ? `${myRoles.length} roles` : myRoles[0]}</span>
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
