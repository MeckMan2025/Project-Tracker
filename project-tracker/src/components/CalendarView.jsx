import { useState, useEffect, useMemo } from 'react'
import {
  ChevronLeft, ChevronRight, Plus, X, Trash2,
  CalendarDays, CalendarRange, Calendar as CalendarIcon, List,
  ChevronDown, ChevronUp, Repeat, AlertCircle,
} from 'lucide-react'
import { supabase } from '../supabase'
import { useUser } from '../contexts/UserContext'
import { usePermissions } from '../hooks/usePermissions'
import NotificationBell from './NotificationBell'
import { useToast } from './ToastProvider'
import RequestsBadge from './RequestsBadge'

// ---------------------------------------------------------------------------
// Categories, departments, priorities
// ---------------------------------------------------------------------------
const CATEGORIES = {
  meeting:     { label: 'Meeting',     emoji: '🔵', color: '#3b82f6', soft: '#dbeafe', text: '#1d4ed8', dept: ['team', 'business'] },
  competition: { label: 'Competition', emoji: '🏆', color: '#ef4444', soft: '#fee2e2', text: '#b91c1c', dept: ['team'] },
  outreach:    { label: 'Outreach',    emoji: '🌱', color: '#22c55e', soft: '#dcfce7', text: '#15803d', dept: ['business'] },
  workshop:    { label: 'Workshop',    emoji: '🛠️', color: '#a855f7', soft: '#f3e8ff', text: '#7e22ce', dept: ['programming', 'technical'] },
  birthday:    { label: 'Birthday',    emoji: '🎂', color: '#ec4899', soft: '#fce7f3', text: '#be185d', dept: ['team'] },
  fundraising: { label: 'Fundraising', emoji: '💰', color: '#f97316', soft: '#ffedd5', text: '#c2410c', dept: ['business'] },
}

const DEPARTMENTS = [
  { id: 'all',         label: 'All',         emoji: '📅' },
  { id: 'team',        label: 'Team',        emoji: '👥' },
  { id: 'business',    label: 'Business',    emoji: '💼' },
  { id: 'programming', label: 'Programming', emoji: '💻' },
  { id: 'technical',   label: 'Technical',   emoji: '🔧' },
  { id: 'mine',        label: 'My Calendar', emoji: '⭐' },
]

const PRIORITIES = {
  critical: { label: 'Critical',  badge: 'bg-red-100 text-red-700',     ring: '#ef4444' },
  important:{ label: 'Important', badge: 'bg-amber-100 text-amber-700', ring: '#f59e0b' },
  normal:   { label: 'Normal',    badge: 'bg-gray-100 text-gray-500',   ring: 'transparent' },
}

const TASK_PRIORITY_COLOR = {
  critical: '#ef4444',
  high:     '#f97316',
  medium:   '#9ca3af',
  low:      '#d1d5db',
}

const REACTION_EMOJIS = ['🎉', '🎂', '🥳', '🤖', '💚']
const VIEWS = [
  { id: 'month',  label: 'Month',  Icon: CalendarDays },
  { id: 'week',   label: 'Week',   Icon: CalendarRange },
  { id: 'day',    label: 'Day',    Icon: CalendarIcon },
  { id: 'agenda', label: 'Agenda', Icon: List },
]

// ---------------------------------------------------------------------------
// Date helpers (string-based, "YYYY-MM-DD" — avoids timezone surprises)
// ---------------------------------------------------------------------------
const pad2 = (n) => String(n).padStart(2, '0')
const toKey = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
const fromKey = (k) => {
  const [y, m, d] = k.split('-').map(Number)
  return new Date(y, m - 1, d)
}
const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r }
const startOfWeek = (d) => addDays(d, -d.getDay())
const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
const formatHuman = (d) => d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
const formatTime = (t) => {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  if (Number.isNaN(h)) return t
  const period = h >= 12 ? 'PM' : 'AM'
  const hh = ((h + 11) % 12) + 1
  return `${hh}:${pad2(m || 0)} ${period}`
}

// Expand a recurring event into concrete date_keys within [from, to] (inclusive).
function expandRecurrence(event, from, to) {
  if (!event.date_key) return []
  const start = fromKey(event.date_key)
  if (Number.isNaN(start.getTime())) return []
  if (!event.recurrence || event.recurrence === 'none') {
    return start >= from && start <= to ? [toKey(start)] : []
  }
  const until = event.recurrence_until ? fromKey(event.recurrence_until) : to
  const stop = until < to ? until : to
  const keys = []
  let cursor = new Date(start)
  // Cap iterations defensively.
  for (let i = 0; i < 366 * 5 && cursor <= stop; i++) {
    if (cursor >= from) keys.push(toKey(cursor))
    if (event.recurrence === 'daily')   cursor = addDays(cursor, 1)
    else if (event.recurrence === 'weekly')  cursor = addDays(cursor, 7)
    else if (event.recurrence === 'monthly') cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, cursor.getDate())
    else if (event.recurrence === 'yearly')  cursor = new Date(cursor.getFullYear() + 1, cursor.getMonth(), cursor.getDate())
    else break
  }
  return keys
}

