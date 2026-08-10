import { useState } from 'react'
import NotificationBell from './NotificationBell'
import RoleDashboard from './RoleDashboard'
import { useRoleTrackers } from '../hooks/useRoleTrackers'
import { usePermissions } from '../hooks/usePermissions'
import { useUser } from '../contexts/UserContext'
import { DASHBOARD_ROLES, SIDE_THEME, sideForRole } from '../data/roleTrackers'

// RoleSpec — one Data subtab holding every role's PUBLIC trackers, with the
// roles as pills inside. People with the role (or leads) can edit; others view.
export default function RoleSpec() {
  const [role, setRole] = useState(DASHBOARD_ROLES[0].role)
  const { trackers, loading, upsertTracker, removeTracker } = useRoleTrackers()
  const { hasLeadTag } = usePermissions()
  const { functionTags } = useUser()
  const canManage = hasLeadTag || (functionTags || []).includes(role)

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="px-4 py-3 pl-14 md:pl-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-pastel-blue-dark via-pastel-pink-dark to-pastel-orange-dark bg-clip-text text-transparent">
              RoleSpec
            </h1>
            <p className="text-sm text-gray-500">Public trackers by role</p>
          </div>
          <NotificationBell />
        </div>
        {/* Role pills */}
        <div className="px-4 pb-2 pl-14 md:pl-4 flex gap-1.5 overflow-x-auto">
          {DASHBOARD_ROLES.map(({ role: r }) => {
            const theme = SIDE_THEME[sideForRole(r)]
            const active = role === r
            return (
              <button
                key={r}
                onClick={() => setRole(r)}
                className={`px-3 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition-colors ${active ? `${theme.chip} ring-2 ring-offset-1 ${theme.ring}` : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
              >
                {r}
              </button>
            )
          })}
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
