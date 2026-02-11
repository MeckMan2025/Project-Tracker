import { useState, useEffect, useCallback, useRef } from 'react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { Plus, Download, Upload } from 'lucide-react'
import { downloadCSV } from './utils/csvUtils'
import TaskModal from './components/TaskModal'
import TaskCard from './components/TaskCard'
import Sidebar from './components/Sidebar'
import LoadingScreen from './components/LoadingScreen'
import LoginScreen from './components/LoginScreen'
import ScoutingForm from './components/ScoutingForm'
import TasksView from './components/TasksView'
import QuickChat from './components/QuickChat'
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
import { useUser } from './contexts/UserContext'
import { usePresence } from './hooks/usePresence'
import { supabase } from './supabase'

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
        <input
          type="password"
          value={pw}
          onChange={(e) => { setPw(e.target.value); setError('') }}
          placeholder="New password"
          className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-pastel-blue focus:border-transparent text-center text-lg"
          autoFocus
          required
        />
        <input
          type="password"
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

const SCOUTING_TAB = { id: 'scouting', name: 'Scouting', type: 'scouting' }
const BOARDS_TAB = { id: 'boards', name: 'Boards', type: 'boards' }
const DATA_TAB = { id: 'data', name: 'Data', type: 'data' }
const AI_TAB = { id: 'ai-manual', name: 'AI Manual', type: 'ai-manual' }
const CHAT_TAB = { id: 'quick-chat', name: 'Quick Chat', type: 'quick-chat' }
const TASKS_TAB = { id: 'tasks', name: 'Tasks', type: 'tasks' }
const NOTEBOOK_TAB = { id: 'notebook', name: 'Engineering Notebook', type: 'notebook' }
const ORG_TAB = { id: 'org-chart', name: 'Org Chart', type: 'org-chart' }
const SUGGESTIONS_TAB = { id: 'suggestions', name: 'Suggestions', type: 'suggestions' }
const CALENDAR_TAB = { id: 'calendar', name: 'Calendar', type: 'calendar' }
const SCHEDULE_TAB = { id: 'schedule', name: 'Schedule', type: 'schedule' }
const WORKSHOPS_TAB = { id: 'workshops', name: 'Workshops', type: 'workshops' }
const ATTENDANCE_TAB = { id: 'attendance', name: 'Attendance', type: 'attendance' }
const USER_MGMT_TAB = { id: 'user-management', name: 'User Management', type: 'user-management' }

const DEFAULT_BOARDS = [
  { id: 'business', name: 'Business', permanent: true },
  { id: 'technical', name: 'Technical', permanent: true },
  { id: 'programming', name: 'Programming', permanent: true },
]

const SYSTEM_TABS = [SCOUTING_TAB, BOARDS_TAB, DATA_TAB, AI_TAB, CHAT_TAB, TASKS_TAB, WORKSHOPS_TAB, NOTEBOOK_TAB, ORG_TAB, SUGGESTIONS_TAB, CALENDAR_TAB, SCHEDULE_TAB, ATTENDANCE_TAB, USER_MGMT_TAB]

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

