import { useState, useEffect, useRef } from 'react'
import { Bell } from 'lucide-react'
import { supabase } from '../supabase'
import { useUser } from '../contexts/UserContext'

export default function NotificationBell() {
  const { user } = useUser()
  const [notifications, setNotifications] = useState([])
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  const unreadCount = notifications.filter(n => !n.read).length

  // Load notifications
  useEffect(() => {
    if (!user) return
    async function load() {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20)
      if (data) setNotifications(data)
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
        // Show foreground browser notification if permission granted
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
    await supabase.from('notifications').update({ read: true }).eq('id', id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }

  const markAllRead = async () => {
    const unread = notifications.filter(n => !n.read)
    if (unread.length === 0) return
    await Promise.all(unread.map(n =>
      supabase.from('notifications').update({ read: true }).eq('id', n.id)
    ))
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  const clearAll = async () => {
    if (notifications.length === 0) return
    await Promise.all(notifications.map(n =>
      supabase.from('notifications').delete().eq('id', n.id)
    ))
    setNotifications([])
  }

  const formatTime = (ts) => {
    const d = new Date(ts)
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(prev => !prev)}
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
        <div className="absolute right-0 top-full mt-2 w-80 max-h-96 overflow-y-auto bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200 z-50">
          <div className="p-3 border-b border-gray-100 flex items-center justify-between">
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
      )}
    </div>
  )
}
