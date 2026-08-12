import { useState, useEffect } from 'react'
import { ArrowLeft, AlertTriangle, Calendar, LifeBuoy, Plus, UserPlus } from 'lucide-react'
import NotificationBell from './NotificationBell'
import { supabase } from '../supabase'

// A page showing one person's tasks — where the lead task-load popup sends you
// when you tap a name.

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const headers = { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }

const PCT = { todo: 0, '25': 25, '50': 50, '75': 75, done: 100, completed: 100 }
const PRIORITY_CHIP = {
  critical: 'bg-red-100 text-red-600',
  high: 'bg-orange-100 text-orange-600',
  medium: 'bg-pastel-pink/40 text-pink-700',
  low: 'bg-gray-100 text-gray-500',
}

const parseDate = (key) => {
  const [y, m, d] = String(key || '').split('-').map(Number)
  return (y && m && d) ? new Date(y, m - 1, d) : null
}

export default function PersonTasksView({ name, onBack, onOpenTask, onAddTask }) {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const res = await fetch(
          `${supabaseUrl}/rest/v1/tasks?assignee=ilike.${encodeURIComponent(name)}&select=*`,
          { headers }
        )
        if (!active || !res.ok) return
        setTasks(await res.json())
      } catch { /* ignore */ }
      finally { if (active) setLoading(false) }
    }
    load()
    const ch = supabase
      .channel(`person-tasks-${name}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, load)
      .subscribe()
    return () => { active = false; supabase.removeChannel(ch) }
  }, [name])

  const open = tasks.filter(t => (PCT[t.status] ?? 0) < 100)
  const done = tasks.filter(t => (PCT[t.status] ?? 0) === 100)
  const today = new Date()
  const midnight = new Date(today.getFullYear(), today.getMonth(), today.getDate())

  const Row = ({ t, muted }) => {
    const due = parseDate(t.due_date)
    const overdue = !muted && due && due < midnight
    const pct = PCT[t.status] ?? 0
    return (
      <button
        onClick={() => onOpenTask?.(t)}
        className={`w-full text-left rounded-xl border px-3.5 py-3 transition-colors ${
          overdue ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100 hover:bg-gray-50'
        }`}
      >
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-semibold truncate ${muted ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
              {overdue && <AlertTriangle size={12} className="inline mr-1 text-red-500" />}
              {t.title}
            </p>
            <div className="flex items-center gap-2 flex-wrap mt-1">
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${PRIORITY_CHIP[t.priority] || PRIORITY_CHIP.medium}`}>
                {t.priority || 'medium'}
              </span>
              <span className="text-[10px] text-gray-400">{pct}%</span>
              {due && (
                <span className={`text-[10px] flex items-center gap-0.5 ${overdue ? 'text-red-600 font-semibold' : 'text-gray-400'}`}>
                  <Calendar size={9} /> {due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </span>
              )}
              {t.assigned_by && (
                <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                  <UserPlus size={9} /> {t.assigned_by}
                </span>
              )}
              {t.mentor && (
                <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                  <LifeBuoy size={9} /> {t.mentor}
                </span>
              )}
            </div>
          </div>
          {!muted && (
            <span
              className="shrink-0 w-7 h-7 rounded-full grid place-items-center"
              style={{ background: `conic-gradient(#7EC8E3 ${pct * 3.6}deg, rgba(0,0,0,0.06) 0deg)` }}
            >
              <span className="w-4 h-4 rounded-full bg-white" />
            </span>
          )}
        </div>
      </button>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        {/* pl-14 everywhere: the floating hamburger sits top-left on every
            width, so the Back control has to clear it, not just on mobile. */}
        <div className="relative px-4 py-3 pl-14 flex items-center justify-between">
          <div className="min-w-0">
            <button onClick={onBack} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 mb-0.5">
              <ArrowLeft size={13} /> Back
            </button>
            <h1 className="text-xl font-bold bg-gradient-to-r from-pastel-blue-dark via-pastel-pink-dark to-pastel-orange-dark bg-clip-text text-transparent truncate">
              {name}'s Tasks
            </h1>
            {/* Against the 3-task target the lead board flags people on. */}
            <p className="text-sm text-gray-500">
              {open.length} of 3 tasks
              {open.length < 3 && <span className="text-amber-600 font-medium"> · needs {3 - open.length} more</span>}
              {done.length > 0 && ` · ${done.length} done`}
            </p>
          </div>

          {/* Assign this person another task, right from their page. */}
          {onAddTask && (
            <button
              onClick={onAddTask}
              className="absolute left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-pastel-blue/40 hover:bg-pastel-blue text-gray-700 transition-colors"
            >
              <Plus size={13} /> Add Task
            </button>
          )}

          <NotificationBell />
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4">
        <div className="max-w-2xl mx-auto space-y-4">
          {loading ? (
            <p className="text-center text-gray-400 mt-10 animate-pulse">Loading…</p>
          ) : tasks.length === 0 ? (
            <p className="text-center text-gray-400 mt-10">{name} has no tasks assigned.</p>
          ) : (
            <>
              <section className="space-y-2">
                {open.length === 0 ? (
                  <p className="text-sm text-gray-400">Nothing open right now.</p>
                ) : open.map(t => <Row key={t.id} t={t} />)}
              </section>

              {done.length > 0 && (
                <section>
                  <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-gray-400 mb-2">Done ({done.length})</h2>
                  <div className="space-y-2">
                    {done.map(t => <Row key={t.id} t={t} muted />)}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}
