import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabase'
import { useUser } from '../contexts/UserContext'
import { usePermissions } from '../hooks/usePermissions'
import { Send, Plus, X, Trash2, FolderOpen, ExternalLink, ChevronDown, ChevronUp, Pencil, Camera, Loader2 } from 'lucide-react'
import NotificationBell from './NotificationBell'

const CATEGORIES = ['Technical', 'Programming', 'Business', 'Custom']

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
  const [meetingDate, setMeetingDate] = useState(() => new Date().toISOString().split('T')[0])
  const [editingEntryId, setEditingEntryId] = useState(null)
  const [projectForm, setProjectForm] = useState({ ...INITIAL_PROJECT })
  const [editingProjectId, setEditingProjectId] = useState(null)
  const [showProjectModal, setShowProjectModal] = useState(false)
  const [submitFeedback, setSubmitFeedback] = useState(null)
  const [showTeamEntries, setShowTeamEntries] = useState(false)
  const [filterStudent, setFilterStudent] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterProject, setFilterProject] = useState('')
  const [filterEngagement, setFilterEngagement] = useState('')
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


  const updateField = (field, value) => setFormData(prev => ({ ...prev, [field]: value }))

  // Submit entry
  const handleSubmitEntry = async () => {
    if (!formData.whatDid.trim()) return
    if (!formData.whyOption) return

    const entryData = {
      username,
      meeting_date: meetingDate,
      category: formData.category,
      custom_category: formData.category === 'Custom' ? formData.customCategory : '',
      what_did: formData.whatDid.trim(),
      why_option: formData.whyOption,
      why_note: formData.whyNote.trim(),
      engagement: formData.engagement,
      project_id: formData.projectId,
      project_link: formData.projectLink.trim(),
      photo_url: formData.photoUrl.trim(),
    }

    // Close form immediately, save in background
    if (editingEntryId) {
      setEntries(prev => prev.map(e => e.id === editingEntryId ? { ...e, ...entryData } : e))
      setSubmitFeedback('Entry updated!')
      fetch(`${supabaseUrl}/rest/v1/notebook_entries?id=eq.${editingEntryId}`, {
        method: 'PATCH',
        headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
        body: JSON.stringify(entryData),
      }).catch(err => console.error('Failed to update entry:', err))
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
      }).catch(err => console.error('Failed to save entry:', err))
    }

    setFormData({ ...INITIAL_ENTRY })
    setEditingEntryId(null)

    setTimeout(() => setSubmitFeedback(null), 3000)

    setView('projects')
  }

  // Delete entry (co-founders only)
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
    if (!isLead) result = result.filter(e => e.username === username)
    if (filterStudent) result = result.filter(e => e.username === filterStudent)
    if (filterCategory) result = result.filter(e => e.category === filterCategory)
    if (filterProject) result = result.filter(e => e.project_id === filterProject)
    if (filterEngagement) result = result.filter(e => e.engagement === filterEngagement)
    return result
  }, [entries, showTeamEntries, isLead, username, filterStudent, filterCategory, filterProject, filterEngagement])

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
                                          {isLead && (
                                            <button onClick={() => handleDeleteEntry(entry.id)} className="text-gray-300 hover:text-red-400 transition-colors">
                                              <Trash2 size={14} />
                                            </button>
                                          )}
                                        </div>
                                        <p className="text-sm text-gray-800 mt-1 font-medium">{entry.what_did}</p>
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

              {/* Meeting date */}
              <div>
                <label className="text-sm font-medium text-gray-600 block mb-1">Meeting Date</label>
                {isLead ? (
                  <input
                    type="date"
                    value={meetingDate}
                    onChange={e => { setMeetingDate(e.target.value); setEditingEntryId(null) }}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-pastel-blue focus:border-transparent"
                  />
                ) : (
                  <p className="text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2">{formatDate(meetingDate)}</p>
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
                  placeholder="Optional: add a short note"
                  className="w-full mt-2 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-pastel-blue focus:border-transparent"
                />
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

              {/* Project link (optional) */}
              <div>
                <label className="text-sm font-medium text-gray-600 block mb-1">Project link (optional)</label>
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
                <label className="text-sm font-medium text-gray-600 block mb-1">Photo/Screenshot (optional)</label>
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
                      onChange={async (e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        if (file.size > 5 * 1024 * 1024) {
                          alert('Photo must be under 5 MB')
                          return
                        }
                        updateField('_uploading', true)
                        const ext = file.name.split('.').pop() || 'jpg'
                        const path = `${user.id}/${Date.now()}.${ext}`
                        const { data, error } = await supabase.storage.from('notebook-photos').upload(path, file)
                        if (error) {
                          console.error('Upload failed:', error)
                          alert('Photo upload failed — try again')
                          updateField('_uploading', false)
                          return
                        }
                        const { data: { publicUrl } } = supabase.storage.from('notebook-photos').getPublicUrl(data.path)
                        updateField('photoUrl', publicUrl)
                        updateField('_uploading', false)
                      }}
                    />
                    {formData._uploading && <Loader2 size={16} className="animate-spin text-pastel-blue-dark ml-auto" />}
                  </label>
                )}
              </div>

              {/* Submit */}
              <button
                onClick={handleSubmitEntry}
                disabled={!formData.whatDid.trim() || !formData.whyOption}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-lg font-semibold transition-colors bg-pastel-pink hover:bg-pastel-pink-dark disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Send size={18} />
                {editingEntryId ? 'Update Entry' : 'Submit Entry'}
              </button>
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
