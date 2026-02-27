import { useState, useEffect, useMemo } from 'react'
import { Send, Camera, X, Loader2, ExternalLink, Users } from 'lucide-react'

const REST_URL = import.meta.env.VITE_SUPABASE_URL
const REST_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const REST_HEADERS = { 'apikey': REST_KEY, 'Authorization': `Bearer ${REST_KEY}` }
const REST_JSON = { ...REST_HEADERS, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' }

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

export default function NotebookFlashRequired({ username, activeFlash, presentUsers, completedUsers }) {
  const [projects, setProjects] = useState([])
  const [category, setCategory] = useState('Technical')
  const [projectId, setProjectId] = useState('')
  const [whatDid, setWhatDid] = useState('')
  const [whyOption, setWhyOption] = useState('')
  const [whyNote, setWhyNote] = useState('')
  const [engagement, setEngagement] = useState('Somewhat')
  const [projectLink, setProjectLink] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [selectedGroupMembers, setSelectedGroupMembers] = useState([])

  // Load active projects
  useEffect(() => {
    fetch(`${REST_URL}/rest/v1/notebook_projects?status=eq.Active&select=*`, { headers: REST_HEADERS })
      .then(res => res.ok ? res.json() : [])
      .then(setProjects)
      .catch(() => {})
  }, [])

  // Available group members: present users who haven't completed and aren't the current user
  const availableGroupMembers = useMemo(() => {
    return presentUsers.filter(u => u !== username && !completedUsers.includes(u))
  }, [presentUsers, completedUsers, username])

  const toggleGroupMember = (member) => {
    setSelectedGroupMembers(prev =>
      prev.includes(member) ? prev.filter(m => m !== member) : [...prev, member]
    )
  }

  const canSubmit = whatDid.trim() && whyOption && (whyOption !== 'Other' || whyNote.trim()) && (photoUrl || projectLink.trim())

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return
    setSubmitting(true)
    setError('')

    try {
      const entryId = String(Date.now()) + Math.random().toString(36).slice(2)
      const meetingDate = new Date().toISOString().split('T')[0]

      // 1. Insert the notebook entry with flash_id
      const entry = {
        id: entryId,
        username,
        meeting_date: meetingDate,
        category,
        custom_category: '',
        what_did: whatDid.trim(),
        why_option: whyOption,
        why_note: whyNote.trim(),
        engagement,
        project_id: projectId,
        project_link: projectLink.trim(),
        photo_url: photoUrl.trim(),
        flash_id: activeFlash.id,
        created_at: new Date().toISOString(),
      }

      const entryRes = await fetch(`${REST_URL}/rest/v1/notebook_entries`, {
        method: 'POST', headers: REST_JSON, body: JSON.stringify(entry),
      })
      if (!entryRes.ok) throw new Error(await entryRes.text())

      // 2. Insert participants (always include submitter + selected group members)
      const allParticipants = [username, ...selectedGroupMembers]
      const participantRows = allParticipants.map(u => ({
        id: String(Date.now()) + Math.random().toString(36).slice(2) + u.slice(0, 4),
        entry_id: entryId,
        username: u,
        created_at: new Date().toISOString(),
      }))

      const partRes = await fetch(`${REST_URL}/rest/v1/notebook_entry_participants`, {
        method: 'POST', headers: REST_JSON, body: JSON.stringify(participantRows),
      })
      if (!partRes.ok) throw new Error(await partRes.text())

      if (localStorage.getItem('scrum-sfx-enabled') !== 'false') {
        new Audio('/sounds/click.mp3').play().catch(() => {})
      }
      // Realtime will auto-update the hook and dismiss the overlay
    } catch (err) {
      console.error('Flash entry submit failed:', err)
      setError('Failed to submit. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[200] bg-gradient-to-br from-pastel-blue/95 via-pastel-pink/90 to-pastel-orange/95 backdrop-blur-sm flex items-center justify-center overflow-y-auto">
      <div className="w-full max-w-lg mx-4 my-8 bg-white rounded-2xl shadow-2xl p-6 space-y-4">
        {/* Header */}
        <div className="text-center">
          <div className="text-4xl mb-2">📓</div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-pastel-blue-dark via-pastel-pink-dark to-pastel-orange-dark bg-clip-text text-transparent">
            Notebook Flash
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Submit your notebook entry before continuing
          </p>
        </div>

        {/* Project / Category selector */}
        <div>
          <label className="text-sm font-medium text-gray-600 block mb-1">Project</label>
          <div className="flex flex-wrap gap-2">
            {['Technical', 'Business', 'Programming'].map(name => (
              <button
                key={name}
                onClick={() => { setCategory(name); setProjectId('') }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  category === name && !projectId ? 'bg-pastel-pink text-gray-800' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {name}
              </button>
            ))}
            {projects.map(p => (
              <button
                key={p.id}
                onClick={() => { setProjectId(p.id); setCategory(p.category || 'Technical') }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  projectId === p.id ? 'bg-pastel-pink text-gray-800' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
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
            value={whatDid}
            onChange={e => setWhatDid(e.target.value.slice(0, 150))}
            placeholder="Wired the intake motor to REV hub port 2"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-pastel-blue focus:border-transparent"
            maxLength={150}
          />
          <p className="text-xs text-gray-400 text-right mt-0.5">{whatDid.length}/150</p>
        </div>

        {/* Why it matters */}
        <div>
          <label className="text-sm font-medium text-gray-600 block mb-1">Why it matters</label>
          <select
            value={whyOption}
            onChange={e => setWhyOption(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-pastel-blue focus:border-transparent"
          >
            <option value="">Select a reason...</option>
            {WHY_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
          <input
            type="text"
            value={whyNote}
            onChange={e => setWhyNote(e.target.value)}
            placeholder={whyOption === 'Other' ? 'Required: explain why this matters' : 'Optional: add a short note'}
            className={`w-full mt-2 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-pastel-blue focus:border-transparent ${whyOption === 'Other' && !whyNote.trim() ? 'border-red-300' : ''}`}
          />
        </div>

        {/* Engagement */}
        <div>
          <label className="text-sm font-medium text-gray-600 block mb-1">How engaged were you?</label>
          <div className="flex gap-2">
            {ENGAGEMENT_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setEngagement(opt.value)}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  engagement === opt.value ? 'bg-pastel-pink text-gray-800' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                <span className={`w-2.5 h-2.5 rounded-full ${opt.dot}`} />
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Project link */}
        <div>
          <label className="text-sm font-medium text-gray-600 block mb-1">Project link {photoUrl ? '(optional)' : '(required if no photo)'}</label>
          <input
            type="url"
            value={projectLink}
            onChange={e => setProjectLink(e.target.value)}
            placeholder="GitHub PR, Google Doc, etc."
            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-pastel-blue focus:border-transparent"
          />
        </div>

        {/* Photo */}
        <div>
          <label className="text-sm font-medium text-gray-600 block mb-1">Photo/Screenshot {projectLink.trim() ? '(optional)' : '(required if no link)'}</label>
          {photoUrl ? (
            <div className="relative inline-block">
              <img src={photoUrl} alt="Preview" className="max-h-32 rounded-lg object-cover" />
              <button
                type="button"
                onClick={() => setPhotoUrl('')}
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
                  if (!file) return
                  if (file.size > 10 * 1024 * 1024) { alert('Photo must be under 10 MB'); return }
                  setUploading(true)
                  const img = new Image()
                  const reader = new FileReader()
                  reader.onload = (ev) => {
                    img.onload = () => {
                      const canvas = document.createElement('canvas')
                      const MAX = 480
                      let w = img.width, h = img.height
                      if (w > MAX || h > MAX) {
                        if (w > h) { h = Math.round(h * MAX / w); w = MAX }
                        else { w = Math.round(w * MAX / h); h = MAX }
                      }
                      canvas.width = w; canvas.height = h
                      canvas.getContext('2d').drawImage(img, 0, 0, w, h)
                      setPhotoUrl(canvas.toDataURL('image/jpeg', 0.5))
                      setUploading(false)
                    }
                    img.src = ev.target.result
                  }
                  reader.readAsDataURL(file)
                }}
              />
              {uploading && <Loader2 size={16} className="animate-spin text-pastel-blue-dark ml-auto" />}
            </label>
          )}
        </div>

        {/* Group members */}
        {availableGroupMembers.length > 0 && (
          <div>
            <label className="text-sm font-medium text-gray-600 flex items-center gap-1.5 mb-1">
              <Users size={14} /> Include group members
            </label>
            <p className="text-xs text-gray-400 mb-2">Select teammates who worked with you on this</p>
            <div className="flex flex-wrap gap-2">
              {availableGroupMembers.map(member => (
                <button
                  key={member}
                  onClick={() => toggleGroupMember(member)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    selectedGroupMembers.includes(member)
                      ? 'bg-pastel-pink text-gray-800'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {member}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {error && <p className="text-sm text-red-500 text-center">{error}</p>}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-lg font-semibold transition-colors bg-pastel-pink hover:bg-pastel-pink-dark disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          {submitting ? 'Submitting...' : 'Submit Entry'}
        </button>
      </div>
    </div>
  )
}
