import { useState, useEffect, useRef } from 'react'
import { Bell, Inbox } from 'lucide-react'
import { supabase } from '../supabase'
import { useUser } from '../contexts/UserContext'
import NotificationPopup from './NotificationPopup'
import { useRequestsPanel } from '../hooks/useRequestsPanel'

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
  const { user } = useUser()
  const { pendingCount, panel: requestsPanel } = useRequestsPanel()
  const [showRequests, setShowRequests] = useState(false)
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
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-semibold text-gray-700">
                {showRequests ? 'Requests' : 'Notifications'}
              </h3>
              {/* Requests live in this same box — the icon swaps what the panel
                  below shows rather than opening a screen. */}
              <button
                onClick={() => setShowRequests(v => !v)}
                title={showRequests ? 'Back to notifications' : 'Requests'}
                className={`relative p-1 rounded-lg transition-colors ${showRequests ? 'bg-pastel-pink/40' : 'hover:bg-gray-100'}`}
              >
                <Inbox size={14} className="text-gray-500" />
                {pendingCount > 0 && !showRequests && (
                  <span className="absolute -top-1 -right-1 bg-pastel-pink-dark text-white text-[9px] font-bold rounded-full min-w-[14px] h-[14px] flex items-center justify-center px-0.5">
                    {pendingCount}
                  </span>
                )}
              </button>
            </div>
            <div className="flex items-center gap-2">
              {!showRequests && unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs text-pastel-blue-dark hover:underline"
                >
                  Mark all read
                </button>
              )}
              {!showRequests && notifications.length > 0 && (
                <button
                  onClick={clearAll}
                  className="text-xs text-red-400 hover:underline"
                >
                  Clear all
                </button>
              )}
            </div>
          </div>

          {showRequests ? requestsPanel : (
          <>
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
          </>
          )}
          </div>
        </>
      )}
    </div>
  )
}
