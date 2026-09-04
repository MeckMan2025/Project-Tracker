import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabase'
import { useUser } from '../contexts/UserContext'
import { usePermissions } from '../hooks/usePermissions'
import { Send, Plus, X, Trash2, FolderOpen, ExternalLink, ChevronDown, ChevronUp, Pencil, Camera, Loader2, GraduationCap } from 'lucide-react'
import NotificationBell from './NotificationBell'
import { ACTIVE_SEASON, seasonOf } from '../data/season'

const CATEGORIES = ['Technical', 'Programming', 'Business', 'Custom']

// Local calendar date. toISOString() is UTC, so after ~7pm Central it rolls to
// tomorrow — an evening entry would default to the wrong meeting date and slip
// out of today's activity count.
function todayLocal() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}


const CATEGORY_COLORS = {
  Technical: 'bg-blue-100 text-blue-700',
  Programming: 'bg-orange-100 text-orange-700',
  Business: 'bg-pink-100 text-pink-700',
  Custom: 'bg-gray-100 text-gray-600',
}

const WHY_OPTIONS = [
  'Directly advances the robot design',
  'Improves autonomous performance',
  'Supports outreach/business goals',
  'Fixes a critical bug or issue',
  'Prepares for upcoming competition',
  'Improves team workflow/process',
  'Research & learning',
  'Other',
]

const ENGAGEMENT_OPTIONS = [
  { value: 'Very', label: 'Very Engaged', dot: 'bg-green-400' },
  { value: 'Somewhat', label: 'Somewhat', dot: 'bg-yellow-400' },
  { value: 'Not', label: 'Not Engaged', dot: 'bg-red-400' },
]

const INITIAL_ENTRY = {
  category: 'Technical',
  customCategory: '',
  whatDid: '',
  whyOption: '',
  whyNote: '',
  engagement: 'Somewhat',
  mentorHelp: false,
  mentorName: '',
  mentorNote: '',
  projectId: '',
  projectLink: '',
  photoUrl: '',
}

const INITIAL_PROJECT = {
  name: '',
  category: 'Technical',
  goal: '',
  reason: '',
  status: 'Active',
}

function SectionHeader({ title }) {
  return <h2 className="text-lg font-semibold text-gray-700 border-b-2 border-pastel-pink pb-1">{title}</h2>
}

