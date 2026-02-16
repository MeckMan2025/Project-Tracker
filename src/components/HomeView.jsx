import { useState, useEffect, useMemo } from 'react'
import { Calendar, ClipboardList, FolderKanban, MessageCircle, BookOpen, Shield, Inbox, Zap, Clock, CheckCircle2, AlertCircle, ArrowRight, Users } from 'lucide-react'
import { useUser } from '../contexts/UserContext'
import { usePermissions } from '../hooks/usePermissions'


function HomeView({ tasksByTab, tabs, onTabChange }) {
  const { username } = useUser()
  const { tier, isGuest } = usePermissions()
  const isTop = tier === 'top'
  const isTeammate = tier === 'teammate'

  const [nextEvent, setNextEvent] = useState(null)
  const [eventLoading, setEventLoading] = useState(true)
  const [pendingRequestCount, setPendingRequestCount] = useState(0)
  const [quote, setQuote] = useState(null)

  // Fetch next event, pending requests, and random quote
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
    const headers = { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }

    fetch(`${supabaseUrl}/rest/v1/calendar_events?date_key=gte.${today}&order=date_key.asc&limit=1&select=*`, { headers })
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        setNextEvent(data && data.length > 0 ? data[0] : null)
        setEventLoading(false)
      })
      .catch(() => setEventLoading(false))

    fetch(`${supabaseUrl}/rest/v1/requests?status=eq.pending&select=id`, { headers })
      .then(res => res.ok ? res.json() : [])
      .then(data => setPendingRequestCount(data ? data.length : 0))
      .catch(() => {})

    fetch(`${supabaseUrl}/rest/v1/fun_quotes?approved=eq.true&select=*`, { headers })
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        if (data && data.length > 0) {
          setQuote(data[Math.floor(Math.random() * data.length)])
        }
      })
      .catch(() => {})
  }, [])

  // Compute task stats from existing tasksByTab
  const stats = useMemo(() => {
    const allTasks = Object.values(tasksByTab).flat()
    const myTasks = allTasks.filter(t => t.assignee && t.assignee.toLowerCase() === (username || '').toLowerCase())
    const myOpen = myTasks.filter(t => t.status !== 'done')
    const myDone = myTasks.filter(t => t.status === 'done')
    const allOpen = allTasks.filter(t => t.status !== 'done')
    const allDone = allTasks.filter(t => t.status === 'done')

    // Find nearest deadline task
    const now = new Date()
    const upcoming = allOpen
      .filter(t => t.dueDate)
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
    const nextDeadline = upcoming.length > 0 ? upcoming[0] : null

    return { myTasks, myOpen, myDone, allOpen, allDone, allTasks, nextDeadline }
  }, [tasksByTab, username])

  // Days until event
  const daysUntil = nextEvent ? Math.ceil((new Date(nextEvent.date_key) - new Date()) / (1000 * 60 * 60 * 24)) : null

  // Format date nicely
  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  // My open tasks (for teammate panel)
  const myOpenTasks = stats.myOpen.slice(0, 5)
  const myOverflow = stats.myOpen.length - 5

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="px-4 py-3 ml-14">
          <h1 className="text-xl font-bold bg-gradient-to-r from-pastel-blue-dark via-pastel-pink-dark to-pastel-orange-dark bg-clip-text text-transparent">
            Mission Control
          </h1>
          <p className="text-sm text-gray-500">Welcome back{username ? `, ${username}` : ''}!</p>
        </div>
      </header>

      <main className="flex-1 p-4 overflow-y-auto space-y-4">
        {/* 1. Next Event Card */}
        <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <Calendar size={18} className="text-pastel-pink-dark" />
            <h2 className="font-semibold text-gray-700">
              {nextEvent
                ? nextEvent.event_type === 'meeting' ? 'Next Meeting'
                : nextEvent.event_type === 'competition' ? 'Next Competition'
                : 'Next Event'
                : 'Next Event'}
            </h2>
          </div>
          {eventLoading ? (
            <p className="text-sm text-gray-400 animate-pulse">Loading...</p>
          ) : nextEvent ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-gray-800">{nextEvent.title || nextEvent.name}</p>
                {nextEvent.description && (
                  <p className="text-sm text-gray-500">{nextEvent.description}</p>
                )}
                <p className="text-sm text-gray-500 mt-1">{formatDate(nextEvent.date_key)}</p>
              </div>
              <div className="flex items-center gap-3">
                {daysUntil !== null && (
                  <div className="text-center px-4 py-2 bg-pastel-pink/30 rounded-lg">
                    <p className="text-2xl font-bold text-pastel-pink-dark">{daysUntil}</p>
                    <p className="text-xs text-gray-500">{daysUntil === 1 ? 'day' : 'days'} away</p>
                  </div>
                )}
                <button
                  onClick={() => onTabChange('calendar')}
                  className="flex items-center gap-1 px-3 py-2 bg-pastel-blue/30 hover:bg-pastel-blue/50 rounded-lg text-sm text-gray-600 transition-colors"
                >
                  View Calendar <ArrowRight size={14} />
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No upcoming events scheduled</p>
          )}
        </div>

        {/* 2. My Tasks Panel (hidden for guest) */}
        {!isGuest && (
          <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm p-4">
            <div className="flex items-center gap-2 mb-3">
              <ClipboardList size={18} className="text-pastel-blue-dark" />
              <h2 className="font-semibold text-gray-700">{isTop ? 'Team Overview' : 'My Tasks'}</h2>
            </div>

            {isTop ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-pastel-orange/20 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-pastel-orange-dark">{pendingRequestCount}</p>
                  <p className="text-xs text-gray-500">Pending Requests</p>
                </div>
                <div className="bg-pastel-blue/20 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-pastel-blue-dark">{stats.allOpen.length}</p>
                  <p className="text-xs text-gray-500">Open Tasks</p>
                </div>
                {pendingRequestCount > 0 && (
                  <div className="col-span-2">
                    <button
                      onClick={() => onTabChange('requests')}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-pastel-orange/30 hover:bg-pastel-orange/50 rounded-lg text-sm text-gray-700 transition-colors"
                    >
                      <Inbox size={14} />
                      Open Approvals
                      <span className="bg-pastel-orange text-xs px-2 py-0.5 rounded-full font-semibold">{pendingRequestCount}</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div>
                {myOpenTasks.length > 0 ? (
                  <div className="space-y-2">
                    {myOpenTasks.map(task => {
                      const overdue = task.dueDate && new Date(task.dueDate) < new Date()
                      return (
                        <div
                          key={task.id}
                          className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${
                            overdue ? 'bg-red-50 border border-red-200' : 'bg-gray-50'
                          }`}
                        >
                          <span className={`truncate flex-1 ${overdue ? 'text-red-700' : 'text-gray-700'}`}>
                            {task.title}
                          </span>
                          <div className="flex items-center gap-2 shrink-0 ml-2">
                            {task.dueDate && (
                              <span className={`text-xs ${overdue ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
                                {formatDate(task.dueDate)}
                              </span>
                            )}
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              task.status === 'todo' ? 'bg-pastel-blue/40' :
                              task.status === 'done' ? 'bg-green-100 text-green-700' :
                              'bg-pastel-orange/40'
                            }`}>
                              {task.status}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                    {myOverflow > 0 && (
                      <p className="text-xs text-gray-400 text-center">+{myOverflow} more</p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No open tasks assigned to you</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* 3. Status Dashboard (hidden for guest) */}
        {!isGuest && (
          <div className="grid grid-cols-2 gap-3">
            {isTop ? (
              <>
                <StatCard icon={CheckCircle2} label="Team Tasks Done" value={stats.allDone.length} color="text-green-500" bg="bg-green-50" />
                <StatCard icon={AlertCircle} label="Open Tasks" value={stats.allOpen.length} color="text-pastel-blue-dark" bg="bg-pastel-blue/20" />
                <StatCard icon={Inbox} label="Pending Requests" value={pendingRequestCount} color="text-pastel-orange-dark" bg="bg-pastel-orange/20" />
                <StatCard icon={Users} label="Total Tasks" value={stats.allTasks.length} color="text-pastel-pink-dark" bg="bg-pastel-pink/20" />
              </>
            ) : (
              <>
                <StatCard icon={CheckCircle2} label="My Done Tasks" value={stats.myDone.length} color="text-green-500" bg="bg-green-50" />
                <StatCard icon={AlertCircle} label="My Open Tasks" value={stats.myOpen.length} color="text-pastel-blue-dark" bg="bg-pastel-blue/20" />
                <StatCard icon={Clock} label="Attendance" value="--" color="text-pastel-orange-dark" bg="bg-pastel-orange/20" />
                <StatCard icon={Zap} label="Outreach Hrs" value="--" color="text-pastel-pink-dark" bg="bg-pastel-pink/20" />
              </>
            )}
          </div>
        )}

        {/* 4. Quick Action Buttons */}
        <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm p-4">
          <h2 className="font-semibold text-gray-700 mb-3">Quick Actions</h2>
          <div className="flex flex-wrap gap-2">
            <QuickAction icon={FolderKanban} label="Open Boards" onClick={() => onTabChange('business')} />
            <QuickAction icon={Calendar} label="View Calendar" onClick={() => onTabChange('calendar')} />
            {!isGuest && (
              <>
                <QuickAction icon={ClipboardList} label="Submit Scouting" onClick={() => onTabChange('scouting')} />
                <QuickAction icon={BookOpen} label="Notebook" onClick={() => onTabChange('notebook')} />
                <QuickAction icon={MessageCircle} label="Quick Chat" onClick={() => onTabChange('quick-chat')} />
              </>
            )}
            {isTop && (
              <>
                <QuickAction
                  icon={Inbox}
                  label="Approvals"
                  badge={pendingRequestCount > 0 ? pendingRequestCount : null}
                  onClick={() => onTabChange('requests')}
                />
                <QuickAction icon={Shield} label="Manage Users" onClick={() => onTabChange('user-management')} />
              </>
            )}
          </div>
        </div>

        {/* 5. Team Pulse (hidden for guest) */}
        {!isGuest && (
          <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm p-4">
            <h2 className="font-semibold text-gray-700 mb-2">Team Pulse</h2>
            <div className="space-y-1 text-sm text-gray-600">
              {pendingRequestCount > 0 && (
                <p>{pendingRequestCount} request{pendingRequestCount !== 1 ? 's' : ''} pending approval</p>
              )}
              {stats.nextDeadline && (
                <p>
                  Next deadline: <span className="font-medium">{stats.nextDeadline.title}</span>{' '}
                  due {formatDate(stats.nextDeadline.dueDate)}
                </p>
              )}
              {pendingRequestCount === 0 && !stats.nextDeadline && (
                <p className="text-gray-400">All clear — nothing urgent right now</p>
              )}
            </div>
          </div>
        )}

        {/* 6. Random Quote Footer */}
        {!isGuest && (
          <div className="text-center py-3">
            {quote ? (
              <p className="text-sm italic text-gray-400">
                "{quote.content}"
                {quote.submitted_by && <span className="not-italic"> — {quote.submitted_by}</span>}
              </p>
            ) : (
              <p className="text-sm italic text-gray-400">No fun quotes yet — submit one in the Notebook!</p>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, color, bg }) {
  return (
    <div className={`${bg} rounded-xl p-3 flex items-center gap-3`}>
      <Icon size={20} className={color} />
      <div>
        <p className="text-xl font-bold text-gray-800">{value}</p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </div>
  )
}

function QuickAction({ icon: Icon, label, badge, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-2 bg-pastel-blue/20 hover:bg-pastel-blue/40 rounded-lg text-sm text-gray-700 transition-colors"
    >
      <Icon size={16} />
      {label}
      {badge && (
        <span className="bg-pastel-orange text-xs px-1.5 py-0.5 rounded-full font-semibold">{badge}</span>
      )}
    </button>
  )
}

export default HomeView
