import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Plus, X, Trash2, Bell } from 'lucide-react'
import { supabase } from '../supabase'
import { useUser } from '../contexts/UserContext'
import { usePermissions } from '../hooks/usePermissions'
import NotificationBell from './NotificationBell'
import { useToast } from './ToastProvider'
import { triggerPush } from '../utils/pushHelper'
import RequestsBadge from './RequestsBadge'
import RestrictedAccess from './RestrictedAccess'

const EVENT_TYPES = {
  meeting:     { label: 'Meeting',     bg: 'bg-pastel-blue/20',  dot: 'bg-pastel-blue-dark',  ring: 'ring-pastel-blue' },
  competition: { label: 'Competition', bg: 'bg-pastel-pink/20',  dot: 'bg-pastel-pink-dark',  ring: 'ring-pastel-pink' },
  other:       { label: 'Other',       bg: 'bg-pastel-orange/20', dot: 'bg-pastel-orange-dark', ring: 'ring-pastel-orange' },
}

function CalendarView() {
  const { username, user } = useUser()
  const { canEditContent, canRequestContent, canReviewRequests, isGuest } = usePermissions()
  const { addToast } = useToast()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [events, setEvents] = useState({})
  const [tasksDue, setTasksDue] = useState({})
  const [selectedDay, setSelectedDay] = useState(null)
  const [eventName, setEventName] = useState('')
  const [eventDesc, setEventDesc] = useState('')
  const [eventType, setEventType] = useState('other')
  const [notifyEnabled, setNotifyEnabled] = useState(false)
  const [notifyMessage, setNotifyMessage] = useState('')
  const [forceNotify, setForceNotify] = useState(false)

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  useEffect(() => {
    async function load() {
      try {
        let token = supabaseKey
        try {
          const { data } = await supabase.auth.getSession()
          if (data?.session?.access_token) token = data.session.access_token
        } catch (e) { /* fall back to anon key */ }

        const res = await fetch(`${supabaseUrl}/rest/v1/calendar_events?select=*&order=date_key.asc`, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${token}`,
          },
        })
        if (!res.ok) return
        const data = await res.json()
        const grouped = {}
        data.forEach(ev => {
          if (!grouped[ev.date_key]) grouped[ev.date_key] = []
          grouped[ev.date_key].push({
            id: ev.id,
            name: ev.name,
            description: ev.description,
            addedBy: ev.added_by,
            eventType: ev.event_type || 'other',
          })
        })
        setEvents(grouped)
      } catch (err) {
        console.error('Failed to load calendar events:', err)
      }
    }
    load()
  }, [])

  // Load tasks with due dates
  useEffect(() => {
    async function loadTaskDueDates() {
      try {
        const res = await fetch(`${supabaseUrl}/rest/v1/tasks?due_date=neq.&select=id,title,assignee,status,due_date,board_id`, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        })
        if (!res.ok) return
        const data = await res.json()
        const grouped = {}
        data.forEach(task => {
          if (!task.due_date) return
          const key = task.due_date
          if (!grouped[key]) grouped[key] = []
          grouped[key].push({
            id: task.id,
            title: task.title,
            assignee: task.assignee,
            status: task.status,
            boardId: task.board_id,
          })
        })
        setTasksDue(grouped)
      } catch (err) {
        console.error('Failed to load task due dates:', err)
      }
    }
    loadTaskDueDates()
  }, [])

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('calendar-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'calendar_events' }, (payload) => {
        const ev = payload.new
        setEvents(prev => {
          const key = ev.date_key
          const existing = prev[key] || []
          if (existing.some(e => e.id === ev.id)) return prev
          return {
            ...prev,
            [key]: [...existing, { id: ev.id, name: ev.name, description: ev.description, addedBy: ev.added_by, eventType: ev.event_type || 'other' }],
          }
        })
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'calendar_events' }, (payload) => {
        const deletedId = payload.old.id
        setEvents(prev => {
          const updated = {}
          for (const [key, list] of Object.entries(prev)) {
            const filtered = list.filter(e => e.id !== deletedId)
            if (filtered.length > 0) updated[key] = filtered
          }
          return updated
        })
      })
      .subscribe()

    // Listen for task changes to update due dates on calendar
    const taskChannel = supabase
      .channel('calendar-task-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          const id = payload.old.id
          setTasksDue(prev => {
            const updated = {}
            for (const [key, list] of Object.entries(prev)) {
              const filtered = list.filter(t => t.id !== id)
              if (filtered.length > 0) updated[key] = filtered
            }
            return updated
          })
        } else {
          const t = payload.new
          // Remove from old date
          setTasksDue(prev => {
            const updated = {}
            for (const [key, list] of Object.entries(prev)) {
              const filtered = list.filter(task => task.id !== t.id)
              if (filtered.length > 0) updated[key] = filtered
            }
            // Add to new date if it has a due_date
            if (t.due_date) {
              const key = t.due_date
              if (!updated[key]) updated[key] = []
              updated[key].push({
                id: t.id, title: t.title, assignee: t.assignee,
                status: t.status, boardId: t.board_id,
              })
            }
            return updated
          })
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      supabase.removeChannel(taskChannel)
    }
  }, [])

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const monthName = currentDate.toLocaleString('default', { month: 'long' })

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1))
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1))

  const dateKey = (day) => `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

  const handleAddEvent = async (e) => {
    e.preventDefault()
    if (!eventName.trim() || !selectedDay) return
    const key = dateKey(selectedDay)
    const name = eventName.trim()
    const desc = eventDesc.trim()

    if (!canEditContent) {
      // Non-lead: submit a request
      const request = {
        id: String(Date.now()) + Math.random().toString(36).slice(2),
        type: 'calendar_event',
        data: { date_key: key, name, description: desc, event_type: eventType, notify: notifyEnabled, notify_message: notifyMessage, force_notify: forceNotify },
        requested_by: username,
        requested_by_user_id: user?.id,
        status: 'pending',
      }
      setEventName('')
      setEventDesc('')
      setNotifyEnabled(false)
      setNotifyMessage('')
      setForceNotify(false)
      addToast('Request sent! A lead will review it.', 'success')
      const { error } = await supabase.from('requests').insert(request)
      if (error) console.error('Error submitting request:', error)
      return
    }

    const newEvent = {
      id: String(Date.now()),
      date_key: key,
      name,
      description: desc,
      added_by: username,
      event_type: eventType,
    }

    // Optimistic update
    setEvents(prev => ({
      ...prev,
      [key]: [...(prev[key] || []), { id: newEvent.id, name: newEvent.name, description: newEvent.description, addedBy: newEvent.added_by, eventType }],
    }))
    setEventName('')
    setEventDesc('')
    const shouldNotify = notifyEnabled
    const customMessage = notifyMessage
    const shouldForce = forceNotify
    setNotifyEnabled(false)
    setNotifyMessage('')
    setForceNotify(false)

    const { error } = await supabase.from('calendar_events').insert(newEvent)
    if (error) {
      console.error('Failed to save calendar event:', error)
      addToast('Failed to save event: ' + error.message, 'error')
      setEvents(prev => {
        const updated = { ...prev }
        updated[key] = (updated[key] || []).filter(ev => ev.id !== newEvent.id)
        if (updated[key].length === 0) delete updated[key]
        return updated
      })
    } else if (shouldNotify) {
      // Notify all team members about this event
      try {
        const { data: profiles } = await supabase.from('profiles').select('id')
        if (profiles) {
          const body = customMessage || `New event: ${name} on ${key}`
          for (const p of profiles) {
            if (p.id === user?.id) continue
            const notifRecord = {
              id: String(Date.now()) + Math.random().toString(36).slice(2) + p.id.slice(0, 4),
              user_id: p.id,
              type: 'calendar_event',
              title: `Calendar: ${name}`,
              body,
              force: shouldForce,
            }
            await supabase.from('notifications').insert(notifRecord)
            triggerPush(notifRecord)
          }
        }
      } catch (err) {
        console.error('Failed to send event notifications:', err)
      }
    }
  }

  const handleDeleteEvent = async (day, eventId) => {
    const key = dateKey(day)
    // Optimistic delete
    setEvents(prev => {
      const updated = { ...prev }
      updated[key] = (updated[key] || []).filter(ev => ev.id !== eventId)
      if (updated[key].length === 0) delete updated[key]
      return updated
    })

    const { error } = await supabase.from('calendar_events').delete().eq('id', eventId)
    if (error) console.error('Failed to delete calendar event:', error)
  }

  const today = new Date()
  const isToday = (day) =>
    today.getFullYear() === year && today.getMonth() === month && today.getDate() === day

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="px-4 py-4 flex items-center justify-between ml-10">
          <div>
            <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-pastel-blue-dark via-pastel-pink-dark to-pastel-orange-dark bg-clip-text text-transparent">
              Team Calendar
            </h1>
            <p className="text-sm text-gray-500">Meetings, competitions & more</p>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-pastel-blue/30 transition-colors">
              <ChevronLeft size={20} />
            </button>
            <span className="text-lg font-semibold text-gray-700 min-w-[160px] text-center">
              {monthName} {year}
            </span>
            <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-pastel-blue/30 transition-colors">
              <ChevronRight size={20} />
            </button>
            {canReviewRequests && <RequestsBadge type="calendar_event" />}
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 overflow-auto">
        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {dayNames.map(d => (
            <div key={d} className="text-center text-xs font-semibold text-gray-500 py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {/* Empty cells before first day */}
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} className="min-h-[80px] md:min-h-[100px] rounded-lg bg-gray-50/50" />
          ))}

          {/* Day cells */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1
            const key = dateKey(day)
            const dayEvents = events[key] || []
            const dayTasks = tasksDue[key] || []
            const selected = selectedDay === day

            return (
              <div
                key={day}
                onClick={() => setSelectedDay(selected ? null : day)}
                className={`min-h-[80px] md:min-h-[100px] rounded-lg p-1.5 cursor-pointer transition-colors border ${
                  selected
                    ? 'border-pastel-pink-dark bg-pastel-pink/20'
                    : isToday(day)
                    ? 'border-pastel-blue-dark/40 bg-white/80'
                    : 'border-transparent bg-white/50 hover:bg-white/80'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-sm font-medium ${
                      isToday(day)
                        ? 'bg-pastel-blue-dark text-white w-6 h-6 rounded-full flex items-center justify-center'
                        : 'text-gray-700'
                    }`}
                  >
                    {day}
                  </span>
                  {selected && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedDay(day)
                      }}
                      className="p-0.5 rounded hover:bg-pastel-pink/40 transition-colors"
                    >
                      <Plus size={14} className="text-pastel-pink-dark" />
                    </button>
                  )}
                </div>
                {/* Event dots/names */}
                <div className="mt-1 space-y-0.5">
                  {dayEvents.map(ev => {
                    const t = EVENT_TYPES[ev.eventType] || EVENT_TYPES.other
                    return (
                      <div
                        key={ev.id}
                        className="flex items-center gap-1 group"
                        title={ev.description || ev.name}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${t.dot} shrink-0`} />
                        <span className="text-xs text-gray-600 truncate">{ev.name}</span>
                      </div>
                    )
                  })}
                  {dayTasks.map(task => (
                    <div
                      key={task.id}
                      className="flex items-center gap-1"
                      title={`Task: ${task.title}${task.assignee ? ' (' + task.assignee + ')' : ''}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${(task.status === 'done' || task.status === 'completed') ? 'bg-green-400' : 'bg-pastel-blue-dark'}`} />
                      <span className={`text-xs truncate ${(task.status === 'done' || task.status === 'completed') ? 'text-green-600 line-through' : 'text-pastel-blue-dark'}`}>{task.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* Selected day detail panel */}
        {selectedDay && (
          <div className="mt-4 bg-white/80 backdrop-blur-sm rounded-xl shadow-sm p-4 max-w-lg mx-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-700">
                {monthName} {selectedDay}, {year}
              </h3>
              <button onClick={() => setSelectedDay(null)} className="p-1 rounded hover:bg-gray-100">
                <X size={16} className="text-gray-400" />
              </button>
            </div>

            {/* Events list */}
            {(events[dateKey(selectedDay)] || []).length > 0 && (
              <div className="space-y-2 mb-3">
                {(events[dateKey(selectedDay)] || []).map(ev => {
                  const t = EVENT_TYPES[ev.eventType] || EVENT_TYPES.other
                  return (
                  <div key={ev.id} className={`flex items-start gap-2 ${t.bg} rounded-lg px-3 py-2`}>
                    <span className={`w-2 h-2 rounded-full ${t.dot} mt-1.5 shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-700">{ev.name}</p>
                      {ev.description && (
                        <p className="text-xs text-gray-500">{ev.description}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-0.5">Added by {ev.addedBy}</p>
                    </div>
                    {canEditContent && (
                      <button
                        onClick={() => handleDeleteEvent(selectedDay, ev.id)}
                        className="p-1 rounded hover:bg-red-100 transition-colors"
                      >
                        <Trash2 size={14} className="text-red-400" />
                      </button>
                    )}
                  </div>
                  )
                })}
              </div>
            )}

            {/* Tasks due on this day */}
            {(tasksDue[dateKey(selectedDay)] || []).length > 0 && (
              <div className="space-y-2 mb-3">
                <p className="text-xs font-semibold text-pastel-blue-dark uppercase tracking-wide">Tasks Due</p>
                {(tasksDue[dateKey(selectedDay)] || []).map(task => (
                  <div key={task.id} className={`flex items-start gap-2 rounded-lg px-3 py-2 ${(task.status === 'done' || task.status === 'completed') ? 'bg-green-50' : 'bg-pastel-blue/20'}`}>
                    <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${(task.status === 'done' || task.status === 'completed') ? 'bg-green-400' : 'bg-pastel-blue-dark'}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${(task.status === 'done' || task.status === 'completed') ? 'text-green-700 line-through' : 'text-gray-700'}`}>{task.title}</p>
                      {task.assignee && (
                        <p className="text-xs text-gray-400 mt-0.5">Assigned to {task.assignee}</p>
                      )}
                      <p className="text-xs text-gray-400">{(task.status === 'done' || task.status === 'completed') ? 'Completed' : task.status === 'todo' ? 'To Do' : task.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {(events[dateKey(selectedDay)] || []).length === 0 && (tasksDue[dateKey(selectedDay)] || []).length === 0 && (
              <p className="text-sm text-gray-400 mb-3">No events or tasks on this day.</p>
            )}

            {/* Add/Request event form — hidden for guests */}
            {!isGuest && <form onSubmit={handleAddEvent} className="space-y-2 border-t pt-3">
              <input
                type="text"
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                placeholder="Event name (e.g. League Tournament)"
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-pastel-pink focus:border-transparent"
              />
              <input
                type="text"
                value={eventDesc}
                onChange={(e) => setEventDesc(e.target.value)}
                placeholder="Description (optional)"
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-pastel-pink focus:border-transparent"
              />
              <div className="flex gap-1">
                {Object.entries(EVENT_TYPES).map(([key, t]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setEventType(key)}
                    className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      eventType === key
                        ? `${t.bg} ring-2 ${t.ring} text-gray-700`
                        : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              {/* Notification options (leads only) */}
              {canEditContent && (
                <div className="space-y-2 bg-gray-50 rounded-lg p-2.5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifyEnabled}
                      onChange={(e) => setNotifyEnabled(e.target.checked)}
                      className="rounded border-gray-300 text-pastel-pink-dark focus:ring-pastel-pink"
                    />
                    <Bell size={14} className="text-gray-500" />
                    <span className="text-xs text-gray-600">Notify team about this event</span>
                  </label>
                  {notifyEnabled && (
                    <>
                      <input
                        type="text"
                        value={notifyMessage}
                        onChange={(e) => setNotifyMessage(e.target.value)}
                        placeholder="Custom message (optional)"
                        className="w-full px-2.5 py-1.5 border rounded-lg text-xs focus:ring-2 focus:ring-pastel-pink focus:border-transparent"
                      />
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={forceNotify}
                          onChange={(e) => setForceNotify(e.target.checked)}
                          className="rounded border-gray-300 text-pastel-orange-dark focus:ring-pastel-orange"
                        />
                        <span className="text-xs text-gray-500">Force-notify (sends even if turned off)</span>
                      </label>
                    </>
                  )}
                </div>
              )}
              <button
                type="submit"
                disabled={!eventName.trim()}
                className={`w-full px-3 py-2 rounded-lg text-sm font-medium text-gray-700 transition-colors disabled:opacity-40 ${
                  canEditContent
                    ? 'bg-pastel-pink hover:bg-pastel-pink-dark'
                    : 'bg-pastel-blue hover:bg-pastel-blue-dark'
                }`}
              >
                {canEditContent ? 'Add Event' : 'Request Event'}
              </button>
            </form>}
          </div>
        )}
      </main>
    </div>
  )
}

export default CalendarView
