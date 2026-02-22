import { useState, useEffect, useCallback, useRef } from 'react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { Plus, Download, Upload } from 'lucide-react'
import { downloadCSV } from './utils/csvUtils'
import { triggerPush } from './utils/pushHelper'
import TaskModal from './components/TaskModal'
import TaskCard from './components/TaskCard'
import Sidebar from './components/Sidebar'
import LoadingScreen from './components/LoadingScreen'
import PasswordInput from './components/PasswordInput'
import LoginScreen from './components/LoginScreen'
import LandingScreen from './components/LandingScreen'
import TeamInfoPage from './components/TeamInfoPage'
import ScoutingForm from './components/ScoutingForm'
import TasksView from './components/TasksView'

import OrgChart from './components/OrgChart'
import SuggestionsView from './components/SuggestionsView'
import CalendarView from './components/CalendarView'
import UserManagement from './components/UserManagement'
import RequestsView from './components/RequestsView'
import RequestsBadge from './components/RequestsBadge'
import ProfileView from './components/ProfileView'
import ScoutingData from './components/ScoutingData'
import EngineeringNotebook from './components/EngineeringNotebook'
import ScoutingSchedule from './components/ScoutingSchedule'
import HomeView from './components/HomeView'
import QuotesManager from './components/QuotesManager'
import AttendanceManager from './components/AttendanceManager'
import AttendanceView from './components/AttendanceView'
import WorkshopIdeas from './components/WorkshopIdeas'
import ChangelogPopup from './components/ChangelogPopup'
import StateCelebration from './components/StateCelebration'

import { useUser } from './contexts/UserContext'
import { usePermissions } from './hooks/usePermissions'
import { usePresence } from './hooks/usePresence'
import RestrictedAccess from './components/RestrictedAccess'
import NotificationBell from './components/NotificationBell'
import { useToast } from './components/ToastProvider'
import { supabase } from './supabase'