// ---------------------------------------------------------------------------
// Top-level component
// ---------------------------------------------------------------------------
function CalendarView({ tabs = [], tasksByTab = {}, onOpenTask } = {}) {
  const { username, user } = useUser()
  const { canEditContent, canReviewRequests, isGuest } = usePermissions()
  const { addToast } = useToast()

  const [view, setView] = useState(() => localStorage.getItem('calendar-view') || 'month')
  const [cursor, setCursor] = useState(new Date())
  const [events, setEvents] = useState([])         // raw event records
  const [reactions, setReactions] = useState({})   // { event_id: [{username, emoji}] }
  const [filter, setFilter] = useState('all')      // all | team | business | programming | technical | mine
  const [showDashboard, setShowDashboard] = useState(() => localStorage.getItem('calendar-dashboard') !== '0')
  const [openEvent, setOpenEvent] = useState(null) // event currently in modal
  const [creating, setCreating] = useState(null)   // { date_key } when add form open
  const [selectedDay, setSelectedDay] = useState(null)

  useEffect(() => { localStorage.setItem('calendar-view', view) }, [view])
  useEffect(() => { localStorage.setItem('calendar-dashboard', showDashboard ? '1' : '0') }, [showDashboard])

  // ---------------------------------------------------------------------- Load
  useEffect(() => {
    let alive = true
    async function load() {
      const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .order('date_key', { ascending: true })
      if (!alive) return
      if (error) { console.error('Failed to load events', error); return }
      setEvents(data || [])
    }
    load()
    const channel = supabase
      .channel('calendar-events-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_events' }, load)
      .subscribe()
    return () => { alive = false; supabase.removeChannel(channel) }
  }, [])

  useEffect(() => {
    let alive = true
    async function load() {
      const { data } = await supabase.from('calendar_birthday_reactions').select('*')
      if (!alive || !data) return
      const grouped = {}
      data.forEach(r => {
        if (!grouped[r.event_id]) grouped[r.event_id] = []
        grouped[r.event_id].push({ id: r.id, username: r.username, emoji: r.emoji })
      })
      setReactions(grouped)
    }
    load()
    const channel = supabase
      .channel('calendar-reactions-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_birthday_reactions' }, load)
      .subscribe()
    return () => { alive = false; supabase.removeChannel(channel) }
  }, [])

  // ---------------------------------------------------------------------- Tasks
  // Flatten tasks across all boards into pseudo-events keyed by due_date.
  const taskEvents = useMemo(() => {
    const out = []
    Object.entries(tasksByTab).forEach(([boardId, list]) => {
      ;(list || []).forEach(t => {
        if (!t.due_date) return
        out.push({
          id: 'task:' + t.id,
          isTask: true,
          task: { ...t, board_id: t.board_id || boardId },
          date_key: t.due_date,
          name: t.title,
          category: 'task',
          priority: t.priority || 'medium',
          assignee: t.assignee,
          status: t.status,
        })
      })
    })
    return out
  }, [tasksByTab])

  // ---------------------------------------------------------------------- Filter
  const eventMatches = (ev) => {
    if (filter === 'all') return true
    if (filter === 'mine') {
      if (ev.isTask) return (ev.assignee || '').toLowerCase() === (username || '').toLowerCase()
      const assigned = ev.assigned_to || []
      if (assigned.map(s => s.toLowerCase()).includes((username || '').toLowerCase())) return true
      // Workshops you can opt-in to count as "mine" too — but only if explicitly assigned.
      return false
    }
    // Department filters
    if (ev.isTask) {
      // Tasks belong to "Team" by default — surface in Team filter only.
      return filter === 'team'
    }
    if (ev.department && ev.department === filter) return true
    // Allow categories to show in their natural department even if dept is unset.
    const cat = CATEGORIES[ev.category] || CATEGORIES[ev.event_type]
    if (cat && cat.dept.includes(filter)) return true
    return false
  }

  // Build [from, to] for the current view to drive recurrence expansion.
  const viewRange = useMemo(() => {
    if (view === 'month') {
      const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
      const last = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0)
      return { from: addDays(startOfWeek(first), -7), to: addDays(last, 14) }
    }
    if (view === 'week') {
      const start = startOfWeek(cursor)
      return { from: start, to: addDays(start, 6) }
    }
    if (view === 'day') {
      return { from: cursor, to: cursor }
    }
    // agenda — next 60 days
    return { from: cursor, to: addDays(cursor, 60) }
  }, [view, cursor])

  // Map of date_key -> [event-instance], with recurrence expanded and filter applied.
  const eventsByDay = useMemo(() => {
    const map = {}
    const push = (key, instance) => { (map[key] = map[key] || []).push(instance) }
    events.forEach(ev => {
      if (!eventMatches(ev)) return
      const keys = expandRecurrence(ev, viewRange.from, viewRange.to)
      keys.forEach(k => push(k, { ...ev, date_key: k, _baseKey: ev.date_key }))
    })
    taskEvents.forEach(t => { if (eventMatches(t)) push(t.date_key, t) })
    Object.values(map).forEach(list => list.sort((a, b) => (a.start_time || '').localeCompare(b.start_time || '')))
    return map
  }, [events, taskEvents, filter, viewRange.from, viewRange.to, username])

  // ---------------------------------------------------------------------- Handlers
  const handleCreate = async (payload) => {
    const newEvent = {
      id: 'evt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      date_key: payload.date_key,
      name: payload.name,
      description: payload.description || '',
      added_by: username,
      event_type: payload.category, // back-compat
      category: payload.category,
      priority: payload.priority || 'normal',
      department: payload.department || (CATEGORIES[payload.category]?.dept[0] || 'team'),
      start_time: payload.start_time || '',
      end_time: payload.end_time || '',
      location: payload.location || '',
      metadata: payload.metadata || {},
      recurrence: payload.recurrence || 'none',
      recurrence_until: payload.recurrence_until || '',
      assigned_to: payload.assigned_to || [],
    }

    if (!canEditContent) {
      const request = {
        id: String(Date.now()) + Math.random().toString(36).slice(2),
        type: 'calendar_event',
        data: newEvent,
        requested_by: username,
        requested_by_user_id: user?.id,
        status: 'pending',
      }
      const { error } = await supabase.from('requests').insert(request)
      if (error) { console.error(error); addToast('Could not submit request', 'error'); return }
      addToast('Request sent! A lead will review it.', 'success')
      setCreating(null)
      return
    }

    setEvents(prev => [...prev, newEvent])
    const { error } = await supabase.from('calendar_events').insert(newEvent)
    if (error) {
      console.error(error)
      addToast('Failed to save event', 'error')
      setEvents(prev => prev.filter(e => e.id !== newEvent.id))
      return
    }
    addToast('Event created', 'success')
    setCreating(null)
  }

  const handleDelete = async (id) => {
    setEvents(prev => prev.filter(e => e.id !== id))
    setOpenEvent(null)
    await supabase.from('calendar_events').delete().eq('id', id)
  }

  const handleReact = async (eventId, emoji) => {
    const existing = (reactions[eventId] || []).find(r => r.username === username && r.emoji === emoji)
    if (existing) {
      setReactions(prev => ({ ...prev, [eventId]: (prev[eventId] || []).filter(r => r.id !== existing.id) }))
      await supabase.from('calendar_birthday_reactions').delete().eq('id', existing.id)
      return
    }
    const row = {
      id: 'rx_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      event_id: eventId,
      user_id: user?.id || null,
      username,
      emoji,
    }
    setReactions(prev => ({ ...prev, [eventId]: [...(prev[eventId] || []), { id: row.id, username, emoji }] }))
    await supabase.from('calendar_birthday_reactions').insert(row)
  }

  const handleEventClick = (ev) => {
    if (ev.isTask) { onOpenTask?.(ev.task); return }
    setOpenEvent(ev)
  }

  // ---------------------------------------------------------------------- Header
  const headerLabel = useMemo(() => {
    if (view === 'month') return cursor.toLocaleString(undefined, { month: 'long', year: 'numeric' })
    if (view === 'week') {
      const start = startOfWeek(cursor); const end = addDays(start, 6)
      return `${start.toLocaleString(undefined, { month: 'short', day: 'numeric' })} – ${end.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
    }
    if (view === 'day') return cursor.toLocaleString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    return 'Next 60 days'
  }, [view, cursor])

  const shift = (dir) => {
    if (view === 'month') setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + dir, 1))
    else if (view === 'week') setCursor(addDays(cursor, 7 * dir))
    else if (view === 'day') setCursor(addDays(cursor, dir))
    else setCursor(addDays(cursor, 30 * dir))
  }

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-20">
        {/* Row 1: title · nav · view switcher · bell */}
        <div className="px-4 py-2 ml-10 flex items-center gap-3 flex-wrap">
          <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-pastel-blue-dark via-pastel-pink-dark to-pastel-orange-dark bg-clip-text text-transparent shrink-0">
            Calendar
          </h1>

          <div className="flex items-center gap-0.5">
            <button onClick={() => shift(-1)} className="p-1 rounded-lg hover:bg-pastel-blue/30"><ChevronLeft size={16} /></button>
            <button onClick={() => setCursor(new Date())} className="px-2 py-0.5 rounded-lg text-xs font-medium hover:bg-pastel-blue/30">Today</button>
            <button onClick={() => shift(1)} className="p-1 rounded-lg hover:bg-pastel-blue/30"><ChevronRight size={16} /></button>
            <span className="ml-1.5 text-sm font-semibold text-gray-700">{headerLabel}</span>
          </div>

          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5 ml-auto">
            {VIEWS.map(v => {
              const Active = v.id === view
              return (
                <button
                  key={v.id}
                  onClick={() => setView(v.id)}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium transition-colors ${Active ? 'bg-white text-gray-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  <v.Icon size={12} /> {v.label}
                </button>
              )
            })}
          </div>

          <NotificationBell />
          {canReviewRequests && <RequestsBadge type="calendar_event" />}
        </div>

        {/* Row 2: department filters + dashboard toggle */}
        <div className="px-4 pb-2 ml-10 flex items-center gap-1 flex-wrap">
          {DEPARTMENTS.map(d => {
            const active = filter === d.id
            return (
              <button
                key={d.id}
                onClick={() => setFilter(d.id)}
                className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-all flex items-center gap-1 ${
                  active
                    ? 'bg-gradient-to-r from-pastel-blue-dark via-pastel-pink-dark to-pastel-orange-dark text-white shadow-sm'
                    : 'bg-white text-gray-600 hover:bg-pastel-pink/20 border border-gray-200'
                }`}
              >
                <span>{d.emoji}</span>{d.label}
              </button>
            )
          })}
          <button
            onClick={() => setShowDashboard(s => !s)}
            className="ml-auto flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-white border border-gray-200 hover:bg-pastel-blue/20 text-gray-600"
          >
            {showDashboard ? <><ChevronUp size={12} /> Hide Dashboard</> : <><ChevronDown size={12} /> Show Dashboard</>}
          </button>
        </div>
      </header>

      <main className="flex-1 p-4 overflow-auto">
        {showDashboard && (
          <Dashboard
            events={events}
            taskEvents={taskEvents}
            username={username}
            onOpenEvent={setOpenEvent}
            onOpenTask={onOpenTask}
          />
        )}

        {view === 'month'  && <MonthView  cursor={cursor} eventsByDay={eventsByDay} onEventClick={handleEventClick} onDayClick={(k) => setSelectedDay(k)} canCreate={!isGuest} onCreate={(k) => setCreating({ date_key: k })} reactions={reactions} />}
        {view === 'week'   && <WeekView   cursor={cursor} eventsByDay={eventsByDay} onEventClick={handleEventClick} canCreate={!isGuest} onCreate={(k) => setCreating({ date_key: k })} reactions={reactions} />}
        {view === 'day'    && <DayView    cursor={cursor} eventsByDay={eventsByDay} onEventClick={handleEventClick} canCreate={!isGuest} onCreate={(k) => setCreating({ date_key: k })} reactions={reactions} />}
        {view === 'agenda' && <AgendaView cursor={cursor} eventsByDay={eventsByDay} onEventClick={handleEventClick} reactions={reactions} />}

        {selectedDay && view === 'month' && (
          <DayPanel
            dateKey={selectedDay}
            items={eventsByDay[selectedDay] || []}
            onClose={() => setSelectedDay(null)}
            onEventClick={handleEventClick}
            onCreate={() => setCreating({ date_key: selectedDay })}
            canCreate={!isGuest}
          />
        )}
      </main>

      {openEvent && (
        <EventModal
          event={openEvent}
          onClose={() => setOpenEvent(null)}
          onDelete={canEditContent ? handleDelete : null}
          reactions={reactions[openEvent.id] || []}
          onReact={(emoji) => handleReact(openEvent.id, emoji)}
          username={username}
        />
      )}

      {creating && (
        <CreateEventModal
          dateKey={creating.date_key}
          onClose={() => setCreating(null)}
          onSubmit={handleCreate}
          canEdit={canEditContent}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
function Dashboard({ events, taskEvents, username, onOpenEvent, onOpenTask }) {
  const today = new Date()
  const weekStart = startOfWeek(today)
  const weekEnd = addDays(weekStart, 6)
  const todayKey = toKey(today)
  const weekEndKey = toKey(weekEnd)

  const all = useMemo(() => {
    const list = []
    events.forEach(ev => {
      const keys = expandRecurrence(ev, weekStart, weekEnd)
      keys.forEach(k => list.push({ ...ev, date_key: k }))
    })
    return list
      .filter(e => e.date_key >= todayKey && e.date_key <= weekEndKey)
      .sort((a, b) => (a.date_key + (a.start_time || '')).localeCompare(b.date_key + (b.start_time || '')))
  }, [events, todayKey, weekEndKey]) // eslint-disable-line

  const upcoming = all.slice(0, 4)
  const dueSoon = useMemo(() => taskEvents
    .filter(t => t.date_key >= todayKey && t.date_key <= weekEndKey && (t.assignee || '').toLowerCase() === (username || '').toLowerCase() && t.status !== 'done' && t.status !== 'completed')
    .sort((a, b) => a.date_key.localeCompare(b.date_key))
    .slice(0, 4), [taskEvents, username, todayKey, weekEndKey])
  const birthdays = all.filter(e => e.category === 'birthday').slice(0, 3)
  const nextComp = all.find(e => e.category === 'competition')

  const Card = ({ title, children, accent }) => (
    <div className="bg-white/80 rounded-xl p-3 border border-gray-100 min-w-0">
      <div className="flex items-center gap-1.5 mb-2">
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: accent }} />
        <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{title}</h3>
      </div>
      {children}
    </div>
  )

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
      <Card title="This Week" accent="#3b82f6">
        {upcoming.length === 0 ? <p className="text-xs text-gray-400">Nothing scheduled this week.</p> : (
          <ul className="space-y-1">
            {upcoming.map(e => (
              <li key={e.id + e.date_key} onClick={() => onOpenEvent(e)} className="text-xs cursor-pointer hover:bg-gray-50 rounded px-1 py-0.5 truncate">
                <span className="mr-1">{CATEGORIES[e.category]?.emoji || '📅'}</span>
                <span className="font-medium text-gray-700">{e.name}</span>
                <span className="text-gray-400"> · {formatHuman(fromKey(e.date_key))}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title="Due This Week" accent="#f97316">
        {dueSoon.length === 0 ? <p className="text-xs text-gray-400">Nothing due this week.</p> : (
          <ul className="space-y-1">
            {dueSoon.map(t => (
              <li key={t.id} onClick={() => onOpenTask?.(t.task)} className="text-xs cursor-pointer hover:bg-gray-50 rounded px-1 py-0.5 truncate">
                <span className="w-1.5 h-1.5 rounded-full inline-block mr-1.5" style={{ background: TASK_PRIORITY_COLOR[t.priority] || '#9ca3af' }} />
                <span className="font-medium text-gray-700">{t.name}</span>
                <span className="text-gray-400"> · {formatHuman(fromKey(t.date_key))}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title="Birthdays This Week" accent="#ec4899">
        {birthdays.length === 0 ? <p className="text-xs text-gray-400">No birthdays this week.</p> : (
          <ul className="space-y-1">
            {birthdays.map(b => (
              <li key={b.id + b.date_key} onClick={() => onOpenEvent(b)} className="text-xs cursor-pointer hover:bg-gray-50 rounded px-1 py-0.5 truncate">
                🎂 <span className="font-medium text-gray-700">{b.name}</span>
                <span className="text-gray-400"> · {formatHuman(fromKey(b.date_key))}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title="Competition This Week" accent="#ef4444">
        {!nextComp ? <p className="text-xs text-gray-400">None this week.</p> : (
          <div onClick={() => onOpenEvent(nextComp)} className="cursor-pointer hover:bg-gray-50 rounded px-1 py-0.5">
            <p className="text-sm font-semibold text-gray-700 truncate">🏆 {nextComp.name}</p>
            <p className="text-xs text-gray-500">{formatHuman(fromKey(nextComp.date_key))}{nextComp.location ? ` · ${nextComp.location}` : ''}</p>
          </div>
        )}
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Event bubble (the rounded pill shown inside day cells / lists)
// ---------------------------------------------------------------------------
function EventBubble({ ev, onClick, dense = false }) {
  if (ev.isTask) {
    const isDone = ev.status === 'done' || ev.status === 'completed'
    const color = isDone ? '#22c55e' : (TASK_PRIORITY_COLOR[ev.priority] || '#9ca3af')
    return (
      <button
        onClick={(e) => { e.stopPropagation(); onClick(ev) }}
        className={`group w-full text-left rounded-full ${dense ? 'px-1.5 py-0.5' : 'px-2 py-1'} hover:opacity-90 transition-opacity flex items-center gap-1 truncate`}
        style={{ background: color + '22', borderLeft: `3px solid ${color}` }}
        title={`Task: ${ev.name}${ev.assignee ? ' · ' + ev.assignee : ''}`}
      >
        <span className={`text-[10px] font-medium truncate ${isDone ? 'line-through text-gray-400' : 'text-gray-700'}`}>📋 {ev.name}</span>
      </button>
    )
  }
  const cat = CATEGORIES[ev.category] || CATEGORIES[ev.event_type] || CATEGORIES.meeting
  const prio = PRIORITIES[ev.priority] || PRIORITIES.normal
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(ev) }}
      className={`group w-full text-left rounded-full ${dense ? 'px-1.5 py-0.5' : 'px-2 py-1'} hover:opacity-90 transition-opacity flex items-center gap-1 truncate`}
      style={{
        background: cat.soft,
        color: cat.text,
        boxShadow: prio.ring !== 'transparent' ? `inset 3px 0 0 ${prio.ring}` : undefined,
      }}
      title={ev.description || ev.name}
    >
      <span className="text-[10px]">{cat.emoji}</span>
      <span className="text-[10px] font-medium truncate flex-1">{ev.name}</span>
      {ev.recurrence && ev.recurrence !== 'none' && <Repeat size={9} className="opacity-60 shrink-0" />}
      {ev.priority === 'critical' && <AlertCircle size={9} className="text-red-500 shrink-0" />}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Month view
// ---------------------------------------------------------------------------
function MonthView({ cursor, eventsByDay, onEventClick, onDayClick, canCreate, onCreate }) {
  const year = cursor.getFullYear(), month = cursor.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = new Date()
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {dayNames.map(d => <div key={d} className="text-center text-xs font-semibold text-gray-500 py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: firstDay }).map((_, i) => <div key={'e' + i} className="min-h-[110px] rounded-lg bg-gray-50/50" />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1
          const date = new Date(year, month, day)
          const key = toKey(date)
          const items = eventsByDay[key] || []
          const isToday = sameDay(date, today)
          return (
            <div
              key={day}
              onClick={() => onDayClick(key)}
              className={`min-h-[110px] rounded-lg p-1.5 cursor-pointer transition-colors border bg-white/50 hover:bg-white/90 ${isToday ? 'border-pastel-blue-dark/50' : 'border-transparent'}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`text-xs font-medium ${isToday ? 'bg-pastel-blue-dark text-white w-5 h-5 rounded-full flex items-center justify-center' : 'text-gray-700'}`}>{day}</span>
                {canCreate && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onCreate(key) }}
                    className="opacity-0 group-hover:opacity-100 hover:opacity-100 p-0.5 rounded hover:bg-gray-100"
                    style={{ opacity: 1 }}
                    title="Add event"
                  >
                    <Plus size={11} className="text-gray-400" />
                  </button>
                )}
              </div>
              <div className="space-y-0.5 max-h-[80px] overflow-y-auto pr-0.5">
                {items.map((ev, idx) => (
                  <EventBubble key={ev.id + ':' + idx} ev={ev} onClick={onEventClick} dense />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Week view
// ---------------------------------------------------------------------------
function WeekView({ cursor, eventsByDay, onEventClick, canCreate, onCreate }) {
  const start = startOfWeek(cursor)
  const today = new Date()
  return (
    <div className="grid grid-cols-7 gap-2">
      {Array.from({ length: 7 }).map((_, i) => {
        const d = addDays(start, i)
        const key = toKey(d)
        const items = eventsByDay[key] || []
        const isToday = sameDay(d, today)
        return (
          <div key={key} className={`bg-white/70 rounded-xl p-2 min-h-[60vh] border ${isToday ? 'border-pastel-blue-dark/40' : 'border-gray-100'}`}>
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-xs text-gray-500 uppercase">{d.toLocaleString(undefined, { weekday: 'short' })}</p>
                <p className={`text-lg font-bold ${isToday ? 'text-pastel-blue-dark' : 'text-gray-700'}`}>{d.getDate()}</p>
              </div>
              {canCreate && (
                <button onClick={() => onCreate(key)} className="p-1 rounded hover:bg-gray-100"><Plus size={14} /></button>
              )}
            </div>
            <div className="space-y-1">
              {items.length === 0 ? <p className="text-xs text-gray-300">—</p> : items.map((ev, idx) => (
                <div key={ev.id + ':' + idx}>
                  <EventBubble ev={ev} onClick={onEventClick} />
                  {ev.start_time && <p className="text-[10px] text-gray-400 ml-2 mt-0.5">{formatTime(ev.start_time)}</p>}
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Day view
// ---------------------------------------------------------------------------
function DayView({ cursor, eventsByDay, onEventClick, canCreate, onCreate }) {
  const key = toKey(cursor)
  const items = eventsByDay[key] || []
  const timed = items.filter(e => !e.isTask && e.start_time)
  const allDay = items.filter(e => !e.isTask && !e.start_time)
  const tasks = items.filter(e => e.isTask)

  return (
    <div className="max-w-3xl mx-auto bg-white/80 rounded-xl border border-gray-100 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-700">{cursor.toLocaleString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</h3>
        {canCreate && (
          <button onClick={() => onCreate(key)} className="text-xs px-2.5 py-1 rounded-full bg-pastel-blue text-pastel-blue-dark hover:bg-pastel-blue-dark hover:text-white">
            <Plus size={12} className="inline mr-1" />Add Event
          </button>
        )}
      </div>
      {items.length === 0 && <p className="text-sm text-gray-400 italic">No events scheduled.</p>}

      {allDay.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase text-gray-400 mb-2">All-day</p>
          <div className="space-y-1.5">{allDay.map((e, i) => <EventBubble key={e.id + i} ev={e} onClick={onEventClick} />)}</div>
        </div>
      )}

      {timed.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase text-gray-400 mb-2">Schedule</p>
          <div className="space-y-2">
            {timed.map((e, i) => (
              <div key={e.id + i} className="flex items-center gap-3">
                <span className="text-xs font-mono text-gray-500 w-20 shrink-0">{formatTime(e.start_time)}{e.end_time ? `–${formatTime(e.end_time)}` : ''}</span>
                <div className="flex-1"><EventBubble ev={e} onClick={onEventClick} /></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tasks.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase text-gray-400 mb-2">Tasks Due</p>
          <div className="space-y-1.5">{tasks.map((e, i) => <EventBubble key={e.id + i} ev={e} onClick={onEventClick} />)}</div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Agenda view
// ---------------------------------------------------------------------------
function AgendaView({ cursor, eventsByDay, onEventClick }) {
  const days = []
  for (let i = 0; i <= 60; i++) {
    const d = addDays(cursor, i)
    const k = toKey(d)
    const items = eventsByDay[k] || []
    if (items.length > 0) days.push({ date: d, key: k, items })
  }
  return (
    <div className="max-w-3xl mx-auto space-y-3">
      {days.length === 0 && <p className="text-sm text-gray-400 italic">Nothing scheduled in the next 60 days.</p>}
      {days.map(d => (
        <div key={d.key} className="bg-white/80 rounded-xl border border-gray-100 p-3">
          <p className="text-xs font-semibold uppercase text-gray-500 mb-2">{formatHuman(d.date)}</p>
          <div className="space-y-1.5">
            {d.items.map((ev, i) => (
              <div key={ev.id + i} className="flex items-center gap-2">
                {ev.start_time && <span className="text-[11px] font-mono text-gray-400 w-16 shrink-0">{formatTime(ev.start_time)}</span>}
                <div className="flex-1 min-w-0"><EventBubble ev={ev} onClick={onEventClick} /></div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Day panel (pop-out under month grid)
// ---------------------------------------------------------------------------
function DayPanel({ dateKey, items, onClose, onEventClick, onCreate, canCreate }) {
  const date = fromKey(dateKey)
  return (
    <div className="mt-4 max-w-lg mx-auto bg-white/90 rounded-xl border border-gray-100 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">{date.toLocaleString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</h3>
        <div className="flex items-center gap-1">
          {canCreate && <button onClick={onCreate} className="p-1 rounded hover:bg-gray-100"><Plus size={14} className="text-gray-500" /></button>}
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100"><X size={14} className="text-gray-400" /></button>
        </div>
      </div>
      {items.length === 0 ? <p className="text-xs text-gray-400">Nothing on this day.</p> : (
        <div className="space-y-1.5">{items.map((ev, i) => <EventBubble key={ev.id + i} ev={ev} onClick={onEventClick} />)}</div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Event detail modal (square overlay)
// ---------------------------------------------------------------------------
function EventModal({ event, onClose, onDelete, reactions, onReact, username }) {
  const cat = CATEGORIES[event.category] || CATEGORIES[event.event_type] || CATEGORIES.meeting
  const prio = PRIORITIES[event.priority] || PRIORITIES.normal
  const meta = event.metadata || {}
  const date = fromKey(event.date_key)

  const Field = ({ label, value }) => value ? (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <p className="text-sm text-gray-700 whitespace-pre-wrap">{value}</p>
    </div>
  ) : null

  // Group reactions by emoji for compact display
  const grouped = {}
  reactions.forEach(r => { (grouped[r.emoji] = grouped[r.emoji] || []).push(r.username) })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        style={{ borderTop: `4px solid ${cat.color}` }}
      >
        <div className="p-5">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-2xl">{cat.emoji}</span>
              <div>
                <h2 className="text-lg font-bold text-gray-800 leading-tight">{event.name}</h2>
                <p className="text-xs text-gray-500">{cat.label}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1 rounded hover:bg-gray-100"><X size={18} /></button>
          </div>

          {/* Badges */}
          <div className="flex items-center gap-1.5 flex-wrap mb-4">
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${prio.badge}`}>{prio.label}</span>
            {event.department && <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 capitalize">{event.department}</span>}
            {event.recurrence && event.recurrence !== 'none' && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 flex items-center gap-1">
                <Repeat size={10} /> {event.recurrence}
              </span>
            )}
          </div>

          {/* Common fields */}
          <div className="space-y-3">
            <Field label="Date" value={date.toLocaleString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} />
            {(event.start_time || event.end_time) && (
              <Field label="Time" value={`${formatTime(event.start_time)}${event.end_time ? ' – ' + formatTime(event.end_time) : ''}`} />
            )}
            <Field label="Location" value={event.location} />
            <Field label="Description" value={event.description} />

            {/* Category-specific fields */}
            {event.category === 'meeting' && <Field label="Agenda" value={meta.agenda} />}
            {event.category === 'meeting' && <Field label="Notes" value={meta.notes} />}

            {event.category === 'competition' && (
              <>
                <Field label="Match Schedule" value={meta.match_schedule} />
                <Field label="Assigned Roles" value={meta.roles} />
                <Field label="What to Wear" value={meta.dress_code} />
              </>
            )}

            {event.category === 'outreach' && (
              <>
                <Field label="Hours" value={meta.hours} />
                <Field label="What to Bring" value={meta.what_to_bring} />
              </>
            )}

            {event.category === 'workshop' && (
              <>
                <Field label="Topic" value={meta.topic} />
                <Field label="Instructor" value={meta.instructor} />
                <Field label="Materials Needed" value={meta.materials} />
              </>
            )}

            {event.category === 'fundraising' && (
              <Field label="Fundraising Goal" value={meta.goal} />
            )}

            {event.category === 'birthday' && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-2">Send a reaction</p>
                <div className="flex items-center gap-2 flex-wrap mb-3">
                  {REACTION_EMOJIS.map(emoji => {
                    const mine = (grouped[emoji] || []).includes(username)
                    return (
                      <button
                        key={emoji}
                        onClick={() => onReact(emoji)}
                        className={`text-2xl rounded-full w-11 h-11 flex items-center justify-center transition-all hover:scale-110 ${mine ? 'bg-pastel-pink/30 ring-2 ring-pastel-pink-dark' : 'bg-gray-50 hover:bg-gray-100'}`}
                      >
                        {emoji}
                      </button>
                    )
                  })}
                </div>
                {Object.keys(grouped).length > 0 && (
                  <div className="space-y-1">
                    {Object.entries(grouped).map(([emoji, names]) => (
                      <p key={emoji} className="text-xs text-gray-600">
                        <span className="text-base mr-1">{emoji}</span>
                        <span className="text-gray-500">{names.join(', ')}</span>
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {event.assigned_to && event.assigned_to.length > 0 && (
              <Field label="Assigned" value={event.assigned_to.join(', ')} />
            )}
          </div>

          <div className="flex items-center justify-between mt-5 pt-3 border-t border-gray-100">
            <p className="text-[11px] text-gray-400">Added by {event.added_by}</p>
            {onDelete && (
              <button
                onClick={() => { if (confirm('Delete this event?')) onDelete(event.id) }}
                className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
              >
                <Trash2 size={12} /> Delete
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Create event modal
// ---------------------------------------------------------------------------
function CreateEventModal({ dateKey, onClose, onSubmit, canEdit }) {
  const [category, setCategory] = useState('meeting')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('normal')
  const [department, setDepartment] = useState('team')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [location, setLocation] = useState('')
  const [recurrence, setRecurrence] = useState('none')
  const [recurrenceUntil, setRecurrenceUntil] = useState('')
  const [meta, setMeta] = useState({})

  // Sync department default with category
  useEffect(() => {
    const cat = CATEGORIES[category]
    if (cat && !cat.dept.includes(department)) setDepartment(cat.dept[0])
  }, [category]) // eslint-disable-line

  const submit = (e) => {
    e.preventDefault()
    if (!name.trim()) return
    onSubmit({
      date_key: dateKey,
      name: name.trim(),
      description: description.trim(),
      category,
      priority,
      department,
      start_time: startTime,
      end_time: endTime,
      location: location.trim(),
      recurrence,
      recurrence_until: recurrenceUntil,
      metadata: meta,
    })
  }

  const setMetaField = (k, v) => setMeta(prev => ({ ...prev, [k]: v }))
  const cat = CATEGORIES[category]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4" onClick={onClose}>
      <form
        onSubmit={submit}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        style={{ borderTop: `4px solid ${cat.color}` }}
      >
        <div className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-800">{canEdit ? 'New Event' : 'Request Event'}</h2>
            <button type="button" onClick={onClose} className="p-1 rounded hover:bg-gray-100"><X size={18} /></button>
          </div>
          <p className="text-xs text-gray-500">{formatHuman(fromKey(dateKey))}{!canEdit && ' · A lead will review your request.'}</p>

          {/* Category */}
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Category</label>
            <div className="grid grid-cols-3 gap-1.5 mt-1">
              {Object.entries(CATEGORIES).map(([key, c]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setCategory(key)}
                  className={`px-2 py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1 ${category === key ? '' : 'opacity-60 hover:opacity-100'}`}
                  style={{ background: c.soft, color: c.text }}
                >
                  <span>{c.emoji}</span> {c.label}
                </button>
              ))}
            </div>
          </div>

          <input
            type="text" value={name} onChange={(e) => setName(e.target.value)}
            placeholder={category === 'birthday' ? 'Whose birthday?' : 'Event title'}
            className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-pastel-blue focus:border-transparent"
          />

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Start time</label>
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full px-2 py-1.5 border rounded-lg text-xs mt-1" />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">End time</label>
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-full px-2 py-1.5 border rounded-lg text-xs mt-1" />
            </div>
          </div>

          {category !== 'birthday' && (
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Location</label>
              <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Where is this?" className="w-full px-3 py-2 border rounded-lg text-sm mt-1" />
            </div>
          )}

          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Notes</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Optional description"
              className="w-full px-3 py-2 border rounded-lg text-sm mt-1 resize-none" />
          </div>

          {/* Category-specific extras */}
          {category === 'meeting' && (
            <CatField label="Agenda" value={meta.agenda || ''} onChange={(v) => setMetaField('agenda', v)} multiline />
          )}
          {category === 'competition' && (
            <>
              <CatField label="Match Schedule" value={meta.match_schedule || ''} onChange={(v) => setMetaField('match_schedule', v)} multiline />
              <CatField label="Assigned Roles" value={meta.roles || ''} onChange={(v) => setMetaField('roles', v)} />
              <CatField label="What to Wear" value={meta.dress_code || ''} onChange={(v) => setMetaField('dress_code', v)} />
            </>
          )}
          {category === 'outreach' && (
            <>
              <CatField label="Hours" value={meta.hours || ''} onChange={(v) => setMetaField('hours', v)} />
              <CatField label="What to Bring" value={meta.what_to_bring || ''} onChange={(v) => setMetaField('what_to_bring', v)} />
            </>
          )}
          {category === 'workshop' && (
            <>
              <CatField label="Topic" value={meta.topic || ''} onChange={(v) => setMetaField('topic', v)} />
              <CatField label="Instructor" value={meta.instructor || ''} onChange={(v) => setMetaField('instructor', v)} />
              <CatField label="Materials Needed" value={meta.materials || ''} onChange={(v) => setMetaField('materials', v)} multiline />
            </>
          )}
          {category === 'fundraising' && (
            <CatField label="Fundraising Goal" value={meta.goal || ''} onChange={(v) => setMetaField('goal', v)} />
          )}

          {/* Priority + Department */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Priority</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full px-2 py-1.5 border rounded-lg text-xs mt-1">
                <option value="normal">🟢 Normal</option>
                <option value="important">🟡 Important</option>
                <option value="critical">🔴 Critical</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Department</label>
              <select value={department} onChange={(e) => setDepartment(e.target.value)} className="w-full px-2 py-1.5 border rounded-lg text-xs mt-1">
                <option value="team">Team</option>
                <option value="business">Business</option>
                <option value="programming">Programming</option>
                <option value="technical">Technical</option>
              </select>
            </div>
          </div>

          {/* Recurrence */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Repeats</label>
              <select value={recurrence} onChange={(e) => setRecurrence(e.target.value)} className="w-full px-2 py-1.5 border rounded-lg text-xs mt-1">
                <option value="none">Doesn't repeat</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
            {recurrence !== 'none' && (
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Until (optional)</label>
                <input type="date" value={recurrenceUntil} onChange={(e) => setRecurrenceUntil(e.target.value)} className="w-full px-2 py-1.5 border rounded-lg text-xs mt-1" />
              </div>
            )}
          </div>

          <button type="submit" disabled={!name.trim()}
            className={`w-full px-3 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-40`}
            style={{ background: cat.color }}
          >
            {canEdit ? 'Create Event' : 'Submit Request'}
          </button>
        </div>
      </form>
    </div>
  )
}

function CatField({ label, value, onChange, multiline }) {
  return (
    <div>
      <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</label>
      {multiline ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={2}
          className="w-full px-3 py-2 border rounded-lg text-sm mt-1 resize-none" />
      ) : (
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 border rounded-lg text-sm mt-1" />
      )}
    </div>
  )
}

export default CalendarView
