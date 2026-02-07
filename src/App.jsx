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
import { useUser } from './contexts/UserContext'
import { usePresence } from './hooks/usePresence'
import { supabase } from './supabase'

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

const SYSTEM_TABS = [SCOUTING_TAB, BOARDS_TAB, DATA_TAB, AI_TAB, CHAT_TAB, TASKS_TAB, NOTEBOOK_TAB, ORG_TAB]

function App() {
  const { username, isLead } = useUser()
  const onlineUsers = usePresence(username)
  const [isLoading, setIsLoading] = useState(true)
  const [tabs, setTabs] = useState([...SYSTEM_TABS])
  const [activeTab, setActiveTab] = useState(() => {
    const saved = localStorage.getItem('scrum-active-tab')
    return saved || 'business'
  })
  const [tasksByTab, setTasksByTab] = useState({})
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingTask, setEditingTask] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [dbReady, setDbReady] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [musicStarted, setMusicStarted] = useState(false)
  const audioRef = useRef(null)

  // Load boards and tasks from Supabase on mount
  useEffect(() => {
    async function loadData() {
      // Load boards
      const { data: boards } = await supabase
        .from('boards')
        .select('*')
        .order('created_at')

      if (boards) {
        const boardTabs = boards.map(b => ({
          id: b.id,
          name: b.name,
          permanent: b.permanent,
        }))
        setTabs([...SYSTEM_TABS, ...boardTabs])
      }

      // Load tasks
      const { data: tasks } = await supabase
        .from('tasks')
        .select('*')

      if (tasks) {
        const grouped = {}
        if (boards) {
          boards.forEach(b => { grouped[b.id] = [] })
        }
        tasks.forEach(t => {
          if (!grouped[t.board_id]) grouped[t.board_id] = []
          grouped[t.board_id].push({
            id: t.id,
            title: t.title,
            description: t.description,
            assignee: t.assignee,
            dueDate: t.due_date,
            status: t.status,
            skills: t.skills || [],
            createdAt: t.created_at,
          })
        })
        setTasksByTab(grouped)
      }

      setDbReady(true)
    }

    loadData()
  }, [])

  // Real-time: listen for board changes
  useEffect(() => {
    const channel = supabase
      .channel('boards-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'boards' }, async () => {
        const { data: boards } = await supabase.from('boards').select('*').order('created_at')
        if (boards) {
          const boardTabs = boards.map(b => ({
            id: b.id,
            name: b.name,
            permanent: b.permanent,
          }))
          setTabs([...SYSTEM_TABS, ...boardTabs])
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  // Real-time: listen for task changes
  useEffect(() => {
    const channel = supabase
      .channel('tasks-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, async () => {
        const { data: tasks } = await supabase.from('tasks').select('*')
        const { data: boards } = await supabase.from('boards').select('id')
        if (tasks && boards) {
          const grouped = {}
          boards.forEach(b => { grouped[b.id] = [] })
          tasks.forEach(t => {
            if (!grouped[t.board_id]) grouped[t.board_id] = []
            grouped[t.board_id].push({
              id: t.id,
              title: t.title,
              description: t.description,
              assignee: t.assignee,
              dueDate: t.due_date,
              status: t.status,
              skills: t.skills || [],
              createdAt: t.created_at,
            })
          })
          setTasksByTab(grouped)
        }
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
    const newId = String(Date.now())
    const { error } = await supabase.from('boards').insert({
      id: newId,
      name,
      permanent: false,
    })
    if (!error) {
      setTabs(prev => [...prev, { id: newId, name, permanent: false }])
      setTasksByTab(prev => ({ ...prev, [newId]: [] }))
      setActiveTab(newId)
    }
  }

  const handleDeleteTab = async (tabId) => {
    if (tabId === 'scouting' || tabId === 'boards' || tabId === 'data' || tabId === 'ai-manual' || tabId === 'quick-chat' || tabId === 'tasks' || tabId === 'notebook' || tabId === 'org-chart') return
    const board = tabs.find(t => t.id === tabId)
    if (board?.permanent) return

    await supabase.from('tasks').delete().eq('board_id', tabId)
    await supabase.from('boards').delete().eq('id', tabId)

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
    await supabase.from('tasks').update({ status: destination.droppableId }).eq('id', draggableId)
  }

  const getTasksByStatus = (status) => {
    return tasks.filter(task => task.status === status)
  }

  const handleAddTask = async (newTask) => {
    const task = {
      id: String(Date.now()),
      board_id: activeTab,
      title: newTask.title,
      description: newTask.description || '',
      assignee: newTask.assignee || '',
      due_date: newTask.dueDate || '',
      status: newTask.status || 'todo',
      skills: newTask.skills || [],
      created_at: new Date().toISOString().split('T')[0],
    }

    const { error } = await supabase.from('tasks').insert(task)
    if (!error) {
      const localTask = {
        id: task.id,
        title: task.title,
        description: task.description,
        assignee: task.assignee,
        dueDate: task.due_date,
        status: task.status,
        skills: task.skills,
        createdAt: task.created_at,
      }
      setTasksByTab(prev => ({
        ...prev,
        [activeTab]: [...(prev[activeTab] || []), localTask],
      }))
    }
    setIsModalOpen(false)
  }

  const handleEditTask = async (updatedTask) => {
    await supabase.from('tasks').update({
      title: updatedTask.title,
      description: updatedTask.description || '',
      assignee: updatedTask.assignee || '',
      due_date: updatedTask.dueDate || '',
      status: updatedTask.status || 'todo',
      skills: updatedTask.skills || [],
    }).eq('id', updatedTask.id)

    setTasksByTab(prev => ({
      ...prev,
      [activeTab]: (prev[activeTab] || []).map(task =>
        task.id === updatedTask.id ? updatedTask : task
      ),
    }))
    setEditingTask(null)
  }

  const handleDeleteTask = async (taskId) => {
    await supabase.from('tasks').delete().eq('id', taskId)

    setTasksByTab(prev => ({
      ...prev,
      [activeTab]: (prev[activeTab] || []).filter(task => task.id !== taskId),
    }))
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
        // Reload tasks
        const { data } = await supabase.from('tasks').select('*').eq('board_id', activeTab)
        if (data) {
          setTasksByTab(prev => ({
            ...prev,
            [activeTab]: data.map(t => ({
              id: t.id,
              title: t.title,
              description: t.description,
              assignee: t.assignee,
              dueDate: t.due_date,
              status: t.status,
              skills: t.skills || [],
              createdAt: t.created_at,
            })),
          }))
        }
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

  return (
    <>
      {isLoading && <LoadingScreen onComplete={handleLoadingComplete} onMusicStart={handleMusicStart} />}
    <div className={`min-h-screen bg-gradient-to-br from-pastel-blue/30 via-pastel-pink/20 to-pastel-orange/30 flex ${isLoading ? 'hidden' : ''}`}>
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
      ) : activeTab === 'tasks' ? (
        <TasksView tasksByTab={tasksByTab} tabs={tabs} />
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
      ) : activeTab === 'data' || activeTab === 'notebook' ? (
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
            <div className="flex gap-2">
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
              {isLead && (
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="flex items-center gap-2 px-3 md:px-4 py-2 bg-pastel-pink hover:bg-pastel-pink-dark rounded-lg transition-colors"
                >
                  <Plus size={18} />
                  <span className="hidden sm:inline">Add Task</span>
                </button>
              )}
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
    </div>
    </>
  )
}

export default App
