import { useState, useEffect } from 'react'
import { Check, X, Clock, Bell, History, Trash2 } from 'lucide-react'
import { supabase } from '../supabase'
import { useUser } from '../contexts/UserContext'
import { usePermissions } from '../hooks/usePermissions'
import NotificationBell from './NotificationBell'
import { usePendingRequests } from '../hooks/usePendingRequests'
import { useToast } from './ToastProvider'

function RequestsView({ tabs = [] }) {
  const { username, user } = useUser()
  const { canReviewRequests, hasLeadTag } = usePermissions()
  const { requests, handleApprove, handleDeny, handleRemind } = usePendingRequests()
  const { addToast } = useToast()
  const [tab, setTab] = useState('pending')
  const [history, setHistory] = useState([])
  const [remindingId, setRemindingId] = useState(null)

  const sectionColors = [
    { border: 'border-pastel-blue', text: 'text-pastel-blue-dark' },
    { border: 'border-pastel-pink', text: 'text-pastel-pink-dark' },
    { border: 'border-pastel-orange', text: 'text-pastel-orange-dark' },
    { border: 'border-purple-300', text: 'text-purple-600' },
    { border: 'border-amber-300', text: 'text-amber-600' },
  ]

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  // Load history (approved + denied) via direct fetch
  useEffect(() => {
    async function loadHistory() {
      try {
        let url = `${supabaseUrl}/rest/v1/requests?status=in.(approved,denied)&order=created_at.desc&limit=50&select=*`
        // Teammates only see their own history
        if (!canReviewRequests && user) {
          url += `&requested_by_user_id=eq.${user.id}`
        }
        const res = await fetch(url, {
          headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
        })
        if (res.ok) setHistory(await res.json())
      } catch (err) {
        console.error('Failed to load request history:', err)
      }
    }
    loadHistory()
  }, [requests, canReviewRequests, user])

  // Filter pending requests for teammates (only their own)
  const visibleRequests = canReviewRequests
    ? requests
    : requests.filter(r => r.requested_by_user_id === user?.id || r.requested_by === username)

  const formatDate = (timestamp) => {
    if (!timestamp) return ''
    const date = new Date(timestamp)
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  }

  const onRemind = async (r) => {
    setRemindingId(r.id)
    const result = await handleRemind(r)
    setRemindingId(null)
    if (result.success) {
      addToast('Reminder sent to approvers', 'success')
    } else {
      addToast(result.error || 'Failed to send reminder', 'error')
    }
  }

  const handleDeleteHistory = async (id) => {
    setHistory(prev => prev.filter(r => r.id !== id))
    try {
      await fetch(`${supabaseUrl}/rest/v1/requests?id=eq.${id}`, {
        method: 'DELETE',
        headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` },
      })
    } catch (err) {
      console.error('Failed to delete request:', err)
    }
  }

  const renderRequestCard = (r, { showActions = false, showStatus = false }) => {
    const boardTabs = tabs.filter(t => !t.type)
    const boardName = (id) => {
      const b = boardTabs.find(t => t.id === id)
      return b ? b.name : (id ? id.charAt(0).toUpperCase() + id.slice(1) : '')
    }

    return (
      <div key={r.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              {showStatus && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  r.status === 'approved'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-600'
                }`}>
                  {r.status === 'approved' ? 'Approved' : 'Denied'}
                </span>
              )}
              {r.type === 'role_request' && (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-purple-100 text-purple-700">
                  Role Request
                </span>
              )}
              {r.type === 'leave_task' && (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700">
                  Leave Task
                </span>
              )}
              {r.board_id && (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-pastel-blue/30 text-pastel-blue-dark">
                  {boardName(r.board_id)}
                </span>
              )}
              <span className="text-xs text-gray-400">{formatDate(r.created_at)}</span>
            </div>
            <p className="text-sm font-semibold text-gray-700">
              {r.type === 'role_request'
                ? `Requesting "${r.data?.role}" role`
                : (r.data?.title || r.data?.name)}
            </p>
            {r.data?.description && (
              <p className="text-xs text-gray-500 mt-0.5">{r.data.description}</p>
            )}
            {r.type === 'calendar_event' && r.data?.event_type && r.data.event_type !== 'other' && (
              <p className="text-xs text-gray-400 mt-0.5 capitalize">Type: {r.data.event_type}</p>
            )}
            <p className="text-xs text-gray-400 mt-1">
              Requested by <span className="font-medium text-pastel-pink-dark">{r.requested_by}</span>
            </p>
            {showStatus && r.reviewed_by && (
              <p className="text-xs text-gray-400">
                Reviewed by <span className="font-medium">{r.reviewed_by}</span>
                {r.reviewed_at && <> on {formatDate(r.reviewed_at)}</>}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1 shrink-0">
            {showActions && canReviewRequests && (
              <div className="flex gap-1">
                <button
                  onClick={() => handleApprove(r)}
                  className="p-2 rounded-lg bg-green-50 hover:bg-green-100 text-green-600 transition-colors"
                  title="Approve"
                >
                  <Check size={18} />
                </button>
                <button
                  onClick={() => handleDeny(r)}
                  className="p-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 transition-colors"
                  title="Deny"
                >
                  <X size={18} />
                </button>
              </div>
            )}
            {showActions && r.requested_by === username && !canReviewRequests && (
              <button
                onClick={() => onRemind(r)}
                disabled={remindingId === r.id}
                className="flex items-center gap-1 p-2 rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-500 transition-colors disabled:opacity-50 text-xs"
                title="Remind approvers"
              >
                <Bell size={14} />
                <span className="hidden sm:inline">Remind</span>
              </button>
            )}
            {showStatus && canReviewRequests && (
              <button
                onClick={() => handleDeleteHistory(r.id)}
                className="p-2 rounded-lg hover:bg-red-50 transition-colors shrink-0"
                title="Delete"
              >
                <Trash2 size={16} className="text-gray-400 hover:text-red-400" />
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  const sections = [
    { key: 'tasks', label: 'Tasks' },
    { key: 'boards', label: 'Boards' },
    { key: 'calendar', label: 'Calendar' },
    { key: 'roles', label: 'Role Requests' },
    { key: 'leave_tasks', label: 'Leave Task Requests' },
  ]

  const groupRequests = (items) => {
    const groups = { tasks: [], boards: [], calendar: [], roles: [], leave_tasks: [] }
    items.forEach(r => {
      if (r.type === 'task') groups.tasks.push(r)
      else if (r.type === 'board') groups.boards.push(r)
      else if (r.type === 'role_request') groups.roles.push(r)
      else if (r.type === 'leave_task') groups.leave_tasks.push(r)
      else groups.calendar.push(r)
    })
    return groups
  }

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="py-4 px-4 flex items-center">
          <div className="w-10 shrink-0" />
          <div className="flex-1 text-center">
            <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-pastel-blue-dark via-pastel-pink-dark to-pastel-orange-dark bg-clip-text text-transparent">
              Requests
            </h1>
            <p className="text-sm text-gray-500">
              {canReviewRequests ? 'Review and approve requests' : 'Track your requests'}
            </p>
          </div>
          <NotificationBell />
        </div>
        <div className="flex border-t">
          <button
            onClick={() => setTab('pending')}
            className={`flex-1 py-2 text-sm font-medium transition-colors flex items-center justify-center gap-1 ${
              tab === 'pending'
                ? 'text-pastel-pink-dark border-b-2 border-pastel-pink-dark'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Clock size={14} />
            Pending ({visibleRequests.length})
          </button>
          <button
            onClick={() => setTab('history')}
            className={`flex-1 py-2 text-sm font-medium transition-colors flex items-center justify-center gap-1 ${
              tab === 'history'
                ? 'text-pastel-pink-dark border-b-2 border-pastel-pink-dark'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <History size={14} />
            History
          </button>
        </div>
      </header>

      <main className="flex-1 p-4 overflow-y-auto">
        <div className="max-w-2xl mx-auto space-y-3">
          {tab === 'pending' ? (
            (() => {
              const groups = groupRequests(visibleRequests)
              return sections.map((section, idx) => {
                const items = groups[section.key] || []
                const color = sectionColors[idx % sectionColors.length]
                return (
                  <div key={section.key}>
                    {idx > 0 && (
                      <hr className="my-4 border-t border-gray-200" />
                    )}
                    <div className="space-y-2">
                      <h2 className={`text-lg font-bold ${color.text} mb-3 border-b-2 ${color.border} pb-2`}>
                        {section.label}
                      </h2>
                      {items.length === 0 ? (
                        <p className="text-sm text-gray-400 pb-2">No pending requests</p>
                      ) : (
                        items.map(r => renderRequestCard(r, { showActions: true }))
                      )}
                    </div>
                  </div>
                )
              })
            })()
          ) : (
            (() => {
              const groups = groupRequests(history)
              return sections.map((section, idx) => {
                const items = groups[section.key] || []
                const color = sectionColors[idx % sectionColors.length]
                return (
                  <div key={section.key}>
                    {idx > 0 && (
                      <hr className="my-4 border-t border-gray-200" />
                    )}
                    <div className="space-y-2">
                      <h2 className={`text-lg font-bold ${color.text} mb-3 border-b-2 ${color.border} pb-2`}>
                        {section.label}
                      </h2>
                      {items.length === 0 ? (
                        <p className="text-sm text-gray-400 pb-2">No history</p>
                      ) : (
                        items.map(r => renderRequestCard(r, { showStatus: true }))
                      )}
                    </div>
                  </div>
                )
              })
            })()
          )}
        </div>
      </main>
    </div>
  )
}

export default RequestsView