// REST API helpers (avoids Supabase JS client auth token issues)
const REST_URL = import.meta.env.VITE_SUPABASE_URL
const REST_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const REST_HEADERS = { 'apikey': REST_KEY, 'Authorization': `Bearer ${REST_KEY}` }
const REST_JSON = { ...REST_HEADERS, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' }

async function restGet(table, query = '') {
  const res = await fetch(`${REST_URL}/rest/v1/${table}?${query}`, { headers: REST_HEADERS })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
async function restInsert(table, data) {
  const res = await fetch(`${REST_URL}/rest/v1/${table}`, {
    method: 'POST', headers: REST_JSON, body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(await res.text())
}
async function restUpdate(table, filter, data) {
  const res = await fetch(`${REST_URL}/rest/v1/${table}?${filter}`, {
    method: 'PATCH', headers: REST_JSON, body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(await res.text())
}
async function restDelete(table, filter) {
  const res = await fetch(`${REST_URL}/rest/v1/${table}?${filter}`, {
    method: 'DELETE', headers: REST_HEADERS,
  })
  if (!res.ok) throw new Error(await res.text())
}

// Tab access requirements: which minimum tier is needed
const TAB_ACCESS = {
  // All tiers (including guest)
  'home': 'guest', 'boards': 'guest', 'tasks': 'guest', 'calendar': 'guest',
  'profile': 'guest', 'ai-manual': 'guest', 'data': 'guest', 'suggestions': 'teammate',
  // Teammate+ (restricted from guests)
  'org-chart': 'teammate', 'scouting': 'teammate', 'schedule': 'teammate',
  'notebook': 'teammate', 'workshops': 'teammate', 'special-controls': 'teammate',
  'attendance': 'teammate', 'user-management': 'teammate', 'requests': 'teammate',
}

const TIER_RANK = { guest: 0, teammate: 1, top: 2 }

function hasAccess(tab, tier) {
  const required = TAB_ACCESS[tab]
  if (!required) return true // board tabs (dynamic) — accessible to all
  return (TIER_RANK[tier] || 0) >= (TIER_RANK[required] || 0)
}

function ForcePasswordChange({ updatePassword }) {
  const [pw, setPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (pw.length < 6) { setError('Password must be at least 6 characters'); return }
    if (pw !== confirm) { setError('Passwords do not match'); return }
    setSubmitting(true)
    try {
      await updatePassword(pw)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pastel-blue/30 via-pastel-pink/20 to-pastel-orange/30 flex items-center justify-center">
      <form onSubmit={handleSubmit} className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-8 w-80 space-y-5">
        <div className="text-center">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-pastel-blue-dark via-pastel-pink-dark to-pastel-orange-dark bg-clip-text text-transparent">
            Set Your Password
          </h1>
          <p className="text-sm text-gray-500 mt-1">You must set a new password before continuing</p>
        </div>
        <PasswordInput
          value={pw}
          onChange={(e) => { setPw(e.target.value); setError('') }}
          placeholder="New password"
          className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-pastel-blue focus:border-transparent text-center text-lg"
          autoFocus
          required
        />
        <PasswordInput
          value={confirm}
          onChange={(e) => { setConfirm(e.target.value); setError('') }}
          placeholder="Confirm password"
          className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-pastel-blue focus:border-transparent text-center text-lg"
          required
        />
        {error && <p className="text-sm text-red-500 text-center">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3 bg-pastel-pink hover:bg-pastel-pink-dark disabled:opacity-50 rounded-xl font-semibold text-gray-700 transition-colors text-lg"
        >
          {submitting ? 'Setting password...' : 'Set Password'}
        </button>
      </form>
    </div>
  )
}

const COLUMNS = [
  { id: 'todo', title: 'To Do', color: 'bg-pastel-blue' },
  { id: '25', title: '25%', color: 'bg-pastel-pink' },
  { id: '50', title: '50%', color: 'bg-pastel-orange' },
  { id: '75', title: '75%', color: 'bg-pastel-pink' },
  { id: 'done', title: 'Done', color: 'bg-pastel-blue' },
]

const HOME_TAB = { id: 'home', name: 'Home', type: 'home' }
const SCOUTING_TAB = { id: 'scouting', name: 'Scouting', type: 'scouting' }
const BOARDS_TAB = { id: 'boards', name: 'Boards', type: 'boards' }
const DATA_TAB = { id: 'data', name: 'Data', type: 'data' }
const AI_TAB = { id: 'ai-manual', name: 'AI Manual', type: 'ai-manual' }
const TASKS_TAB = { id: 'tasks', name: 'Tasks', type: 'tasks' }
const NOTEBOOK_TAB = { id: 'notebook', name: 'Engineering Notebook', type: 'notebook' }
const ORG_TAB = { id: 'org-chart', name: 'Org Chart', type: 'org-chart' }
const SUGGESTIONS_TAB = { id: 'suggestions', name: 'Suggestions', type: 'suggestions' }
const CALENDAR_TAB = { id: 'calendar', name: 'Calendar', type: 'calendar' }
const SCHEDULE_TAB = { id: 'schedule', name: 'Schedule', type: 'schedule' }
const WORKSHOPS_TAB = { id: 'workshops', name: 'Workshops', type: 'workshops' }
const ATTENDANCE_TAB = { id: 'attendance', name: 'Attendance', type: 'attendance' }
const USER_MGMT_TAB = { id: 'user-management', name: 'User Management', type: 'user-management' }
const SPECIAL_TAB = { id: 'special-controls', name: 'Special Controls', type: 'special-controls' }

const DEFAULT_BOARDS = [
  { id: 'business', name: 'Business', permanent: true },
  { id: 'technical', name: 'Technical', permanent: true },
  { id: 'programming', name: 'Programming', permanent: true },
]

const SYSTEM_TABS = [HOME_TAB, SCOUTING_TAB, BOARDS_TAB, DATA_TAB, AI_TAB, TASKS_TAB, WORKSHOPS_TAB, NOTEBOOK_TAB, ORG_TAB, SUGGESTIONS_TAB, CALENDAR_TAB, SCHEDULE_TAB, ATTENDANCE_TAB, USER_MGMT_TAB, SPECIAL_TAB]

const mapTask = (t) => ({
  id: t.id,
  title: t.title,
  description: t.description,
  assignee: t.assignee,
  dueDate: t.due_date,
  status: t.status,
  skills: t.skills || [],
  createdAt: t.created_at,
})

// Restore cached data from localStorage for instant load
function getCachedData() {
  try {
    const cached = localStorage.getItem('scrum-cache')
    if (cached) {
      const { tabs: cachedTabs, tasksByTab: cachedTasks } = JSON.parse(cached)
      if (cachedTabs && cachedTasks) {
        return { tabs: [...SYSTEM_TABS, ...cachedTabs], tasksByTab: cachedTasks }
      }
    }
  } catch (e) { /* ignore corrupt cache */ }
  return null
}

const ROLE_EMOJIS = {
  'Website': { emoji: '💻', label: 'Web Developer' },
  'Build': { emoji: '🔧', label: 'Builder' },
  'CAD': { emoji: '📐', label: 'CAD Designer' },
  'Scouting': { emoji: '🔍', label: 'Scout' },
  'Business': { emoji: '🤝', label: 'Business Specialist' },
  'Communications': { emoji: '📣', label: 'Communications Lead' },
  'Programming': { emoji: '⌨️', label: 'Programmer' },
  'Co-Founder': { emoji: '👑', label: 'Co-Founder' },
  'Mentor': { emoji: '🎓', label: 'Mentor' },
  'Coach': { emoji: '🏆', label: 'Coach' },
  'Team Lead': { emoji: '🚀', label: 'Team Lead' },
  'Business Lead': { emoji: '💼', label: 'Business Lead' },
  'Technical Lead': { emoji: '⚙️', label: 'Technical Lead' },
}

function RoleChangeModal({ alert, onDismiss }) {
  if (!alert) return null

  let emoji = '🎉'
  let title = ''
  let subtitle = ''

  if (alert.type === 'added') {
    const role = alert.roles[0]
    const info = ROLE_EMOJIS[role] || { emoji: '🎉', label: role }
    emoji = info.emoji
    title = `You're now: ${role}!`
    subtitle = alert.roles.length > 1
      ? `Also added: ${alert.roles.slice(1).join(', ')}`
      : 'Your permissions have been updated.'
  } else if (alert.type === 'removed') {
    emoji = '📋'
    title = `Role removed: ${alert.roles.join(', ')}`
    subtitle = 'Your permissions have been updated.'
  } else if (alert.type === 'tier') {
    const tierLabels = { top: 'Admin', teammate: 'Teammate', guest: 'Guest' }
    emoji = alert.tier === 'guest' ? '👁️' : alert.tier === 'top' ? '⭐' : '🤝'
    title = `Access level: ${tierLabels[alert.tier] || alert.tier}`
    subtitle = 'Your permissions have been updated.'
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-[100]" onClick={onDismiss} />
      <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-80 pointer-events-auto text-center animate-bounce-in">
          <div className="text-7xl mb-4">{emoji}</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">{title}</h2>
          <p className="text-sm text-gray-500 mb-6">{subtitle}</p>
          <button
            onClick={onDismiss}
            className="px-6 py-2.5 bg-pastel-pink hover:bg-pastel-pink-dark rounded-xl font-semibold text-gray-700 transition-colors"
          >
            Got it!
          </button>
        </div>
      </div>
    </>
  )
}

function App() {
  const { username, isLead, user, loading, passwordRecovery, mustChangePassword, updatePassword, sessionExpired, roleChangeAlert, dismissRoleChangeAlert } = useUser()
  const { canEditContent, canRequestContent, canReviewRequests, canImport, canDragAnyTask, canDragOwnTask, canManageUsers, tier, isGuest, hasLeadTag } = usePermissions()
  const { addToast } = useToast()
  const { onlineUsers, presenceState } = usePresence(username)
  const [isLoading, setIsLoading] = useState(true)
  const [radicalMsg] = useState(() => {
    const msgs = ['Getting Radical...', 'Revving the robots...', 'Charging up the SCRUM...', 'Radical Robotics incoming...', 'Deploying radical vibes...', 'Scrumming it up...', 'Activating turbo mode...', 'Warming up the gears...']
    return msgs[Math.floor(Math.random() * msgs.length)]
  })
  const cachedData = useRef(getCachedData())
  const [tabs, setTabs] = useState(() => cachedData.current?.tabs || [...SYSTEM_TABS, ...DEFAULT_BOARDS])
  const [activeTab, setActiveTab] = useState(() => {
    const saved = localStorage.getItem('scrum-active-tab')
    // Clear removed tabs so users don't land on a dead page
    const removed = ['quick-chat', 'announcements']
    if (saved && removed.includes(saved)) {
      localStorage.removeItem('scrum-active-tab')
      return 'home'
    }
    return saved || 'home'
  })
  const [tasksByTab, setTasksByTab] = useState(() => cachedData.current?.tasksByTab || {})
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false)
  const [editingTask, setEditingTask] = useState(null)


  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [specialView, setSpecialView] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [landingChoice, setLandingChoice] = useState(null)
  const [viewingProfileId, setViewingProfileId] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [musicStarted, setMusicStarted] = useState(false)
  const audioRef = useRef(null)

  // Heartbeat: update last_seen_at every 10s so attendance knows who's online
  // Users who stop pinging for >15s are considered offline
  useEffect(() => {
    if (!username) return
    const filter = `display_name=eq.${encodeURIComponent(username)}`
    const ping = () => {
      restUpdate('profiles', filter, { last_seen_at: new Date().toISOString() }).catch(() => {})
    }
    ping() // immediate on login
    const interval = setInterval(ping, 10000)
    return () => clearInterval(interval)
  }, [username])

  // Keep localStorage cache in sync so refresh always has latest data
  const syncCache = useCallback((updatedTasks) => {
    try {
      const boardTabs = tabs.filter(t => !t.type)
      if (boardTabs.length > 0) {
        localStorage.setItem('scrum-cache', JSON.stringify({ tabs: boardTabs, tasksByTab: updatedTasks }))
      }
    } catch (e) { /* ignore quota errors */ }
  }, [tabs])

  // Send a notification when someone is assigned a task
  const notifyAssignee = useCallback(async (assigneeName, taskTitle) => {
    if (!assigneeName || assigneeName === '__up_for_grabs__' || !taskTitle) return
    // Don't notify yourself
    if (assigneeName.toLowerCase() === username.toLowerCase()) return
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
    const headers = { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
    try {
      // Look up the assignee's user ID by display_name
      const res = await fetch(
        `${supabaseUrl}/rest/v1/profiles?display_name=ilike.${encodeURIComponent(assigneeName)}&select=id`,
        { headers }
      )
      if (!res.ok) return
      const profiles = await res.json()
      if (!profiles || profiles.length === 0) return
      const targetUserId = profiles[0].id
      const notif = {
        id: String(Date.now()) + Math.random().toString(36).slice(2),
        user_id: targetUserId,
        type: 'task_assigned',
        title: 'Task Assigned',
        body: `${username} assigned you to "${taskTitle}"`,
      }
      await fetch(`${supabaseUrl}/rest/v1/notifications`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
        body: JSON.stringify(notif),
      })
      triggerPush(notif)
    } catch (err) {
      console.error('Failed to notify assignee:', err)
    }
  }, [username])

  // Load boards and tasks from Supabase once user is authenticated
  const loadData = useCallback(async () => {
    if (!user) return
    setLoadError(null)

    try {
      // Load boards and tasks in parallel via REST
      const [boards, tasks] = await Promise.all([
        restGet('boards', 'select=*&order=created_at'),
        restGet('tasks', 'select=*'),
      ])

      // Seed default boards if missing
      const existingIds = boards.map(b => b.id)
      const missing = DEFAULT_BOARDS.filter(b => !existingIds.includes(b.id))
      if (missing.length > 0) {
        try {
          for (const b of missing) {
            await restInsert('boards', { id: b.id, name: b.name, permanent: true })
          }
        } catch (e) {
          console.error('Failed to seed default boards:', e.message)
        }
      }

      const allBoards = missing.length > 0
        ? [...boards, ...missing.map(b => ({ id: b.id, name: b.name, permanent: true }))]
        : boards

      const defaultIds = DEFAULT_BOARDS.map(b => b.id)
      const extra = allBoards
        .filter(b => !defaultIds.includes(b.id))
        .map(b => ({ id: b.id, name: b.name, permanent: b.permanent }))
      const boardTabs = [...DEFAULT_BOARDS, ...extra]
      setTabs([...SYSTEM_TABS, ...boardTabs])

      const grouped = {}
      allBoards.forEach(b => { grouped[b.id] = [] })
      tasks.forEach(t => {
        if (!grouped[t.board_id]) grouped[t.board_id] = []
        grouped[t.board_id].push(mapTask(t))
      })
      setTasksByTab(grouped)

      // Cache for instant load next time
      try {
        localStorage.setItem('scrum-cache', JSON.stringify({ tabs: boardTabs, tasksByTab: grouped }))
      } catch (e) { /* ignore quota errors */ }
    } catch (err) {
      console.error('Unexpected error loading data:', err)
      setLoadError('Failed to load data. Please try again.')
    }
  }, [user?.id])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Real-time: listen for board changes (use payload, no re-query)
  useEffect(() => {
    const channel = supabase
      .channel('boards-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'boards' }, (payload) => {
        const b = payload.new
        setTabs(prev => {
          if (prev.some(t => t.id === b.id)) return prev
          return [...prev, { id: b.id, name: b.name, permanent: b.permanent }]
        })
        setTasksByTab(prev => ({ ...prev, [b.id]: prev[b.id] || [] }))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'boards' }, (payload) => {
        const id = payload.old.id
        setTabs(prev => prev.filter(t => t.id !== id))
        setTasksByTab(prev => {
          const updated = { ...prev }
          delete updated[id]
          return updated
        })
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  // Real-time: listen for task changes (use payload, no re-query)
  useEffect(() => {
    const channel = supabase
      .channel('tasks-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tasks' }, (payload) => {
        const task = mapTask(payload.new)
        const boardId = payload.new.board_id
        setTasksByTab(prev => {
          const existing = prev[boardId] || []
          if (existing.some(t => t.id === task.id)) return prev
          return { ...prev, [boardId]: [...existing, task] }
        })
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tasks' }, (payload) => {
        const task = mapTask(payload.new)
        const boardId = payload.new.board_id
        setTasksByTab(prev => ({
          ...prev,
          [boardId]: (prev[boardId] || []).map(t => t.id === task.id ? task : t),
        }))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'tasks' }, (payload) => {
        const id = payload.old.id
        setTasksByTab(prev => {
          const updated = {}
          for (const boardId in prev) {
            updated[boardId] = prev[boardId].filter(t => t.id !== id)
          }
          return updated
        })
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  // Save activeTab locally (each user picks their own view)
  useEffect(() => {
    localStorage.setItem('scrum-active-tab', activeTab)
    if (activeTab !== 'special-controls') setSpecialView(null)
  }, [activeTab])

  const tasks = tasksByTab[activeTab] || []

  const handleAddTab = async (name) => {
    const newId = String(Date.now()) + Math.random().toString(36).slice(2)
    // Update UI immediately (optimistic)
    setTabs(prev => [...prev, { id: newId, name, permanent: false }])
    setTasksByTab(prev => ({ ...prev, [newId]: [] }))
    setActiveTab(newId)
    // Persist via REST
    try {
      await restInsert('boards', { id: newId, name, permanent: false })
    } catch (err) {
      console.error('Failed to save board:', err.message)
      setTabs(prev => prev.filter(t => t.id !== newId))
      setTasksByTab(prev => {
        const updated = { ...prev }
        delete updated[newId]
        return updated
      })
      setActiveTab('business')
      addToast('Failed to create board. Please try again.', 'error')
    }
  }

  const handleDeleteTab = async (tabId) => {
    if (tabId === 'home' || tabId === 'scouting' || tabId === 'boards' || tabId === 'data' || tabId === 'ai-manual' || tabId === 'tasks' || tabId === 'workshops' || tabId === 'notebook' || tabId === 'org-chart' || tabId === 'calendar' || tabId === 'attendance' || tabId === 'user-management' || tabId === 'profile' || tabId === 'requests' || tabId === 'schedule' || tabId === 'special-controls') return
    const board = tabs.find(t => t.id === tabId)
    if (board?.permanent) return

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
    const restHeaders = { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }

    // Delete tasks for this board via REST
    const tasksRes = await fetch(`${supabaseUrl}/rest/v1/tasks?board_id=eq.${tabId}`, {
      method: 'DELETE',
      headers: restHeaders,
    })
    if (!tasksRes.ok) {
      addToast('Failed to delete board tasks.', 'error')
      return
    }

    // Delete the board itself via REST
    const boardRes = await fetch(`${supabaseUrl}/rest/v1/boards?id=eq.${tabId}`, {
      method: 'DELETE',
      headers: restHeaders,
    })
    if (!boardRes.ok) {
      addToast('Failed to delete board.', 'error')
      return
    }

    // Supabase confirmed — now update UI
    setTabs(prev => prev.filter(t => t.id !== tabId))
    setTasksByTab(prev => {
      const updated = { ...prev }
      delete updated[tabId]
      return updated
    })
    if (activeTab === tabId) {
      setActiveTab('business')
    }
  }

  const handleDragEnd = async (result) => {
    if (!result.destination) return
    const { source, destination, draggableId } = result
    if (source.droppableId === destination.droppableId) return

    // Update locally + sync cache
    setTasksByTab(prev => {
      const updated = {
        ...prev,
        [activeTab]: (prev[activeTab] || []).map(task =>
          task.id === draggableId
            ? { ...task, status: destination.droppableId }
            : task
        ),
      }
      syncCache(updated)
      return updated
    })

    // Update via REST
    try {
      await restUpdate('tasks', `id=eq.${draggableId}`, { status: destination.droppableId })
    } catch (err) {
      console.error('Failed to update task status:', err.message)
      addToast('Failed to move task.', 'error')
    }
  }

  const getTasksByStatus = (status) => {
    return tasks.filter(task => task.status === status)
  }

  const handleAddTask = async (newTask) => {
    const task = {
      id: String(Date.now()) + Math.random().toString(36).slice(2),
      board_id: activeTab,
      title: newTask.title,
      description: newTask.description || '',
      assignee: newTask.assignee || '',
      due_date: newTask.dueDate || '',
      status: newTask.status || 'todo',
      skills: newTask.skills || [],
      created_at: new Date().toISOString().split('T')[0],
    }

    // Add to local state immediately (optimistic) + sync cache
    const localTask = mapTask(task)
    setTasksByTab(prev => {
      const updated = {
        ...prev,
        [activeTab]: [...(prev[activeTab] || []), localTask],
      }
      syncCache(updated)
      return updated
    })
    setIsModalOpen(false)

    // Persist via REST
    try {
      await restInsert('tasks', task)
      if (task.assignee) notifyAssignee(task.assignee, task.title)
    } catch (err) {
      console.error('Failed to save task:', err.message)
      setTasksByTab(prev => {
        const updated = {
          ...prev,
          [activeTab]: (prev[activeTab] || []).filter(t => t.id !== task.id),
        }
        syncCache(updated)
        return updated
      })
      addToast('Failed to save task. Please try again.', 'error')
    }
  }

  const handleClaimTask = async (taskId) => {
    // Optimistic update: assign to current user
    const prevTasks = tasksByTab[activeTab] || []
    setTasksByTab(prev => {
      const updated = {
        ...prev,
        [activeTab]: (prev[activeTab] || []).map(task =>
          task.id === taskId ? { ...task, assignee: username } : task
        ),
      }
      syncCache(updated)
      return updated
    })

    // Race-condition guard: only claim if still up for grabs
    try {
      const res = await fetch(`${REST_URL}/rest/v1/tasks?id=eq.${taskId}&assignee=eq.__up_for_grabs__`, {
        method: 'PATCH',
        headers: { ...REST_JSON, 'Prefer': 'return=representation' },
        body: JSON.stringify({ assignee: username }),
      })
      const data = res.ok ? await res.json() : []
      if (!res.ok || !data || data.length === 0) {
        setTasksByTab(prev => {
          const updated = { ...prev, [activeTab]: prevTasks }
          syncCache(updated)
          return updated
        })
        addToast(!res.ok ? 'Failed to claim task.' : 'Someone else already claimed this task.', 'error')
      } else {
        addToast('Task claimed!', 'success')
      }
    } catch (err) {
      setTasksByTab(prev => {
        const updated = { ...prev, [activeTab]: prevTasks }
        syncCache(updated)
        return updated
      })
      addToast('Failed to claim task.', 'error')
    }
  }

  const handleLeaveTaskRequest = async (task) => {
    // Check for duplicate pending leave_task request
    const { data: existing } = await supabase
      .from('requests')
      .select('id')
      .eq('type', 'leave_task')
      .eq('status', 'pending')
      .eq('requested_by_user_id', user.id)
      .eq('board_id', activeTab)

    if (existing && existing.length > 0) {
      // Check if any match this exact task
      // We store task_id in data, so also check via data filter client-side
      const hasDupe = existing.some(r => true) // any pending leave_task from this user on this board
      if (hasDupe) {
        addToast('You already have a pending leave request on this board.', 'error')
        return
      }
    }

    const request = {
      id: String(Date.now()) + Math.random().toString(36).slice(2),
      type: 'leave_task',
      data: {
        task_id: task.id,
        title: task.title,
        assignee: task.assignee,
      },
      requested_by: username,
      requested_by_user_id: user.id,
      status: 'pending',
      board_id: activeTab,
    }

    addToast('Leave request sent! A lead will review it.', 'success')
    try {
      await supabase.from('requests').insert(request)
    } catch (err) {
      console.error('Error submitting leave request:', err)
    }
  }

  const handleRequestTask = async (newTask) => {
    setIsRequestModalOpen(false)
    const request = {
      id: String(Date.now()) + Math.random().toString(36).slice(2),
      type: 'task',
      data: {
        title: newTask.title,
        description: newTask.description || '',
        assignee: newTask.assignee || '',
        dueDate: newTask.dueDate || '',
        status: newTask.status || 'todo',
        skills: newTask.skills || [],
      },
      requested_by: username,
      requested_by_user_id: user.id,
      status: 'pending',
      board_id: activeTab,
    }
    addToast('Request sent! A lead will review it.', 'success')
    try {
      await supabase.from('requests').insert(request)
    } catch (err) {
      console.error('Error submitting request:', err)
    }
  }

  const handleEditTask = async (updatedTask) => {
    // Save for rollback
    const prevTasks = tasksByTab[activeTab] || []
    const oldTask = prevTasks.find(t => t.id === updatedTask.id)

    // Update UI immediately + sync cache
    setTasksByTab(prev => {
      const updated = {
        ...prev,
        [activeTab]: (prev[activeTab] || []).map(task =>
          task.id === updatedTask.id ? updatedTask : task
        ),
      }
      syncCache(updated)
      return updated
    })
    setEditingTask(null)

    try {
      await restUpdate('tasks', `id=eq.${updatedTask.id}`, {
        title: updatedTask.title,
        description: updatedTask.description || '',
        assignee: updatedTask.assignee || '',
        due_date: updatedTask.dueDate || '',
        status: updatedTask.status || 'todo',
        skills: updatedTask.skills || [],
      })
      const newAssignee = updatedTask.assignee || ''
      const oldAssignee = oldTask?.assignee || ''
      if (newAssignee && newAssignee !== oldAssignee) {
        notifyAssignee(newAssignee, updatedTask.title)
      }
    } catch (err) {
      console.error('Failed to update task:', err.message)
      setTasksByTab(prev => {
        const updated = { ...prev, [activeTab]: prevTasks }
        syncCache(updated)
        return updated
      })
      addToast('Failed to update task.', 'error')
    }
  }

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return

    // Save for rollback
    const prevTasks = tasksByTab[activeTab] || []

    // Optimistic UI update — remove immediately
    setTasksByTab(prev => {
      const updated = {
        ...prev,
        [activeTab]: (prev[activeTab] || []).filter(task => task.id !== taskId),
      }
      syncCache(updated)
      return updated
    })

    try {
      await restDelete('tasks', `id=eq.${taskId}`)
    } catch (err) {
      console.error('Failed to delete task:', err.message)
      setTasksByTab(prev => {
        const updated = { ...prev, [activeTab]: prevTasks }
        syncCache(updated)
        return updated
      })
      addToast('Failed to delete task.', 'error')
    }
  }

  const handleExport = () => {
    const currentTab = tabs.find(t => t.id === activeTab)
    downloadCSV(tasks, `${currentTab?.name || 'tasks'}.csv`)
  }

  const handleImport = (event) => {
    const file = event.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (e) => {
      const text = e.target.result
      const Papa = await import('papaparse')
      const result = Papa.default.parse(text, {
        header: true,
        skipEmptyLines: true,
      })
      const importedTasks = result.data.map(task => ({
        id: String(Date.now()) + Math.random().toString(36).slice(2),
        board_id: activeTab,
        title: task.title || '',
        description: task.description || '',
        assignee: task.assignee || '',
        due_date: task.dueDate || '',
        status: task.status || 'todo',
        skills: task.skills ? task.skills.split(';') : [],
        created_at: task.createdAt || new Date().toISOString().split('T')[0],
      }))

      if (importedTasks.length > 0) {
        await restInsert('tasks', importedTasks)
        // Update local state directly - realtime handler deduplicates
        setTasksByTab(prev => ({
          ...prev,
          [activeTab]: [...(prev[activeTab] || []), ...importedTasks.map(mapTask)],
        }))
      }
    }
    reader.readAsText(file)
    event.target.value = ''
  }

  const currentTabName = tabs.find(t => t.id === activeTab)?.name || 'Board'

  const handleLoadingComplete = useCallback(() => {
    setIsLoading(false)
  }, [])

  const handleMusicStart = useCallback((audio) => {
    audioRef.current = audio
    setIsPlaying(true)
    setMusicStarted(true)
    audio.addEventListener('ended', () => setIsPlaying(false))
  }, [])

  const toggleMusic = () => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) {
      audio.play().catch(() => {})
      setIsPlaying(true)
    } else {
      audio.pause()
      setIsPlaying(false)
    }
  }

  const canDragTask = (task) => {
    if (canDragAnyTask) return true
    if (!canDragOwnTask) return false
    return task.assignee && task.assignee.toLowerCase() === username.toLowerCase()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pastel-blue/30 via-pastel-pink/20 to-pastel-orange/30 flex flex-col items-center justify-center gap-4">
        <img src="/ScrumLogo-transparent.png" alt="Loading" className="w-20 h-20 animate-spin-slow" />
        <p className="text-gray-500 text-lg animate-pulse font-semibold">{radicalMsg}</p>
      </div>
    )
  }

  if (!user) {
    if (passwordRecovery) {
      return <LoginScreen sessionExpired={sessionExpired} />
    }
    if (landingChoice === 'login') {
      return <LoginScreen sessionExpired={sessionExpired} onBack={() => setLandingChoice(null)} />
    }
    if (landingChoice === 'team-info') {
      return <TeamInfoPage onBack={() => setLandingChoice(null)} />
    }
    return (
      <LandingScreen
        onGetRadical={() => setLandingChoice('login')}
        onRadicalRundown={() => setLandingChoice('team-info')}
      />
    )
  }

  if (mustChangePassword) {
    return <ForcePasswordChange updatePassword={updatePassword} />
  }

  return (
    <>
      {isLoading && <LoadingScreen onComplete={handleLoadingComplete} onMusicStart={handleMusicStart} />}
      {!isLoading && <ChangelogPopup />}
    <div className={`min-h-screen bg-gradient-to-br from-pastel-blue/30 via-pastel-pink/20 to-pastel-orange/30 flex flex-col relative ${isLoading ? 'hidden' : ''}`}>
      <StateCelebration />
      {loadError && (
        <div className="bg-red-100 border border-red-300 text-red-700 px-4 py-2 text-sm text-center flex items-center justify-center gap-3">
          <span>{loadError}</span>
          <button
            onClick={loadData}
            className="px-3 py-1 bg-red-200 hover:bg-red-300 rounded-lg text-red-800 font-semibold transition-colors"
          >
            Retry
          </button>
        </div>
      )}
      {/* Role change celebration modal */}
      <RoleChangeModal alert={roleChangeAlert} onDismiss={dismissRoleChangeAlert} />

      <div className="flex flex-1 min-h-0">
      {/* Sidebar */}
      <Sidebar
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onAddTab={handleAddTab}
        onDeleteTab={handleDeleteTab}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        isPlaying={isPlaying}
        onToggleMusic={toggleMusic}
        musicStarted={musicStarted}
        onlineUsers={onlineUsers}


      />


      {/* Main Content */}
      {!hasAccess(activeTab, tier) ? (
        <RestrictedAccess feature={tabs.find(t => t.id === activeTab)?.name || activeTab} />
      ) : activeTab === 'home' ? (
        <HomeView tasksByTab={tasksByTab} tabs={tabs} onTabChange={setActiveTab} />
      ) : activeTab === 'scouting' ? (
        <ScoutingForm />
      ) : activeTab === 'schedule' ? (
        <ScoutingSchedule />
      ) : activeTab === 'tasks' ? (
        <TasksView tasksByTab={tasksByTab} tabs={tabs} />
      ) : activeTab === 'workshops' ? (
        <WorkshopIdeas />
      ) : activeTab === 'ai-manual' ? (
        <div className="flex-1 flex flex-col min-w-0">
          <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
            <div className="px-4 py-3 ml-14 flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-pastel-blue-dark via-pastel-pink-dark to-pastel-orange-dark bg-clip-text text-transparent">
                  AI Manual
                </h1>
              </div>
              <NotificationBell />
            </div>
          </header>
          <div className="flex-1 flex flex-col items-center justify-center gap-6 p-4">
          <div className="text-center">
            <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-pastel-blue-dark via-pastel-pink-dark to-pastel-orange-dark bg-clip-text text-transparent mb-2">
              AI Manual
            </h1>
            <p className="text-gray-500">Ask questions about the FTC Competition Manual</p>
          </div>
          <a
            href="https://ftc-cmchatbot.firstinspires.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-3 bg-pastel-pink hover:bg-pastel-pink-dark rounded-xl font-semibold text-gray-700 shadow-md transition-colors text-lg"
          >
            Open FTC AI Chatbot
          </a>
          <p className="text-xs text-gray-400 text-center max-w-sm">
            Powered by FIRST. Trained on the current Competition Manual — always verify answers against the official manual.
          </p>
          </div>
        </div>
      ) : activeTab === 'org-chart' ? (
        <OrgChart onViewProfile={(profileId) => { setViewingProfileId(profileId); setActiveTab('profile') }} />
      ) : activeTab === 'suggestions' ? (
        <SuggestionsView />
      ) : activeTab === 'calendar' ? (
        <CalendarView />
      ) : activeTab === 'user-management' ? (
        <UserManagement />
      ) : activeTab === 'requests' ? (
        <RequestsView tabs={tabs} />
      ) : activeTab === 'profile' ? (
        <ProfileView viewingProfileId={viewingProfileId} onClearViewing={() => setViewingProfileId(null)} />
      ) : activeTab === 'data' ? (
        <ScoutingData />
      ) : activeTab === 'notebook' ? (
        <EngineeringNotebook />
      ) : activeTab === 'attendance' ? (
        <AttendanceView />
      ) : activeTab === 'special-controls' ? (
        <div className="flex-1 flex flex-col min-w-0">
          <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
            <div className="px-4 py-3 ml-14 flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-pastel-blue-dark via-pastel-pink-dark to-pastel-orange-dark bg-clip-text text-transparent">
                  Special Controls
                </h1>
              </div>
              <NotificationBell />
            </div>
          </header>
          {specialView === 'quotes' ? (
            <QuotesManager onBack={() => setSpecialView(null)} />
          ) : specialView === 'attendance' ? (
            <AttendanceManager onBack={() => setSpecialView(null)} />
          ) : (
            <div className="flex-1 p-6">
              <div className="max-w-md mx-auto grid gap-4">
                <button
                  onClick={() => setSpecialView('quotes')}
                  className="w-full px-6 py-4 bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm hover:shadow-md hover:bg-white transition-all text-left"
                >
                  <span className="text-lg font-semibold text-gray-700">Quotes</span>
                  <p className="text-sm text-gray-400 mt-1">Submit a fun quote or joke</p>
                </button>
                {hasLeadTag && (
                  <button
                    onClick={() => setSpecialView('attendance')}
                    className="w-full px-6 py-4 bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm hover:shadow-md hover:bg-white transition-all text-left"
                  >
                    <span className="text-lg font-semibold text-gray-700">Attendance</span>
                    <p className="text-sm text-gray-400 mt-1">Take and manage meeting attendance</p>
                  </button>
                )}
                {hasLeadTag && (
                  <button
                    className="w-full px-6 py-4 bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm hover:shadow-md hover:bg-white transition-all text-left"
                  >
                    <span className="text-lg font-semibold text-gray-700">Comp Day</span>
                    <p className="text-sm text-gray-400 mt-1">Coming soon</p>
                  </button>
                )}
                {hasLeadTag && ['SWOT Mode', 'Meeting Stats', 'Scouting Mode', 'Testing'].map(label => (
                  <button
                    key={label}
                    className="w-full px-6 py-4 bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm hover:shadow-md hover:bg-white transition-all text-left"
                  >
                    <span className="text-lg font-semibold text-gray-700">{label}</span>
                    <p className="text-sm text-gray-400 mt-1">Coming soon</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
          <div className="px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4 ml-10">
              <div>
                <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-pastel-blue-dark via-pastel-pink-dark to-pastel-orange-dark bg-clip-text text-transparent">
                  Everything That's Scrum
                </h1>
                <p className="text-sm text-gray-500">{currentTabName}</p>
              </div>
            </div>
            <div className="flex gap-2 items-center">
              <NotificationBell />
              {canReviewRequests && <RequestsBadge type="task" boardId={activeTab} />}
              {canImport && (
                <label className="flex items-center gap-2 px-3 md:px-4 py-2 bg-pastel-blue hover:bg-pastel-blue-dark rounded-lg cursor-pointer transition-colors">
                  <Upload size={18} />
                  <span className="hidden sm:inline">Import</span>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleImport}
                    className="hidden"
                  />
                </label>
              )}
              <button
                onClick={handleExport}
                className="flex items-center gap-2 px-3 md:px-4 py-2 bg-pastel-orange hover:bg-pastel-orange-dark rounded-lg transition-colors"
              >
                <Download size={18} />
                <span className="hidden sm:inline">Export</span>
              </button>
              {canEditContent ? (
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="flex items-center gap-2 px-3 md:px-4 py-2 bg-pastel-pink hover:bg-pastel-pink-dark rounded-lg transition-colors"
                >
                  <Plus size={18} />
                  <span className="hidden sm:inline">Add Task</span>
                </button>
              ) : canRequestContent ? (
                <button
                  onClick={() => setIsRequestModalOpen(true)}
                  className="flex items-center gap-2 px-3 md:px-4 py-2 bg-pastel-blue hover:bg-pastel-blue-dark rounded-lg transition-colors"
                >
                  <Plus size={18} />
                  <span className="hidden sm:inline">Request Task</span>
                </button>
              ) : null}
            </div>
          </div>
        </header>

        {/* Board */}
        <main className="flex-1 p-4 overflow-x-auto">
          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 min-w-[300px]">
              {COLUMNS.map(column => (
                <div key={column.id} className="flex flex-col">
                  <div className={`${column.color} rounded-t-lg px-4 py-2 font-semibold text-gray-700`}>
                    {column.title}
                    <span className="ml-2 text-sm font-normal text-gray-500">
                      ({getTasksByStatus(column.id).length})
                    </span>
                  </div>
                  <Droppable droppableId={column.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`flex-1 min-h-[200px] p-2 rounded-b-lg transition-colors ${
                          snapshot.isDraggingOver
                            ? 'bg-white/80'
                            : 'bg-white/50'
                        }`}
                      >
                        {getTasksByStatus(column.id).map((task, index) => (
                          <Draggable
                            key={task.id}
                            draggableId={task.id}
                            index={index}
                            isDragDisabled={!canDragTask(task)}
                          >
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                              >
                                <TaskCard
                                  task={task}
                                  isDragging={snapshot.isDragging}
                                  onEdit={() => setEditingTask(task)}
                                  onDelete={() => handleDeleteTask(task.id)}
                                  canEdit={canEditContent}
                                  onClaim={handleClaimTask}
                                  onLeaveTask={handleLeaveTaskRequest}
                                  currentUser={username}
                                  isGuest={isGuest}
                                />
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              ))}
            </div>
          </DragDropContext>
        </main>
      </div>
      )}

      {/* Add/Edit Task Modal */}
      {(isModalOpen || editingTask) && (
        <TaskModal
          task={editingTask}
          onSave={editingTask ? handleEditTask : handleAddTask}
          onClose={() => {
            setIsModalOpen(false)
            setEditingTask(null)
          }}
          isLead={canEditContent}
        />
      )}

      {/* Request Task Modal (non-leads) */}
      {isRequestModalOpen && (
        <TaskModal
          task={null}
          onSave={handleRequestTask}
          onClose={() => setIsRequestModalOpen(false)}
          requestMode
        />
      )}



      </div>
    </div>
    </>
  )
}

export default App
