import { useState, useEffect, useMemo } from 'react'
import {
  Plus, Send, Trash2, Check, X, ChevronRight, ChevronLeft, Eye,
  Lightbulb, Monitor, Video, ListOrdered, Upload, Link, MessageSquare,
  Clock, Users, Target, BookOpen, Edit3, RotateCcw, FileText, Library
} from 'lucide-react'
import { supabase } from '../supabase'
import { useUser } from '../contexts/UserContext'
import { usePermissions } from '../hooks/usePermissions'
import NotificationBell from './NotificationBell'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const headers = { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
const jsonHeaders = { ...headers, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' }

const CATEGORIES = ['CAD', 'Programming', 'AI', 'Business', 'Other']
const FORMATS = [
  { id: 'live', label: 'Live Presentation', icon: Monitor, desc: 'Present live to teammates' },
  { id: 'video', label: 'Pre-recorded Video', icon: Video, desc: 'Upload or link a video' },
  { id: 'guide', label: 'Guided Step-by-Step', icon: ListOrdered, desc: 'Written step-by-step guide' },
]

const STATUS_STYLES = {
  draft: 'bg-gray-100 text-gray-600',
  submitted: 'bg-blue-100 text-blue-700',
  approved: 'bg-green-100 text-green-700',
  needs_revision: 'bg-yellow-100 text-yellow-700',
  denied: 'bg-red-100 text-red-600',
}
const STATUS_LABELS = {
  draft: 'Draft',
  submitted: 'Submitted',
  approved: 'Approved',
  needs_revision: 'Needs Revision',
  denied: 'Denied',
}

const DURATION_OPTIONS = ['15 min', '30 min', '45 min', '1 hour', '1.5 hours', '2 hours', '2+ hours']

function formatDate(ts) {
  return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}

// ─── Create Workshop Modal ───────────────────────────────────────────────────

function CreateWorkshopModal({ onClose, onSave, editing }) {
  const [step, setStep] = useState(editing ? 2 : 1)
  const [format, setFormat] = useState(editing?.format_type || '')
  const [form, setForm] = useState({
    title: editing?.title || '',
    category: editing?.category || '',
    target_audience: editing?.target_audience || '',
    objective: editing?.objective || '',
    duration: editing?.duration || '',
    ...(editing?.content_data || {}),
  })
  const [errors, setErrors] = useState({})

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }))

  const contentData = () => {
    const d = {}
    if (format === 'live') {
      d.slides_link = form.slides_link || ''
      d.materials = form.materials || ''
      d.location = form.location || ''
    } else if (format === 'video') {
      d.video_link = form.video_link || ''
      d.materials = form.materials || ''
    } else if (format === 'guide') {
      d.steps = form.steps || ['', '', '']
      d.expected_outcome = form.expected_outcome || ''
    }
    return d
  }

  const validate = () => {
    const e = {}
    if (!form.title.trim()) e.title = true
    if (!form.category) e.category = true
    if (!form.target_audience.trim()) e.target_audience = true
    if (!form.objective.trim()) e.objective = true
    if (!form.duration) e.duration = true
    if (format === 'guide') {
      const steps = form.steps || ['', '', '']
      if (!steps[0]?.trim()) e.steps = true
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = (status) => {
    if (!validate()) return
    onSave({
      title: form.title.trim(),
      category: form.category,
      format_type: format,
      objective: form.objective.trim(),
      target_audience: form.target_audience.trim(),
      duration: form.duration,
      content_data: contentData(),
      status,
    })
  }

  const steps = form.steps || ['', '', '']
  const setStepText = (idx, val) => {
    const newSteps = [...steps]
    newSteps[idx] = val
    set('steps', newSteps)
  }
  const addStep = () => set('steps', [...steps, ''])
  const removeStep = (idx) => {
    if (steps.length <= 1) return
    set('steps', steps.filter((_, i) => i !== idx))
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-5 py-4 rounded-t-2xl flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-800">
            {editing ? 'Edit Workshop' : 'Create Workshop'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Step 1: Choose Format */}
          {step === 1 && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-gray-600">Choose a format</p>
              {FORMATS.map(f => (
                <button
                  key={f.id}
                  onClick={() => { setFormat(f.id); setStep(2) }}
                  className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left ${
                    format === f.id
                      ? 'border-pastel-pink bg-pastel-pink/10'
                      : 'border-gray-100 hover:border-pastel-blue/50 hover:bg-gray-50'
                  }`}
                >
                  <f.icon size={22} className="text-pastel-blue-dark shrink-0" />
                  <div>
                    <p className="font-semibold text-gray-700 text-sm">{f.label}</p>
                    <p className="text-xs text-gray-400">{f.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Step 2: Fill Details */}
          {step === 2 && (
            <div className="space-y-4">
              {/* Back button */}
              {!editing && (
                <button
                  onClick={() => setStep(1)}
                  className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
                >
                  <ChevronLeft size={14} />
                  Change format
                </button>
              )}

              {/* Format badge */}
              <div className="flex items-center gap-2">
                {(() => { const F = FORMATS.find(f => f.id === format); return F ? <F.icon size={16} className="text-pastel-blue-dark" /> : null })()}
                <span className="text-sm font-medium text-pastel-blue-dark">
                  {FORMATS.find(f => f.id === format)?.label}
                </span>
              </div>

              {/* Common Fields */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Title *</label>
                <input
                  value={form.title}
                  onChange={e => set('title', e.target.value)}
                  placeholder="e.g. Intro to 3D Printing"
                  className={`w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-pastel-pink focus:border-transparent ${errors.title ? 'border-red-300' : ''}`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Category *</label>
                  <select
                    value={form.category}
                    onChange={e => set('category', e.target.value)}
                    className={`w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-pastel-pink focus:border-transparent ${errors.category ? 'border-red-300' : ''}`}
                  >
                    <option value="">Select...</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Duration *</label>
                  <select
                    value={form.duration}
                    onChange={e => set('duration', e.target.value)}
                    className={`w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-pastel-pink focus:border-transparent ${errors.duration ? 'border-red-300' : ''}`}
                  >
                    <option value="">Select...</option>
                    {DURATION_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Target Audience *</label>
                <input
                  value={form.target_audience}
                  onChange={e => set('target_audience', e.target.value)}
                  placeholder="e.g. Beginners, CAD team, Everyone"
                  className={`w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-pastel-pink focus:border-transparent ${errors.target_audience ? 'border-red-300' : ''}`}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Learning Objective *</label>
                <textarea
                  value={form.objective}
                  onChange={e => set('objective', e.target.value)}
                  placeholder="What will participants learn? (1-2 sentences)"
                  rows={2}
                  className={`w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-pastel-pink focus:border-transparent resize-none ${errors.objective ? 'border-red-300' : ''}`}
                />
              </div>

              {/* Format-Specific Fields */}
              {format === 'live' && (
                <>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Slides Link (optional)</label>
                    <input
                      value={form.slides_link || ''}
                      onChange={e => set('slides_link', e.target.value)}
                      placeholder="Google Slides, PowerPoint link..."
                      className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-pastel-pink focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Materials Needed</label>
                    <input
                      value={form.materials || ''}
                      onChange={e => set('materials', e.target.value)}
                      placeholder="e.g. Laptop, 3D printer access..."
                      className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-pastel-pink focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Location (optional)</label>
                    <input
                      value={form.location || ''}
                      onChange={e => set('location', e.target.value)}
                      placeholder="e.g. Room 204, Workshop Area"
                      className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-pastel-pink focus:border-transparent"
                    />
                  </div>
                </>
              )}

              {format === 'video' && (
                <>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Video Link *</label>
                    <input
                      value={form.video_link || ''}
                      onChange={e => set('video_link', e.target.value)}
                      placeholder="YouTube, Google Drive, or other video link"
                      className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-pastel-pink focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Materials Needed (optional)</label>
                    <input
                      value={form.materials || ''}
                      onChange={e => set('materials', e.target.value)}
                      placeholder="e.g. Follow-along files, software..."
                      className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-pastel-pink focus:border-transparent"
                    />
                  </div>
                </>
              )}

              {format === 'guide' && (
                <>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Steps *</label>
                    <div className="mt-1 space-y-2">
                      {steps.map((s, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="text-xs font-bold text-pastel-blue-dark mt-2.5 w-5 text-right shrink-0">{i + 1}.</span>
                          <textarea
                            value={s}
                            onChange={e => setStepText(i, e.target.value)}
                            placeholder={`Step ${i + 1}...`}
                            rows={2}
                            className={`flex-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-pastel-pink focus:border-transparent resize-none ${i === 0 && errors.steps ? 'border-red-300' : ''}`}
                          />
                          {steps.length > 1 && (
                            <button onClick={() => removeStep(i)} className="mt-2 text-gray-300 hover:text-red-400">
                              <X size={14} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={addStep}
                      className="mt-2 flex items-center gap-1 text-xs text-pastel-blue-dark hover:text-pastel-pink-dark font-medium"
                    >
                      <Plus size={12} />
                      Add Step
                    </button>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Expected Outcome</label>
                    <textarea
                      value={form.expected_outcome || ''}
                      onChange={e => set('expected_outcome', e.target.value)}
                      placeholder="What should the participant have at the end?"
                      rows={2}
                      className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-pastel-pink focus:border-transparent resize-none"
                    />
                  </div>
                </>
              )}

              {Object.keys(errors).length > 0 && (
                <p className="text-xs text-red-500">Please fill in all required fields.</p>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={() => handleSave('draft')}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-semibold text-gray-600 transition-colors"
                >
                  <FileText size={14} />
                  Save Draft
                </button>
                <button
                  onClick={() => handleSave('submitted')}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-pastel-pink hover:bg-pastel-pink-dark rounded-xl text-sm font-semibold text-gray-700 transition-colors"
                >
                  <Send size={14} />
                  Submit for Review
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Workshop Detail / View Modal ────────────────────────────────────────────

function WorkshopDetailModal({ workshop, onClose, canReview, onReview }) {
  const [reviewAction, setReviewAction] = useState(null) // 'approve' | 'revision' | 'deny'
  const [reviewComment, setReviewComment] = useState('')

  const cd = workshop.content_data || {}
  const fmt = FORMATS.find(f => f.id === workshop.format_type)

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b px-5 py-4 rounded-t-2xl flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            {fmt && <fmt.icon size={18} className="text-pastel-blue-dark shrink-0" />}
            <h2 className="text-lg font-bold text-gray-800 truncate">{workshop.title}</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg shrink-0">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Meta */}
          <div className="flex flex-wrap gap-2">
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_STYLES[workshop.status]}`}>
              {STATUS_LABELS[workshop.status]}
            </span>
            <span className="text-xs px-2.5 py-1 rounded-full bg-pastel-blue/30 text-pastel-blue-dark font-medium">
              {workshop.category}
            </span>
            <span className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 font-medium flex items-center gap-1">
              <Clock size={10} /> {workshop.duration}
            </span>
          </div>

          <div className="text-xs text-gray-400">
            By <span className="font-medium text-gray-600">{workshop.creator_name}</span> &middot; {formatDate(workshop.created_at)}
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Learning Objective</p>
            <p className="text-sm text-gray-700">{workshop.objective}</p>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Target Audience</p>
            <p className="text-sm text-gray-700">{workshop.target_audience}</p>
          </div>

          {/* Format-specific content */}
          {workshop.format_type === 'live' && (
            <>
              {cd.slides_link && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Slides</p>
                  <a href={cd.slides_link} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-500 hover:underline break-all">
                    {cd.slides_link}
                  </a>
                </div>
              )}
              {cd.materials && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Materials Needed</p>
                  <p className="text-sm text-gray-700">{cd.materials}</p>
                </div>
              )}
              {cd.location && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Location</p>
                  <p className="text-sm text-gray-700">{cd.location}</p>
                </div>
              )}
            </>
          )}

          {workshop.format_type === 'video' && (
            <>
              {cd.video_link && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Video</p>
                  <a href={cd.video_link} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-500 hover:underline break-all">
                    {cd.video_link}
                  </a>
                </div>
              )}
              {cd.materials && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Materials Needed</p>
                  <p className="text-sm text-gray-700">{cd.materials}</p>
                </div>
              )}
            </>
          )}

          {workshop.format_type === 'guide' && (
            <>
              {cd.steps && cd.steps.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Steps</p>
                  <div className="space-y-2">
                    {cd.steps.filter(s => s.trim()).map((s, i) => (
                      <div key={i} className="flex gap-2">
                        <span className="text-xs font-bold text-pastel-blue-dark mt-0.5 w-5 text-right shrink-0">{i + 1}.</span>
                        <p className="text-sm text-gray-700">{s}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {cd.expected_outcome && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Expected Outcome</p>
                  <p className="text-sm text-gray-700">{cd.expected_outcome}</p>
                </div>
              )}
            </>
          )}

          {/* Review comment from reviewer */}
          {workshop.review_comment && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
              <p className="text-xs font-semibold text-yellow-700 mb-1">Reviewer Feedback</p>
              <p className="text-sm text-yellow-800">{workshop.review_comment}</p>
              {workshop.reviewer_name && (
                <p className="text-xs text-yellow-600 mt-1">— {workshop.reviewer_name}</p>
              )}
            </div>
          )}

          {/* Review Controls (Top users only, when status is submitted) */}
          {canReview && workshop.status === 'submitted' && (
            <div className="border-t pt-4 space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Review</p>
              {!reviewAction ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => onReview(workshop.id, 'approved', '')}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-green-50 hover:bg-green-100 text-green-600 text-sm font-medium transition-colors"
                  >
                    <Check size={14} /> Approve
                  </button>
                  <button
                    onClick={() => setReviewAction('revision')}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-yellow-50 hover:bg-yellow-100 text-yellow-700 text-sm font-medium transition-colors"
                  >
                    <MessageSquare size={14} /> Request Revision
                  </button>
                  <button
                    onClick={() => setReviewAction('deny')}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-500 text-sm font-medium transition-colors"
                  >
                    <X size={14} /> Deny
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <textarea
                    value={reviewComment}
                    onChange={e => setReviewComment(e.target.value)}
                    placeholder={reviewAction === 'revision' ? 'What needs to be changed?' : 'Reason for denial (optional)'}
                    rows={3}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-pastel-pink focus:border-transparent resize-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => setReviewAction(null)}
                      className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm text-gray-600"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        const status = reviewAction === 'revision' ? 'needs_revision' : 'denied'
                        onReview(workshop.id, status, reviewComment)
                      }}
                      disabled={reviewAction === 'revision' && !reviewComment.trim()}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 ${
                        reviewAction === 'deny'
                          ? 'bg-red-100 hover:bg-red-200 text-red-600'
                          : 'bg-yellow-100 hover:bg-yellow-200 text-yellow-700'
                      }`}
                    >
                      {reviewAction === 'deny' ? 'Confirm Deny' : 'Request Revision'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Workshop Card ───────────────────────────────────────────────────────────

function WorkshopCard({ workshop, onClick, showStatus, showActions, onDelete, onWithdraw, onEdit, onSubmit }) {
  const fmt = FORMATS.find(f => f.id === workshop.format_type)

  return (
    <div
      className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md transition-shadow cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            {fmt && <fmt.icon size={14} className="text-pastel-blue-dark shrink-0" />}
            <h3 className="text-sm font-semibold text-gray-800 truncate">{workshop.title}</h3>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-400">{workshop.creator_name}</span>
            <span className="text-xs text-gray-300">&middot;</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-pastel-blue/20 text-pastel-blue-dark font-medium">
              {workshop.category}
            </span>
            <span className="text-xs text-gray-400 flex items-center gap-0.5">
              <Clock size={10} /> {workshop.duration}
            </span>
          </div>
        </div>
        {showStatus && (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${STATUS_STYLES[workshop.status]}`}>
            {STATUS_LABELS[workshop.status]}
          </span>
        )}
      </div>
      <p className="text-xs text-gray-500 mt-2 line-clamp-2">{workshop.objective}</p>

      {/* Action buttons for own workshops */}
      {showActions && (
        <div className="flex items-center gap-2 mt-3" onClick={e => e.stopPropagation()}>
          {workshop.status === 'draft' && (
            <>
              <button
                onClick={() => onEdit(workshop)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-600 text-xs font-medium transition-colors"
              >
                <Edit3 size={12} /> Edit
              </button>
              <button
                onClick={() => onSubmit(workshop)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-pastel-pink/50 hover:bg-pastel-pink text-gray-700 text-xs font-medium transition-colors"
              >
                <Send size={12} /> Submit
              </button>
              <button
                onClick={() => onDelete(workshop.id)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 text-xs font-medium transition-colors"
              >
                <Trash2 size={12} /> Delete
              </button>
            </>
          )}
          {workshop.status === 'submitted' && (
            <button
              onClick={() => onWithdraw(workshop.id)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-600 text-xs font-medium transition-colors"
            >
              <RotateCcw size={12} /> Withdraw
            </button>
          )}
          {workshop.status === 'needs_revision' && (
            <button
              onClick={() => onEdit(workshop)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-yellow-50 hover:bg-yellow-100 text-yellow-700 text-xs font-medium transition-colors"
            >
              <Edit3 size={12} /> Revise & Resubmit
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function WorkshopIdeas() {
  const { username, user } = useUser()
  const { hasLeadTag, isGuest } = usePermissions()

  const canReview = hasLeadTag
  const canCreate = !isGuest

  const [workshops, setWorkshops] = useState([])
  const [section, setSection] = useState('library') // 'library' | 'my' | 'review'
  const [createModal, setCreateModal] = useState(false)
  const [editingWorkshop, setEditingWorkshop] = useState(null)
  const [viewWorkshop, setViewWorkshop] = useState(null)
  const [myFilter, setMyFilter] = useState('all')

  const loadWorkshops = async () => {
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/workshops?select=*&order=created_at.desc`, { headers })
      if (res.ok) setWorkshops(await res.json())
    } catch (err) {
      console.error('Failed to load workshops:', err)
    }
  }

  useEffect(() => {
    loadWorkshops()
    const onFocus = () => loadWorkshops()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel('workshops-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'workshops' }, (payload) => {
        setWorkshops(prev => prev.some(w => w.id === payload.new.id) ? prev : [payload.new, ...prev])
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'workshops' }, (payload) => {
        setWorkshops(prev => prev.some(w => w.id === payload.new.id)
          ? prev.map(w => w.id === payload.new.id ? payload.new : w)
          : [payload.new, ...prev]
        )
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'workshops' }, (payload) => {
        setWorkshops(prev => prev.filter(w => w.id !== payload.old.id))
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  // Derived lists
  const myWorkshops = useMemo(() =>
    workshops.filter(w => w.creator_name === username),
  [workshops, username])

  const filteredMyWorkshops = useMemo(() =>
    myFilter === 'all' ? myWorkshops : myWorkshops.filter(w => w.status === myFilter),
  [myWorkshops, myFilter])

  const libraryWorkshops = useMemo(() =>
    workshops.filter(w => w.status === 'approved'),
  [workshops])

  const reviewQueue = useMemo(() =>
    workshops.filter(w => w.status === 'submitted'),
  [workshops])

  // Handlers
  const handleSave = async (data) => {
    const workshop = {
      id: editingWorkshop?.id || String(Date.now()) + Math.random().toString(36).slice(2),
      creator_name: username || user?.email || 'Anonymous',
      ...data,
      review_comment: editingWorkshop?.review_comment || null,
      reviewer_name: editingWorkshop?.reviewer_name || null,
      created_at: editingWorkshop?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    if (editingWorkshop) {
      // Update
      setWorkshops(prev => prev.map(w => w.id === editingWorkshop.id ? { ...w, ...workshop } : w))
      try {
        await fetch(`${supabaseUrl}/rest/v1/workshops?id=eq.${editingWorkshop.id}`, {
          method: 'PATCH',
          headers: jsonHeaders,
          body: JSON.stringify({
            title: workshop.title,
            category: workshop.category,
            format_type: workshop.format_type,
            objective: workshop.objective,
            target_audience: workshop.target_audience,
            duration: workshop.duration,
            content_data: workshop.content_data,
            status: workshop.status,
            review_comment: data.status === 'submitted' ? null : workshop.review_comment,
            reviewer_name: data.status === 'submitted' ? null : workshop.reviewer_name,
            updated_at: workshop.updated_at,
          }),
        })
      } catch (err) {
        console.error('Failed to update workshop:', err)
        loadWorkshops()
      }
    } else {
      // Insert
      setWorkshops(prev => [workshop, ...prev])
      try {
        await fetch(`${supabaseUrl}/rest/v1/workshops`, {
          method: 'POST',
          headers: jsonHeaders,
          body: JSON.stringify(workshop),
        })
      } catch (err) {
        console.error('Failed to create workshop:', err)
        setWorkshops(prev => prev.filter(w => w.id !== workshop.id))
      }
    }

    setCreateModal(false)
    setEditingWorkshop(null)
    setSection('my')
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this workshop draft?')) return
    setWorkshops(prev => prev.filter(w => w.id !== id))
    try {
      await fetch(`${supabaseUrl}/rest/v1/workshops?id=eq.${id}`, { method: 'DELETE', headers })
    } catch (err) {
      console.error('Failed to delete workshop:', err)
      loadWorkshops()
    }
  }

  const handleWithdraw = async (id) => {
    if (!window.confirm('Withdraw this submission? It will return to draft.')) return
    setWorkshops(prev => prev.map(w => w.id === id ? { ...w, status: 'draft' } : w))
    try {
      await fetch(`${supabaseUrl}/rest/v1/workshops?id=eq.${id}`, {
        method: 'PATCH',
        headers: jsonHeaders,
        body: JSON.stringify({ status: 'draft', updated_at: new Date().toISOString() }),
      })
    } catch (err) {
      console.error('Failed to withdraw workshop:', err)
      loadWorkshops()
    }
  }

  const handleSubmit = async (workshop) => {
    setWorkshops(prev => prev.map(w => w.id === workshop.id ? { ...w, status: 'submitted' } : w))
    try {
      await fetch(`${supabaseUrl}/rest/v1/workshops?id=eq.${workshop.id}`, {
        method: 'PATCH',
        headers: jsonHeaders,
        body: JSON.stringify({ status: 'submitted', review_comment: null, reviewer_name: null, updated_at: new Date().toISOString() }),
      })
    } catch (err) {
      console.error('Failed to submit workshop:', err)
      loadWorkshops()
    }
  }

  const handleReview = async (id, status, comment) => {
    setWorkshops(prev => prev.map(w => w.id === id ? { ...w, status, review_comment: comment || null, reviewer_name: username } : w))
    setViewWorkshop(null)
    try {
      await fetch(`${supabaseUrl}/rest/v1/workshops?id=eq.${id}`, {
        method: 'PATCH',
        headers: jsonHeaders,
        body: JSON.stringify({ status, review_comment: comment || null, reviewer_name: username, updated_at: new Date().toISOString() }),
      })
    } catch (err) {
      console.error('Failed to review workshop:', err)
      loadWorkshops()
    }
  }

  const handleEdit = (workshop) => {
    setEditingWorkshop(workshop)
    setCreateModal(true)
  }

  const sectionTabs = [
    { id: 'library', label: 'Workshop Library', icon: Library, count: libraryWorkshops.length },
    ...(canCreate ? [{ id: 'my', label: 'My Workshops', icon: BookOpen, count: myWorkshops.length }] : []),
    ...(canReview ? [{ id: 'review', label: 'Review Queue', icon: Eye, count: reviewQueue.length }] : []),
  ]

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="px-4 py-3 ml-14 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-pastel-blue-dark via-pastel-pink-dark to-pastel-orange-dark bg-clip-text text-transparent">
              Workshops
            </h1>
            <p className="text-sm text-gray-500">Create, share, and learn from team workshops</p>
          </div>
          <div className="flex items-center gap-2">
            {canCreate && (
              <button
                onClick={() => { setEditingWorkshop(null); setCreateModal(true) }}
                className="flex items-center gap-1.5 px-3 py-2 bg-pastel-pink hover:bg-pastel-pink-dark rounded-xl text-sm font-semibold text-gray-700 transition-colors"
              >
                <Plus size={14} />
                <span className="hidden sm:inline">Create Workshop</span>
              </button>
            )}
            <NotificationBell />
          </div>
        </div>

        {/* Section tabs */}
        <div className="px-4 ml-14 flex gap-1 pb-2 overflow-x-auto">
          {sectionTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setSection(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                section === tab.id
                  ? 'bg-pastel-blue/30 text-pastel-blue-dark'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              <tab.icon size={14} />
              {tab.label}
              {tab.count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                  section === tab.id ? 'bg-pastel-blue-dark/20' : 'bg-gray-200'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 p-4 overflow-y-auto">
        <div className="max-w-2xl mx-auto space-y-4">

          {/* Workshop Library */}
          {section === 'library' && (
            <>
              {libraryWorkshops.length > 0 ? (
                <div className="space-y-3">
                  {libraryWorkshops.map(w => (
                    <WorkshopCard
                      key={w.id}
                      workshop={w}
                      onClick={() => setViewWorkshop(w)}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-20">
                  <Library size={40} className="mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-400 text-sm">No approved workshops yet.</p>
                  {canCreate && (
                    <button
                      onClick={() => { setEditingWorkshop(null); setCreateModal(true) }}
                      className="mt-3 text-sm text-pastel-pink-dark hover:underline font-medium"
                    >
                      Be the first to create one!
                    </button>
                  )}
                </div>
              )}
            </>
          )}

          {/* My Workshops */}
          {section === 'my' && canCreate && (
            <>
              {/* Status filter */}
              <div className="flex gap-1 flex-wrap">
                {['all', 'draft', 'submitted', 'approved', 'needs_revision', 'denied'].map(f => (
                  <button
                    key={f}
                    onClick={() => setMyFilter(f)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                      myFilter === f
                        ? 'bg-pastel-pink text-gray-700'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {f === 'all' ? 'All' : STATUS_LABELS[f]}
                  </button>
                ))}
              </div>

              {filteredMyWorkshops.length > 0 ? (
                <div className="space-y-3">
                  {filteredMyWorkshops.map(w => (
                    <WorkshopCard
                      key={w.id}
                      workshop={w}
                      onClick={() => setViewWorkshop(w)}
                      showStatus
                      showActions
                      onDelete={handleDelete}
                      onWithdraw={handleWithdraw}
                      onEdit={handleEdit}
                      onSubmit={handleSubmit}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-20">
                  <BookOpen size={40} className="mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-400 text-sm">
                    {myFilter === 'all' ? "You haven't created any workshops yet." : `No ${STATUS_LABELS[myFilter]?.toLowerCase()} workshops.`}
                  </p>
                  {myFilter === 'all' && (
                    <button
                      onClick={() => { setEditingWorkshop(null); setCreateModal(true) }}
                      className="mt-3 text-sm text-pastel-pink-dark hover:underline font-medium"
                    >
                      Create your first workshop
                    </button>
                  )}
                </div>
              )}
            </>
          )}

          {/* Review Queue (Top users only) */}
          {section === 'review' && canReview && (
            <>
              {reviewQueue.length > 0 ? (
                <div className="space-y-3">
                  {reviewQueue.map(w => (
                    <WorkshopCard
                      key={w.id}
                      workshop={w}
                      onClick={() => setViewWorkshop(w)}
                      showStatus
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-20">
                  <Check size={40} className="mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-400 text-sm">No workshops pending review.</p>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Modals */}
      {createModal && (
        <CreateWorkshopModal
          onClose={() => { setCreateModal(false); setEditingWorkshop(null) }}
          onSave={handleSave}
          editing={editingWorkshop}
        />
      )}

      {viewWorkshop && (
        <WorkshopDetailModal
          workshop={viewWorkshop}
          onClose={() => setViewWorkshop(null)}
          canReview={canReview}
          onReview={handleReview}
        />
      )}
    </div>
  )
}
