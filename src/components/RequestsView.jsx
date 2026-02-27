import { useState, useEffect } from 'react'
import { Check, X, Bell, Trash2 } from 'lucide-react'
import { supabase } from '../supabase'
import { useUser } from '../contexts/UserContext'
import { usePermissions } from '../hooks/usePermissions'
import NotificationBell from './NotificationBell'
import { usePendingRequests } from '../hooks/usePendingRequests'
import { useToast } from './ToastProvider'

const typeCategories = [
  { key: 'task', label: 'Task Requests', border: 'border-pastel-pink', text: 'text-pastel-pink-dark' },
  { key: 'board', label: 'Board Requests', border: 'border-pastel-blue', text: 'text-pastel-blue-dark' },
  { key: 'calendar_event', label: 'Calendar Events', border: 'border-pastel-orange', text: 'text-pastel-orange-dark' },
  { key: 'role_request', label: 'Role Requests', border: 'border-purple-300', text: 'text-purple-600' },
  { key: 'leave_task', label: 'Leave Task Requests', border: 'border-amber-300', text: 'text-amber-600' },
]

function RequestsView({ tabs = [] }) {
  const { username, user } = useUser()
  const { canReviewRequests, hasLeadTag } = usePermissions()
  const { requests, handleApprove, handleDeny, handleRemind } = usePendingRequests()
  const { addToast } = useToast()
  const [history, setHistory] = useState([])
  const [remindingId, setRemindingId] = useState(null)
  const [filter, setFilter] = useState('all') // 'all' | 'pending' | 'history'

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

  // Combine and filter based on toggle
  const filteredRequests = filter === 'pending'
    ? visibleRequests
    : filter === 'history'
    ? history
    : [...visibleRequests, ...history]

  const totalRequests = filteredRequests.length

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

  const renderRequestCard = (r) => {
    const boardTabs = tabs.filter(t => !t.type)
    const boardName = (id) => {
      const b = boardTabs.find(t => t.id === id)
      return b ? b.name : (id ? id.charAt(0).toUpperCase() + id.slice(1) : '')
    }
    const isPending = r.status === 'pending'

    return (
      <div
        key={r.id}
        className={`bg-white rounded-lg p-3 shadow-sm border-l-4 shrink-0 w-[260px] snap-center ${
          isPending ? 'border-l-amber-400' : r.status === 'approved' ? 'border-l-green-400' : 'border-l-red-400'
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                isPending
                  ? 'bg-amber-100 text-amber-700'
                  : r.status === 'approved'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-red-100 text-red-600'
              }`}>
                {isPending ? 'Pending' : r.status === 'approved' ? 'Approved' : 'Denied'}
              </span>
              {r.board_id && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-pastel-blue/30 text-pastel-blue-dark">
                  {boardName(r.board_id)}
                </span>
              )}
            </div>
            <p className="text-sm font-semibold text-gray-700 truncate">
              {r.type === 'role_request'
                ? `Requesting "${r.data?.role}" role`
                : (r.data?.title || r.data?.name)}
            </p>
            {r.data?.description && (
              <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{r.data.description}</p>
            )}
            {r.type === 'calendar_event' && r.data?.event_type && r.data.event_type !== 'other' && (
              <p className="text-[10px] text-gray-400 mt-0.5 capitalize">Type: {r.data.event_type}</p>
            )}
            <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-1">
              <span>By <span className="font-medium text-pastel-pink-dark">{r.requested_by}</span></span>
              <span>{formatDate(r.created_at)}</span>
            </div>
            {!isPending && r.reviewed_by && (
              <p className="text-[10px] text-gray-400 mt-0.5">
                Reviewed by <span className="font-medium">{r.reviewed_by}</span>
                {r.reviewed_at && <> on {formatDate(r.reviewed_at)}</>}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1 shrink-0">
            {isPending && canReviewRequests && (
              <div className="flex gap-1">
                <button
                  onClick={() => handleApprove(r)}
                  className="p-1.5 rounded-lg bg-green-50 hover:bg-green-100 text-green-600 transition-colors"
                  title="Approve"
                >
                  <Check size={14} />
                </button>
                <button
                  onClick={() => handleDeny(r)}
                  className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 transition-colors"
                  title="Deny"
                >
                  <X size={14} />
                </button>
              </div>
            )}
            {isPending && r.requested_by === username && !canReviewRequests && (
              <button
                onClick={() => onRemind(r)}
                disabled={remindingId === r.id}
                className="p-1.5 rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-500 transition-colors disabled:opacity-50"
                title="Remind approvers"
              >
                <Bell size={14} />
              </button>
            )}
            {!isPending && canReviewRequests && (
              <button
                onClick={() => handleDeleteHistory(r.id)}
                className="p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                title="Delete"
              >
                <Trash2 size={14} className="text-gray-400 hover:text-red-400" />
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="px-4 py-4 pl-14 md:pl-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-pastel-blue-dark via-pastel-pink-dark to-pastel-orange-dark bg-clip-text text-transparent">
              Requests
            </h1>
            <p className="text-sm text-gray-500">
              {totalRequests} request{totalRequests !== 1 ? 's' : ''}{' '}
              {filter === 'pending' ? 'pending' : filter === 'history' ? 'in history' : 'total'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-gray-100 rounded-lg p-0.5">
              {[
                { key: 'all', label: 'All' },
                { key: 'pending', label: 'Pending' },
                { key: 'history', label: 'History' },
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    filter === f.key ? 'bg-white text-gray-700 shadow-sm' : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <NotificationBell />
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 overflow-y-auto">
        {totalRequests === 0 ? (
          <div className="flex items-center justify-center h-[60vh]">
            <p className="text-gray-400">No {filter === 'pending' ? 'pending ' : filter === 'history' ? 'past ' : ''}requests</p>
          </div>
        ) : (
          <div className="space-y-8 px-2 md:px-6">
            {typeCategories.map(cat => {
              const catRequests = filteredRequests.filter(r => r.type === cat.key)
              if (catRequests.length === 0) return null
              return (
                <div key={cat.key}>
                  <h2 className={`text-lg font-bold ${cat.text} mb-3 border-b-2 ${cat.border} pb-2`}>
                    {cat.label}
                    <span className="ml-2 text-sm font-normal text-gray-400">({catRequests.length})</span>
                  </h2>
                  <div className="flex flex-nowrap gap-3 overflow-x-auto pb-2 snap-x snap-mandatory md:snap-none">
                    {catRequests.map(r => renderRequestCard(r))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}

export default RequestsView
