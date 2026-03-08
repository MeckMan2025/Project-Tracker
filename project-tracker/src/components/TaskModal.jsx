import { useState } from 'react'
import { X } from 'lucide-react'

const SKILL_OPTIONS = [
  'Programming', 'CAD', 'Mechanical', 'Electronics', 'Design',
  'Presentation', 'Testing', 'Documentation', 'Business', 'Strategy'
]

const DEPARTMENT_OPTIONS = ['Business', 'Technical', 'Programming']

function TaskModal({ task, onSave, onClose, requestMode, isLead, isTeam }) {
  const [formData, setFormData] = useState({
    title: task?.title || '',
    description: task?.description || '',
    status: task?.status || 'todo',
    assignee: task?.assignee || '',
    dueDate: task?.dueDate || '',
    skills: task?.skills || [],
    priority: task?.priority || 'medium',
  })
  const [showErrors, setShowErrors] = useState(false)

  const descriptionMissing = !formData.description.trim()

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!formData.title.trim() || descriptionMissing) {
      setShowErrors(true)
      return
    }

    if (!task && localStorage.getItem('scrum-sfx-enabled') !== 'false') {
      new Audio('/sounds/click.mp3').play().catch(() => {})
    }

    onSave({
      ...task,
      ...formData,
      id: task?.id,
    })
  }

  const toggleSkill = (skill) => {
    setFormData(prev => ({
      ...prev,
      skills: prev.skills.includes(skill)
        ? prev.skills.filter(s => s !== skill)
        : [...prev.skills, skill],
    }))
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">
            {task ? 'Edit Task' : requestMode ? 'Request Task' : 'Add New Task'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-pastel-blue focus:border-transparent"
              placeholder="Enter task title"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description *
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => {
                setFormData({ ...formData, description: e.target.value })
                if (showErrors && e.target.value.trim()) setShowErrors(false)
              }}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-pastel-blue focus:border-transparent ${
                showErrors && descriptionMissing ? 'border-red-500' : ''
              }`}
              placeholder="Describe the task"
              rows={3}
            />
            {showErrors && descriptionMissing && (
              <p className="text-red-500 text-sm mt-1">Description is required</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Assign To
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {DEPARTMENT_OPTIONS.map(dept => (
                <button
                  key={dept}
                  type="button"
                  onClick={() => setFormData({ ...formData, assignee: formData.assignee === dept ? '' : dept })}
                  className={`px-3 py-1 rounded-full text-sm transition-colors ${
                    formData.assignee === dept
                      ? 'bg-pastel-blue text-gray-700'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {dept}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={DEPARTMENT_OPTIONS.includes(formData.assignee) ? '' : formData.assignee}
              onChange={(e) => setFormData({ ...formData, assignee: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-pastel-blue focus:border-transparent"
              placeholder="Or type a person's name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Due Date
            </label>
            <input
              type="date"
              value={formData.dueDate}
              onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-pastel-blue focus:border-transparent"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-pastel-blue focus:border-transparent"
              >
                <option value="todo">To Do</option>
                <option value="25">25%</option>
                <option value="50">50%</option>
                <option value="75">75%</option>
                <option value="done">Done</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Priority
              </label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-pastel-blue focus:border-transparent"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Required Skills
            </label>
            <div className="flex flex-wrap gap-2">
              {SKILL_OPTIONS.map(skill => (
                <button
                  key={skill}
                  type="button"
                  onClick={() => toggleSkill(skill)}
                  className={`px-3 py-1 rounded-full text-sm transition-colors ${
                    formData.skills.includes(skill)
                      ? 'bg-pastel-pink text-gray-700'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {skill}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={descriptionMissing}
              className={`flex-1 px-4 py-2 rounded-lg transition-colors font-medium ${
                descriptionMissing
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-pastel-pink hover:bg-pastel-pink-dark'
              }`}
            >
              {task ? 'Save Changes' : requestMode ? 'Send Request' : 'Add Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default TaskModal
