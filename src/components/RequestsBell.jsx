import { useState, useEffect, useRef } from 'react'
import { Inbox, Check, X } from 'lucide-react'
import { useUser } from '../contexts/UserContext'
import { usePermissions } from '../hooks/usePermissions'
import { usePendingRequests } from '../hooks/usePendingRequests'

// Sits next to the notification bell with its own dropdown. Requests are read
// and acted on here rather than on a full screen.
//
// Approve/deny come from usePendingRequests — the same hook the full Requests
// view uses — so approving keeps its real side effects instead of getting a
// second implementation that only flips a status.
export default function RequestsBell() {
  const { user, username } = useUser()
  const { canReviewRequests, outreachEventRequestsOnly, isGuest } = usePermissions()
  const { requests, handleApprove, handleDeny } = usePendingRequests()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  if (isGuest) return null

  // Leads see everything pending, everyone else only their own, and Outreach
  // only event requests.
  const mine = (requests || [])
    .filter(r => canReviewRequests || r.requested_by_user_id === user?.id || r.requested_by === username)
    .filter(r => !outreachEventRequestsOnly || r.type === 'calendar_event')

  const label = (r) =>
    r.type === 'role_request'
      ? `Requesting "${r.data?.role}" role`
      : (r.data?.title || r.data?.name || 'Request')

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(prev => !prev)}
        className="relative p-2 rounded-lg hover:bg-pastel-blue/30 transition-colors"
        title="Requests"
      >
        <Inbox size={20} className="text-gray-600" />
        {mine.length > 0 && (
          <span className="absolute -top-1 -right-1 bg-pastel-pink-dark text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
            {mine.length}
          </span>
        )}
      </button>

      {open && (
        <>
          <div
            className="sm:hidden fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
            onClick={() => setOpen(false)}
          />
          <div className="
            fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-md max-h-[80vh]
            sm:absolute sm:left-auto sm:top-full sm:translate-x-0 sm:translate-y-0 sm:right-0 sm:mt-2 sm:w-80 sm:max-h-96
            overflow-y-auto bg-white rounded-xl shadow-2xl border border-gray-200 z-50
          ">
            <div className="p-3 border-b border-gray-100 sticky top-0 bg-white">
              <h3 className="text-sm font-semibold text-gray-700">Requests</h3>
            </div>

            {mine.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-400">
                No pending requests
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {mine.map(r => (
                  <div key={r.id} className="p-3 flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-700 truncate">{label(r)}</p>
                      {r.data?.description && (
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{r.data.description}</p>
                      )}
                      <p className="text-[10px] text-gray-400 mt-1">
                        {String(r.type).replace(/_/g, ' ')} · {r.requested_by}
                      </p>
                    </div>
                    {canReviewRequests ? (
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => handleApprove(r)} title="Approve" className="p-1.5 rounded-lg hover:bg-green-50">
                          <Check size={15} className="text-green-500" />
                        </button>
                        <button onClick={() => handleDeny(r)} title="Deny" className="p-1.5 rounded-lg hover:bg-red-50">
                          <X size={15} className="text-red-400" />
                        </button>
                      </div>
                    ) : (
                      <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700">
                        Pending
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
