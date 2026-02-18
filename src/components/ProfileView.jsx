import { useState, useEffect, useRef } from 'react'
import { User, Save, ChevronDown, AlertTriangle, CheckCircle, Clock, Lock, XCircle, Wrench, Shield, MessageCircle, Bell, Music } from 'lucide-react'
import { supabase } from '../supabase'
import { useUser } from '../contexts/UserContext'
import { usePermissions } from '../hooks/usePermissions'
import NotificationBell from './NotificationBell'
import { usePushNotifications } from '../hooks/usePushNotifications'

const STATUS_OPTIONS = [
  { value: 'available', label: 'Available', icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-50' },
  { value: 'locked-in', label: 'Locked In', icon: Lock, color: 'text-yellow-600', bg: 'bg-yellow-50', note: 'Focused work, minimal interruptions' },
  { value: 'dnd', label: "Don't Talk To Me", icon: XCircle, color: 'text-red-500', bg: 'bg-red-50', note: 'No interruptions unless critical' },
  { value: 'in-lab', label: 'In Lab', icon: Wrench, color: 'text-blue-500', bg: 'bg-blue-50' },
  { value: 'out', label: 'Out', icon: Clock, color: 'text-gray-400', bg: 'bg-gray-50' },
]

const DISCIPLINE_OPTIONS = [
  'Mechanical', 'Electrical', 'Programming', 'CAD', 'Autonomy',
  'Design', 'Testing', 'Business', 'Strategy',
]

const SKILL_LEVELS = ['beginner', 'working', 'strong', 'expert']

const SKILL_OPTIONS = [
  'Java', 'Python', 'Blocks', 'CAD (OnShape)', 'CAD (SolidWorks)', 'CAD (Fusion 360)',
  '3D Printing', 'Wiring', 'Soldering', 'Mechanical Assembly',
  'Autonomous Programming', 'TeleOp Programming', 'Vision/OpenCV',
  'Sensors', 'PID Control', 'Documentation', 'Presentation',
  'Business', 'Fundraising', 'Project Management',
]

const TOOL_OPTIONS = [
  'FTC SDK', 'Android Studio', 'OnShape', 'SolidWorks', 'Fusion 360',
  'GitHub', 'VS Code', 'Driver Station', 'REV Hardware Client',
  'FTC Dashboard', 'MeepMeep', 'RoadRunner', 'Google Docs',
  'Slack', 'Discord',
]

const SAFETY_OPTIONS = [
  'Power Tool Safety', 'Soldering Certification', 'Battery Handling',
  'Lab Safety Training', 'First Aid/CPR', 'Eye Protection Certified',
]

const PERMISSION_OPTIONS = [
  'Lab Access', 'Tool Room Access', 'Release Authority',
  'Safety Sign-off', 'Drive Team', 'Pit Crew',
]

const MUSIC_OPTIONS = [
  { id: 'random', label: 'Random', description: 'Pick a random song each time' },
  { id: 'intro', label: 'Intro', description: '/intro.mp3' },
  { id: 'radical-robotics', label: 'Radical Robotics', description: '/radical-robotics.mp3' },
  { id: 'off', label: 'Off', description: 'No music on startup' },
]

const DEFAULT_PROFILE_DATA = {
  discipline: '',
  timezone: '',
  status: 'available',
  sprint_capacity: 0,
  systems_owned: [],
  review_responsibilities: [],
  skills: {},
  tools: [],
  safety_certs: [],
  permissions: [],
  comm_style: '',
  comm_notes: '',
}

function ProfileView() {
  const { username, nickname: savedNickname, useNickname: savedUseNickname, user, authorityTier, primaryRoleLabel, functionTags, shortBio } = useUser()
  const { role, secondaryRoles, isElevated, tier, isAuthorityAdmin } = usePermissions()
  const { isSupported: pushSupported, isSubscribed: pushSubscribed, permission: pushPermission, subscribe: pushSubscribe, unsubscribe: pushUnsubscribe } = usePushNotifications()
  const [notifPrefs, setNotifPrefs] = useState({ enabled: true, calendar: true, chat: true })
  const [pushBusy, setPushBusy] = useState(false)
  const [pushError, setPushError] = useState('')

  // Auto-save notification prefs whenever they change (after initial load)
  const notifPrefsLoaded = useRef(false)
  useEffect(() => {
    if (!user) return
    if (!notifPrefsLoaded.current) {
      notifPrefsLoaded.current = true
      return
    }
    fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}`, {
      method: 'PATCH',
      headers: {
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({ notification_prefs: notifPrefs }),
    }).catch(err => console.error('Failed to save notification prefs:', err))
  }, [notifPrefs, user])
  const [editName, setEditName] = useState('')
  const [editNickname, setEditNickname] = useState('')
  const [editUseNickname, setEditUseNickname] = useState(false)
  const [profile, setProfile] = useState(DEFAULT_PROFILE_DATA)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState(false)
  const [pwSubmitting, setPwSubmitting] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)
  const [musicPref, setMusicPref] = useState(() => localStorage.getItem('scrum-music-pref') || 'off')
  const [taskStats, setTaskStats] = useState({ active: 0, blocked: 0, total: 0 })
  const [assignedTasks, setAssignedTasks] = useState([])

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  // Load profile data via direct fetch
  useEffect(() => {
    async function load() {
      if (!user) return
      try {
        const res = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${user.id}&select=*`, {
          headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` },
        })
        if (!res.ok) return
        const rows = await res.json()
        const data = rows[0]
        if (!data) return
        setEditName(data.display_name || '')
        setEditNickname(data.nickname || '')
        setEditUseNickname(!!data.use_nickname)
        setProfile(prev => ({
          ...prev,
          discipline: data.discipline || '',
          timezone: data.timezone || '',
          status: data.status || 'available',
          sprint_capacity: data.sprint_capacity || 0,
          systems_owned: data.systems_owned || [],
          review_responsibilities: data.review_responsibilities || [],
          skills: data.skills || {},
          tools: data.tools || [],
          safety_certs: data.safety_certs || [],
          permissions: data.permissions || [],
          comm_style: data.comm_style || '',
          comm_notes: data.comm_notes || '',
        }))
        if (data.notification_prefs) {
          setNotifPrefs(data.notification_prefs)
        }
        if (data.music_preference) {
          setMusicPref(data.music_preference)
          // Only sync from DB if user hasn't set a local preference
          if (!localStorage.getItem('scrum-music-pref')) {
            localStorage.setItem('scrum-music-pref', data.music_preference)
          }
        }
      } catch (err) {
        console.error('Failed to load profile:', err)
      }
    }
    load()
  }, [user])

  // Load task stats via direct fetch
  useEffect(() => {
    async function loadTasks() {
      if (!username) return
      try {
        const res = await fetch(`${supabaseUrl}/rest/v1/tasks?assignee=ilike.${encodeURIComponent(username)}&select=*`, {
          headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` },
        })
        if (!res.ok) return
        const data = await res.json()
        setAssignedTasks(data)
        setTaskStats({
          active: data.filter(t => t.status !== 'done').length,
          blocked: data.filter(t => t.status === 'todo').length,
          total: data.length,
        })
      } catch (err) {
        console.error('Failed to load tasks:', err)
      }
    }
    loadTasks()
  }, [username])

  const [saveError, setSaveError] = useState('')

  const handleSave = async () => {
    if (!user) return
    setSaving(true)
    setSaveError('')

    const baseFields = {
      display_name: editName.trim() || username,
      discipline: profile.discipline,
      timezone: profile.timezone,
      status: profile.status,
      sprint_capacity: profile.sprint_capacity,
      systems_owned: profile.systems_owned,
      review_responsibilities: profile.review_responsibilities,
      skills: profile.skills,
      tools: profile.tools,
      safety_certs: profile.safety_certs,
      permissions: profile.permissions,
      comm_style: profile.comm_style,
      comm_notes: profile.comm_notes,
      notification_prefs: notifPrefs,
      music_preference: musicPref,
    }

    const nicknameFields = {
      nickname: editNickname.trim(),
      use_nickname: editUseNickname,
    }

    try {
      // Try saving everything including nickname fields
      let res = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${user.id}`, {
        method: 'PATCH',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ ...baseFields, ...nicknameFields }),
      })

      // If it failed (likely missing nickname columns), retry without nickname fields
      if (!res.ok) {
        console.warn('Full save failed, retrying without nickname fields...')
        res = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${user.id}`, {
          method: 'PATCH',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify(baseFields),
        })
        if (res.ok) {
          setSaveError('Name saved! To save nicknames, run the SQL to add nickname columns.')
          setTimeout(() => setSaveError(''), 5000)
        }
      }

      if (res.ok) {
        const newName = editName.trim() || username
        localStorage.setItem('scrum-username', newName)
        localStorage.setItem('chat-username', newName)
        localStorage.setItem('scrum-nickname', editNickname.trim())
        localStorage.setItem('scrum-use-nickname', String(editUseNickname))
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      } else {
        const errText = await res.text()
        console.error('Save failed:', errText)
        setSaveError('Save failed — check console for details')
        setTimeout(() => setSaveError(''), 5000)
      }
    } catch (err) {
      console.error('Failed to save profile:', err)
      setSaveError('Save failed — network error')
      setTimeout(() => setSaveError(''), 5000)
    }
    setSaving(false)
  }

  const handleStatusChange = async (newStatus) => {
    setProfile(prev => ({ ...prev, status: newStatus }))
    setStatusOpen(false)
    if (user) {
      fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${user.id}`, {
        method: 'PATCH',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ status: newStatus }),
      }).catch(err => console.error('Failed to update status:', err))
    }
  }

  const toggleArrayItem = (field, item) => {
    setProfile(prev => ({
      ...prev,
      [field]: prev[field].includes(item)
        ? prev[field].filter(i => i !== item)
        : [...prev[field], item],
    }))
  }

  const setSkillLevel = (skill, level) => {
    setProfile(prev => ({
      ...prev,
      skills: { ...prev.skills, [skill]: level },
    }))
  }

  const removeSkill = (skill) => {
    setProfile(prev => {
      const updated = { ...prev.skills }
      delete updated[skill]
      return { ...prev, skills: updated }
    })
  }

  const currentStatus = STATUS_OPTIONS.find(s => s.value === profile.status) || STATUS_OPTIONS[0]
  const CurrentStatusIcon = currentStatus.icon

  const usagePercent = profile.sprint_capacity > 0
    ? Math.min(100, Math.round((taskStats.active / profile.sprint_capacity) * 100))
    : 0

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="py-4 px-4 flex items-center justify-between">
          <div className="w-10 shrink-0" />
          <div className="flex-1 text-center">
            <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-pastel-blue-dark via-pastel-pink-dark to-pastel-orange-dark bg-clip-text text-transparent">
              My Profile
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-2 bg-pastel-pink hover:bg-pastel-pink-dark disabled:opacity-50 rounded-lg transition-colors text-sm font-medium text-gray-700"
            >
              <Save size={16} />
              {saving ? 'Saving...' : saved ? 'Saved!' : 'Save'}
            </button>
          </div>
        </div>
        {saveError && (
          <p className="text-xs text-amber-600 text-center pb-2 px-4">{saveError}</p>
        )}
      </header>

      <main className="flex-1 p-4 overflow-y-auto">
        <div className="max-w-2xl mx-auto space-y-6">

          {/* ─── Header / Identity ─── */}
          <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-pastel-blue to-pastel-pink flex items-center justify-center shrink-0">
                <User size={32} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="space-y-2 mb-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-0.5">Display Name</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Your name"
                      className="w-full px-3 py-1.5 border rounded-lg text-sm font-bold text-gray-800 focus:ring-2 focus:ring-pastel-blue focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-0.5">Nickname</label>
                    <input
                      type="text"
                      value={editNickname}
                      onChange={(e) => setEditNickname(e.target.value)}
                      placeholder="Optional nickname"
                      className="w-full px-3 py-1.5 border rounded-lg text-sm text-gray-800 focus:ring-2 focus:ring-pastel-blue focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Show in chat as</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setEditUseNickname(false)}
                        className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                          !editUseNickname ? 'bg-pastel-pink font-medium text-gray-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        {editName || username || 'Name'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditUseNickname(true)}
                        disabled={!editNickname.trim()}
                        className={`px-3 py-1.5 rounded-lg text-sm transition-colors disabled:opacity-40 ${
                          editUseNickname ? 'bg-pastel-pink font-medium text-gray-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        {editNickname.trim() || 'Nickname'}
                      </button>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-gray-500">{user?.email}</p>
                {primaryRoleLabel && (
                  <p className="text-sm text-gray-600 font-medium mt-0.5">{primaryRoleLabel}</p>
                )}
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {functionTags.length > 0 && functionTags.map(tag => (
                    <span key={tag} className="text-xs px-2 py-0.5 rounded-full font-medium bg-pastel-pink/30 text-pastel-pink-dark">
                      {tag}
                    </span>
                  ))}
                  {profile.discipline && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-pastel-blue/30 text-pastel-blue-dark font-medium">
                      {profile.discipline}
                    </span>
                  )}
                </div>
                {shortBio && (
                  <p className="text-sm text-gray-500 mt-2 italic">{shortBio}</p>
                )}
              </div>
            </div>

            {/* Status selector */}
            <div className="mt-4 relative">
              <button
                onClick={() => setStatusOpen(!statusOpen)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border-2 transition-colors ${currentStatus.bg} border-current/10`}
              >
                <div className="flex items-center gap-2">
                  <CurrentStatusIcon size={18} className={currentStatus.color} />
                  <span className="font-medium text-gray-700">{currentStatus.label}</span>
                  {currentStatus.note && (
                    <span className="text-xs text-gray-400 hidden sm:inline">— {currentStatus.note}</span>
                  )}
                </div>
                <ChevronDown size={16} className={`text-gray-400 transition-transform ${statusOpen ? 'rotate-180' : ''}`} />
              </button>
              {statusOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border z-20">
                  {STATUS_OPTIONS.map(opt => {
                    const OptIcon = opt.icon
                    return (
                      <button
                        key={opt.value}
                        onClick={() => handleStatusChange(opt.value)}
                        className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors first:rounded-t-lg last:rounded-b-lg ${
                          opt.value === profile.status ? 'bg-gray-50' : ''
                        }`}
                      >
                        <OptIcon size={18} className={opt.color} />
                        <div className="text-left">
                          <p className="text-sm font-medium text-gray-700">{opt.label}</p>
                          {opt.note && <p className="text-xs text-gray-400">{opt.note}</p>}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Discipline & Timezone */}
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Discipline</label>
                <select
                  value={profile.discipline}
                  onChange={(e) => setProfile(prev => ({ ...prev, discipline: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-pastel-blue focus:border-transparent"
                >
                  <option value="">Select...</option>
                  {DISCIPLINE_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Timezone</label>
                <input
                  type="text"
                  value={profile.timezone}
                  onChange={(e) => setProfile(prev => ({ ...prev, timezone: e.target.value }))}
                  placeholder="e.g. CST"
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-pastel-blue focus:border-transparent"
                />
              </div>
            </div>
          </section>

          {/* ─── Work Summary ─── */}
          <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Clock size={16} className="text-pastel-blue-dark" />
              Work Summary
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-pastel-blue/20 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-pastel-blue-dark">{profile.sprint_capacity}</p>
                <p className="text-xs text-gray-500">Sprint Capacity</p>
              </div>
              <div className="bg-pastel-pink/20 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-pastel-pink-dark">{usagePercent}%</p>
                <p className="text-xs text-gray-500">Workload</p>
              </div>
              <div className="bg-pastel-orange/20 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-pastel-orange-dark">{taskStats.active}</p>
                <p className="text-xs text-gray-500">Active Tasks</p>
              </div>
              <div className="bg-red-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-red-400">{taskStats.blocked}</p>
                <p className="text-xs text-gray-500">In To Do</p>
              </div>
            </div>
            <div className="mt-3">
              <label className="block text-xs font-medium text-gray-500 mb-1">Sprint Capacity (tasks)</label>
              <input
                type="number"
                min="0"
                value={profile.sprint_capacity}
                onChange={(e) => setProfile(prev => ({ ...prev, sprint_capacity: parseInt(e.target.value) || 0 }))}
                className="w-24 px-3 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-pastel-blue focus:border-transparent"
              />
            </div>
          </section>

          {/* ─── Current Work ─── */}
          <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <AlertTriangle size={16} className="text-pastel-orange-dark" />
              Current Work
            </h3>
            {assignedTasks.length === 0 ? (
              <p className="text-sm text-gray-400">No tasks assigned.</p>
            ) : (
              <div className="space-y-2">
                {assignedTasks.filter(t => t.status !== 'done').map(t => (
                  <div key={t.id} className="flex items-center gap-3 px-3 py-2 bg-gray-50 rounded-lg">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${
                      t.status === 'todo' ? 'bg-red-400' :
                      t.status === '25' ? 'bg-orange-400' :
                      t.status === '50' ? 'bg-yellow-400' :
                      'bg-green-400'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-700 truncate">{t.title}</p>
                      <p className="text-xs text-gray-400">{t.status === 'todo' ? 'To Do' : t.status + '%'}</p>
                    </div>
                    {t.status === 'todo' && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-500 font-medium">Blocked</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ─── Ownership & Responsibilities ─── */}
          <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Shield size={16} className="text-pastel-pink-dark" />
              Ownership & Responsibilities
            </h3>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-2">Systems Owned</label>
              <input
                type="text"
                value={profile.systems_owned.join(', ')}
                onChange={(e) => setProfile(prev => ({
                  ...prev,
                  systems_owned: e.target.value.split(',').map(s => s.trim()).filter(Boolean),
                }))}
                placeholder="e.g. Drivetrain, Intake, Arm (comma-separated)"
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-pastel-blue focus:border-transparent"
              />
            </div>
            <div className="mt-3">
              <label className="block text-xs font-medium text-gray-500 mb-2">Review Responsibilities</label>
              <div className="flex flex-wrap gap-2">
                {['Design Review', 'Code Review', 'Safety Sign-off', 'Release Approval', 'Notebook Review'].map(resp => (
                  <button
                    key={resp}
                    type="button"
                    onClick={() => toggleArrayItem('review_responsibilities', resp)}
                    className={`px-3 py-1 rounded-full text-xs transition-colors ${
                      profile.review_responsibilities.includes(resp)
                        ? 'bg-pastel-pink text-gray-700'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {resp}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* ─── Skills & Tools ─── */}
          <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Wrench size={16} className="text-pastel-blue-dark" />
              Skills & Tools
            </h3>

            {/* Skills with levels */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-2">Skills</label>
              <div className="space-y-2">
                {Object.entries(profile.skills).map(([skill, level]) => (
                  <div key={skill} className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-gray-700 min-w-[140px]">{skill}</span>
                    <div className="flex gap-1">
                      {SKILL_LEVELS.map(l => (
                        <button
                          key={l}
                          onClick={() => setSkillLevel(skill, l)}
                          className={`px-2 py-0.5 rounded text-xs transition-colors ${
                            level === l
                              ? 'bg-pastel-blue text-gray-700 font-medium'
                              : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                          }`}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                    <button onClick={() => removeSkill(skill)} className="text-gray-300 hover:text-red-400 text-xs ml-1">
                      <XCircle size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-2">
                <label className="block text-xs text-gray-400 mb-1">Add skill:</label>
                <div className="flex flex-wrap gap-1">
                  {SKILL_OPTIONS.filter(s => !profile.skills[s]).map(skill => (
                    <button
                      key={skill}
                      onClick={() => setSkillLevel(skill, 'beginner')}
                      className="px-2 py-1 bg-gray-50 hover:bg-pastel-blue/20 rounded text-xs text-gray-500 transition-colors"
                    >
                      + {skill}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Tools */}
            <div className="mt-4">
              <label className="block text-xs font-medium text-gray-500 mb-2">Tools & Technologies</label>
              <div className="flex flex-wrap gap-2">
                {TOOL_OPTIONS.map(tool => (
                  <button
                    key={tool}
                    type="button"
                    onClick={() => toggleArrayItem('tools', tool)}
                    className={`px-3 py-1 rounded-full text-xs transition-colors ${
                      profile.tools.includes(tool)
                        ? 'bg-pastel-blue text-gray-700'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {tool}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* ─── Safety & Permissions ─── */}
          <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Shield size={16} className="text-pastel-orange-dark" />
              Safety & Permissions
            </h3>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-2">Safety Training / Certifications</label>
              <div className="flex flex-wrap gap-2">
                {SAFETY_OPTIONS.map(cert => (
                  <button
                    key={cert}
                    type="button"
                    onClick={() => toggleArrayItem('safety_certs', cert)}
                    className={`px-3 py-1 rounded-full text-xs transition-colors ${
                      profile.safety_certs.includes(cert)
                        ? 'bg-pastel-orange text-gray-700'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {cert}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-3">
              <label className="block text-xs font-medium text-gray-500 mb-2">Permissions</label>
              <div className="flex flex-wrap gap-2">
                {PERMISSION_OPTIONS.map(perm => (
                  <button
                    key={perm}
                    type="button"
                    onClick={() => toggleArrayItem('permissions', perm)}
                    className={`px-3 py-1 rounded-full text-xs transition-colors ${
                      profile.permissions.includes(perm)
                        ? 'bg-pastel-orange text-gray-700'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {perm}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* ─── Communication Preferences ─── */}
          <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <MessageCircle size={16} className="text-pastel-pink-dark" />
              Communication Preferences
            </h3>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Preferred Style</label>
              <select
                value={profile.comm_style}
                onChange={(e) => setProfile(prev => ({ ...prev, comm_style: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-pastel-pink focus:border-transparent"
              >
                <option value="">Select...</option>
                <option value="in-person">In Person</option>
                <option value="chat">Chat / Messaging</option>
                <option value="quick-standup">Quick Standup</option>
                <option value="async">Async (leave me a note)</option>
              </select>
            </div>
            <div className="mt-3">
              <label className="block text-xs font-medium text-gray-500 mb-1">Notes for teammates</label>
              <textarea
                value={profile.comm_notes}
                onChange={(e) => setProfile(prev => ({ ...prev, comm_notes: e.target.value }))}
                placeholder="e.g. Only interrupt for safety or blocking issues when Locked In"
                rows={2}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-pastel-pink focus:border-transparent resize-none"
              />
            </div>
          </section>

          {/* ─── Push Notifications ─── */}
          <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Bell size={16} className="text-pastel-blue-dark" />
              Push Notifications
            </h3>
            {!pushSupported ? (
              <p className="text-sm text-gray-400">Push notifications are not supported in this browser.</p>
            ) : (
              <div className="space-y-3">
                {/* Master toggle */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Enable push notifications</p>
                    <p className="text-xs text-gray-400">
                      {pushPermission === 'denied'
                        ? 'Notifications are blocked in browser settings'
                        : pushSubscribed
                        ? 'Receiving push notifications on this device'
                        : 'Not subscribed on this device'}
                    </p>
                  </div>
                  <button
                    onClick={async () => {
                      setPushBusy(true)
                      setPushError('')
                      try {
                        if (pushSubscribed) {
                          const ok = await pushUnsubscribe()
                          if (ok) {
                            setNotifPrefs(prev => ({ ...prev, enabled: false }))
                          } else {
                            setPushError('Failed to unsubscribe')
                          }
                        } else {
                          const ok = await pushSubscribe()
                          if (ok) {
                            setNotifPrefs(prev => ({ ...prev, enabled: true }))
                          } else {
                            setPushError(
                              pushPermission === 'denied'
                                ? 'Blocked in browser settings — check site permissions'
                                : 'Subscribe failed — check browser console for details'
                            )
                          }
                        }
                      } catch (err) {
                        setPushError(err.message)
                      }
                      setPushBusy(false)
                    }}
                    disabled={pushPermission === 'denied' || pushBusy}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-40 ${
                      pushSubscribed && notifPrefs.enabled ? 'bg-pastel-blue-dark' : 'bg-gray-300'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      pushSubscribed && notifPrefs.enabled ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>
                {pushBusy && <p className="text-xs text-gray-400">Working...</p>}
                {pushError && <p className="text-xs text-red-500">{pushError}</p>}

                {/* Category toggles */}
                {pushSubscribed && (
                  <>
                    <div className="flex items-center justify-between pl-4 border-l-2 border-gray-100">
                      <p className="text-sm text-gray-600">Calendar events</p>
                      <button
                        onClick={() => setNotifPrefs(prev => ({ ...prev, calendar: !prev.calendar }))}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          notifPrefs.calendar ? 'bg-pastel-blue-dark' : 'bg-gray-300'
                        }`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          notifPrefs.calendar ? 'translate-x-6' : 'translate-x-1'
                        }`} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between pl-4 border-l-2 border-gray-100">
                      <p className="text-sm text-gray-600">Chat messages</p>
                      <button
                        onClick={() => setNotifPrefs(prev => ({ ...prev, chat: !prev.chat }))}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          notifPrefs.chat ? 'bg-pastel-blue-dark' : 'bg-gray-300'
                        }`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          notifPrefs.chat ? 'translate-x-6' : 'translate-x-1'
                        }`} />
                      </button>
                    </div>
                    <p className="text-xs text-gray-400 italic">Leads can force-send important notifications even if you turn these off.</p>
                  </>
                )}
              </div>
            )}
          </section>

          {/* ─── Music Preference ─── */}
          <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Music size={16} className="text-pastel-pink-dark" />
              Startup Music
            </h3>
            <p className="text-xs text-gray-400 mb-3">Choose which song plays when you open the app.</p>
            <div className="space-y-2">
              {MUSIC_OPTIONS.map(opt => (
                <button
                  key={opt.id}
                  onClick={() => {
                    setMusicPref(opt.id)
                    localStorage.setItem('scrum-music-pref', opt.id)
                  }}
                  className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-colors ${
                    musicPref === opt.id
                      ? 'border-pastel-pink bg-pastel-pink/10'
                      : 'border-gray-200 hover:border-pastel-pink/50'
                  }`}
                >
                  <p className="text-sm font-medium text-gray-700">{opt.label}</p>
                  <p className="text-xs text-gray-400">{opt.description}</p>
                </button>
              ))}
            </div>
          </section>

          {/* ─── Change Password ─── */}
          <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
            <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Lock size={16} className="text-pastel-blue-dark" />
              Change Password
            </h3>
            <form onSubmit={async (e) => {
              e.preventDefault()
              setPwError('')
              setPwSuccess(false)
              if (newPassword.length < 6) {
                setPwError('Password must be at least 6 characters')
                return
              }
              if (newPassword !== confirmPassword) {
                setPwError('Passwords do not match')
                return
              }
              setPwSubmitting(true)
              try {
                const { error } = await supabase.auth.updateUser({ password: newPassword })
                if (error) throw error
                setPwSuccess(true)
                setNewPassword('')
                setConfirmPassword('')
                setTimeout(() => setPwSuccess(false), 3000)
              } catch (err) {
                setPwError(err.message)
              } finally {
                setPwSubmitting(false)
              }
            }} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => { setNewPassword(e.target.value); setPwError(''); setPwSuccess(false) }}
                  placeholder="Minimum 6 characters"
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-pastel-blue focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setPwError(''); setPwSuccess(false) }}
                  placeholder="Re-enter new password"
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-pastel-blue focus:border-transparent"
                />
              </div>
              {pwError && <p className="text-sm text-red-500">{pwError}</p>}
              {pwSuccess && <p className="text-sm text-green-600">Password updated successfully!</p>}
              <button
                type="submit"
                disabled={pwSubmitting || !newPassword}
                className="px-4 py-2 bg-pastel-pink hover:bg-pastel-pink-dark disabled:opacity-50 rounded-lg transition-colors text-sm font-medium text-gray-700"
              >
                {pwSubmitting ? 'Updating...' : 'Change Password'}
              </button>
            </form>
          </section>

        </div>
      </main>
    </div>
  )
}

export default ProfileView
