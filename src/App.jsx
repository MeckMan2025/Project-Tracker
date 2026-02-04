import { useState, useEffect } from 'react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { Plus, Download, Upload } from 'lucide-react'
import { loadTasksFromCSV, downloadCSV } from './utils/csvUtils'
import TaskModal from './components/TaskModal'
import TaskCard from './components/TaskCard'
import Sidebar from './components/Sidebar'

const COLUMNS = [
  { id: 'todo', title: 'To Do', color: 'bg-pastel-blue' },
  { id: '25', title: '25%', color: 'bg-pastel-pink' },
  { id: '50', title: '50%', color: 'bg-pastel-orange' },
  { id: '75', title: '75%', color: 'bg-pastel-pink' },
  { id: 'done', title: 'Done', color: 'bg-pastel-blue' },
]

const DEFAULT_TABS = [
  { id: 'main', name: 'Main Board' },
]

function App() {
  const [tabs, setTabs] = useState(() => {
    const saved = localStorage.getItem('scrum-tabs')
    return saved ? JSON.parse(saved) : DEFAULT_TABS
  })
  const [activeTab, setActiveTab] = useState(() => {
    const saved = localStorage.getItem('scrum-active-tab')
    return saved || 'main'
  })
  const [tasksByTab, setTasksByTab] = useState(() => {
    const saved = localStorage.getItem('scrum-tasks')
    return saved ? JSON.parse(saved) : { main: [] }
  })
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingTask, setEditingTask] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Load initial tasks from CSV if no saved data
  useEffect(() => {
    const saved = localStorage.getItem('scrum-tasks')
    if (!saved) {
      loadTasksFromCSV().then(tasks => {
        setTasksByTab({ main: tasks })
      })
    }
  }, [])

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem('scrum-tabs', JSON.stringify(tabs))
  }, [tabs])

  useEffect(() => {
    localStorage.setItem('scrum-active-tab', activeTab)
  }, [activeTab])

  useEffect(() => {
    localStorage.setItem('scrum-tasks', JSON.stringify(tasksByTab))
  }, [tasksByTab])

  const tasks = tasksByTab[activeTab] || []

  const setTasks = (updater) => {
    setTasksByTab(prev => ({
      ...prev,
      [activeTab]: typeof updater === 'function' ? updater(prev[activeTab] || []) : updater,
    }))
  }

  const handleAddTab = (name) => {
    const newTab = {
      id: String(Date.now()),
      name,
    }
    setTabs(prev => [...prev, newTab])
    setTasksByTab(prev => ({ ...prev, [newTab.id]: [] }))
    setActiveTab(newTab.id)
  }

  const handleDeleteTab = (tabId) => {
    if (tabs.length <= 1) return
    setTabs(prev => prev.filter(t => t.id !== tabId))
    setTasksByTab(prev => {
      const updated = { ...prev }
      delete updated[tabId]
      return updated
    })
    if (activeTab === tabId) {
      setActiveTab(tabs.find(t => t.id !== tabId)?.id || 'main')
    }
  }

  const handleDragEnd = (result) => {
    if (!result.destination) return

    const { source, destination, draggableId } = result

    if (source.droppableId === destination.droppableId) return

    setTasks(prev =>
      prev.map(task =>
        task.id === draggableId
          ? { ...task, status: destination.droppableId }
          : task
      )
    )
  }

  const getTasksByStatus = (status) => {
    return tasks.filter(task => task.status === status)
  }

  const handleAddTask = (newTask) => {
    const task = {
      ...newTask,
      id: String(Date.now()),
      createdAt: new Date().toISOString().split('T')[0],
    }
    setTasks(prev => [...prev, task])
    setIsModalOpen(false)
  }

  const handleEditTask = (updatedTask) => {
    setTasks(prev =>
      prev.map(task => (task.id === updatedTask.id ? updatedTask : task))
    )
    setEditingTask(null)
  }

  const handleDeleteTask = (taskId) => {
    setTasks(prev => prev.filter(task => task.id !== taskId))
  }

  const handleExport = () => {
    const currentTab = tabs.find(t => t.id === activeTab)
    downloadCSV(tasks, `${currentTab?.name || 'tasks'}.csv`)
  }

  const handleImport = (event) => {
    const file = event.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target.result
      import('papaparse').then(Papa => {
        const result = Papa.default.parse(text, {
          header: true,
          skipEmptyLines: true,
        })
        const importedTasks = result.data.map(task => ({
          ...task,
          skills: task.skills ? task.skills.split(';') : [],
        }))
        setTasks(importedTasks)
      })
    }
    reader.readAsText(file)
    event.target.value = ''
  }

  const currentTabName = tabs.find(t => t.id === activeTab)?.name || 'Board'

  return (
    <div className="min-h-screen bg-gradient-to-br from-pastel-blue/30 via-pastel-pink/20 to-pastel-orange/30 flex">
      {/* Sidebar */}
      <Sidebar
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onAddTab={handleAddTab}
        onDeleteTab={handleDeleteTab}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
          <div className="px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4 pl-10 md:pl-0">
              <div>
                <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-pastel-blue-dark via-pastel-pink-dark to-pastel-orange-dark bg-clip-text text-transparent">
                  Everything That's Scrum
                </h1>
                <p className="text-sm text-gray-500">{currentTabName}</p>
              </div>
            </div>
            <div className="flex gap-2">
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
              <button
                onClick={handleExport}
                className="flex items-center gap-2 px-3 md:px-4 py-2 bg-pastel-orange hover:bg-pastel-orange-dark rounded-lg transition-colors"
              >
                <Download size={18} />
                <span className="hidden sm:inline">Export</span>
              </button>
              <button
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-2 px-3 md:px-4 py-2 bg-pastel-pink hover:bg-pastel-pink-dark rounded-lg transition-colors"
              >
                <Plus size={18} />
                <span className="hidden sm:inline">Add Task</span>
              </button>
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
  )
}

export default App
