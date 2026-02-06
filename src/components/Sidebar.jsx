import { useState } from 'react'
import { Plus, FolderKanban, Trash2, Menu, X, ClipboardList, ChevronRight, LineChart, MoreVertical, BookOpen, MessageCircle, Settings, User, LogOut, Bell, GitBranch, HelpCircle, ClipboardEdit } from 'lucide-react'

function Sidebar({ tabs, activeTab, onTabChange, onAddTab, onDeleteTab, isOpen, onToggle }) {
  const [newTabName, setNewTabName] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const handleAddTab = (e) => {
    e.preventDefault()
    if (!newTabName.trim()) return
    onAddTab(newTabName.trim())
    setNewTabName('')
    setIsAdding(false)
  }

  const systemTabs = tabs.filter(t => t.type === 'scouting' || t.type === 'boards')
  const boardTabs = tabs.filter(t => t.type !== 'scouting' && t.type !== 'boards' && t.type !== 'data' && t.type !== 'ai-manual' && t.type !== 'quick-chat' && t.type !== 'tasks')
  const isBoardActive = activeTab !== 'scouting' && activeTab !== 'boards' && activeTab !== 'data' && activeTab !== 'ai-manual' && activeTab !== 'quick-chat' && activeTab !== 'tasks'

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
          <h2 className="text-lg font-semibold text-gray-700 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <FolderKanban className="text-pastel-pink-dark" size={20} />
              Navigation
            </span>
            <button onClick={() => setMenuOpen(true)} className="p-1 rounded hover:bg-gray-100 transition-colors">
              <MoreVertical size={18} className="text-gray-400" />
            </button>
          </h2>
        </div>

        {/* Menu Modal */}
        {menuOpen && (
          <>
            <div className="fixed inset-0 bg-black/30 z-50" onClick={() => setMenuOpen(false)} />
            <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
              <div className="bg-white rounded-xl shadow-xl p-6 w-64 pointer-events-auto relative">
                <button onClick={() => setMenuOpen(false)} className="absolute top-3 right-3 p-1 rounded hover:bg-gray-100 transition-colors">
                  <X size={16} className="text-gray-400" />
                </button>
                <h3 className="text-sm font-semibold text-gray-500 mb-4 uppercase tracking-wide">Menu</h3>
                <div className="space-y-1">
                  {[
                    { icon: User, label: 'Profile', color: 'text-pastel-blue-dark' },
                    { icon: Settings, label: 'Settings', color: 'text-pastel-orange-dark' },
                    { icon: Bell, label: 'Notifications', color: 'text-pastel-pink-dark' },
                    { icon: GitBranch, label: 'Org Chart', color: 'text-pastel-blue-dark' },
                    { icon: HelpCircle, label: 'Help', color: 'text-pastel-orange-dark' },
                    { icon: LogOut, label: 'Logout', color: 'text-red-400' },
                  ].map(({ icon: Icon, label, color }) => (
                    <button
                      key={label}
                      onClick={() => setMenuOpen(false)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-pastel-blue/20 transition-colors text-gray-700 text-sm"
                    >
                      <Icon size={18} className={color} />
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        <nav className="p-2 flex-1 overflow-y-auto max-h-[calc(100vh-180px)]">
          {/* Scouting Tab */}
          <div
            className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
              activeTab === 'scouting'
                ? 'bg-pastel-pink text-gray-800'
                : 'hover:bg-pastel-blue/30 text-gray-600'
            }`}
            onClick={() => {
              onTabChange('scouting')
              if (window.innerWidth < 768) onToggle()
            }}
          >
            <ClipboardList size={16} className="text-pastel-orange-dark" />
            <span className="truncate">Scouting</span>
          </div>

          <hr className="my-2 border-gray-200" />

          {/* Boards Tab */}
          <div
            className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
              isBoardActive
                ? 'bg-pastel-pink text-gray-800'
                : 'hover:bg-pastel-blue/30 text-gray-600'
            }`}
            onClick={() => {
              onTabChange('business')
              if (window.innerWidth < 768) onToggle()
            }}
          >
            <FolderKanban size={16} className="text-pastel-blue-dark" />
            <span className="truncate">Boards</span>
          </div>

          {/* Sub-boards (only visible when a board is active) */}
          {isBoardActive && (
            <div className="ml-4 mt-1 space-y-1">
              {boardTabs.map((tab) => (
                <div
                  key={tab.id}
                  className={`group flex items-center justify-between px-3 py-1.5 rounded-lg cursor-pointer transition-colors text-sm ${
                    activeTab === tab.id
                      ? 'bg-pastel-blue/40 text-gray-800'
                      : 'hover:bg-pastel-blue/20 text-gray-500'
                  }`}
                  onClick={() => {
                    onTabChange(tab.id)
                    if (window.innerWidth < 768) onToggle()
                  }}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <ChevronRight
                      size={14}
                      className={`transition-transform ${activeTab === tab.id ? 'rotate-90' : ''}`}
                    />
                    <span className="truncate">{tab.name}</span>
                  </div>
                  {!tab.permanent && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onDeleteTab(tab.id)
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-opacity"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              ))}

              {/* Add Board button */}
              <div className="pt-1">
                {isAdding ? (
                  <form onSubmit={handleAddTab} className="space-y-2 px-2">
                    <input
                      type="text"
                      value={newTabName}
                      onChange={(e) => setNewTabName(e.target.value)}
                      placeholder="Board name"
                      className="w-full px-3 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-pastel-blue focus:border-transparent"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setIsAdding(false)
                          setNewTabName('')
                        }}
                        className="flex-1 px-3 py-1 text-xs border rounded-lg hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="flex-1 px-3 py-1 text-xs bg-pastel-pink hover:bg-pastel-pink-dark rounded-lg"
                      >
                        Create
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    onClick={() => setIsAdding(true)}
                    className="w-full flex items-center justify-center gap-1 px-3 py-1.5 bg-pastel-blue/30 hover:bg-pastel-blue/50 rounded-lg transition-colors text-gray-500 text-sm"
                  >
                    <Plus size={14} />
                    Add Board
                  </button>
                )}
              </div>
            </div>
          )}

          <hr className="my-2 border-gray-200" />

          {/* Data Tab */}
          <div
            className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
              activeTab === 'data'
                ? 'bg-pastel-pink text-gray-800'
                : 'hover:bg-pastel-blue/30 text-gray-600'
            }`}
            onClick={() => {
              onTabChange('data')
              if (window.innerWidth < 768) onToggle()
            }}
          >
            <LineChart size={16} className="text-pastel-blue-dark" />
            <span className="truncate">Data</span>
          </div>

          <hr className="my-2 border-gray-200" />

          {/* AI Manual Tab */}
          <div
            className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
              activeTab === 'ai-manual'
                ? 'bg-pastel-pink text-gray-800'
                : 'hover:bg-pastel-blue/30 text-gray-600'
            }`}
            onClick={() => {
              onTabChange('ai-manual')
              if (window.innerWidth < 768) onToggle()
            }}
          >
            <BookOpen size={16} className="text-pastel-orange-dark" />
            <span className="truncate">AI Manual</span>
          </div>

          <hr className="my-2 border-gray-200" />

          {/* Quick Chat Tab */}
          <div
            className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
              activeTab === 'quick-chat'
                ? 'bg-pastel-pink text-gray-800'
                : 'hover:bg-pastel-blue/30 text-gray-600'
            }`}
            onClick={() => {
              onTabChange('quick-chat')
              if (window.innerWidth < 768) onToggle()
            }}
          >
            <MessageCircle size={16} className="text-pastel-pink-dark" />
            <span className="truncate">Quick Chat</span>
          </div>

          <hr className="my-2 border-gray-200" />

          {/* Tasks Tab */}
          <div
            className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
              activeTab === 'tasks'
                ? 'bg-pastel-pink text-gray-800'
                : 'hover:bg-pastel-blue/30 text-gray-600'
            }`}
            onClick={() => {
              onTabChange('tasks')
              if (window.innerWidth < 768) onToggle()
            }}
          >
            <ClipboardEdit size={16} className="text-pastel-blue-dark" />
            <span className="truncate">Tasks</span>
          </div>
        </nav>
      </aside>
    </>
  )
}

export default Sidebar
