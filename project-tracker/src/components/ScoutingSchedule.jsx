import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../supabase'
import { usePermissions } from '../hooks/usePermissions'
import { Calendar, MapPin, Clock, Plus, Pencil, Trash2, X } from 'lucide-react'
import NotificationBell from './NotificationBell'

// Scouting Schedule = a list of scheduled scouting dates.
// Coaches / Mentors / Leads / Co-Founders (hasLeadTag) can add, edit, and
// delete dates; everyone else can only view. Dates are stored on the existing
// scouting_schedule "main" row (under data.dates) so no new table is needed.

const EMPTY = { title: '', date: '', time: '', location: '', notes: '' }

export default function ScoutingSchedule() {
  const { hasLeadTag } = usePermissions()
  const canManage = hasLeadTag

  const [dates, setDates] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null) // date object being edited, or {new:true}
  const [form, setForm] = useState(EMPTY)
  const fullData = useRef({}) // preserve the rest of the schedule doc (groups, etc.)

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  const restHeaders = { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' }

  const applyRow = (row) => {
    fullData.current = row?.data || {}
    const d = Array.isArray(fullData.current.dates) ? fullData.current.dates : []
    setDates([...d].sort((a, b) => (a.date || '').localeCompare(b.date || '')))
  }

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${supabaseUrl}/rest/v1/scouting_schedule?id=eq.main&select=*`, { headers: restHeaders })
        if (res.ok) { const rows = await res.json(); applyRow(rows?.[0] || null) }
      } catch { /* ignore */ }
      setLoading(false)
    })()
    const channel = supabase
      .channel('scouting-schedule-dates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scouting_schedule' }, (payload) => {
        if (payload.new) applyRow(payload.new)
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const persist = useCallback(async (nextDates) => {
    const merged = { ...fullData.current, dates: nextDates }
    fullData.current = merged
    setDates([...nextDates].sort((a, b) => (a.date || '').localeCompare(b.date || '')))
    try {
      await fetch(`${supabaseUrl}/rest/v1/scouting_schedule`, {
        method: 'POST',
        headers: { ...restHeaders, Prefer: 'resolution=merge-duplicates, return=minimal' },
        body: JSON.stringify({ id: 'main', data: merged }),
      })
    } catch { /* ignore */ }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const openAdd = () => { setForm(EMPTY); setEditing({ new: true }) }
  const openEdit = (d) => { setForm({ title: d.title || '', date: d.date || '', time: d.time || '', location: d.location || '', notes: d.notes || '' }); setEditing(d) }

  const save = () => {
    if (!form.title.trim() || !form.date) return
    const entry = { ...form, title: form.title.trim() }
    let next
    if (editing?.new) {
      next = [...dates, { id: String(Date.now()) + Math.random().toString(36).slice(2), ...entry }]
    } else {
      next = dates.map((d) => (d.id === editing.id ? { ...d, ...entry } : d))
    }
    persist(next)
    setEditing(null)
  }

  const remove = (id) => {
    if (!confirm('Delete this scouting date?')) return
    persist(dates.filter((d) => d.id !== id))
  }

  const fmt = (dateStr) => {
    if (!dateStr) return ''
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
  }
  const isPast = (dateStr) => dateStr && new Date(dateStr + 'T23:59:59') < new Date()

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="px-4 py-3 ml-14 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-pastel-blue-dark via-pastel-pink-dark to-pastel-orange-dark bg-clip-text text-transparent">
              Scouting Schedule
            </h1>
            <p className="text-sm text-gray-500">{canManage ? 'Add, edit, and remove scouting dates' : 'Upcoming scouting dates'}</p>
          </div>
          <NotificationBell />
        </div>
      </header>

      <main className="flex-1 p-4 overflow-y-auto space-y-3">
        {canManage && (
          <button onClick={openAdd} className="w-full flex items-center justify-center gap-2 py-3 bg-pastel-pink hover:bg-pastel-pink-dark rounded-xl font-semibold text-gray-700 transition-colors">
            <Plus size={18} /> Schedule a Date
          </button>
        )}

        {loading ? (
          <p className="text-center text-gray-400 mt-10 animate-pulse">Loading…</p>
        ) : dates.length === 0 ? (
          <div className="text-center mt-16">
            <Calendar size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">No scouting dates yet.</p>
            {canManage && <p className="text-sm text-gray-400 mt-1">Tap “Schedule a Date” to add one.</p>}
          </div>
        ) : (
          dates.map((d) => (
            <div key={d.id} className={`bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-start gap-4 ${isPast(d.date) ? 'opacity-60' : ''}`}>
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pastel-blue to-pastel-pink flex flex-col items-center justify-center shrink-0 text-white">
                <span className="text-[10px] font-bold uppercase leading-none">{d.date ? new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' }) : '—'}</span>
                <span className="text-lg font-black leading-none">{d.date ? new Date(d.date + 'T00:00:00').getDate() : ''}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-800">{d.title}{isPast(d.date) && <span className="ml-2 text-xs font-normal text-gray-400">(past)</span>}</p>
                <p className="text-xs text-gray-500">{fmt(d.date)}</p>
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-gray-500">
                  {d.time && <span className="flex items-center gap-1"><Clock size={12} /> {d.time}</span>}
                  {d.location && <span className="flex items-center gap-1"><MapPin size={12} /> {d.location}</span>}
                </div>
                {d.notes && <p className="text-sm text-gray-600 mt-2">{d.notes}</p>}
              </div>
              {canManage && (
                <div className="flex flex-col gap-1 shrink-0">
                  <button onClick={() => openEdit(d)} className="p-1.5 rounded-lg hover:bg-pastel-blue/20" title="Edit"><Pencil size={15} className="text-gray-400 hover:text-pastel-blue-dark" /></button>
                  <button onClick={() => remove(d.id)} className="p-1.5 rounded-lg hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-gray-400 hover:text-red-400" /></button>
                </div>
              )}
            </div>
          ))
        )}
      </main>

      {/* Add / Edit modal (leads only) */}
      {editing && canManage && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-700">{editing.new ? 'Schedule a Date' : 'Edit Date'}</h3>
              <button onClick={() => setEditing(null)} className="p-1 rounded hover:bg-gray-100"><X size={18} className="text-gray-400" /></button>
            </div>
            <label className="block">
              <span className="text-xs font-semibold text-gray-500">TITLE *</span>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. League Meet 2" className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-pastel-blue focus:border-transparent" autoFocus />
            </label>
            <div className="flex gap-2">
              <label className="flex-1">
                <span className="text-xs font-semibold text-gray-500">DATE *</span>
                <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-pastel-blue focus:border-transparent" />
              </label>
              <label className="w-28">
                <span className="text-xs font-semibold text-gray-500">TIME</span>
                <input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-pastel-blue focus:border-transparent" />
              </label>
            </div>
            <label className="block">
              <span className="text-xs font-semibold text-gray-500">LOCATION</span>
              <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="e.g. Bettendorf HS" className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-pastel-blue focus:border-transparent" />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-gray-500">NOTES</span>
              <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Who to scout, what to bring…" className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-pastel-blue focus:border-transparent resize-none" />
            </label>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setEditing(null)} className="flex-1 py-2.5 text-sm border rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={save} disabled={!form.title.trim() || !form.date} className="flex-1 py-2.5 text-sm bg-pastel-pink hover:bg-pastel-pink-dark disabled:opacity-50 rounded-lg font-semibold text-gray-700">
                {editing.new ? 'Add Date' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
