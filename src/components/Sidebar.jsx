import { useState } from 'react'
import { Plus, FolderKanban, Trash2, Menu, X, ClipboardList, ChevronRight, LineChart, MoreVertical, BookOpen, MessageCircle, Settings, User, LogOut, Bell, GitBranch, HelpCircle, ClipboardEdit, Play, Pause, Calendar, Shield } from 'lucide-react'
import { useUser } from '../contexts/UserContext'

function Sidebar({ tabs, activeTab, onTabChange, onAddTab, onDeleteTab, isOpen, onToggle, isPlaying, onToggleMusic, musicStarted, onlineUsers, isLead }) {
  const { logout } = useUser()
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
  const boardTabs = tabs.filter(t => t.type !== 'scouting' && t.type !== 'boards' && t.type !== 'data' && t.type !== 'ai-manual' && t.type !== 'quick-chat' && t.type !== 'tasks' && t.type !== 'notebook' && t.type !== 'org-chart' && t.type !== 'suggestions' && t.type !== 'calendar' && t.type !== 'attendance' && t.type !== 'user-management')
  const isBoardActive = activeTab !== 'scouting' && activeTab !== 'boards' && activeTab !== 'data' && activeTab !== 'ai-manual' && activeTab !== 'quick-chat' && activeTab !== 'tasks' && activeTab !== 'notebook' && activeTab !== 'org-chart' && activeTab !== 'suggestions' && activeTab !== 'calendar' && activeTab !== 'attendance' && activeTab !== 'user-management'

  return (
    <>
      {/* Toggle button - visible when sidebar is closed */}
      {!isOpen && (
        <button
          onClick={onToggle}
          className="fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-md"
        >
          <Menu size={20} />
        </button>
      )}

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-30"
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-white/90 backdrop-blur-sm shadow-lg z-40 transform transition-transform duration-300 flex flex-col ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-700 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <button onClick={onToggle} className="p-1 rounded hover:bg-gray-100 transition-colors">
                <X size={18} className="text-gray-400" />
              </button>
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
            <div className="fixed inset-0 bg-black/30 z-50" />
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
                    { icon: GitBranch, label: 'Org Chart', color: 'text-pastel-blue-dark', tab: 'org-chart' },
                    { icon: HelpCircle, label: 'Help', color: 'text-pastel-orange-dark' },
                    { icon: LogOut, label: 'Logout', color: 'text-red-400' },
                  ].map(({ icon: Icon, label, color, tab }) => (
                    <button
                      key={label}
                      onClick={() => {
                        setMenuOpen(false)
                        if (label === 'Logout') {
                          logout()
                          return
                        }
                        if (tab) {
                          onTabChange(tab)
                          onToggle()
                        }
                      }}
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

        <nav className="p-2 flex-1 overflow-y-auto">
          {/* Scouting Tab */}
          <div
            className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
              activeTab === 'scouting'
                ? 'bg-pastel-pink text-gray-800'
                : 'hover:bg-pastel-blue/30 text-gray-600'
            }`}
            onClick={() => {
              onTabChange('scouting')
              onToggle()
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
              onToggle()
            }}
          >
            <FolderKanban size={16} className="text-pastel-blue-dark" />
            <span className="truncate">Boards</span>
          </div>

          {/* Sub-boards */}
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
                  onToggle()
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
                      e.preventDefault()
                      if (confirm(`Delete "${tab.name}" board?`)) {
                        onDeleteTab(tab.id)
                      }
                    }}
                    className="shrink-0 p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 active:bg-red-100 transition-colors"
                  >
                    <Trash2 size={16} />
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

          <hr className="my-2 border-gray-200" />

          {/* Data Tab */}
          <div
            className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
              activeTab === 'data' || activeTab === 'attendance'
                ? 'bg-pastel-pink text-gray-800'
                : 'hover:bg-pastel-blue/30 text-gray-600'
            }`}
            onClick={() => {
              onTabChange('data')
              onToggle()
            }}
          >
            <LineChart size={16} className="text-pastel-blue-dark" />
            <span className="truncate">Data</span>
          </div>

          {/* Data sub-items */}
          {(activeTab === 'data' || activeTab === 'attendance') && (
            <div className="ml-4 mt-1 space-y-1">
              <div
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer transition-colors text-sm ${
                  activeTab === 'data' ? 'bg-pastel-blue/40 text-gray-800' : 'hover:bg-pastel-blue/20 text-gray-500'
                }`}
                onClick={() => {
                  onTabChange('data')
                  onToggle()
                }}
              >
                <ChevronRight size={14} className={activeTab === 'data' ? 'rotate-90' : ''} />
                <span className="truncate">Scouting</span>
              </div>
              <div
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer transition-colors text-sm ${
                  activeTab === 'attendance' ? 'bg-pastel-blue/40 text-gray-800' : 'hover:bg-pastel-blue/20 text-gray-500'
                }`}
                onClick={() => {
                  onTabChange('attendance')
                  onToggle()
                }}
              >
                <ChevronRight size={14} className={activeTab === 'attendance' ? 'rotate-90' : ''} />
                <span className="truncate">Attendance</span>
              </div>
            </div>
          )}

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
              onToggle()
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
              onToggle()
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
              onToggle()
            }}
          >
            <ClipboardEdit size={16} className="text-pastel-blue-dark" />
            <span className="truncate">Tasks</span>
          </div>

          <hr className="my-2 border-gray-200" />

          {/* Engineering Notebook Tab */}
          <div
            className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
              activeTab === 'notebook'
                ? 'bg-pastel-pink text-gray-800'
                : 'hover:bg-pastel-blue/30 text-gray-600'
            }`}
            onClick={() => {
              onTabChange('notebook')
              onToggle()
            }}
          >
            <BookOpen size={16} className="text-pastel-blue-dark" />
            <span className="truncate">Engineering Notebook</span>
          </div>

          <hr className="my-2 border-gray-200" />

          {/* Suggestions Tab */}
          <div
            className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
              activeTab === 'suggestions'
                ? 'bg-pastel-pink text-gray-800'
                : 'hover:bg-pastel-blue/30 text-gray-600'
            }`}
            onClick={() => {
              onTabChange('suggestions')
              onToggle()
            }}
          >
            <HelpCircle size={16} className="text-pastel-orange-dark" />
            <span className="truncate">Suggestions</span>
          </div>

          <hr className="my-2 border-gray-200" />

          {/* Calendar Tab */}
          <div
            className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
              activeTab === 'calendar'
                ? 'bg-pastel-pink text-gray-800'
                : 'hover:bg-pastel-blue/30 text-gray-600'
            }`}
            onClick={() => {
              onTabChange('calendar')
              onToggle()
            }}
          >
            <Calendar size={16} className="text-pastel-pink-dark" />
            <span className="truncate">Calendar</span>
          </div>

          {isLead && (
            <>
              <hr className="my-2 border-gray-200" />

              <div
                className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                  activeTab === 'user-management'
                    ? 'bg-pastel-pink text-gray-800'
                    : 'hover:bg-pastel-blue/30 text-gray-600'
                }`}
                onClick={() => {
                  onTabChange('user-management')
                  onToggle()
                }}
              >
                <Shield size={16} className="text-pastel-orange-dark" />
                <span className="truncate">User Management</span>
              </div>
            </>
          )}
        </nav>

        {/* Online Now */}
        {onlineUsers && onlineUsers.length > 0 && (
          <div className="px-4 py-3 border-t">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Online Now</h3>
            <div className="space-y-1.5">
              {onlineUsers.map((user) => (
                <div key={user.username} className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
                  <span className="truncate">{user.username}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Music control */}
        {musicStarted && (
          <div className="p-4 border-t">
            <button
              onClick={onToggleMusic}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-pastel-blue/30 hover:bg-pastel-blue/50 rounded-lg transition-colors text-gray-600 text-sm"
            >
              {isPlaying ? <Pause size={16} /> : <Play size={16} />}
              {isPlaying ? 'Pause Music' : 'Play Music'}
            </button>
          </div>
        )}
      </aside>
    </>
  )
}

export default Sidebar
