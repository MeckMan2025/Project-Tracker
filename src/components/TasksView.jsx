import { Calendar, User, Zap } from 'lucide-react'
import { usePermissions } from '../hooks/usePermissions'
import RequestsBadge from './RequestsBadge'
import NotificationBell from './NotificationBell'

function TasksView({ tasksByTab, tabs }) {
  const { canReviewRequests, isGuest } = usePermissions()
  const boardTabs = tabs.filter(t => !t.type)

  const totalTasks = boardTabs.reduce((sum, tab) => sum + (tasksByTab[tab.id] || []).length, 0)

  const boardColors = [
    { border: 'border-pastel-blue', text: 'text-pastel-blue-dark' },
    { border: 'border-pastel-pink', text: 'text-pastel-pink-dark' },
    { border: 'border-pastel-orange', text: 'text-pastel-orange-dark' },
  ]

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="px-4 py-4 pl-14 md:pl-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-pastel-blue-dark via-pastel-pink-dark to-pastel-orange-dark bg-clip-text text-transparent">
              All Tasks
            </h1>
            <p className="text-sm text-gray-500">{totalTasks} task{totalTasks !== 1 ? 's' : ''} across all boards</p>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            {canReviewRequests && <RequestsBadge type="task" />}
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 overflow-y-auto">
        {totalTasks === 0 ? (
          <div className="flex items-center justify-center h-[60vh]">
            <p className="text-gray-400">No tasks yet</p>
          </div>
        ) : (
          <div className="space-y-8 px-2 md:px-6">
            {boardTabs.map((tab, index) => {
              const tasks = tasksByTab[tab.id] || []
              const color = boardColors[index % boardColors.length]
              return (
                <div key={tab.id}>
                  <h2 className={`text-lg font-bold ${color.text} mb-3 border-b-2 ${color.border} pb-2`}>
                    {tab.name}
                    <span className="ml-2 text-sm font-normal text-gray-400">({tasks.length})</span>
                  </h2>
                  {tasks.length === 0 ? (
                    <p className="text-sm text-gray-400 ml-2">No tasks</p>
                  ) : (
                    <div className="flex flex-nowrap gap-3 overflow-x-auto pb-2 snap-x snap-mandatory md:snap-none">
                      {tasks.map(task => {
                        const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'done'
                        const isUpForGrabs = task.assignee === '__up_for_grabs__'
                        return (
                          <div
                            key={task.id}
                            className={`bg-white rounded-lg p-3 shadow-sm border-l-4 shrink-0 w-[220px] snap-center ${
                              isUpForGrabs ? 'border-l-amber-400' : isOverdue ? 'border-l-red-400' : 'border-l-pastel-pink-dark'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <h3 className="font-medium text-gray-800 text-sm truncate">{task.title}</h3>
                            </div>
                            <span className="text-[10px] text-gray-400 capitalize">{task.status === 'todo' ? 'To Do' : task.status === 'done' ? 'Done' : task.status + '%'}</span>

                            {task.description && (
                              <p className="text-xs text-gray-500 mb-1 line-clamp-3 mt-1">{task.description}</p>
                            )}

                            {task.skills && task.skills.length > 0 && (
                              <div className="flex flex-wrap gap-1 mb-1">
                                {task.skills.map((skill, i) => (
                                  <span key={i} className="text-[10px] px-1.5 py-0.5 bg-pastel-orange/50 text-gray-600 rounded-full">
                                    {skill}
                                  </span>
                                ))}
                              </div>
                            )}

                            <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-1">
                              {isUpForGrabs ? (
                                <span className="flex items-center gap-0.5 text-amber-500 font-medium">
                                  <Zap size={8} />
                                  Up for Grabs
                                </span>
                              ) : task.assignee ? (
                                <span className="flex items-center gap-0.5">
                                  <User size={8} />
                                  {task.assignee}
                                </span>
                              ) : null}
                              {task.dueDate && (
                                <span className={`flex items-center gap-0.5 ${isOverdue ? 'text-red-400' : ''}`}>
                                  <Calendar size={8} />
                                  {task.dueDate}
                                </span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}

export default TasksView
