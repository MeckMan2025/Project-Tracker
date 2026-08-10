import NotificationBell from './NotificationBell'
import RoleDashboard from './RoleDashboard'
import { useRoleTrackers } from '../hooks/useRoleTrackers'
import { usePermissions } from '../hooks/usePermissions'
import { useUser } from '../contexts/UserContext'
import { SIDE_THEME, sideForRole } from '../data/roleTrackers'

// A single role's public trackers, opened from the Data sidebar subtab.
export default function RoleDataView({ role }) {
  const { trackers, loading, upsertTracker, removeTracker } = useRoleTrackers()
  const { hasLeadTag } = usePermissions()
  const { functionTags } = useUser()
  const canManage = hasLeadTag || (functionTags || []).includes(role)
  const theme = SIDE_THEME[sideForRole(role)]

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="px-4 py-4 pl-14 md:pl-4 flex items-center justify-between">
          <div>
            <h1 className={`text-xl md:text-2xl font-black ${theme.text}`}>{role}</h1>
            <p className="text-sm text-gray-500">Public trackers · everyone can see</p>
          </div>
          <NotificationBell />
        </div>
      </header>
      <main className="flex-1 overflow-y-auto p-4">
        <div className="max-w-5xl mx-auto">
          {loading ? (
            <p className="text-center text-gray-400 mt-10 animate-pulse">Loading…</p>
          ) : (
            <RoleDashboard
              role={role}
              trackers={trackers}
              upsertTracker={upsertTracker}
              removeTracker={removeTracker}
              editable={canManage}
              publicOnly
            />
          )}
        </div>
      </main>
    </div>
  )
}
