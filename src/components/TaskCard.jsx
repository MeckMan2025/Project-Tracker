import { Calendar, User, Pencil, Trash2, MessageCircle } from 'lucide-react'

function TaskCard({ task, isDragging, onEdit, onDelete }) {
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'done'

  return (
    <div
      className={`bg-white rounded-lg p-3 mb-2 shadow-sm border-l-4 transition-shadow ${
        isDragging ? 'shadow-lg' : 'hover:shadow-md'
      } ${isOverdue ? 'border-l-red-400' : 'border-l-pastel-pink-dark'}`}
    >
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-medium text-gray-800 flex-1">{task.title}</h3>
        <div className="flex gap-1 ml-2">
          <button
            onClick={onEdit}
            className="p-1 text-gray-400 hover:text-pastel-blue-dark rounded"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={onDelete}
            className="p-1 text-gray-400 hover:text-red-400 rounded"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {task.description && (
        <p className="text-sm text-gray-500 mb-2 line-clamp-2">
          {task.description}
        </p>
      )}

      {task.skills && task.skills.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {task.skills.map((skill, i) => (
            <span
              key={i}
              className="text-xs px-2 py-0.5 bg-pastel-orange/50 text-gray-600 rounded-full"
            >
              {skill}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-gray-400">
        <div className="flex items-center gap-3">
          {task.assignee && (
            <span className="flex items-center gap-1">
              <User size={12} />
              {task.assignee}
            </span>
          )}
          {task.dueDate && (
            <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-400' : ''}`}>
              <Calendar size={12} />
              {task.dueDate}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export default TaskCard
