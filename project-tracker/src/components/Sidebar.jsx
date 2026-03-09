import { useState, useEffect } from 'react'
import { Plus, FolderKanban, Trash2, Menu, X, ClipboardList, ChevronRight, LineChart, MoreVertical, BookOpen, Settings, User, LogOut, Bell, GitBranch, HelpCircle, ClipboardEdit, Play, Pause, Calendar, Shield, Inbox, Home, Gamepad2, MessageCircle, GraduationCap, Lightbulb } from 'lucide-react'
import { useUser } from '../contexts/UserContext'
import { usePermissions } from '../hooks/usePermissions'
import { useToast } from './ToastProvider'

function Sidebar({ tabs, activeTab, onTabChange, onAddTab, onDeleteTab, isOpen, onToggle, isPlaying, onToggleMusic, musicStarted, onlineUsers, isTeamAccount, compDayLock }) {
  const { logout, username, user } = useUser()
  const { isGuest, canEditContent, canRequestContent, hasLeadTag } = usePermissions()
  const { addToast } = useToast()
  const [newTabName, setNewTabName] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [boardsOpen, setBoardsOpen] = useState(isTeamAccount)
  const [dataOpen, setDataOpen] = useState(false)
  const [scoutingOpen, setScoutingOpen] = useState(false)
  const [tasksOpen, setTasksOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [navFilter, setNavFilter] = useState(() => localStorage.getItem('scrum-nav-filter') || 'general')

  // Reset all dropdowns when sidebar closes
  useEffect(() => {
    if (!isOpen) {
      setMenuOpen(false)
      setBoardsOpen(false)
      setDataOpen(false)
      setScoutingOpen(false)
      setTasksOpen(false)
      setChatOpen(false)
      setIsAdding(false)
      setNewTabName('')
    }
  }, [isOpen])

  const handleAddTab = (e) => {
    e.preventDefault()
    if (!newTabName.trim()) return
    if (localStorage.getItem('scrum-sfx-enabled') !== 'false') new Audio('/sounds/click.mp3').play().catch(() => {})
    onAddTab(newTabName.trim())
    setNewTabName('')
    setIsAdding(false)
  }

  const handleRequestBoard = async (e) => {
    e.preventDefault()
    if (!newTabName.trim()) return
    const request = {
      id: String(Date.now()) + Math.random().toString(36).slice(2),
      type: 'board',
      data: { name: newTabName.trim() },
      requested_by: username,
      requested_by_user_id: user?.id,
      status: 'pending',
    }
    setNewTabName('')
    setIsAdding(false)
    addToast('Board request submitted for approval', 'success')
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
    fetch(`${supabaseUrl}/rest/v1/requests`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    }).catch(err => console.error('Failed to request board:', err))
  }

  // Comp Day screen lock — determine which tabs are allowed per role
  const compDayAllowedTabs = compDayLock ? ({
    'scouting': ['comp-day', 'scouting', 'schedule', 'data'],
    'drive-team': ['comp-day', 'chat-all', 'chat-alliances', 'chat-leagues', 'schedule'],
    'pit-crew': ['comp-day', 'schedule'],
    'spirit': ['comp-day', 'schedule'],
    'bag-watch': ['comp-day', 'schedule'],
    'break': ['comp-day', 'schedule'],
    'strategy': ['comp-day', 'data', 'chat-all', 'chat-alliances', 'chat-leagues', 'schedule'],
    'safety': ['comp-day', 'schedule'],
  }[compDayLock.role] || ['comp-day']) : null

  const systemTabs = tabs.filter(t => t.type === 'scouting' || t.type === 'boards')
  const boardTabs = tabs.filter(t => t.type !== 'home' && t.type !== 'scouting' && t.type !== 'boards' && t.type !== 'data' && t.type !== 'ai-manual' && t.type !== 'tasks' && t.type !== 'notebook' && t.type !== 'org-chart' && t.type !== 'suggestions' && t.type !== 'calendar' && t.type !== 'attendance' && t.type !== 'user-management' && t.type !== 'schedule' && t.type !== 'workshops' && t.type !== 'special-controls' && t.type !== 'team-scouting-data')
  const isBoardActive = activeTab !== 'home' && activeTab !== 'scouting' && activeTab !== 'boards' && activeTab !== 'data' && activeTab !== 'ai-manual' && activeTab !== 'tasks' && activeTab !== 'notebook' && activeTab !== 'org-chart' && activeTab !== 'suggestions' && activeTab !== 'calendar' && activeTab !== 'attendance' && activeTab !== 'user-management' && activeTab !== 'profile' && activeTab !== 'requests' && activeTab !== 'schedule' && activeTab !== 'workshops' && activeTab !== 'special-controls' && activeTab !== 'chat-all' && activeTab !== 'chat-alliances' && activeTab !== 'chat-leagues' && activeTab !== 'team-scouting-data'

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
                    { icon: User, label: 'Profile', color: 'text-pastel-blue-dark', tab: 'profile' },
                    ...(!isTeamAccount ? [{ icon: Calendar, label: 'Calendar', color: 'text-pastel-pink-dark', tab: 'calendar' }] : []),
                    { icon: Settings, label: 'Settings', color: 'text-pastel-orange-dark', tab: 'settings' },
                    ...(!isGuest && !isTeamAccount ? [{ icon: GitBranch, label: 'Org Chart', color: 'text-pastel-blue-dark', tab: 'org-chart' }] : []),
                    ...(!isGuest && !isTeamAccount ? [{ icon: Shield, label: 'User Management', color: 'text-pastel-orange-dark', tab: 'user-management' }] : []),
                    { icon: Lightbulb, label: 'Suggestions', color: 'text-pastel-orange-dark', tab: 'suggestions' },
                    { icon: LogOut, label: 'Logout', color: 'text-red-400' },
                  ].map(({ icon: Icon, label, color, tab, action }) => (
                    <button
                      key={label}
                      onClick={() => {
                        if (label === 'Logout') {
                          logout()
                          return
                        }
                        setMenuOpen(false)
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

        {/* Category Filter — hidden during comp day lock */}
        {!compDayAllowedTabs && !isTeamAccount && <div className="px-4 pt-3 pb-1 flex gap-2 justify-center">
          {[
            { id: 'technical', emoji: '🔧' },
            { id: 'general', emoji: '🏠' },
            { id: 'business', emoji: '💼' },
          ].map(({ id, emoji }) => (
            <button
              key={id}
              onClick={() => {
                const val = navFilter === id ? 'general' : id
                setNavFilter(val)
                localStorage.setItem('scrum-nav-filter', val)
              }}
              className={`px-3 py-1.5 rounded-lg text-lg transition-colors ${
                navFilter === id
                  ? 'bg-pastel-pink shadow-sm scale-110'
                  : 'bg-gray-100 hover:bg-gray-200'
              }`}
              title={id.charAt(0).toUpperCase() + id.slice(1)}
            >
              {emoji}
            </button>
          ))}
        </div>}

        <nav className="p-2 flex-1 overflow-y-auto">
          {/* ─── Comp Day Locked Nav ─── */}
          {compDayAllowedTabs ? (<>
            <div className="mb-2 px-2 py-2 bg-gradient-to-r from-red-100 to-orange-100 rounded-lg border border-red-200">
              <p className="text-xs font-bold text-red-700 text-center">🔒 Comp Day Active</p>
              <p className="text-[10px] text-red-500 text-center mt-0.5">Screen locked to your assigned role</p>
            </div>
            <hr className="my-2 border-gray-200" />
            <div
              className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                activeTab === 'comp-day' ? 'bg-pastel-pink text-gray-800' : 'hover:bg-pastel-blue/30 text-gray-600'
              }`}
              onClick={() => { onTabChange('comp-day'); onToggle() }}
            >
              <Shield size={16} className="text-red-500" />
              <span className="truncate">Competition Day</span>
            </div>
            <hr className="my-2 border-gray-200" />

            {/* Role-specific tabs based on allowed tabs */}
            {compDayAllowedTabs.includes('scouting') && (
              <div
                className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                  activeTab === 'scouting' ? 'bg-pastel-pink text-gray-800' : 'hover:bg-pastel-blue/30 text-gray-600'
                }`}
                onClick={() => { onTabChange('scouting'); onToggle() }}
              >
                <ClipboardList size={16} className="text-pastel-orange-dark" />
                <span className="truncate">Scouting Form</span>
              </div>
            )}
            {compDayAllowedTabs.includes('schedule') && (
              <div
                className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                  activeTab === 'schedule' ? 'bg-pastel-pink text-gray-800' : 'hover:bg-pastel-blue/30 text-gray-600'
                }`}
                onClick={() => { onTabChange('schedule'); onToggle() }}
              >
                <Calendar size={16} className="text-pastel-blue-dark" />
                <span className="truncate">Match Schedule</span>
              </div>
            )}
            {compDayAllowedTabs.includes('data') && (
              <div
                className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                  activeTab === 'data' ? 'bg-pastel-pink text-gray-800' : 'hover:bg-pastel-blue/30 text-gray-600'
                }`}
                onClick={() => { onTabChange('data'); onToggle() }}
              >
                <LineChart size={16} className="text-pastel-blue-dark" />
                <span className="truncate">Scouting Data</span>
              </div>
            )}
            {compDayAllowedTabs.includes('chat-all') && (<>
              <div
                className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                  activeTab === 'chat-all' || activeTab === 'chat-alliances' || activeTab === 'chat-leagues'
                    ? 'bg-pastel-pink text-gray-800' : 'hover:bg-pastel-blue/30 text-gray-600'
                }`}
                onClick={() => setChatOpen(prev => !prev)}
              >
                <MessageCircle size={16} className="text-pastel-pink-dark" />
                <span className="truncate flex-1">Strategy Chat</span>
                <ChevronRight size={14} className={`transition-transform ${chatOpen ? 'rotate-90' : ''}`} />
              </div>
              {chatOpen && (
                <div className="ml-4 mt-1 space-y-1">
                  {[{ tab: 'chat-all', label: 'All' }, { tab: 'chat-alliances', label: 'Alliances' }, { tab: 'chat-leagues', label: 'Leagues' }].map(({ tab, label }) => (
                    <div
                      key={tab}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer transition-colors text-sm ${
                        activeTab === tab ? 'bg-pastel-blue/40 text-gray-800' : 'hover:bg-pastel-blue/20 text-gray-500'
                      }`}
                      onClick={() => { onTabChange(tab); onToggle() }}
                    >
                      <ChevronRight size={14} className={activeTab === tab ? 'rotate-90' : ''} />
                      <span className="truncate">{label}</span>
                    </div>
                  ))}
                </div>
              )}
            </>)}
          </>) : (<>
          {/* ─── Normal Nav ─── */}
          {/* Home Tab */}
          <div
            className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
              activeTab === 'home'
                ? 'bg-pastel-pink text-gray-800'
                : 'hover:bg-pastel-blue/30 text-gray-600'
            }`}
            onClick={() => {
              onTabChange('home')
              onToggle()
            }}
          >
            <Home size={16} className="text-pastel-pink-dark" />
            <span className="truncate">Home</span>
          </div>

          <hr className="my-2 border-gray-200" />

          {/* Chat Tab */}
          <div
            className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
              activeTab === 'chat-all' || activeTab === 'chat-alliances' || activeTab === 'chat-leagues'
                ? 'bg-pastel-pink text-gray-800'
                : 'hover:bg-pastel-blue/30 text-gray-600'
            }`}
            onClick={() => setChatOpen(prev => !prev)}
          >
            <MessageCircle size={16} className="text-pastel-pink-dark" />
            <span className="truncate flex-1">Chat</span>
            <ChevronRight
              size={14}
              className={`transition-transform ${chatOpen || activeTab === 'chat-all' || activeTab === 'chat-alliances' || activeTab === 'chat-leagues' ? 'rotate-90' : ''}`}
            />
          </div>

          {(chatOpen || activeTab === 'chat-all' || activeTab === 'chat-alliances' || activeTab === 'chat-leagues') && (
            <div className="ml-4 mt-1 space-y-1">
              {[{ tab: 'chat-all', label: 'All' }, { tab: 'chat-alliances', label: 'Alliances' }, { tab: 'chat-leagues', label: 'Leagues' }].map(({ tab, label }) => (
                <div
                  key={tab}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer transition-colors text-sm ${
                    activeTab === tab ? 'bg-pastel-blue/40 text-gray-800' : 'hover:bg-pastel-blue/20 text-gray-500'
                  }`}
                  onClick={() => { onTabChange(tab); onToggle() }}
                >
                  <ChevronRight size={14} className={activeTab === tab ? 'rotate-90' : ''} />
                  <span className="truncate">{label}</span>
                </div>
              ))}
            </div>
          )}

          <hr className="my-2 border-gray-200" />

          {/* Scouting Tab for team accounts — form only, no dropdown */}
          {navFilter !== 'business' && isTeamAccount && (
            <>
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
                <span className="truncate flex-1">Scouting</span>
              </div>
              <hr className="my-2 border-gray-200" />
            </>
          )}

          {/* Scouting Tab for regular accounts — dropdown with form + schedule */}
          {!isTeamAccount && !isGuest && (
            <>
              <div
                className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                  activeTab === 'scouting' || activeTab === 'schedule'
                    ? 'bg-pastel-pink text-gray-800'
                    : 'hover:bg-pastel-blue/30 text-gray-600'
                }`}
                onClick={() => {
                  setScoutingOpen(prev => !prev)
                }}
              >
                <ClipboardList size={16} className="text-pastel-orange-dark" />
                <span className="truncate flex-1">Scouting</span>
                <ChevronRight
                  size={14}
                  className={`transition-transform ${scoutingOpen || activeTab === 'scouting' || activeTab === 'schedule' ? 'rotate-90' : ''}`}
                />
              </div>

              {(scoutingOpen || activeTab === 'scouting' || activeTab === 'schedule') && (
                <div className="ml-4 mt-1 space-y-1">
                  <div
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer transition-colors text-sm ${
                      activeTab === 'scouting' ? 'bg-pastel-blue/40 text-gray-800' : 'hover:bg-pastel-blue/20 text-gray-500'
                    }`}
                    onClick={() => {
                      onTabChange('scouting')
                      onToggle()
                    }}
                  >
                    <ChevronRight size={14} className={activeTab === 'scouting' ? 'rotate-90' : ''} />
                    <span className="truncate">Scouting Form</span>
                  </div>
                  <div
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer transition-colors text-sm ${
                      activeTab === 'schedule' ? 'bg-pastel-blue/40 text-gray-800' : 'hover:bg-pastel-blue/20 text-gray-500'
                    }`}
                    onClick={() => {
                      onTabChange('schedule')
                      onToggle()
                    }}
                  >
                    <ChevronRight size={14} className={activeTab === 'schedule' ? 'rotate-90' : ''} />
                    <span className="truncate">Schedule</span>
                  </div>
                </div>
              )}

              <hr className="my-2 border-gray-200" />
            </>
          )}

          {/* Data Tab for team accounts — dropdown with scouting data only */}
          {isTeamAccount && (
            <>
              <div
                className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                  activeTab === 'team-scouting-data'
                    ? 'bg-pastel-pink text-gray-800'
                    : 'hover:bg-pastel-blue/30 text-gray-600'
                }`}
                onClick={() => {
                  setDataOpen(prev => !prev)
                }}
              >
                <LineChart size={16} className="text-pastel-blue-dark" />
                <span className="truncate flex-1">Data</span>
                <ChevronRight
                  size={14}
                  className={`transition-transform ${dataOpen || activeTab === 'team-scouting-data' ? 'rotate-90' : ''}`}
                />
              </div>

              {(dataOpen || activeTab === 'team-scouting-data') && (
                <div className="ml-4 mt-1 space-y-1">
                  <div
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer transition-colors text-sm ${
                      activeTab === 'team-scouting-data' ? 'bg-pastel-blue/40 text-gray-800' : 'hover:bg-pastel-blue/20 text-gray-500'
                    }`}
                    onClick={() => {
                      onTabChange('team-scouting-data')
                      onToggle()
                    }}
                  >
                    <ChevronRight size={14} className={activeTab === 'team-scouting-data' ? 'rotate-90' : ''} />
                    <span className="truncate">Scouting Data</span>
                  </div>
                </div>
              )}

              <hr className="my-2 border-gray-200" />
            </>
          )}

          {!isTeamAccount && <>
          <div
            className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
              activeTab === 'data' || activeTab === 'attendance'
                ? 'bg-pastel-pink text-gray-800'
                : 'hover:bg-pastel-blue/30 text-gray-600'
            }`}
            onClick={() => {
              if (isGuest) {
                onTabChange('data')
                onToggle()
              } else {
                setDataOpen(prev => !prev)
              }
            }}
          >
            <LineChart size={16} className="text-pastel-blue-dark" />
            <span className="truncate flex-1">Data</span>
            {!isGuest && (
              <ChevronRight
                size={14}
                className={`transition-transform ${dataOpen || activeTab === 'data' || activeTab === 'attendance' ? 'rotate-90' : ''}`}
              />
            )}
          </div>

          {!isGuest && (dataOpen || activeTab === 'data' || activeTab === 'attendance') && (
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
                <span className="truncate">RadRank</span>
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

          </>}

          {/* Only show separator if non-team Data section was rendered (team Data has its own hr) */}
          {!isTeamAccount && <hr className="my-2 border-gray-200" />}

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

          {/* Boards Tab */}
          <div
            className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
              isBoardActive
                ? 'bg-pastel-pink text-gray-800'
                : 'hover:bg-pastel-blue/30 text-gray-600'
            }`}
            onClick={() => {
              setBoardsOpen(prev => !prev)
            }}
          >
            <FolderKanban size={16} className="text-pastel-blue-dark" />
            <span className="truncate flex-1">Boards</span>
            <ChevronRight
              size={14}
              className={`transition-transform ${boardsOpen || isBoardActive ? 'rotate-90' : ''}`}
            />
          </div>

          {/* Sub-boards */}
          {(boardsOpen || isBoardActive) && <div className="ml-4 mt-1 space-y-1">
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
                {!tab.permanent && canEditContent && (
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

            {/* Add/Request Board button — hidden for guests */}
            {(canEditContent || canRequestContent) && <div className="pt-1">
              {isAdding ? (
                <form onSubmit={canEditContent ? handleAddTab : handleRequestBoard} className="space-y-2 px-2">
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
                      {canEditContent ? 'Create' : 'Request'}
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  onClick={() => setIsAdding(true)}
                  className="w-full flex items-center justify-center gap-1 px-3 py-1.5 bg-pastel-blue/30 hover:bg-pastel-blue/50 rounded-lg transition-colors text-gray-500 text-sm"
                >
                  <Plus size={14} />
                  {canEditContent ? 'Add Board' : 'Request Board'}
                </button>
              )}
            </div>}
          </div>}

          {!isTeamAccount && <>
          <hr className="my-2 border-gray-200" />

          {/* Tasks Tab — dropdown with Scrum + Workshops */}
          <div
            className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
              activeTab === 'tasks' || activeTab === 'workshops'
                ? 'bg-pastel-pink text-gray-800'
                : 'hover:bg-pastel-blue/30 text-gray-600'
            }`}
            onClick={() => setTasksOpen(prev => !prev)}
          >
            <ClipboardEdit size={16} className="text-pastel-blue-dark" />
            <span className="truncate flex-1">Tasks</span>
            <ChevronRight
              size={14}
              className={`transition-transform ${tasksOpen || activeTab === 'tasks' || activeTab === 'workshops' ? 'rotate-90' : ''}`}
            />
          </div>

          {(tasksOpen || activeTab === 'tasks' || activeTab === 'workshops') && (
            <div className="ml-4 mt-1 space-y-1">
              <div
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer transition-colors text-sm ${
                  activeTab === 'tasks' ? 'bg-pastel-blue/40 text-gray-800' : 'hover:bg-pastel-blue/20 text-gray-500'
                }`}
                onClick={() => { onTabChange('tasks'); onToggle() }}
              >
                <ChevronRight size={14} className={activeTab === 'tasks' ? 'rotate-90' : ''} />
                <span className="truncate">Scrum</span>
              </div>
              {!isGuest && (
                <div
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer transition-colors text-sm ${
                    activeTab === 'workshops' ? 'bg-pastel-blue/40 text-gray-800' : 'hover:bg-pastel-blue/20 text-gray-500'
                  }`}
                  onClick={() => { onTabChange('workshops'); onToggle() }}
                >
                  <ChevronRight size={14} className={activeTab === 'workshops' ? 'rotate-90' : ''} />
                  <span className="truncate">Workshops</span>
                </div>
              )}
            </div>
          )}

          </>}

          <hr className="my-2 border-gray-200" />

          {/* Engineering Notebook — hidden for guests and team accounts */}
          {!isGuest && !isTeamAccount && (
            <>
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
            </>
          )}

          {!isTeamAccount && <>

          {!isGuest && (
            <>
              <hr className="my-2 border-gray-200" />

              <div
                className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                  activeTab === 'requests'
                    ? 'bg-pastel-pink text-gray-800'
                    : 'hover:bg-pastel-blue/30 text-gray-600'
                }`}
                onClick={() => {
                  onTabChange('requests')
                  onToggle()
                }}
              >
                <Inbox size={16} className="text-pastel-pink-dark" />
                <span className="truncate">Requests</span>
              </div>
            </>
          )}

          {!isGuest && (
            <>
              <hr className="my-2 border-gray-200" />

              <div
                className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                  activeTab === 'special-controls'
                    ? 'bg-pastel-pink text-gray-800'
                    : 'hover:bg-pastel-blue/30 text-gray-600'
                }`}
                onClick={() => {
                  onTabChange('special-controls')
                  onToggle()
                }}
              >
                <Gamepad2 size={16} className="text-pastel-pink-dark" />
                <span className="truncate">Special Controls</span>
              </div>
            </>
          )}
          </>}
          </>)}
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
