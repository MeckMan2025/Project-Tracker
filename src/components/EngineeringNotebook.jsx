import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabase'
import { useUser } from '../contexts/UserContext'
import { usePermissions } from '../hooks/usePermissions'
import { Send, Plus, X, Trash2, Check, BookOpen, FolderOpen, MessageSquareQuote, Filter, ExternalLink, ChevronDown, ChevronUp, Pencil } from 'lucide-react'
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
  const { username } = useUser()
  const { canOrganizeNotebook, canApproveQuotes, canSubmitNotebook, isGuest } = usePermissions()
  const isLead = canOrganizeNotebook
  const canReviewQuotes = canApproveQuotes
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  const [view, setView] = useState('timeline')
  const [entries, setEntries] = useState([])
  const [projects, setProjects] = useState([])
  const [approvedQuotes, setApprovedQuotes] = useState([])
  const [pendingQuotes, setPendingQuotes] = useState([])
  const [formData, setFormData] = useState({ ...INITIAL_ENTRY })
  const [meetingDate, setMeetingDate] = useState(() => new Date().toISOString().split('T')[0])
  const [editingEntryId, setEditingEntryId] = useState(null)
  const [projectForm, setProjectForm] = useState({ ...INITIAL_PROJECT })
  const [editingProjectId, setEditingProjectId] = useState(null)
  const [showProjectModal, setShowProjectModal] = useState(false)
  const [quoteText, setQuoteText] = useState('')
  const [showQuoteModal, setShowQuoteModal] = useState(false)
  const [quoteToast, setQuoteToast] = useState(null)
  const [submitFeedback, setSubmitFeedback] = useState(null)
  const [showTeamEntries, setShowTeamEntries] = useState(false)
  const [filterStudent, setFilterStudent] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterProject, setFilterProject] = useState('')
  const [filterEngagement, setFilterEngagement] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  // Load data via direct fetch
  useEffect(() => {
    const headers = { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
    async function load() {
      try {
        const [eRes, pRes, qRes] = await Promise.all([
          fetch(`${supabaseUrl}/rest/v1/notebook_entries?select=*&order=created_at.desc`, { headers }),
          fetch(`${supabaseUrl}/rest/v1/notebook_projects?select=*&order=created_at.desc`, { headers }),
          fetch(`${supabaseUrl}/rest/v1/fun_quotes?select=*&order=created_at.desc`, { headers }),
        ])
        if (eRes.ok) setEntries(await eRes.json())
        if (pRes.ok) setProjects(await pRes.json())
        if (qRes.ok) {
          const quotes = await qRes.json()
          setApprovedQuotes(quotes.filter(q => q.approved))
          setPendingQuotes(quotes.filter(q => !q.approved))
        }
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
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'fun_quotes' }, (payload) => {
        if (payload.new.approved) {
          setApprovedQuotes(prev => prev.some(q => q.id === payload.new.id) ? prev : [payload.new, ...prev])
        } else {
          setPendingQuotes(prev => prev.some(q => q.id === payload.new.id) ? prev : [payload.new, ...prev])
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'fun_quotes' }, (payload) => {
        if (payload.new.approved) {
          setPendingQuotes(prev => prev.filter(q => q.id !== payload.new.id))
          setApprovedQuotes(prev => prev.some(q => q.id === payload.new.id) ? prev : [payload.new, ...prev])
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'fun_quotes' }, (payload) => {
        setPendingQuotes(prev => prev.filter(q => q.id !== payload.old.id))
        setApprovedQuotes(prev => prev.filter(q => q.id !== payload.old.id))
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

    // Show fun quote
    if (approvedQuotes.length > 0) {
      const random = approvedQuotes[Math.floor(Math.random() * approvedQuotes.length)]
      setQuoteToast(random)
      setTimeout(() => setQuoteToast(null), 5000)
    }

    setView('timeline')
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

  // Submit fun quote
  const handleSubmitQuote = () => {
    if (!quoteText.trim()) return
    const newQuote = {
      id: String(Date.now()) + Math.random().toString(36).slice(2),
      content: quoteText.trim(),
      submitted_by: username,
      approved: false,
      approved_by: '',
      created_at: new Date().toISOString(),
    }
    setPendingQuotes(prev => [newQuote, ...prev])
    setQuoteText('')
    setShowQuoteModal(false)
    setSubmitFeedback('Quote submitted for approval!')
    setTimeout(() => setSubmitFeedback(null), 3000)
    fetch(`${supabaseUrl}/rest/v1/fun_quotes`, {
      method: 'POST',
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
      body: JSON.stringify(newQuote),
    }).catch(err => console.error('Failed to submit quote:', err))
  }

  // Approve quote (top only)
  const handleApproveQuote = (id) => {
    const quote = pendingQuotes.find(q => q.id === id)
    setPendingQuotes(prev => prev.filter(q => q.id !== id))
    if (quote) setApprovedQuotes(prev => [{ ...quote, approved: true, approved_by: username }, ...prev])
    fetch(`${supabaseUrl}/rest/v1/fun_quotes?id=eq.${id}`, {
      method: 'PATCH',
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
      body: JSON.stringify({ approved: true, approved_by: username }),
    }).catch(err => console.error('Failed to approve quote:', err))
  }

  // Delete quote (top only)
  const handleDeleteQuote = (id) => {
    setPendingQuotes(prev => prev.filter(q => q.id !== id))
    setApprovedQuotes(prev => prev.filter(q => q.id !== id))
    fetch(`${supabaseUrl}/rest/v1/fun_quotes?id=eq.${id}`, {
      method: 'DELETE',
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` },
    }).catch(err => console.error('Failed to delete quote:', err))
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

  const views = [
    { id: 'timeline', label: 'Timeline', icon: BookOpen },
    { id: 'entry', label: 'New Entry', icon: Plus },
    ...(isLead ? [{ id: 'projects', label: 'Projects', icon: FolderOpen }] : []),
    { id: 'quotes', label: 'Quotes', icon: MessageSquareQuote },
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

      {/* Fun quote toast */}
      {quoteToast && (
        <div className="mx-4 mt-2 bg-pastel-orange/20 rounded-xl p-3 text-center relative" onClick={() => setQuoteToast(null)}>
          <MessageSquareQuote size={14} className="inline mr-1 text-pastel-orange-dark" />
          <span className="text-sm text-gray-700 italic">"{quoteToast.content}"</span>
          <span className="text-xs text-gray-400 ml-2">- {quoteToast.submitted_by}</span>
        </div>
      )}

      <main className="flex-1 p-4 overflow-y-auto">
        <div className="max-w-2xl mx-auto space-y-3">

          {/* ========== TIMELINE VIEW ========== */}
          {view === 'timeline' && (
            <>
              {/* Filter toggle & team toggle */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center gap-1 text-sm px-3 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
                >
                  <Filter size={14} />
                  Filters
                  {showFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                <button
                  onClick={() => { setFormData({ ...INITIAL_ENTRY }); setEditingEntryId(null); localStorage.removeItem('notebook-entry-draft'); setView('entry') }}
                  className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg bg-pastel-pink hover:bg-pastel-pink-dark transition-colors font-medium"
                >
                  <Plus size={14} />
                  New Entry
                </button>
              </div>

              {/* Filters */}
              {showFilters && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 bg-white rounded-lg p-3 shadow-sm">
                  {isLead && (
                    <select value={filterStudent} onChange={e => setFilterStudent(e.target.value)} className="text-sm border rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-pastel-blue focus:border-transparent">
                      <option value="">All Students</option>
                      {studentNames.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  )}
                  <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="text-sm border rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-pastel-blue focus:border-transparent">
                    <option value="">All Categories</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <select value={filterProject} onChange={e => setFilterProject(e.target.value)} className="text-sm border rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-pastel-blue focus:border-transparent">
                    <option value="">All Projects</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <select value={filterEngagement} onChange={e => setFilterEngagement(e.target.value)} className="text-sm border rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-pastel-blue focus:border-transparent">
                    <option value="">All Engagement</option>
                    {ENGAGEMENT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  {(filterStudent || filterCategory || filterProject || filterEngagement) && (
                    <button
                      onClick={() => { setFilterStudent(''); setFilterCategory(''); setFilterProject(''); setFilterEngagement('') }}
                      className="col-span-2 md:col-span-4 text-xs text-gray-500 hover:text-gray-700 flex items-center justify-center gap-1"
                    >
                      <X size={12} /> Clear filters
                    </button>
                  )}
                </div>
              )}

              {/* Timeline */}
              {groupedEntries.length === 0 ? (
                <div className="text-center text-gray-400 py-12">
                  <BookOpen size={40} className="mx-auto mb-2 opacity-50" />
                  <p>No notebook entries yet.</p>
                  <p className="text-sm mt-1">Tap "New Entry" to log your first meeting!</p>
                </div>
              ) : (
                groupedEntries.map(([date, dateEntries]) => (
                  <div key={date}>
                    <div className="flex items-center gap-2 mb-2 mt-4">
                      <h3 className="text-sm font-semibold text-gray-500">{formatDate(date)}</h3>
                      <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">{dateEntries.length} {dateEntries.length === 1 ? 'entry' : 'entries'}</span>
                    </div>
                    <div className="space-y-2">
                      {dateEntries.map(entry => {
                        const catColor = CATEGORY_COLORS[entry.category] || CATEGORY_COLORS.Custom
                        const engDot = ENGAGEMENT_OPTIONS.find(o => o.value === entry.engagement)?.dot || 'bg-gray-400'
                        const project = projectMap[entry.project_id]
                        const canDelete = isLead
                        return (
                          <div key={entry.id} className="bg-white rounded-lg p-3 shadow-sm">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${catColor}`}>
                                  {entry.category === 'Custom' ? (entry.custom_category || 'Custom') : entry.category}
                                </span>
                                <span className="flex items-center gap-1 text-xs text-gray-400">
                                  <span className={`w-2 h-2 rounded-full inline-block ${engDot}`} />
                                  {entry.engagement}
                                </span>
                              </div>
                              {canDelete && (
                                <button onClick={() => handleDeleteEntry(entry.id)} className="text-gray-300 hover:text-red-400 transition-colors">
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                            <p className="text-sm text-gray-800 mt-1.5 font-medium">{entry.what_did}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              <span className="font-medium">Why:</span> {entry.why_option}
                              {entry.why_note && <span className="italic"> - {entry.why_note}</span>}
                            </p>
                            {project && (
                              <p className="text-xs text-gray-400 mt-1">
                                <FolderOpen size={10} className="inline mr-1" />
                                {project.name}
                              </p>
                            )}
                            <div className="flex items-center gap-3 mt-2 flex-wrap">
                              {entry.project_link && (
                                <a href={entry.project_link} target="_blank" rel="noopener noreferrer" className="text-xs text-pastel-blue-dark hover:underline flex items-center gap-0.5">
                                  <ExternalLink size={10} /> Link
                                </a>
                              )}
                              {entry.photo_url && (
                                <a href={entry.photo_url} target="_blank" rel="noopener noreferrer" className="text-xs text-pastel-blue-dark hover:underline">
                                  Photo
                                </a>
                              )}
                            </div>
                            <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-gray-100">
                              <span className="text-xs text-gray-400 font-medium">{entry.username}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))
              )}

              {/* Submit quote link */}
              <div className="text-center pt-4">
                <button
                  onClick={() => setShowQuoteModal(true)}
                  className="text-xs text-gray-400 hover:text-pastel-pink-dark transition-colors"
                >
                  Submit a fun team quote
                </button>
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

              {/* Category */}
              <div>
                <label className="text-sm font-medium text-gray-600 block mb-1">Category</label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat}
                      onClick={() => updateField('category', cat)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        formData.category === cat ? 'bg-pastel-pink text-gray-800' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
                {formData.category === 'Custom' && (
                  <input
                    type="text"
                    value={formData.customCategory}
                    onChange={e => updateField('customCategory', e.target.value)}
                    placeholder="Category name (e.g. Strategy)"
                    className="w-full mt-2 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-pastel-blue focus:border-transparent"
                  />
                )}
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

              {/* Project (optional) */}
              {activeProjects.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-gray-600 block mb-1">Project (optional)</label>
                  <select
                    value={formData.projectId}
                    onChange={e => updateField('projectId', e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-pastel-blue focus:border-transparent"
                  >
                    <option value="">No project</option>
                    {activeProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              )}

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

              {/* Photo URL (optional) */}
              <div>
                <label className="text-sm font-medium text-gray-600 block mb-1">Photo/Screenshot URL (optional)</label>
                <input
                  type="url"
                  value={formData.photoUrl}
                  onChange={e => updateField('photoUrl', e.target.value)}
                  placeholder="Paste image URL from Google Drive, Discord, etc."
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-pastel-blue focus:border-transparent"
                />
                {formData.photoUrl && (
                  <img
                    src={formData.photoUrl}
                    alt="Preview"
                    className="mt-2 max-h-32 rounded-lg object-cover"
                    onError={e => { e.target.style.display = 'none' }}
                  />
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

          {/* ========== PROJECTS VIEW (lead-only) ========== */}
          {view === 'projects' && isLead && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <SectionHeader title="Projects" />
                <button
                  onClick={() => { setProjectForm({ ...INITIAL_PROJECT }); setEditingProjectId(null); setShowProjectModal(true) }}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-pastel-pink hover:bg-pastel-pink-dark transition-colors"
                >
                  <Plus size={14} /> New Project
                </button>
              </div>

              {projects.length === 0 ? (
                <div className="text-center text-gray-400 py-8">
                  <FolderOpen size={40} className="mx-auto mb-2 opacity-50" />
                  <p>No projects yet.</p>
                  <p className="text-sm mt-1">Create a project to group related notebook entries.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {projects.map(project => {
                    const linkedCount = entries.filter(e => e.project_id === project.id).length
                    const catColor = CATEGORY_COLORS[project.category] || CATEGORY_COLORS.Custom
                    return (
                      <div key={project.id} className="bg-white rounded-lg p-3 shadow-sm">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold text-gray-800">{project.name}</h4>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${catColor}`}>{project.category}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${project.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                {project.status}
                              </span>
                            </div>
                            {project.goal && <p className="text-sm text-gray-600 mt-1">{project.goal}</p>}
                            {project.reason && <p className="text-xs text-gray-400 mt-0.5">Why: {project.reason}</p>}
                            <p className="text-xs text-gray-400 mt-1">{linkedCount} linked {linkedCount === 1 ? 'entry' : 'entries'} | Created by {project.created_by}</p>
                          </div>
                          <div className="flex gap-1">
                            <button
                              onClick={() => {
                                setProjectForm({ name: project.name, category: project.category, goal: project.goal || '', reason: project.reason || '', status: project.status })
                                setEditingProjectId(project.id)
                                setShowProjectModal(true)
                              }}
                              className="text-gray-300 hover:text-pastel-blue-dark transition-colors"
                            >
                              <Pencil size={14} />
                            </button>
                            <button onClick={() => handleDeleteProject(project.id)} className="text-gray-300 hover:text-red-400 transition-colors">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ========== QUOTES VIEW (visible to all, manage by top) ========== */}
          {view === 'quotes' && (
            <div className="space-y-4">
              <SectionHeader title="Fun Quotes" />

              {/* Pending quotes (top can approve/delete) */}
              {canReviewQuotes && pendingQuotes.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 mb-2">Pending Approval ({pendingQuotes.length})</h3>
                  <div className="space-y-2">
                    {pendingQuotes.map(q => (
                      <div key={q.id} className="bg-yellow-50 rounded-lg p-3 flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm text-gray-700 italic">"{q.content}"</p>
                          <p className="text-xs text-gray-400 mt-1">- {q.submitted_by}</p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button onClick={() => handleApproveQuote(q.id)} className="p-1 text-green-500 hover:text-green-700 transition-colors">
                            <Check size={16} />
                          </button>
                          <button onClick={() => handleDeleteQuote(q.id)} className="p-1 text-red-400 hover:text-red-600 transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Approved quotes */}
              <div>
                <h3 className="text-sm font-semibold text-gray-500 mb-2">Approved ({approvedQuotes.length})</h3>
                {approvedQuotes.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">No approved quotes yet.</p>
                ) : (
                  <div className="space-y-2">
                    {approvedQuotes.map(q => (
                      <div key={q.id} className="bg-white rounded-lg p-3 shadow-sm flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm text-gray-700 italic">"{q.content}"</p>
                          <p className="text-xs text-gray-400 mt-1">- {q.submitted_by}</p>
                        </div>
                        {canReviewQuotes && (
                          <button onClick={() => handleDeleteQuote(q.id)} className="text-gray-300 hover:text-red-400 transition-colors shrink-0">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Submit quote link */}
              {!isGuest && (
                <div className="text-center pt-2">
                  <button
                    onClick={() => setShowQuoteModal(true)}
                    className="text-sm px-4 py-2 rounded-lg bg-pastel-orange/30 hover:bg-pastel-orange/50 transition-colors font-medium text-gray-700"
                  >
                    Submit a Fun Quote
                  </button>
                </div>
              )}
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

      {/* Quote submit modal */}
      {showQuoteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowQuoteModal(false)}>
          <div className="bg-white rounded-xl p-5 w-full max-w-md space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">Submit a Fun Quote</h3>
              <button onClick={() => setShowQuoteModal(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <p className="text-xs text-gray-400">Quotes are reviewed by team leads before appearing. Keep it fun and team-friendly!</p>
            <textarea
              value={quoteText}
              onChange={e => setQuoteText(e.target.value)}
              placeholder="Type your quote, joke, or fun message..."
              rows={3}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-pastel-blue focus:border-transparent resize-none"
            />
            <button
              onClick={handleSubmitQuote}
              disabled={!quoteText.trim()}
              className="w-full py-2 rounded-lg font-medium bg-pastel-orange hover:bg-pastel-orange-dark transition-colors disabled:opacity-40"
            >
              Submit Quote
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