export default function EngineeringNotebook() {
  const { username, user } = useUser()
  const { canOrganizeNotebook, canSubmitNotebook, isGuest } = usePermissions()
  const isLead = canOrganizeNotebook
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  const [view, setView] = useState('projects')
  const [entries, setEntries] = useState([])
  const [projects, setProjects] = useState([])
  const [formData, setFormData] = useState({ ...INITIAL_ENTRY })
  const [meetingDate, setMeetingDate] = useState(todayLocal)
  // Meeting days, so a late entry can be filed against the meeting it belongs
  // to. These are the same days attendance is taken on, which is what decides
  // whether a missing entry counts against you.
  const [meetingDays, setMeetingDays] = useState([])
  const [editingEntryId, setEditingEntryId] = useState(null)
  const [projectForm, setProjectForm] = useState({ ...INITIAL_PROJECT })
  const [editingProjectId, setEditingProjectId] = useState(null)
  const [showProjectModal, setShowProjectModal] = useState(false)
  const [submitFeedback, setSubmitFeedback] = useState(null)
  const [showTeamEntries, setShowTeamEntries] = useState(false)
  const [filterSeason, setFilterSeason] = useState(ACTIVE_SEASON)
  const [filterStudent, setFilterStudent] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterProject, setFilterProject] = useState('')
  const [filterEngagement, setFilterEngagement] = useState('')
  // Adults on the roster, to name who helped. Optional — the yes/no is the
  // part that matters for judging.
  const [mentors, setMentors] = useState([])
  const [showFilters, setShowFilters] = useState(false)
  const [expandedProject, setExpandedProject] = useState(null)
  const [showRequestProjectModal, setShowRequestProjectModal] = useState(false)
  const [requestProjectName, setRequestProjectName] = useState('')

  // Load data via direct fetch
  useEffect(() => {
    const headers = { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
    async function load() {
      try {
        const [eRes, pRes] = await Promise.all([
          fetch(`${supabaseUrl}/rest/v1/notebook_entries?select=*&order=created_at.desc`, { headers }),
          fetch(`${supabaseUrl}/rest/v1/notebook_projects?select=*&order=created_at.desc`, { headers }),
        ])
        if (eRes.ok) setEntries(await eRes.json())
        if (pRes.ok) setProjects(await pRes.json())
      } catch (err) {
        console.error('Failed to load notebook data:', err)
      }
    }
    load()
  }, [])

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel('notebook-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notebook_entries' }, (payload) => {
        setEntries(prev => prev.some(e => e.id === payload.new.id) ? prev : [payload.new, ...prev])
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notebook_entries' }, (payload) => {
        setEntries(prev => prev.map(e => e.id === payload.new.id ? payload.new : e))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'notebook_entries' }, (payload) => {
        setEntries(prev => prev.filter(e => e.id !== payload.old.id))
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notebook_projects' }, (payload) => {
        setProjects(prev => prev.some(p => p.id === payload.new.id) ? prev : [payload.new, ...prev])
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notebook_projects' }, (payload) => {
        setProjects(prev => prev.map(p => p.id === payload.new.id ? payload.new : p))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'notebook_projects' }, (payload) => {
        setProjects(prev => prev.filter(p => p.id !== payload.old.id))
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])


  // Mentors and coaches, for the "who helped" dropdown.
  useEffect(() => {
    let active = true
    fetch(`${supabaseUrl}/rest/v1/profiles?select=display_name,function_tags&order=display_name`, {
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
    })
      .then(res => (res.ok ? res.json() : []))
      .then(rows => {
        if (!active) return
        const list = Array.isArray(rows) ? rows : []
        setMentors(
          list
            .filter(r => (r.function_tags || []).some(t => t === 'Mentor' || t === 'Coach'))
            .map(r => r.display_name)
            .filter(Boolean)
        )
      })
      .catch(() => {})
    return () => { active = false }
  }, [])

  useEffect(() => {
    let active = true
    fetch(`${supabaseUrl}/rest/v1/attendance_sessions?select=session_date&order=session_date.desc`, {
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
    })
      .then(res => (res.ok ? res.json() : []))
      .then(rows => { if (active) setMeetingDays([...new Set((rows || []).map(r => r.session_date))]) })
      .catch(() => {})
    return () => { active = false }
  }, [])

  // Meetings this person has no entry for yet — what they'd be marked absent for.
  const missingDays = meetingDays.filter(
    d => d <= todayLocal() && !entries.some(e => e.username === username && e.meeting_date === d)
  )

  const updateField = (field, value) => setFormData(prev => ({ ...prev, [field]: value }))

  // Submit entry
  const handleSubmitEntry = async () => {
    if (!formData.whatDid.trim()) return
    if (!formData.whyOption) return
    if (formData.whyOption === 'Other' && !formData.whyNote.trim()) return
    if (!formData.photoUrl && !formData.projectLink.trim()) return

    if (localStorage.getItem('scrum-sfx-enabled') !== 'false') new Audio('/sounds/click.mp3').play().catch(() => {})

    const entryData = {
      username,
      meeting_date: meetingDate,
      category: formData.category,
      custom_category: formData.category === 'Custom' ? formData.customCategory : '',
      what_did: formData.whatDid.trim(),
      why_option: formData.whyOption,
      why_note: formData.whyNote.trim(),
      engagement: formData.engagement,
      mentor_help: !!formData.mentorHelp,
      mentor_name: formData.mentorHelp ? formData.mentorName.trim() : '',
      mentor_note: formData.mentorHelp ? formData.mentorNote.trim() : '',
      project_id: formData.projectId,
      project_link: formData.projectLink.trim(),
      photo_url: formData.photoUrl.trim(),
      season: ACTIVE_SEASON,
    }

    // Close form immediately, save in background
    if (editingEntryId) {
      setEntries(prev => prev.map(e => e.id === editingEntryId ? { ...e, ...entryData } : e))
      setSubmitFeedback('Entry updated!')
      fetch(`${supabaseUrl}/rest/v1/notebook_entries?id=eq.${editingEntryId}`, {
        method: 'PATCH',
        headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
        body: JSON.stringify(entryData),
      }).then(res => {
        if (!res.ok) res.text().then(t => { console.error('Update failed:', t); setSubmitFeedback('Failed to save — try again') })
      }).catch(err => { console.error('Failed to update entry:', err); setSubmitFeedback('Failed to save — try again') })
    } else {
      const newEntry = {
        id: String(Date.now()) + Math.random().toString(36).slice(2),
        ...entryData,
        created_at: new Date().toISOString(),
      }
      setEntries(prev => [newEntry, ...prev])
      setSubmitFeedback('Entry saved!')
      fetch(`${supabaseUrl}/rest/v1/notebook_entries`, {
        method: 'POST',
        headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
        body: JSON.stringify(newEntry),
      }).then(res => {
        if (!res.ok) res.text().then(t => { console.error('Save failed:', t); setSubmitFeedback('Failed to save — try again'); setEntries(prev => prev.filter(e => e.id !== newEntry.id)) })
      }).catch(err => { console.error('Failed to save entry:', err); setSubmitFeedback('Failed to save — try again'); setEntries(prev => prev.filter(e => e.id !== newEntry.id)) })
    }

    setFormData({ ...INITIAL_ENTRY })
    setEditingEntryId(null)

    setTimeout(() => setSubmitFeedback(null), 3000)

    setView('projects')
  }

  // Delete entry (co-founders only)
  // Load an existing entry back into the form. handleSubmitEntry already
  // PATCHes when editingEntryId is set — nothing ever set it until now.
  const startEditEntry = (entry) => {
    setFormData({
      category: entry.category || 'Technical',
      customCategory: entry.custom_category || '',
      whatDid: entry.what_did || '',
      whyOption: entry.why_option || '',
      whyNote: entry.why_note || '',
      engagement: entry.engagement || 'Somewhat',
      mentorHelp: !!entry.mentor_help,
      mentorName: entry.mentor_name || '',
      mentorNote: entry.mentor_note || '',
      projectId: entry.project_id || '',
      projectLink: entry.project_link || '',
      photoUrl: entry.photo_url || '',
    })
    setMeetingDate(entry.meeting_date || todayLocal())
    setEditingEntryId(entry.id)
    setView('entry')
  }

  const handleDeleteEntry = (id) => {
    if (!window.confirm('Delete this notebook entry?')) return
    setEntries(prev => prev.filter(e => e.id !== id))
    fetch(`${supabaseUrl}/rest/v1/notebook_entries?id=eq.${id}`, {
      method: 'DELETE',
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` },
    }).catch(err => console.error('Failed to delete entry:', err))
  }

  // Submit project
  const handleSubmitProject = () => {
    if (!projectForm.name.trim()) return
    if (editingProjectId) {
      const updateData = {
        name: projectForm.name.trim(),
        category: projectForm.category,
        goal: projectForm.goal.trim(),
        reason: projectForm.reason.trim(),
        status: projectForm.status,
      }
      setProjects(prev => prev.map(p => p.id === editingProjectId ? { ...p, ...updateData } : p))
      fetch(`${supabaseUrl}/rest/v1/notebook_projects?id=eq.${editingProjectId}`, {
        method: 'PATCH',
        headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
        body: JSON.stringify(updateData),
      }).catch(err => console.error('Failed to update project:', err))
    } else {
      const newProject = {
        id: String(Date.now()) + Math.random().toString(36).slice(2),
        ...projectForm,
        name: projectForm.name.trim(),
        goal: projectForm.goal.trim(),
        reason: projectForm.reason.trim(),
        created_by: username,
        created_at: new Date().toISOString(),
      }
      setProjects(prev => [newProject, ...prev])
      fetch(`${supabaseUrl}/rest/v1/notebook_projects`, {
        method: 'POST',
        headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
        body: JSON.stringify(newProject),
      }).catch(err => console.error('Failed to save project:', err))
    }
    setProjectForm({ ...INITIAL_PROJECT })
    setEditingProjectId(null)
    setShowProjectModal(false)
  }

  // Delete project
  const handleDeleteProject = (id) => {
    setProjects(prev => prev.filter(p => p.id !== id))
    fetch(`${supabaseUrl}/rest/v1/notebook_projects?id=eq.${id}`, {
      method: 'DELETE',
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` },
    }).catch(err => console.error('Failed to delete project:', err))
  }

  // Filtered entries
  const filteredEntries = useMemo(() => {
    let result = entries
    if (filterSeason) result = result.filter(e => seasonOf(e) === filterSeason)
    if (!isLead) result = result.filter(e => e.username === username)
    if (filterStudent) result = result.filter(e => e.username === filterStudent)
    if (filterCategory) result = result.filter(e => e.category === filterCategory)
    if (filterProject) result = result.filter(e => e.project_id === filterProject)
    if (filterEngagement) result = result.filter(e => e.engagement === filterEngagement)
    return result
  }, [entries, showTeamEntries, isLead, username, filterSeason, filterStudent, filterCategory, filterProject, filterEngagement])

  // Seasons available in the data (plus the active one), newest first
  const availableSeasons = useMemo(() => {
    const set = new Set([ACTIVE_SEASON])
    entries.forEach(e => set.add(seasonOf(e)))
    return Array.from(set).sort().reverse()
  }, [entries])

  // Group by date
  const groupedEntries = useMemo(() => {
    const groups = {}
    filteredEntries.forEach(e => {
      const key = e.meeting_date || 'Unknown'
      if (!groups[key]) groups[key] = []
      groups[key].push(e)
    })
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]))
  }, [filteredEntries])

  // Unique students for filter
  const studentNames = useMemo(() => [...new Set(entries.map(e => e.username))].sort(), [entries])

  const activeProjects = projects.filter(p => p.status === 'Active')
  const projectMap = Object.fromEntries(projects.map(p => [p.id, p]))

  const formatDate = (dateStr) => {
    try {
      const [y, m, d] = dateStr.split('-')
      return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    } catch { return dateStr }
  }

  const PERMANENT_PROJECTS = [
    { id: '_technical', name: 'Technical', permanent: true },
    { id: '_business', name: 'Business', permanent: true },
    { id: '_programming', name: 'Programming', permanent: true },
  ]

  const allDisplayProjects = [
    ...PERMANENT_PROJECTS,
    ...projects.filter(p => p.status === 'Active').map(p => ({ ...p, permanent: false })),
  ]

  const getProjectEntries = (projectId) => {
    let result
    // Entries with a project_id matching an active custom project belong to that project.
    // All other entries fall back to their category's permanent project.
    const activeProjectIds = new Set(projects.filter(p => p.status === 'Active').map(p => p.id))

    if (projectId === '_technical') {
      result = entries.filter(e => e.category === 'Technical' && !(e.project_id && activeProjectIds.has(e.project_id)))
    } else if (projectId === '_business') {
      result = entries.filter(e => e.category === 'Business' && !(e.project_id && activeProjectIds.has(e.project_id)))
    } else if (projectId === '_programming') {
      result = entries.filter(e => e.category === 'Programming' && !(e.project_id && activeProjectIds.has(e.project_id)))
    } else {
      result = entries.filter(e => e.project_id === projectId)
    }
    if (!isLead) {
      result = result.filter(e => e.username === username)
    }
    // Only show entries from the selected season (so archived seasons don't leak into the folders)
    result = result.filter(e => seasonOf(e) === filterSeason)
    return result
  }

  const groupByDate = (entryList) => {
    const groups = {}
    entryList.forEach(e => {
      const key = e.meeting_date || 'Unknown'
      if (!groups[key]) groups[key] = []
      groups[key].push(e)
    })
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]))
  }

  const handleNewEntryFromProject = (projectId) => {
    const newForm = { ...INITIAL_ENTRY }
    if (projectId === '_technical') {
      newForm.category = 'Technical'
    } else if (projectId === '_business') {
      newForm.category = 'Business'
    } else if (projectId === '_programming') {
      newForm.category = 'Programming'
    } else {
      const proj = projects.find(p => p.id === projectId)
      newForm.projectId = projectId
      newForm.category = proj?.category || 'Technical'
    }
    setFormData(newForm)
    setEditingEntryId(null)
    setView('entry')
  }

  const handleRequestProject = () => {
    if (!requestProjectName.trim()) return
    const request = {
      id: String(Date.now()) + Math.random().toString(36).slice(2),
      type: 'notebook_project',
      data: { name: requestProjectName.trim() },
      requested_by: username,
      requested_by_user_id: user?.id,
      status: 'pending',
    }
    setRequestProjectName('')
    setShowRequestProjectModal(false)
    setSubmitFeedback('Project request submitted for approval!')
    setTimeout(() => setSubmitFeedback(null), 3000)
    fetch(`${supabaseUrl}/rest/v1/requests`, {
      method: 'POST',
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
      body: JSON.stringify(request),
    }).catch(err => console.error('Failed to request project:', err))
  }

  const views = [
    { id: 'projects', label: 'Projects', icon: FolderOpen },
    { id: 'entry', label: 'New Entry', icon: Plus },
  ]

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="px-4 py-3 ml-14 flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-pastel-blue-dark via-pastel-pink-dark to-pastel-orange-dark bg-clip-text text-transparent">
              Engineering Notebook
            </h1>
          {/* Sub-tabs */}
          <div className="flex gap-1 mt-2 overflow-x-auto">
            {views.map(v => {
              const Icon = v.icon
              return (
                <button
                  key={v.id}
                  onClick={() => {
                    if (v.id === 'entry') {
                      setFormData({ ...INITIAL_ENTRY })
                      setEditingEntryId(null)

                    }
                    setView(v.id)
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                    view === v.id ? 'bg-pastel-pink text-gray-800' : 'text-gray-500 hover:bg-pastel-blue/30'
                  }`}
                >
                  <Icon size={14} />
                  {v.label}
                </button>
              )
            })}
          </div>
          {/* Season selector — view the current season or an archived one */}
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-gray-400">Season</span>
            <select
              value={filterSeason}
              onChange={e => setFilterSeason(e.target.value)}
              className="border rounded-lg px-2 py-1 text-xs focus:ring-2 focus:ring-pastel-blue focus:border-transparent"
            >
              {availableSeasons.map(s => (
                <option key={s} value={s}>{s}{s === ACTIVE_SEASON ? ' (current)' : ' — archive'}</option>
              ))}
            </select>
          </div>
          </div>
          <NotificationBell />
        </div>
      </header>

      {/* Feedback toast */}
      {submitFeedback && (
        <div className="mx-4 mt-2 text-center text-green-600 font-medium animate-pulse text-sm">
          {submitFeedback}
        </div>
      )}

      <main className="flex-1 p-4 overflow-y-auto">
        <div className="max-w-2xl mx-auto space-y-3">

          {/* ========== PROJECTS VIEW ========== */}
          {view === 'projects' && (
            <>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                {isLead ? (
                  <button
                    onClick={() => { setProjectForm({ ...INITIAL_PROJECT }); setEditingProjectId(null); setShowProjectModal(true) }}
                    className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg bg-pastel-blue/30 hover:bg-pastel-blue/50 transition-colors font-medium"
                  >
                    <Plus size={14} /> New Project
                  </button>
                ) : (
                  <button
                    onClick={() => setShowRequestProjectModal(true)}
                    className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg bg-pastel-blue/30 hover:bg-pastel-blue/50 transition-colors font-medium"
                  >
                    <Plus size={14} /> Request Project
                  </button>
                )}
                <button
                  onClick={() => { setFormData({ ...INITIAL_ENTRY }); setEditingEntryId(null); setView('entry') }}
                  className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg bg-pastel-pink hover:bg-pastel-pink-dark transition-colors font-medium"
                >
                  <Plus size={14} /> New Entry
                </button>
              </div>

              <div className="space-y-2">
                {allDisplayProjects.map(project => {
                  const projectEntries = getProjectEntries(project.id)
                  const isExpanded = expandedProject === project.id
                  const dateGroups = groupByDate(projectEntries)

                  return (
                    <div key={project.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
                      <div
                        onClick={() => setExpandedProject(isExpanded ? null : project.id)}
                        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <FolderOpen size={18} className="text-pastel-blue-dark" />
                          <span className="font-semibold text-gray-800">{project.name}</span>
                          <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
                            {projectEntries.length}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {!project.permanent && isLead && (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setProjectForm({ name: project.name, category: project.category || 'Technical', goal: project.goal || '', reason: project.reason || '', status: project.status || 'Active' })
                                  setEditingProjectId(project.id)
                                  setShowProjectModal(true)
                                }}
                                className="text-gray-300 hover:text-pastel-blue-dark transition-colors"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDeleteProject(project.id) }}
                                className="text-gray-300 hover:text-red-400 transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                          {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="border-t px-4 py-3 space-y-3 bg-gray-50/30">
                          <button
                            onClick={() => handleNewEntryFromProject(project.id)}
                            className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-pastel-pink/30 hover:bg-pastel-pink/50 transition-colors text-gray-600"
                          >
                            <Plus size={12} /> Add Entry
                          </button>

                          {dateGroups.length === 0 ? (
                            <p className="text-sm text-gray-400 text-center py-6">No entries yet.</p>
                          ) : (
                            dateGroups.map(([date, dateEntries]) => (
                              <div key={date}>
                                <div className="flex items-center gap-2 mb-1.5">
                                  <h4 className="text-xs font-semibold text-gray-500">{formatDate(date)}</h4>
                                  <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-1.5 py-0.5">{dateEntries.length}</span>
                                </div>
                                <div className="space-y-2">
                                  {dateEntries.map(entry => {
                                    const engDot = ENGAGEMENT_OPTIONS.find(o => o.value === entry.engagement)?.dot || 'bg-gray-400'
                                    return (
                                      <div key={entry.id} className="bg-white rounded-lg p-3 shadow-sm">
                                        <div className="flex items-start justify-between gap-2">
                                          <span className="flex items-center gap-1 text-xs text-gray-400">
                                            <span className={`w-2 h-2 rounded-full inline-block ${engDot}`} />
                                            {entry.engagement}
                                          </span>
                                          <div className="flex items-center gap-2 shrink-0">
                                            {/* Your own entry is yours to fix — a typo shouldn't need a
                                                lead. Leads can edit anyone's. */}
                                            {(entry.username === username || isLead) && (
                                              <button
                                                onClick={() => startEditEntry(entry)}
                                                title="Edit this entry"
                                                className="text-gray-300 hover:text-pastel-blue-dark transition-colors"
                                              >
                                                <Pencil size={14} />
                                              </button>
                                            )}
                                            {isLead && (
                                              <button onClick={() => handleDeleteEntry(entry.id)} title="Delete this entry" className="text-gray-300 hover:text-red-400 transition-colors">
                                                <Trash2 size={14} />
                                              </button>
                                            )}
                                          </div>
                                        </div>
                                        <p className="text-sm text-gray-800 mt-1 font-medium">{entry.what_did}</p>
                                        <p className="text-xs mt-1 flex items-start flex-wrap gap-x-1 text-gray-400">
                                          {entry.mentor_help ? (
                                            <>
                                              <GraduationCap size={11} className="text-amber-500 shrink-0 mt-0.5" />
                                              Mentor helped{entry.mentor_name ? ` — ${entry.mentor_name}` : ''}
                                              {entry.mentor_note ? <span className="italic text-gray-400">: {entry.mentor_note}</span> : null}
                                            </>
                                          ) : 'Done on their own'}
                                        </p>
                                        <p className="text-xs text-gray-500 mt-1">
                                          <span className="font-medium">Why:</span> {entry.why_option}
                                          {entry.why_note && <span className="italic"> - {entry.why_note}</span>}
                                        </p>
                                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                                          {entry.project_link && (
                                            <a href={entry.project_link} target="_blank" rel="noopener noreferrer" className="text-xs text-pastel-blue-dark hover:underline flex items-center gap-0.5">
                                              <ExternalLink size={10} /> Link
                                            </a>
                                          )}
                                          {entry.photo_url && (
                                            <a href={entry.photo_url} target="_blank" rel="noopener noreferrer">
                                              <img src={entry.photo_url} alt="Entry photo" className="mt-1 max-h-32 rounded-lg object-cover" onError={e => { e.target.style.display = 'none' }} />
                                            </a>
                                          )}
                                        </div>
                                        <div className="mt-2 pt-1.5 border-t border-gray-100">
                                          <span className="text-xs text-gray-400 font-medium">{entry.username}</span>
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

            </>
          )}

          {/* ========== ENTRY FORM VIEW ========== */}
          {view === 'entry' && (
            <div className="space-y-4">
              <SectionHeader title={editingEntryId ? 'Update Entry' : 'New Notebook Entry'} />
              {editingEntryId && (
                <div className="flex items-center justify-between gap-2 bg-pastel-blue/20 rounded-lg px-3 py-2">
                  <p className="text-xs text-gray-600">Editing an entry you already wrote — saving replaces it.</p>
                  <button
                    onClick={() => { setFormData({ ...INITIAL_ENTRY }); setEditingEntryId(null); setMeetingDate(todayLocal()) }}
                    className="text-xs font-semibold text-gray-500 hover:text-gray-700 shrink-0"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {/* Meeting date */}
              <div>
                <label className="text-sm font-medium text-gray-600 block mb-1">Meeting Date</label>
                {/* Anyone can date an entry, not just leads — missing one now
                    marks you absent, so everyone needs a way to make it up.
                    Capped at today: you can't write up a meeting that hasn't
                    happened. */}
                <input
                  type="date"
                  value={meetingDate}
                  max={todayLocal()}
                  onChange={e => setMeetingDate(e.target.value || todayLocal())}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-pastel-blue focus:border-transparent"
                />
                {meetingDate !== todayLocal() && (
                  <p className="text-xs text-pastel-blue-dark mt-1">
                    Writing this up for {formatDate(meetingDate)}, not today.
                  </p>
                )}
                {missingDays.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs text-gray-400 mb-1">
                      No entry yet for {missingDays.length === 1 ? 'this meeting' : 'these meetings'} — tap one to write it up.
                      It completes your notebook, but it won't undo an absence.
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {missingDays.map(d => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setMeetingDate(d)}
                          className={`px-2 py-1 text-xs rounded-lg transition-colors ${
                            meetingDate === d
                              ? 'bg-pastel-blue text-gray-800 font-semibold'
                              : 'bg-pastel-orange/30 hover:bg-pastel-orange/50 text-gray-700'
                          }`}
                        >
                          {formatDate(d)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Project */}
              <div>
                <label className="text-sm font-medium text-gray-600 block mb-1">Project</label>
                <div className="flex flex-wrap gap-2">
                  {['Technical', 'Business', 'Programming'].map(name => (
                    <button
                      key={name}
                      onClick={() => { updateField('category', name); updateField('projectId', '') }}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        formData.category === name && !formData.projectId ? 'bg-pastel-pink text-gray-800' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {name}
                    </button>
                  ))}
                  {activeProjects.map(p => (
                    <button
                      key={p.id}
                      onClick={() => { updateField('projectId', p.id); updateField('category', p.category || 'Technical') }}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        formData.projectId === p.id ? 'bg-pastel-pink text-gray-800' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* What did you do */}
              <div>
                <label className="text-sm font-medium text-gray-600 block mb-1">What did you do?</label>
                <input
                  type="text"
                  value={formData.whatDid}
                  onChange={e => updateField('whatDid', e.target.value.slice(0, 150))}
                  placeholder="Wired the intake motor to REV hub port 2"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-pastel-blue focus:border-transparent"
                  maxLength={150}
                />
                <p className="text-xs text-gray-400 text-right mt-0.5">{formData.whatDid.length}/150</p>
              </div>

              {/* Why it matters */}
              <div>
                <label className="text-sm font-medium text-gray-600 block mb-1">Why it matters</label>
                <select
                  value={formData.whyOption}
                  onChange={e => updateField('whyOption', e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-pastel-blue focus:border-transparent"
                >
                  <option value="">Select a reason...</option>
                  {WHY_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
                <input
                  type="text"
                  value={formData.whyNote}
                  onChange={e => updateField('whyNote', e.target.value)}
                  placeholder={formData.whyOption === 'Other' ? 'Required: explain why this matters' : 'Optional: add a short note'}
                  className={`w-full mt-2 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-pastel-blue focus:border-transparent ${formData.whyOption === 'Other' && !formData.whyNote.trim() ? 'border-red-300' : ''}`}
                />
                {formData.whyOption === 'Other' && !formData.whyNote.trim() && (
                  <p className="text-xs text-red-400 mt-0.5">A note is required when selecting "Other"</p>
                )}
              </div>

              {/* Engagement */}
              <div>
                <label className="text-sm font-medium text-gray-600 block mb-1">How engaged were you?</label>
                <div className="flex gap-2">
                  {ENGAGEMENT_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => updateField('engagement', opt.value)}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        formData.engagement === opt.value ? 'bg-pastel-pink text-gray-800' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      <span className={`w-2.5 h-2.5 rounded-full ${opt.dot}`} />
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mentor help — FTC judges care whether the work was student-led,
                  so record it per entry rather than guessing later. */}
              <div>
                <label className="text-sm font-medium text-gray-600 block mb-1">Did a mentor help?</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setFormData(prev => ({ ...prev, mentorHelp: false, mentorName: '', mentorNote: '' }))}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      !formData.mentorHelp ? 'bg-pastel-pink text-gray-800' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    I did this on my own
                  </button>
                  <button
                    onClick={() => updateField('mentorHelp', true)}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      formData.mentorHelp ? 'bg-pastel-pink text-gray-800' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    <GraduationCap size={14} /> A mentor helped
                  </button>
                </div>
                {formData.mentorHelp && (
                  <>
                    <select
                      value={formData.mentorName}
                      onChange={e => updateField('mentorName', e.target.value)}
                      className="w-full mt-2 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-pastel-blue focus:border-transparent"
                    >
                      <option value="">Which mentor?</option>
                      {mentors.map(m => <option key={m} value={m}>{m}</option>)}
                      <option value="Someone else">Someone else</option>
                    </select>
                    <textarea
                      value={formData.mentorNote}
                      onChange={e => updateField('mentorNote', e.target.value)}
                      rows={2}
                      placeholder="How did they help? e.g. showed me how to set gear ratios, I did the CAD"
                      className="w-full mt-2 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-pastel-blue focus:border-transparent"
                    />
                  </>
                )}
              </div>

              {/* Project link (optional) */}
              <div>
                <label className="text-sm font-medium text-gray-600 block mb-1">Project link {formData.photoUrl ? '(optional)' : '(required if no photo)'}</label>
                <input
                  type="url"
                  value={formData.projectLink}
                  onChange={e => updateField('projectLink', e.target.value)}
                  placeholder="GitHub PR, Google Doc, etc."
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-pastel-blue focus:border-transparent"
                />
              </div>

              {/* Photo upload (optional) */}
              <div>
                <label className="text-sm font-medium text-gray-600 block mb-1">Photo/Screenshot {formData.projectLink.trim() ? '(optional)' : '(required if no link)'}</label>
                {formData.photoUrl ? (
                  <div className="relative inline-block">
                    <img
                      src={formData.photoUrl}
                      alt="Preview"
                      className="max-h-40 rounded-lg object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => updateField('photoUrl', '')}
                      className="absolute -top-2 -right-2 bg-white rounded-full shadow p-0.5 text-gray-400 hover:text-red-400 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <label className="flex items-center gap-2 px-4 py-3 rounded-lg border-2 border-dashed border-gray-200 hover:border-pastel-blue cursor-pointer transition-colors">
                    <Camera size={18} className="text-gray-400" />
                    <span className="text-sm text-gray-400">Tap to add a photo</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        // Clear the input straight away, so picking the same
                        // file again after a failure still fires onChange.
                        e.target.value = ''
                        if (!file) return
                        if (file.size > 10 * 1024 * 1024) {
                          setFormData(prev => ({ ...prev, _uploading: false, _photoError: 'That photo is over 10 MB — try a smaller one.' }))
                          return
                        }
                        setFormData(prev => ({ ...prev, _uploading: true, _photoError: '' }))

                        // Every path out of here has to clear _uploading. It
                        // previously only cleared on success, so a photo the
                        // browser couldn't decode — an iPhone HEIC on Chrome,
                        // most often — left the spinner going forever and the
                        // Submit button disabled with nothing to explain why.
                        const fail = (msg) => setFormData(prev => ({ ...prev, _uploading: false, _photoError: msg }))
                        const CANT_READ = "Couldn't read that photo. If it came from an iPhone it may be HEIC — open it, screenshot it, and add the screenshot, or use the project link instead."

                        const img = new Image()
                        const reader = new FileReader()
                        reader.onerror = () => fail(CANT_READ)
                        reader.onload = (ev) => {
                          img.onerror = () => fail(CANT_READ)
                          img.onload = () => {
                            try {
                              const canvas = document.createElement('canvas')
                              const MAX = 480
                              let w = img.width, h = img.height
                              if (!w || !h) return fail(CANT_READ)
                              if (w > MAX || h > MAX) {
                                if (w > h) { h = Math.round(h * MAX / w); w = MAX }
                                else { w = Math.round(w * MAX / h); h = MAX }
                              }
                              canvas.width = w
                              canvas.height = h
                              const ctx = canvas.getContext('2d')
                              if (!ctx) return fail(CANT_READ)
                              ctx.drawImage(img, 0, 0, w, h)
                              const dataUrl = canvas.toDataURL('image/jpeg', 0.5)
                              setFormData(prev => ({ ...prev, photoUrl: dataUrl, _uploading: false, _photoError: '' }))
                            } catch {
                              fail(CANT_READ)
                            }
                          }
                          img.src = ev.target.result
                        }
                        reader.readAsDataURL(file)
                      }}
                    />
                    {formData._uploading && <Loader2 size={16} className="animate-spin text-pastel-blue-dark ml-auto" />}
                  </label>
                )}
                {formData._photoError && (
                  <p className="text-xs text-red-500 mt-1.5">{formData._photoError}</p>
                )}
              </div>

              {/* Submit — say what's still missing rather than just greying out */}
              {(() => {
                const missing = [
                  !formData.whatDid.trim() && 'what you did',
                  !formData.whyOption && 'why it mattered',
                  formData.whyOption === 'Other' && !formData.whyNote.trim() && 'a note for "Other"',
                  !formData.photoUrl && !formData.projectLink.trim() && 'a photo or a project link',
                ].filter(Boolean)
                return (
                  <>
                    {missing.length > 0 && (
                      <p className="text-xs text-gray-400 text-center">
                        Still needed: {missing.join(' · ')}
                      </p>
                    )}
                    <button
                      onClick={handleSubmitEntry}
                      disabled={missing.length > 0}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-lg font-semibold transition-colors bg-pastel-pink hover:bg-pastel-pink-dark disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Send size={18} />
                      {editingEntryId ? 'Update Entry' : 'Submit Entry'}
                    </button>
                  </>
                )
              })()}
            </div>
          )}


        </div>
      </main>

      {/* ========== MODALS ========== */}

      {/* Project modal */}
      {showProjectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowProjectModal(false)}>
          <div className="bg-white rounded-xl p-5 w-full max-w-md space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">{editingProjectId ? 'Edit Project' : 'New Project'}</h3>
              <button onClick={() => setShowProjectModal(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <input
              type="text"
              value={projectForm.name}
              onChange={e => setProjectForm(p => ({ ...p, name: e.target.value }))}
              placeholder="Project name"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-pastel-blue focus:border-transparent"
            />
            <select
              value={projectForm.category}
              onChange={e => setProjectForm(p => ({ ...p, category: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-pastel-blue focus:border-transparent"
            >
              {CATEGORIES.filter(c => c !== 'Custom').map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <textarea
              value={projectForm.goal}
              onChange={e => setProjectForm(p => ({ ...p, goal: e.target.value }))}
              placeholder="What's the goal?"
              rows={2}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-pastel-blue focus:border-transparent resize-none"
            />
            <textarea
              value={projectForm.reason}
              onChange={e => setProjectForm(p => ({ ...p, reason: e.target.value }))}
              placeholder="Why is this important?"
              rows={2}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-pastel-blue focus:border-transparent resize-none"
            />
            {editingProjectId && (
              <select
                value={projectForm.status}
                onChange={e => setProjectForm(p => ({ ...p, status: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-pastel-blue focus:border-transparent"
              >
                <option value="Active">Active</option>
                <option value="Completed">Completed</option>
              </select>
            )}
            <button
              onClick={handleSubmitProject}
              disabled={!projectForm.name.trim()}
              className="w-full py-2 rounded-lg font-medium bg-pastel-pink hover:bg-pastel-pink-dark transition-colors disabled:opacity-40"
            >
              {editingProjectId ? 'Update Project' : 'Create Project'}
            </button>
          </div>
        </div>
      )}

      {/* Request project modal (teammates) */}
      {showRequestProjectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowRequestProjectModal(false)}>
          <div className="bg-white rounded-xl p-5 w-full max-w-md space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">Request a Project</h3>
              <button onClick={() => setShowRequestProjectModal(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <p className="text-xs text-gray-400">Your request will be reviewed by a team lead.</p>
            <input
              type="text"
              value={requestProjectName}
              onChange={e => setRequestProjectName(e.target.value)}
              placeholder="Project name"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-pastel-blue focus:border-transparent"
              autoFocus
            />
            <button
              onClick={handleRequestProject}
              disabled={!requestProjectName.trim()}
              className="w-full py-2 rounded-lg font-medium bg-pastel-pink hover:bg-pastel-pink-dark transition-colors disabled:opacity-40"
            >
              Submit Request
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
