import { useState } from 'react'
import { Plus, FolderKanban, Trash2, Menu, X, ChevronRight } from 'lucide-react'

function Sidebar({ tabs, activeTab, onTabChange, onAddTab, onDeleteTab, isOpen, onToggle }) {
  const [newTabName, setNewTabName] = useState('')
  const [isAdding, setIsAdding] = useState(false)

  const handleAddTab = (e) => {
    e.preventDefault()
    if (!newTabName.trim()) return
    onAddTab(newTabName.trim())
    setNewTabName('')
    setIsAdding(false)
  }

  return (
    <>
      {/* Mobile toggle button */}
      <button
        onClick={onToggle}
        className="md:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-md"
      >
        {isOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/30 z-30"
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed md:static top-0 left-0 h-full w-64 bg-white/90 backdrop-blur-sm shadow-lg z-40 transform transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
            <FolderKanban className="text-pastel-pink-dark" size={20} />
            Boards
          </h2>
        </div>

        <nav className="p-2 flex-1 overflow-y-auto max-h-[calc(100vh-180px)]">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={`group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                activeTab === tab.id
                  ? 'bg-pastel-pink text-gray-800'
                  : 'hover:bg-pastel-blue/30 text-gray-600'
              }`}
              onClick={() => {
                onTabChange(tab.id)
                if (window.innerWidth < 768) onToggle()
              }}
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <ChevronRight
                  size={16}
                  className={`transition-transform ${activeTab === tab.id ? 'rotate-90' : ''}`}
                />
                <span className="truncate">{tab.name}</span>
              </div>
              {tabs.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onDeleteTab(tab.id)
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-opacity"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </nav>

        <div className="p-3 border-t">
          {isAdding ? (
            <form onSubmit={handleAddTab} className="space-y-2">
              <input
                type="text"
                value={newTabName}
                onChange={(e) => setNewTabName(e.target.value)}
                placeholder="Board name"
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-pastel-blue focus:border-transparent"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAdding(false)
                    setNewTabName('')
                  }}
                  className="flex-1 px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-3 py-1.5 text-sm bg-pastel-pink hover:bg-pastel-pink-dark rounded-lg"
                >
                  Create
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setIsAdding(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-pastel-blue/50 hover:bg-pastel-blue rounded-lg transition-colors text-gray-600"
            >
              <Plus size={18} />
              New Board
            </button>
          )}
        </div>
      </aside>
    </>
  )
}

export default Sidebar
