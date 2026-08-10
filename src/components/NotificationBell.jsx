import { useState, useEffect, useRef } from 'react'
import { Bell, Inbox, ChevronRight, Check, X } from 'lucide-react'
import { supabase } from '../supabase'
import { useUser } from '../contexts/UserContext'
import { usePermissions } from '../hooks/usePermissions'
import { usePendingRequests } from '../hooks/usePendingRequests'
import NotificationPopup from './NotificationPopup'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const restHeaders = { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }

// Shared across every mounted bell so an incoming notification only pops once.
const poppedIds = new Set()

// Ask for OS notification permission (best-effort; ignored if already decided).
function requestNotifPermission() {
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {})
    }
  } catch { /* ignore */ }
}

export default function NotificationBell() {
  const { user, username } = useUser()
  const { canReviewRequests, outreachEventRequestsOnly } = usePermissions()
  const { requests, handleApprove, handleDeny } = usePendingRequests()
  const [requestsOpen, setRequestsOpen] = useState(false)

  // What this user is allowed to see: leads get everything pending, everyone
  // else only their own, and Outreach only event requests.
  const myRequests = (requests || [])
    .filter(r => canReviewRequests || r.requested_by_user_id === user?.id || r.requested_by === username)
    .filter(r => !outreachEventRequestsOnly || r.type === 'calendar_event')
  const [popup, setPopup] = useState(null)
  const [notifications, setNotifications] = useState([])
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  const unreadCount = notifications.filter(n => !n.read).length



  // Ask for OS notification permission once so real notifications can fire.
  useEffect(() => { requestNotifPermission() }, [])

  // Load notifications via direct REST (bypasses JS client auth token issues)
  useEffect(() => {
    if (!user) return
    async function load() {
      const res = await fetch(
        `${supabaseUrl}/rest/v1/notifications?user_id=eq.${user.id}&select=*&order=created_at.desc&limit=20`,
        { headers: restHeaders }
      )
      if (res.ok) setNotifications(await res.json())
    }
    load()
  }, [user])

  // Realtime subscription
  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel('notifications-bell')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        setNotifications(prev => {
          if (prev.some(n => n.id === payload.new.id)) return prev
          return [payload.new, ...prev].slice(0, 20)
        })
        // Pop it on screen once (cute white card + OS notification)
        if (!poppedIds.has(payload.new.id)) {
          poppedIds.add(payload.new.id)
          setPopup(payload.new)
          // Foreground OS notification if permission granted
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            try {
              new Notification(payload.new.title || 'Notification', {
                body: payload.new.body || '',
                icon: '/icon-192.png',
              })
            } catch (e) {
              // Ignore — may fail on mobile or if SW is handling it
            }
          }
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        setNotifications(prev => prev.map(n => n.id === payload.new.id ? payload.new : n))
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [user])

  // Close on outside click
  useEffect(() => {
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const markAsRead = async (id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    fetch(`${supabaseUrl}/rest/v1/notifications?id=eq.${id}`, {
      method: 'PATCH',
      headers: { ...restHeaders, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
      body: JSON.stringify({ read: true }),
    }).catch(() => {})
  }

  const markAllRead = async () => {
    const unread = notifications.filter(n => !n.read)
    if (unread.length === 0) return
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    fetch(`${supabaseUrl}/rest/v1/notifications?user_id=eq.${user.id}&read=eq.false`, {
      method: 'PATCH',
      headers: { ...restHeaders, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
      body: JSON.stringify({ read: true }),
    }).catch(() => {})
  }

  const clearAll = async () => {
    if (notifications.length === 0) return
    setNotifications([])
    fetch(`${supabaseUrl}/rest/v1/notifications?user_id=eq.${user.id}`, {
      method: 'DELETE',
      headers: restHeaders,
    }).catch(() => {})
  }

  const formatTime = (ts) => {
    const d = new Date(ts)
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  }

  return (
    <div className="relative" ref={ref}>
      <NotificationPopup notification={popup} onClose={() => setPopup(null)} />
      <button
        onClick={() => { requestNotifPermission(); setOpen(prev => !prev) }}
        className="relative p-2 rounded-lg hover:bg-pastel-blue/30 transition-colors"
        title="Notifications"
      >
        <Bell size={20} className="text-gray-600" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Mobile backdrop — blurs background, click to close */}
          <div
            className="sm:hidden fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
            onClick={() => setOpen(false)}
          />
          <div className="
            fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-md max-h-[80vh]
            sm:absolute sm:left-auto sm:top-full sm:translate-x-0 sm:translate-y-0 sm:right-0 sm:mt-2 sm:w-80 sm:max-h-96
            overflow-y-auto bg-white rounded-xl shadow-2xl border border-gray-200 z-50
          ">
          <div className="p-3 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
            <h3 className="text-sm font-semibold text-gray-700">
              Notifications
            </h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs text-pastel-blue-dark hover:underline"
                >
                  Mark all read
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={clearAll}
                  className="text-xs text-red-400 hover:underline"
                >
                  Clear all
                </button>
              )}
            </div>
          </div>

          {/* Requests lives here rather than in the nav. NotificationBell is
              rendered from ~30 places, so it fires a navigation event instead of
              taking an onTabChange prop through all of them. */}
          <button
            onClick={() => setRequestsOpen(o => !o)}
            className="w-full flex items-center gap-2 px-3 py-2.5 border-b border-gray-100 hover:bg-gray-50 transition-colors"
          >
            <Inbox size={15} className="text-pastel-pink-dark shrink-0" />
            <span className="text-sm font-medium text-gray-700 flex-1 text-left">Requests</span>
            {myRequests.length > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-pastel-pink text-gray-700">
                {myRequests.length}
              </span>
            )}
            <ChevronRight size={14} className={`text-gray-300 shrink-0 transition-transform ${requestsOpen ? 'rotate-90' : ''}`} />
          </button>

          {/* Requests are handled here rather than on a full screen. Approve and
              deny come from usePendingRequests, the same hook the old view used,
              so the side effects of approving stay in one place. */}
          {requestsOpen && (
            <div className="border-b border-gray-100 bg-gray-50/50">
              {myRequests.length === 0 ? (
                <p className="px-3 py-3 text-xs text-gray-400">No pending requests</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {myRequests.map(r => (
                    <div key={r.id} className="px-3 py-2.5 flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-700 truncate">
                          {r.type === 'role_request'
                            ? `Requesting "${r.data?.role}" role`
                            : (r.data?.title || r.data?.name || 'Request')}
                        </p>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {r.type.replace('_', ' ')} · {r.requested_by}
                        </p>
                      </div>
                      {canReviewRequests && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleApprove(r)}
                            title="Approve"
                            className="p-1 rounded hover:bg-green-50"
                          >
                            <Check size={14} className="text-green-500" />
                          </button>
                          <button
                            onClick={() => handleDeny(r)}
                            title="Deny"
                            className="p-1 rounded hover:bg-red-50"
                          >
                            <X size={14} className="text-red-400" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {notifications.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-400">
              No notifications
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {notifications.map(n => (
                <div
                  key={n.id}
                  className={`p-3 hover:bg-gray-50/50 cursor-pointer ${!n.read ? 'bg-pastel-blue/10' : ''}`}
                  onClick={() => !n.read && markAsRead(n.id)}
                >
                  <div className="flex items-start gap-2">
                    {!n.read && <span className="w-2 h-2 rounded-full bg-pastel-blue-dark mt-1.5 shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-700">{n.title}</p>
                      {n.body && <p className="text-xs text-gray-500 mt-0.5">{n.body}</p>}
                      <p className="text-[10px] text-gray-400 mt-1">{formatTime(n.created_at)}</p>
                    </div>
                  </div>
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
