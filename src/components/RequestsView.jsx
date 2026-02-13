import { useState, useEffect } from 'react'
import { Check, X, Clock, Bell, History } from 'lucide-react'
import { supabase } from '../supabase'
import { useUser } from '../contexts/UserContext'
import { usePermissions } from '../hooks/usePermissions'
import { usePendingRequests } from '../hooks/usePendingRequests'
import { useToast } from './ToastProvider'

function RequestsView() {
  const { username, user } = useUser()
  const { isTop } = usePermissions()
  const { requests, handleApprove, handleDeny, handleRemind } = usePendingRequests()
  const { addToast } = useToast()
  const [tab, setTab] = useState('pending')
  const [history, setHistory] = useState([])
  const [remindingId, setRemindingId] = useState(null)

  // Load history (approved + denied)
  useEffect(() => {
    async function loadHistory() {
      const { data } = await supabase
        .from('requests')
        .select('*')
        .in('status', ['approved', 'denied'])
        .order('created_at', { ascending: false })
        .limit(50)
      if (data) setHistory(data)
    }
    loadHistory()
  }, [requests]) // Refresh history when pending requests change

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

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="py-4 px-4 flex items-center">
          <div className="w-10 shrink-0" />
          <div className="flex-1 text-center">
            <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-pastel-blue-dark via-pastel-pink-dark to-pastel-orange-dark bg-clip-text text-transparent">
              Requests
            </h1>
          </div>
          <div className="w-10 shrink-0" />
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
            Pending ({requests.length})
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
            <>
              {requests.length === 0 ? (
                <div className="text-center mt-20">
                  <Clock size={48} className="mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-400">No pending requests</p>
                </div>
              ) : (
                requests.map((r) => (
                  <div key={r.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            r.type === 'task'
                              ? 'bg-pastel-pink/40 text-pastel-pink-dark'
                              : 'bg-pastel-orange/40 text-pastel-orange-dark'
                          }`}>
                            {r.type === 'task' ? 'Task' : 'Calendar Event'}
                          </span>
                          <span className="text-xs text-gray-400">{formatDate(r.created_at)}</span>
                        </div>
                        <p className="text-sm font-semibold text-gray-700">
                          {r.data?.title || r.data?.name}
                        </p>
                        {r.data?.description && (
                          <p className="text-xs text-gray-500 mt-0.5">{r.data.description}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">
                          Requested by <span className="font-medium text-pastel-pink-dark">{r.requested_by}</span>
                          {r.board_id && r.type === 'task' && (
                            <> for board <span className="font-medium">{r.board_id}</span></>
                          )}
                        </p>
                      </div>
                      <div className="flex flex-col gap-1 shrink-0">
                        {isTop && (
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
                        {r.requested_by === username && (
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
                      </div>
                    </div>
                  </div>
                ))
              )}
            </>
          ) : (
            <>
              {history.length === 0 ? (
                <div className="text-center mt-20">
                  <History size={48} className="mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-400">No request history</p>
                </div>
              ) : (
                history.map((r) => (
                  <div key={r.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            r.status === 'approved'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-600'
                          }`}>
                            {r.status === 'approved' ? 'Approved' : 'Denied'}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            r.type === 'task'
                              ? 'bg-pastel-pink/40 text-pastel-pink-dark'
                              : 'bg-pastel-orange/40 text-pastel-orange-dark'
                          }`}>
                            {r.type === 'task' ? 'Task' : 'Event'}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-gray-700">
                          {r.data?.title || r.data?.name}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          Requested by <span className="font-medium">{r.requested_by}</span>
                        </p>
                        {r.reviewed_by && (
                          <p className="text-xs text-gray-400">
                            Reviewed by <span className="font-medium">{r.reviewed_by}</span>
                            {r.reviewed_at && <> on {formatDate(r.reviewed_at)}</>}
                          </p>
                        )}
                        {r.decision_reason && (
                          <p className="text-xs text-gray-500 mt-1 italic">Reason: {r.decision_reason}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}

export default RequestsView
