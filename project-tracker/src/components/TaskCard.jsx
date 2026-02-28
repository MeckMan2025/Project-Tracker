import { Calendar, User, Pencil, Trash2, Zap, LogOut, Hand, CheckCircle } from 'lucide-react'

const UP_FOR_GRABS = '__up_for_grabs__'

function TaskCard({ task, isDragging, onEdit, onDelete, canEdit, onClaim, onLeaveTask, onMarkDone, currentUser, isGuest }) {
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'done'
  const isUpForGrabs = task.assignee === UP_FOR_GRABS
  const isAssignedToMe = currentUser && task.assignee && task.assignee.toLowerCase() === currentUser.toLowerCase()

  return (
    <div
      className={`bg-white rounded-lg p-3 mb-2 shadow-sm border-l-4 transition-shadow ${
        isDragging ? 'shadow-lg' : 'hover:shadow-md'
      } ${isUpForGrabs ? 'border-l-amber-400' : isOverdue ? 'border-l-red-400' : 'border-l-pastel-pink-dark'}`}
    >
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-medium text-gray-800 flex-1">{task.title}</h3>
        {canEdit && (
          <div className="flex gap-1 ml-2">
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onEdit() }}
              className="p-1 text-gray-400 hover:text-pastel-blue-dark rounded"
            >
              <Pencil size={14} />
            </button>
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onDelete() }}
              className="p-1 text-gray-400 hover:text-red-400 rounded"
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}
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
          {isUpForGrabs ? (
            <span className="flex items-center gap-1 text-amber-500 font-medium">
              <Zap size={12} />
              Up for Grabs
            </span>
          ) : task.assignee ? (
            <span className="flex items-center gap-1">
              <User size={12} />
              {task.assignee}
            </span>
          ) : null}
          {task.dueDate && (
            <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-400' : ''}`}>
              <Calendar size={12} />
              {task.dueDate}
            </span>
          )}
        </div>
      </div>

      {/* Mark Done button */}
      {task.status !== 'done' && !isGuest && onMarkDone && (
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onMarkDone(task.id) }}
          className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-600 text-xs font-medium rounded-lg transition-colors"
        >
          <CheckCircle size={12} />
          Mark Done
        </button>
      )}

      {/* Claim button for non-guests on Up for Grabs tasks */}
      {isUpForGrabs && !isGuest && onClaim && (
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onClaim(task.id) }}
          className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-medium rounded-lg transition-colors"
        >
          <Hand size={12} />
          Claim Task
        </button>
      )}

      {/* Request to Leave button for the assigned user */}
      {isAssignedToMe && !isUpForGrabs && onLeaveTask && (
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onLeaveTask(task) }}
          className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-500 text-xs font-medium rounded-lg transition-colors"
        >
          <LogOut size={12} />
          Request to Leave
        </button>
      )}
    </div>
  )
}

export default TaskCard
