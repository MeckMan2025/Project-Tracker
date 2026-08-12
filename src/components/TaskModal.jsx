import { useMemberNames } from '../hooks/useMemberNames'
import { useState } from 'react'
import { X, ArrowLeft } from 'lucide-react'

const SKILL_OPTIONS = [
  'Programming', 'CAD', 'Mechanical', 'Electronics', 'Design',
  'Presentation', 'Testing', 'Documentation', 'Business', 'Strategy'
]


function TaskModal({ task, onSave, onClose, requestMode, isLead, isTeam, backToPerson, onBackToPerson }) {
  const memberNames = useMemberNames()
  const [formData, setFormData] = useState({
    title: task?.title || '',
    description: task?.description || '',
    status: task?.status || 'todo',
    assignee: task?.assignee || '',
    dueDate: task?.dueDate || '',
    mentor: task?.mentor || '',
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
          <div className="min-w-0">
            {/* Only when this was opened from someone's task page. */}
            {backToPerson && (
              <button
                type="button"
                onClick={onBackToPerson}
                className="flex items-center gap-1 text-xs font-semibold text-pastel-blue-dark hover:underline mb-0.5"
              >
                <ArrowLeft size={12} /> Back to {backToPerson}'s tasks
              </button>
            )}
            <h2 className="text-lg font-semibold">
              {task ? 'Edit Task' : requestMode ? 'Request Task' : 'Add New Task'}
            </h2>
          </div>
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Assignee
              </label>
              <select
                value={formData.assignee}
                onChange={(e) => setFormData({ ...formData, assignee: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg bg-white focus:ring-2 focus:ring-pastel-blue focus:border-transparent"
              >
                <option value="">Unassigned</option>
                <option value="__up_for_grabs__">🙋 Up for Grabs</option>
                {memberNames.map(n => <option key={n} value={n}>{n}</option>)}
                {/* A name from before the roster dropdown (or a removed member)
                    still shows so the select doesn't silently blank it. */}
                {formData.assignee && formData.assignee !== '__up_for_grabs__' && !memberNames.includes(formData.assignee) && (
                  <option value={formData.assignee}>{formData.assignee} (former)</option>
                )}
              </select>
            </div>
            {task && (
              <div className="col-span-2 -mb-2">
                <p className="text-xs text-gray-400">
                  Assigned by{' '}
                  {task.assignedBy
                    ? <span className="font-medium text-gray-600">{task.assignedBy}</span>
                    : <span className="italic">unknown — recorded automatically on new tasks</span>}
                </p>
              </div>
            )}
            <div>
              {/* Who to go to when you're stuck on this task. */}
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mentor <span className="text-xs font-normal text-gray-400">(who to ask for help)</span>
              </label>
              <select
                value={formData.mentor}
                onChange={(e) => setFormData({ ...formData, mentor: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg bg-white focus:ring-2 focus:ring-pastel-blue focus:border-transparent"
              >
                <option value="">No mentor</option>
                {memberNames.map(n => <option key={n} value={n}>{n}</option>)}
                {formData.mentor && !memberNames.includes(formData.mentor) && (
                  <option value={formData.mentor}>{formData.mentor} (former)</option>
                )}
              </select>
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