function App() {
  const { username, isLead, user, loading, passwordRecovery, mustChangePassword, updatePassword, sessionExpired } = useUser()
  const { onlineUsers, presenceState } = usePresence(username)
  const [isLoading, setIsLoading] = useState(true)
  const [tabs, setTabs] = useState([...SYSTEM_TABS, ...DEFAULT_BOARDS])
  const [activeTab, setActiveTab] = useState(() => {
    const saved = localStorage.getItem('scrum-active-tab')
    return saved || 'business'
  })
  const [tasksByTab, setTasksByTab] = useState({})
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false)
  const [editingTask, setEditingTask] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [dbReady, setDbReady] = useState(false)
  const [loadError, setLoadError] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [musicStarted, setMusicStarted] = useState(false)
  const audioRef = useRef(null)

  // Load boards and tasks from Supabase once user is authenticated
  const loadData = useCallback(async () => {
    if (!user) return
    setLoadError(null)
    setDbReady(false)

    try {
      // Load boards
      const { data: boards, error: boardsError } = await supabase
        .from('boards')
        .select('*')
        .order('created_at')

      if (boardsError) {
        console.error('Failed to load boards:', boardsError.message)
        setLoadError('Failed to load boards: ' + boardsError.message)
        setDbReady(true)
        return
      }

      // Seed default boards if missing
      const existingIds = (boards || []).map(b => b.id)
      const missing = DEFAULT_BOARDS.filter(b => !existingIds.includes(b.id))
      if (missing.length > 0) {
        const { error: seedError } = await supabase
          .from('boards')
          .upsert(missing.map(b => ({ id: b.id, name: b.name, permanent: true })))
        if (seedError) {
          console.error('Failed to seed default boards:', seedError.message)
        }
      }

      // Re-query boards after seeding so we have a complete list
      const allBoards = missing.length > 0
        ? [...(boards || []), ...missing.map(b => ({ id: b.id, name: b.name, permanent: true }))]
        : (boards || [])

      const boardTabs = allBoards.map(b => ({
        id: b.id,
        name: b.name,
        permanent: b.permanent,
      }))
      const defaultIds = DEFAULT_BOARDS.map(b => b.id)
      const extra = boardTabs.filter(b => !defaultIds.includes(b.id))
      setTabs([...SYSTEM_TABS, ...DEFAULT_BOARDS, ...extra])

      // Load tasks
      const { data: tasks, error: tasksError } = await supabase
        .from('tasks')
        .select('*')

      if (tasksError) {
        console.error('Failed to load tasks:', tasksError.message)
        setLoadError('Failed to load tasks: ' + tasksError.message)
        setDbReady(true)
        return
      }

      const grouped = {}
      allBoards.forEach(b => { grouped[b.id] = [] })
      if (tasks) {
        tasks.forEach(t => {
          if (!grouped[t.board_id]) grouped[t.board_id] = []
          grouped[t.board_id].push(mapTask(t))
        })
      }
      setTasksByTab(grouped)
      setDbReady(true)
    } catch (err) {
      console.error('Unexpected error loading data:', err)
      setLoadError('Failed to load data. Please try again.')
      setDbReady(true)
    }
  }, [user])

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
  }, [activeTab])

  const tasks = tasksByTab[activeTab] || []

  const handleAddTab = async (name) => {
    const newId = String(Date.now()) + Math.random().toString(36).slice(2)
    // Update UI immediately (optimistic)
    setTabs(prev => [...prev, { id: newId, name, permanent: false }])
    setTasksByTab(prev => ({ ...prev, [newId]: [] }))
    setActiveTab(newId)
    // Persist to Supabase
    const { error } = await supabase.from('boards').insert({
      id: newId,
      name,
      permanent: false,
    })
    if (error) {
      console.error('Failed to save board:', error.message)
      // Rollback on failure
      setTabs(prev => prev.filter(t => t.id !== newId))
      setTasksByTab(prev => {
        const updated = { ...prev }
        delete updated[newId]
        return updated
      })
      setActiveTab('business')
      alert('Failed to create board. Please try again.')
    }
  }

  const handleDeleteTab = async (tabId) => {
    if (tabId === 'scouting' || tabId === 'boards' || tabId === 'data' || tabId === 'ai-manual' || tabId === 'quick-chat' || tabId === 'tasks' || tabId === 'workshops' || tabId === 'notebook' || tabId === 'org-chart' || tabId === 'calendar' || tabId === 'attendance' || tabId === 'user-management' || tabId === 'profile' || tabId === 'requests' || tabId === 'schedule') return
    const board = tabs.find(t => t.id === tabId)
    if (board?.permanent) return

    // Update UI immediately
    setTabs(prev => prev.filter(t => t.id !== tabId))
    setTasksByTab(prev => {
      const updated = { ...prev }
      delete updated[tabId]
      return updated
    })
    if (activeTab === tabId) {
      setActiveTab('business')
    }

    // Then persist to Supabase
    try {
      await supabase.from('tasks').delete().eq('board_id', tabId)
      await supabase.from('boards').delete().eq('id', tabId)
    } catch (err) {
      console.error('Error deleting board:', err)
    }
  }

  const handleDragEnd = async (result) => {
    if (!result.destination) return
    const { source, destination, draggableId } = result
    if (source.droppableId === destination.droppableId) return

    // Update locally
    setTasksByTab(prev => ({
      ...prev,
      [activeTab]: (prev[activeTab] || []).map(task =>
        task.id === draggableId
          ? { ...task, status: destination.droppableId }
          : task
      ),
    }))

    // Update in Supabase
    const { error } = await supabase.from('tasks').update({ status: destination.droppableId }).eq('id', draggableId)
    if (error) {
      console.error('Failed to update task status:', error.message)
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

    // Add to local state immediately (optimistic) — realtime handler will dedup
    const localTask = mapTask(task)
    setTasksByTab(prev => ({
      ...prev,
      [activeTab]: [...(prev[activeTab] || []), localTask],
    }))
    setIsModalOpen(false)

    // Persist to Supabase
    const { error } = await supabase.from('tasks').insert(task)
    if (error) {
      console.error('Failed to save task:', error.message)
      // Rollback on failure
      setTasksByTab(prev => ({
        ...prev,
        [activeTab]: (prev[activeTab] || []).filter(t => t.id !== task.id),
      }))
      alert('Failed to save task. Please try again.')
    }
  }

  const handleRequestTask = async (newTask) => {
    try {
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
        status: 'pending',
        board_id: activeTab,
      }
      await supabase.from('requests').insert(request)
      alert('Request sent! A lead will review it.')
    } catch (err) {
      console.error('Error submitting request:', err)
    }
    setIsRequestModalOpen(false)
  }

  const handleEditTask = async (updatedTask) => {
    // Update UI immediately — realtime handler will overwrite with same data
    setTasksByTab(prev => ({
      ...prev,
      [activeTab]: (prev[activeTab] || []).map(task =>
        task.id === updatedTask.id ? updatedTask : task
      ),
    }))
    setEditingTask(null)

    const { error } = await supabase.from('tasks').update({
      title: updatedTask.title,
      description: updatedTask.description || '',
      assignee: updatedTask.assignee || '',
      due_date: updatedTask.dueDate || '',
      status: updatedTask.status || 'todo',
      skills: updatedTask.skills || [],
    }).eq('id', updatedTask.id)
    if (error) {
      console.error('Failed to update task:', error.message)
    }
  }

  const handleDeleteTask = async (taskId) => {
    // Remove from UI immediately — realtime handler will dedup
    setTasksByTab(prev => ({
      ...prev,
      [activeTab]: (prev[activeTab] || []).filter(task => task.id !== taskId),
    }))

    const { error } = await supabase.from('tasks').delete().eq('id', taskId)
    if (error) {
      console.error('Failed to delete task:', error.message)
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
        await supabase.from('tasks').insert(importedTasks)
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
    if (isLead) return true
    return task.assignee && task.assignee.toLowerCase() === username.toLowerCase()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pastel-blue/30 via-pastel-pink/20 to-pastel-orange/30 flex items-center justify-center">
        <p className="text-gray-500 text-lg animate-pulse">Loading...</p>
      </div>
    )
  }

  if (!user || passwordRecovery) {
    return <LoginScreen sessionExpired={sessionExpired} />
  }

  if (mustChangePassword) {
    return <ForcePasswordChange updatePassword={updatePassword} />
  }

  return (
    <>
      {isLoading && <LoadingScreen onComplete={handleLoadingComplete} onMusicStart={handleMusicStart} />}
    <div className={`min-h-screen bg-gradient-to-br from-pastel-blue/30 via-pastel-pink/20 to-pastel-orange/30 flex flex-col ${isLoading ? 'hidden' : ''}`}>
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
        isLead={isLead}
      />

      {/* Main Content */}
      {activeTab === 'scouting' ? (
        <ScoutingForm />
      ) : activeTab === 'schedule' ? (
        <ScoutingSchedule />
      ) : activeTab === 'tasks' ? (
        <TasksView tasksByTab={tasksByTab} tabs={tabs} />
      ) : activeTab === 'workshops' ? (
        <div className="flex-1 flex flex-col min-w-0">
          <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
            <div className="px-4 py-3 ml-14">
              <h1 className="text-xl font-bold bg-gradient-to-r from-pastel-blue-dark via-pastel-pink-dark to-pastel-orange-dark bg-clip-text text-transparent">
                Workshops
              </h1>
              <p className="text-sm text-gray-500">Coming soon</p>
            </div>
          </header>
          <div className="flex-1 flex items-center justify-center">
            <p className="text-xl font-semibold text-gray-500 text-center px-4">
              KAYDEN AND YUKTI ARE WORKING ON IT &lt;3
            </p>
          </div>
        </div>
      ) : activeTab === 'quick-chat' ? (
        <QuickChat />
      ) : activeTab === 'ai-manual' ? (
        <div className="flex-1 flex flex-col items-center justify-center min-w-0 gap-6 p-4">
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
      ) : activeTab === 'org-chart' ? (
        <OrgChart />
      ) : activeTab === 'suggestions' ? (
        <SuggestionsView />
      ) : activeTab === 'calendar' ? (
        <CalendarView />
      ) : activeTab === 'user-management' ? (
        <UserManagement />
      ) : activeTab === 'requests' ? (
        <RequestsView />
      ) : activeTab === 'profile' ? (
        <ProfileView />
      ) : activeTab === 'data' ? (
        <ScoutingData />
      ) : activeTab === 'notebook' ? (
        <EngineeringNotebook />
      ) : activeTab === 'attendance' ? (
        <div className="flex-1 flex items-center justify-center min-w-0">
          <p className="text-xl font-semibold text-gray-500 text-center px-4">
            KAYDEN AND YUKTI ARE WORKING ON IT &lt;3
          </p>
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
              {isLead && <RequestsBadge type="task" boardId={activeTab} />}
              {isLead && (
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
              {isLead ? (
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="flex items-center gap-2 px-3 md:px-4 py-2 bg-pastel-pink hover:bg-pastel-pink-dark rounded-lg transition-colors"
                >
                  <Plus size={18} />
                  <span className="hidden sm:inline">Add Task</span>
                </button>
              ) : (
                <button
                  onClick={() => setIsRequestModalOpen(true)}
                  className="flex items-center gap-2 px-3 md:px-4 py-2 bg-pastel-blue hover:bg-pastel-blue-dark rounded-lg transition-colors"
                >
                  <Plus size={18} />
                  <span className="hidden sm:inline">Request Task</span>
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Board */}
        <main className="flex-1 p-4 overflow-x-auto">
          {!dbReady ? (
            <div className="flex items-center justify-center h-48">
              <p className="text-gray-500 animate-pulse">Loading boards...</p>
            </div>
          ) : (
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
                                  isLead={isLead}
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
          )}
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
