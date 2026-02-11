import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Plus, X, Trash2 } from 'lucide-react'
import { supabase } from '../supabase'
import { useUser } from '../contexts/UserContext'
import RequestsBadge from './RequestsBadge'

function CalendarView() {
  const { username, isLead } = useUser()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [events, setEvents] = useState({})
  const [selectedDay, setSelectedDay] = useState(null)
  const [eventName, setEventName] = useState('')
  const [eventDesc, setEventDesc] = useState('')

  // Load events from Supabase on mount
  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .order('created_at', { ascending: true })
      if (error) {
        console.error('Failed to load calendar events:', error.message)
        return
      }
      if (data) {
        const grouped = {}
        data.forEach(ev => {
          if (!grouped[ev.date_key]) grouped[ev.date_key] = []
          grouped[ev.date_key].push({
            id: ev.id,
            name: ev.name,
            description: ev.description,
            addedBy: ev.added_by,
          })
        })
        setEvents(grouped)
      }
    }
    load()
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
            [key]: [...existing, { id: ev.id, name: ev.name, description: ev.description, addedBy: ev.added_by }],
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

    return () => { supabase.removeChannel(channel) }
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

    if (!isLead) {
      // Non-lead: submit a request
      try {
        const request = {
          id: String(Date.now()) + Math.random().toString(36).slice(2),
          type: 'calendar_event',
          data: {
            date_key: key,
            name: eventName.trim(),
            description: eventDesc.trim(),
          },
          requested_by: username,
          status: 'pending',
        }
        await supabase.from('requests').insert(request)
        alert('Request sent! A lead will review it.')
      } catch (err) {
        console.error('Error submitting request:', err)
      }
      setEventName('')
      setEventDesc('')
      return
    }

    const newEvent = {
      id: String(Date.now()),
      date_key: key,
      name: eventName.trim(),
      description: eventDesc.trim(),
      added_by: username,
    }

    const { error } = await supabase.from('calendar_events').insert(newEvent)
    if (error) {
      console.error('Failed to save calendar event:', error.message)
      return
    }

    setEvents(prev => {
      const updated = { ...prev }
      if (!updated[key]) updated[key] = []
      updated[key].push({
        id: newEvent.id,
        name: newEvent.name,
        description: newEvent.description,
        addedBy: newEvent.added_by,
      })
      return updated
    })
    setEventName('')
    setEventDesc('')
  }

  const handleDeleteEvent = async (day, eventId) => {
    const { error } = await supabase.from('calendar_events').delete().eq('id', eventId)
    if (error) {
      console.error('Failed to delete calendar event:', error.message)
      return
    }
    const key = dateKey(day)
    setEvents(prev => {
      const updated = { ...prev }
      updated[key] = (updated[key] || []).filter(ev => ev.id !== eventId)
      if (updated[key].length === 0) delete updated[key]
      return updated
    })
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
              Competition Calendar
            </h1>
            <p className="text-sm text-gray-500">View upcoming competition days</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-pastel-blue/30 transition-colors">
              <ChevronLeft size={20} />
            </button>
            <span className="text-lg font-semibold text-gray-700 min-w-[160px] text-center">
              {monthName} {year}
            </span>
            <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-pastel-blue/30 transition-colors">
              <ChevronRight size={20} />
            </button>
            {isLead && <RequestsBadge type="calendar_event" />}
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
                  {dayEvents.map(ev => (
                    <div
                      key={ev.id}
                      className="flex items-center gap-1 group"
                      title={ev.description || ev.name}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-pastel-orange-dark shrink-0" />
                      <span className="text-xs text-gray-600 truncate">{ev.name}</span>
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
            {(events[dateKey(selectedDay)] || []).length > 0 ? (
              <div className="space-y-2 mb-3">
                {(events[dateKey(selectedDay)] || []).map(ev => (
                  <div key={ev.id} className="flex items-start gap-2 bg-pastel-orange/20 rounded-lg px-3 py-2">
                    <span className="w-2 h-2 rounded-full bg-pastel-orange-dark mt-1.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-700">{ev.name}</p>
                      {ev.description && (
                        <p className="text-xs text-gray-500">{ev.description}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-0.5">Added by {ev.addedBy}</p>
                    </div>
                    {isLead && (
                      <button
                        onClick={() => handleDeleteEvent(selectedDay, ev.id)}
                        className="p-1 rounded hover:bg-red-100 transition-colors"
                      >
                        <Trash2 size={14} className="text-red-400" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 mb-3">No events on this day.</p>
            )}

            {/* Add/Request event form */}
            <form onSubmit={handleAddEvent} className="space-y-2 border-t pt-3">
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
              <button
                type="submit"
                disabled={!eventName.trim()}
                className={`w-full px-3 py-2 rounded-lg text-sm font-medium text-gray-700 transition-colors disabled:opacity-40 ${
                  isLead
                    ? 'bg-pastel-pink hover:bg-pastel-pink-dark'
                    : 'bg-pastel-blue hover:bg-pastel-blue-dark'
                }`}
              >
                {isLead ? 'Add Event' : 'Request Event'}
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  )
}

export default CalendarView
