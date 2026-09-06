import { useState, useEffect, useRef } from 'react'
import { getSession, withSession, scoreKey, tally, hasFinished, finishedVoters } from '../lib/matrixSession'
import { triggerPush } from '../utils/pushHelper'
import { ArrowLeft, Plus, Trash2, Trophy, Camera, X, Save, Edit3 } from 'lucide-react'
import { useUser } from '../contexts/UserContext'

const REST_URL = import.meta.env.VITE_SUPABASE_URL
const REST_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const REST_HEADERS = { 'apikey': REST_KEY, 'Authorization': `Bearer ${REST_KEY}` }
const REST_JSON = { ...REST_HEADERS, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' }

function genId() {
  return String(Date.now()) + Math.random().toString(36).slice(2)
}

async function uploadImage(file) {
  const ext = file.name.split('.').pop()
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const res = await fetch(`${REST_URL}/storage/v1/object/design-matrix-images/${fileName}`, {
    method: 'POST',
    headers: { 'apikey': REST_KEY, 'Authorization': `Bearer ${REST_KEY}`, 'Content-Type': file.type },
    body: file,
  })
  if (!res.ok) throw new Error('Upload failed')
  return `${REST_URL}/storage/v1/object/public/design-matrix-images/${fileName}`
}

function getWinner(matrix) {
  if (!matrix.options.length || !matrix.criteria.length) return null
  const totals = matrix.options.map(opt => {
    const total = matrix.criteria.reduce((sum, crit) => {
      return sum + (Number(matrix.scores[`${opt.id}_${crit.id}`]) || 0)
    }, 0)
    return { id: opt.id, name: opt.name, total }
  })
  totals.sort((a, b) => b.total - a.total)
  if (totals[0]?.total === 0) return null
  return totals[0]
}

// ─── Library View ───
function MatrixLibrary({ matrices, onSelect, onCreate, onDelete, username }) {
  // Three shelves: what's waiting on you, what's running, and what's decided.
  const sessionOf = (m) => getSession(m)
  const needsYou = matrices.filter(m => {
    const se = sessionOf(m)
    return se && se.status === 'open' && (se.participants || []).includes(username) && !hasFinished(m, se, username)
  })
  const running = matrices.filter(m => {
    const se = sessionOf(m)
    return se && se.status === 'open' && !needsYou.includes(m)
  })
  const decided = matrices.filter(m => sessionOf(m)?.status === 'closed')
  const drafts = matrices.filter(m => !sessionOf(m))
  const shelf = (title, list, note) => list.length === 0 ? null : (
    <div className="space-y-2">
      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">{title}{note ? ` · ${note}` : ''}</h3>
      <div className="grid gap-2">
        {list.map(m => {
          const se = sessionOf(m)
          const t = se ? tally(m, se) : null
          const done = se ? finishedVoters(m, se).length : 0
            // Only the person who made it can throw it away, and never from
            // under people who are still rating it.
            const canDelete = m.created_by === username && se?.status !== 'open'
            return (
              <div key={m.id} className="group flex items-center gap-2 bg-white/80 rounded-xl border-2 border-gray-100 hover:border-pastel-pink p-3 transition-colors">
                <button onClick={() => onSelect(m)} className="flex-1 text-left min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-gray-800 truncate">{m.title || 'Untitled'}</span>
                    {se?.status === 'closed' && t?.winner && <span className="text-xs font-bold text-pastel-pink-dark shrink-0">🏆 {t.winner.name}</span>}
                    {se?.status === 'open' && <span className="text-xs text-gray-400 shrink-0">{done}/{(se.participants || []).length} rated</span>}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">by {m.created_by}{se ? ` · hosted by ${se.hostedBy}` : ''}</p>
                </button>
                {canDelete && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onDelete(m.id) }}
                    title="Delete this matrix"
                    className="shrink-0 p-1.5 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            )
        })}
      </div>
    </div>
  )
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-700">Decision Matrices</h2>
        <button
          onClick={onCreate}
          className="flex items-center gap-2 px-4 py-2 bg-pastel-pink hover:bg-pastel-pink-dark rounded-lg transition-colors text-sm font-medium"
        >
          <Plus size={16} /> New Matrix
        </button>
      </div>
      {shelf('Waiting on you', needsYou, 'rate these')}
      {shelf('Being rated', running)}
      {shelf('Decided', decided)}
      {drafts.length > 0 && <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">Not hosted yet</h3>}
      {matrices.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-lg mb-2">No decision matrices yet</p>
          <p className="text-sm">Create one to compare the options and decide together</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {drafts.map(m => {
            const winner = getWinner(m)
            const winnerOpt = winner ? m.options.find(o => o.id === winner.id) : null
            const thumbnail = winnerOpt?.imageUrl || m.options.find(o => o.imageUrl)?.imageUrl
            return (
              <div key={m.id} className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer overflow-hidden" onClick={() => onSelect(m)}>
                <div className="flex">
                  {thumbnail && (
                    <div className="w-20 h-20 flex-shrink-0">
                      <img src={thumbnail} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="flex-1 px-4 py-3 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-gray-700 truncate">{m.title}</h3>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {new Date(m.created_at).toLocaleDateString()} · {m.options.length} options · {m.criteria.length} criteria
                        </p>
                        {winner && (
                          <p className="text-xs text-amber-600 font-medium mt-1 flex items-center gap-1">
                            <Trophy size={12} /> {winner.name} ({winner.total} pts)
                          </p>
                        )}
                      </div>
                      {m.created_by === username && (
                        <button onClick={e => { e.stopPropagation(); onDelete(m.id) }} className="text-gray-300 hover:text-red-400 transition-colors p-1 flex-shrink-0">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Matrix Editor (full table layout) ───
function MatrixEditor({ initial, onSave, onCancel, username }) {
  const [title, setTitle] = useState(initial?.title || '')
  const [description, setDescription] = useState(initial?.description || '')
  const [options, setOptions] = useState(initial?.options || [])
  const [criteria, setCriteria] = useState(initial?.criteria || [])
  const [scores, setScores] = useState(initial?.scores || {})
  const [decision, setDecision] = useState(initial?.decision || { chosen: '', reason: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [uploading, setUploading] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const fileInputRef = useRef(null)
  const uploadTargetRef = useRef(null)

  const showFeedback = (msg) => { setFeedback(msg); setTimeout(() => setFeedback(null), 3000) }

  const addOption = () => setOptions(prev => [...prev, { id: genId(), name: '', description: '', imageUrl: '' }])
  const updateOption = (id, field, value) => setOptions(prev => prev.map(o => o.id === id ? { ...o, [field]: value } : o))
  const removeOption = (id) => {
    setOptions(prev => prev.filter(o => o.id !== id))
    setScores(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { if (k.startsWith(id + '_')) delete n[k] }); return n })
    if (decision.chosen === id) setDecision(prev => ({ ...prev, chosen: '' }))
  }

  const addCriterion = () => setCriteria(prev => [...prev, { id: genId(), name: '' }])
  const updateCriterion = (id, name) => setCriteria(prev => prev.map(c => c.id === id ? { ...c, name } : c))
  const removeCriterion = (id) => {
    setCriteria(prev => prev.filter(c => c.id !== id))
    setScores(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { if (k.endsWith('_' + id)) delete n[k] }); return n })
  }



  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !uploadTargetRef.current) return
    const optId = uploadTargetRef.current
    setUploading(optId)
    try {
      const url = await uploadImage(file)
      updateOption(optId, 'imageUrl', url)
    } catch { showFeedback('Image upload failed') }
    finally { setUploading(null); if (fileInputRef.current) fileInputRef.current.value = '' }
  }

  const triggerUpload = (optId) => { uploadTargetRef.current = optId; fileInputRef.current?.click() }

  const handleSave = async () => {
    if (!title.trim()) { showFeedback('Title is required'); return }
    if (options.length < 2) { showFeedback('Add at least 2 options'); return }
    if (criteria.length < 1) { showFeedback('Add at least 1 criterion'); return }
    if (options.some(o => !o.name.trim())) { showFeedback('All options need a name'); return }
    if (criteria.some(c => !c.name.trim())) { showFeedback('All criteria need a name'); return }
    setSaving(true)
    try {
      const data = {
        id: initial?.id || genId(), title: title.trim(), description: description.trim(),
        options, criteria, scores, decision,
        created_by: initial?.created_by || username,
        created_at: initial?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      const method = initial ? 'PATCH' : 'POST'
      const url = initial ? `${REST_URL}/rest/v1/design_matrices?id=eq.${initial.id}` : `${REST_URL}/rest/v1/design_matrices`
      const res = await fetch(url, { method, headers: REST_JSON, body: JSON.stringify(data) })
      if (!res.ok) {
        const errText = await res.text().catch(() => '')
        console.error('Save failed:', res.status, errText)
        throw new Error('Save failed: ' + res.status)
      }
      onSave(data)
    } catch (err) { console.error(err); showFeedback(err.message || 'Failed to save') }
    finally { setSaving(false) }
  }

  return (
    <div className="space-y-5">
      <input type="file" ref={fileInputRef} accept="image/*" onChange={handleImageUpload} className="hidden" />

      {/* Title & Description */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm p-4 space-y-3">
        <input
          value={title} onChange={e => setTitle(e.target.value)} placeholder="Matrix Title *"
          className="w-full text-xl font-bold text-gray-700 bg-transparent border-b border-gray-200 focus:border-pastel-blue-dark focus:outline-none pb-2"
        />
        <textarea
          value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional description..." rows={2}
          className="w-full text-sm text-gray-500 bg-transparent border-b border-gray-100 focus:border-pastel-blue-dark focus:outline-none resize-none"
        />
      </div>

      {/* Full Matrix Table */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm p-4 space-y-3">
        <h3 className="font-semibold text-gray-700">Decision Matrix</h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            {/* Column headers = Design Options */}
            <thead>
              {/* Option images row */}
              {options.some(o => o.imageUrl) && (
                <tr>
                  <td className="p-1" />
                  {options.map(opt => (
                    <td key={opt.id} className="p-1 text-center">
                      {opt.imageUrl ? (
                        <img
                          src={opt.imageUrl} alt={opt.name}
                          className="w-16 h-16 object-cover rounded-lg mx-auto cursor-pointer border border-gray-200"
                          onClick={() => setImagePreview(opt.imageUrl)}
                        />
                      ) : null}
                    </td>
                  ))}
                  <td className="p-1" />
                </tr>
              )}
              {/* Option names row */}
              <tr className="bg-gradient-to-r from-pastel-blue via-pastel-pink to-pastel-orange text-gray-700">
                <th className="border border-gray-300 px-3 py-2 text-left font-semibold min-w-[120px]">
                  Design Options →
                </th>
                {options.map(opt => (
                  <th key={opt.id} className="border border-gray-300 px-2 py-2 text-center min-w-[100px]">
                    <input
                      value={opt.name} onChange={e => updateOption(opt.id, 'name', e.target.value)}
                      placeholder="Option name"
                      className="w-full text-center text-xs font-semibold bg-transparent text-gray-700 placeholder-gray-400 focus:outline-none border-b border-transparent focus:border-gray-500"
                    />
                    <div className="flex items-center justify-center gap-1 mt-1">
                      <button onClick={() => triggerUpload(opt.id)} className="text-gray-400 hover:text-gray-800" title="Upload image">
                        <Camera size={11} />
                      </button>
                      {uploading === opt.id && <span className="text-[10px] text-gray-400">...</span>}
                      <button onClick={() => removeOption(opt.id)} className="text-gray-400 hover:text-red-500" title="Remove option">
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </th>
                ))}
                <th className="border border-gray-300 px-2 py-2">
                  <button onClick={addOption} className="text-gray-400 hover:text-gray-800 mx-auto flex items-center gap-1 text-xs">
                    <Plus size={12} /> Add
                  </button>
                </th>
              </tr>
              {/* "Criteria ↓" label row */}
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-3 py-1 text-left text-xs text-gray-500 font-medium">
                  Criteria ↓
                </th>
                {options.map(opt => (
                  <th key={opt.id} className="border border-gray-300 px-2 py-1 text-center text-[10px] text-gray-400">
                    {opt.description || ''}
                  </th>
                ))}
                <th className="border border-gray-300" />
              </tr>
            </thead>

            <tbody>
              {/* Criteria rows with score inputs */}
              {criteria.map(c => (
                <tr key={c.id} className="hover:bg-gray-50/50">
                  <td className="border border-gray-300 px-3 py-2">
                    <div className="flex items-center gap-1">
                      <input
                        value={c.name} onChange={e => updateCriterion(c.id, e.target.value)}
                        placeholder="Criterion"
                        className="flex-1 text-sm text-gray-700 bg-transparent focus:outline-none border-b border-transparent focus:border-pastel-blue-dark"
                      />
                      <button onClick={() => removeCriterion(c.id)} className="text-gray-300 hover:text-red-400 flex-shrink-0">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                  {/* No score boxes here. Whoever builds the matrix names the
                      options and criteria; the numbers come from the people
                      invited to rate it once it's hosted. */}
                  {options.map(opt => (
                    <td key={opt.id} className="border border-gray-300 px-1 py-2 text-center text-xs text-gray-300">—</td>
                  ))}
                  <td className="border border-gray-300" />
                </tr>
              ))}

              {/* Add criterion row */}
              <tr>
                <td className="border border-gray-300 px-3 py-2">
                  <button onClick={addCriterion} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
                    <Plus size={12} /> Add Criterion
                  </button>
                </td>
                {options.map(opt => <td key={opt.id} className="border border-gray-300" />)}
                <td className="border border-gray-300" />
              </tr>

              {options.length > 0 && criteria.length > 0 && (
                <tr className="bg-gray-50 text-gray-400">
                  <td className="border border-gray-300 px-3 py-2 text-xs" colSpan={options.length + 2}>
                    Scores get filled in by the people you invite once you host this.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {options.length === 0 && criteria.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-4">
            Add design options (columns) and criteria (rows) to build your matrix
          </p>
        )}
      </div>

      {/* Final Decision */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm p-4 space-y-3">
        <h3 className="font-semibold text-gray-700">Final Decision</h3>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Chosen Option</label>
          <select
            value={decision.chosen} onChange={e => setDecision(prev => ({ ...prev, chosen: e.target.value }))}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:border-pastel-blue-dark focus:outline-none bg-white"
          >
            <option value="">Select winning option...</option>
            {options.filter(o => o.name.trim()).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Why was this chosen?</label>
          <textarea value={decision.reason} onChange={e => setDecision(prev => ({ ...prev, reason: e.target.value }))}
            placeholder="Explain the reasoning..." rows={2}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:border-pastel-blue-dark focus:outline-none resize-none"
          />
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Additional Notes (optional)</label>
          <textarea value={decision.notes} onChange={e => setDecision(prev => ({ ...prev, notes: e.target.value }))}
            placeholder="Any extra notes..." rows={2}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:border-pastel-blue-dark focus:outline-none resize-none"
          />
        </div>
      </div>

      {/* Feedback & Actions */}
      {feedback && <div className="text-center text-amber-600 font-medium animate-pulse text-sm">{feedback}</div>}
      <div className="flex gap-3">
        <button onClick={onCancel} className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors text-sm font-medium">
          Cancel
        </button>
        <button onClick={handleSave} disabled={saving}
          className="flex-1 py-3 rounded-xl bg-pastel-blue hover:bg-pastel-blue-dark transition-colors text-sm font-medium flex items-center justify-center gap-2">
          <Save size={16} /> {saving ? 'Saving...' : initial ? 'Update Matrix' : 'Save Matrix'}
        </button>
      </div>

      {/* Image Preview Modal */}
      {imagePreview && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setImagePreview(null)}>
          <div className="relative max-w-2xl max-h-[80vh]">
            <img src={imagePreview} alt="Preview" className="max-w-full max-h-[80vh] object-contain rounded-xl" />
            <button onClick={() => setImagePreview(null)} className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1">
              <X size={20} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Matrix Viewer (read-only table) ───
function MatrixViewer({ matrix, onEdit }) {
  const [imagePreview, setImagePreview] = useState(null)
  const chosenOption = matrix.options.find(o => o.id === matrix.decision?.chosen)

  const getTotal = (optId) => matrix.criteria.reduce((sum, c) => sum + (Number(matrix.scores[`${optId}_${c.id}`]) || 0), 0)
  const highestTotal = Math.max(...matrix.options.map(o => getTotal(o.id)), 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-700">{matrix.title}</h2>
          {matrix.description && <p className="text-sm text-gray-400 mt-1">{matrix.description}</p>}
          <p className="text-xs text-gray-400 mt-1">Created by {matrix.created_by} · {new Date(matrix.created_at).toLocaleDateString()}</p>
        </div>
        <button onClick={onEdit} className="flex items-center gap-1 text-sm text-pastel-blue-dark hover:text-blue-600">
          <Edit3 size={14} /> Edit
        </button>
      </div>

      {/* Full table view */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm p-4 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            {/* Images row */}
            {matrix.options.some(o => o.imageUrl) && (
              <tr>
                <td className="p-1" />
                {matrix.options.map(opt => (
                  <td key={opt.id} className="p-1 text-center">
                    {opt.imageUrl ? (
                      <img src={opt.imageUrl} alt={opt.name}
                        className="w-16 h-16 object-cover rounded-lg mx-auto cursor-pointer border border-gray-200"
                        onClick={() => setImagePreview(opt.imageUrl)}
                      />
                    ) : null}
                  </td>
                ))}
              </tr>
            )}
            {/* Option names */}
            <tr className="bg-gradient-to-r from-pastel-blue via-pastel-pink to-pastel-orange text-gray-700">
              <th className="border border-gray-300 px-3 py-2 text-left font-semibold min-w-[120px]">Design Options →</th>
              {matrix.options.map(opt => {
                const total = getTotal(opt.id)
                const isHighest = total > 0 && total === highestTotal
                return (
                  <th key={opt.id} className={`border border-gray-300 px-3 py-2 text-center font-semibold min-w-[100px] ${isHighest ? 'bg-amber-200/60' : ''}`}>
                    {opt.name}
                    {isHighest && <Trophy size={12} className="inline ml-1" />}
                  </th>
                )
              })}
            </tr>
            {/* Descriptions row */}
            {matrix.options.some(o => o.description) && (
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-3 py-1 text-left text-xs text-gray-500 font-medium">Criteria ↓</th>
                {matrix.options.map(opt => (
                  <td key={opt.id} className="border border-gray-300 px-2 py-1 text-center text-[10px] text-gray-400">
                    {opt.description || ''}
                  </td>
                ))}
              </tr>
            )}
          </thead>
          <tbody>
            {matrix.criteria.map(c => (
              <tr key={c.id} className="hover:bg-gray-50/50">
                <td className="border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700">{c.name}</td>
                {matrix.options.map(opt => (
                  <td key={opt.id} className="border border-gray-300 px-3 py-2 text-center text-sm text-gray-700">
                    {matrix.scores[`${opt.id}_${c.id}`] ?? '—'}
                  </td>
                ))}
              </tr>
            ))}
            {/* Before it's hosted there are no scores, so a row of zeroes
                would just read as "everything is equally bad". */}
            {highestTotal > 0 ? (
              <tr className="bg-gradient-to-r from-pastel-blue via-pastel-pink to-pastel-orange text-gray-700 font-bold">
                <td className="border border-gray-300 px-3 py-2 text-sm">TOTAL</td>
                {matrix.options.map(opt => {
                  const total = getTotal(opt.id)
                  const isHighest = total > 0 && total === highestTotal
                  return (
                    <td key={opt.id} className={`border border-gray-300 px-3 py-2 text-center text-sm ${isHighest ? 'bg-amber-200/60 font-extrabold' : ''}`}>
                      <span className="inline-flex items-center gap-1 justify-center">
                        {isHighest && <Trophy size={13} />} {total}
                      </span>
                    </td>
                  )
                })}
              </tr>
            ) : (
              <tr className="bg-gray-50 text-gray-400">
                <td className="border border-gray-300 px-3 py-2 text-xs" colSpan={matrix.options.length + 1}>
                  Not rated yet — host this and the people you invite fill it in.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Final Decision */}
      {(chosenOption || matrix.decision?.reason) && (
        <div className="bg-amber-50/80 backdrop-blur-sm rounded-2xl shadow-sm p-4 space-y-2">
          <h3 className="font-semibold text-amber-800 flex items-center gap-2"><Trophy size={16} /> Final Decision</h3>
          {chosenOption && <p className="text-sm text-amber-700"><span className="font-medium">Chosen:</span> {chosenOption.name}</p>}
          {matrix.decision?.reason && <p className="text-sm text-amber-700"><span className="font-medium">Why:</span> {matrix.decision.reason}</p>}
          {matrix.decision?.notes && <p className="text-sm text-amber-600"><span className="font-medium">Notes:</span> {matrix.decision.notes}</p>}
        </div>
      )}

      {imagePreview && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setImagePreview(null)}>
          <div className="relative max-w-2xl max-h-[80vh]">
            <img src={imagePreview} alt="Preview" className="max-w-full max-h-[80vh] object-contain rounded-xl" />
            <button onClick={() => setImagePreview(null)} className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1"><X size={20} /></button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Component ───
// ─── Confetti ───
function Confetti() {
  const bits = Array.from({ length: 60 }, (_, i) => ({
    left: (i * 37) % 100,
    delay: (i % 12) * 0.12,
    dur: 2.4 + ((i % 5) * 0.35),
    color: ['#f9a8d4', '#93c5fd', '#fcd34d', '#86efac', '#c4b5fd'][i % 5],
    size: 6 + (i % 4) * 2,
  }))
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden z-50" aria-hidden="true">
      <style>{`@keyframes mx-fall{0%{transform:translateY(-12vh) rotate(0);opacity:1}100%{transform:translateY(105vh) rotate(720deg);opacity:0}}`}</style>
      {bits.map((b, i) => (
        <span key={i} style={{
          position: 'absolute', top: 0, left: `${b.left}%`,
          width: b.size, height: b.size * 1.6, background: b.color, borderRadius: 2,
          animation: `mx-fall ${b.dur}s linear ${b.delay}s forwards`,
        }} />
      ))}
    </div>
  )
}

// A drumroll, built rather than downloaded — no audio file to ship.
function drumroll(seconds = 3) {
  try {
    if (localStorage.getItem('scrum-sfx-enabled') === 'false') return () => {}
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return () => {}
    const ctx = new Ctx()
    const len = Math.floor(ctx.sampleRate * seconds)
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = buf.getChannelData(0)
    // Noise pulsed fast and swelling — a roll that builds to the reveal.
    for (let i = 0; i < len; i++) {
      const t = i / ctx.sampleRate
      const pulse = Math.max(0, Math.sin(t * Math.PI * 2 * 18))
      const swell = 0.15 + 0.85 * (t / seconds) ** 2
      data[i] = (Math.random() * 2 - 1) * pulse * swell * 0.35
    }
    const src = ctx.createBufferSource()
    src.buffer = buf
    const gain = ctx.createGain()
    gain.gain.value = 0.9
    src.connect(gain).connect(ctx.destination)
    src.start()
    return () => { try { src.stop(); ctx.close() } catch { /* already gone */ } }
  } catch { return () => {} }
}

// ─── The reveal: ready → drumroll → winner ───
function RevealCeremony({ winner, tied, onDone }) {
  const [stage, setStage] = useState('ready')
  useEffect(() => {
    if (stage !== 'rolling') return
    const stop = drumroll(3)
    const id = setTimeout(() => setStage('winner'), 3000)
    return () => { stop(); clearTimeout(id) }
  }, [stage])
  return (
    <div className="fixed inset-0 z-[70] bg-gray-900/95 backdrop-blur-sm flex items-center justify-center p-6 text-center">
      <style>{`
        @keyframes mx-shake{0%,100%{transform:translate(0,0) rotate(0)}25%{transform:translate(-3px,2px) rotate(-1.5deg)}75%{transform:translate(3px,-2px) rotate(1.5deg)}}
        @keyframes mx-pop{0%{transform:scale(.3);opacity:0}60%{transform:scale(1.12);opacity:1}100%{transform:scale(1)}}
        @keyframes mx-pulse{0%,100%{opacity:.35}50%{opacity:1}}
      `}</style>
      {stage === 'winner' && <Confetti />}
      {stage === 'ready' && (
        <div className="space-y-6">
          <p className="text-5xl">🥁</p>
          <p className="text-2xl font-black text-white">Are you ready?</p>
          <p className="text-sm text-gray-400">Every rating is in.</p>
          <button onClick={() => setStage('rolling')}
            className="px-8 py-3 rounded-2xl bg-pastel-pink hover:bg-pastel-pink-dark font-bold text-gray-800">
            Reveal the decision
          </button>
        </div>
      )}
      {stage === 'rolling' && (
        <div className="space-y-6">
          <p className="text-6xl" style={{ animation: 'mx-shake .12s linear infinite' }}>🥁</p>
          <p className="text-xl font-bold text-white" style={{ animation: 'mx-pulse 1s ease-in-out infinite' }}>Drumroll…</p>
        </div>
      )}
      {stage === 'winner' && (
        <div className="space-y-5" style={{ animation: 'mx-pop .6s cubic-bezier(.2,1.4,.4,1) both' }}>
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-pastel-pink">The decision is</p>
          {winner ? (
            <>
              <p className="text-5xl font-black text-white">🏆 {winner.name}</p>
              {winner.imageUrl && <img src={winner.imageUrl} alt="" className="mx-auto rounded-2xl max-h-52 object-cover" />}
              <p className="text-sm text-gray-300">{winner.total.toFixed(1)} average across every criterion</p>
            </>
          ) : (
            <p className="text-3xl font-black text-white">
              {tied && tied.length > 1 ? `It's a tie — ${tied.map(t => t.name).join(' and ')}` : 'No ratings came in'}
            </p>
          )}
          <button onClick={onDone} className="px-8 py-3 rounded-2xl bg-white/90 hover:bg-white font-bold text-gray-800">
            See the numbers
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Choose who rates it ───
function HostPicker({ matrix, username, onHost, onCancel }) {
  const [people, setPeople] = useState([])
  // The host rates their own matrix like everyone else, so they're in from the
  // start and can't be taken out.
  const [picked, setPicked] = useState([username])
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    fetch(`${REST_URL}/rest/v1/profiles?select=display_name,authority_tier,function_tags&order=display_name`, { headers: REST_HEADERS })
      .then(r => r.ok ? r.json() : [])
      .then(rows => setPeople((rows || []).filter(p =>
        p.display_name && p.authority_tier !== 'guest' &&
        !(p.function_tags || []).includes('Team') &&
        !['ets', 'everythingthatsscrum'].includes((p.display_name || '').trim().toLowerCase())
      ).map(p => p.display_name)))
      .catch(() => {})
  }, [])
  const toggle = (n) => {
    if (n === username) return
    setPicked(prev => prev.includes(n) ? prev.filter(x => x !== n) : [...prev, n])
  }
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-gray-700">Host “{matrix.title}”</h2>
        <p className="text-sm text-gray-400">Pick who rates it. They each score every option against every criterion, and the results are the average.</p>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={() => setPicked(people)} className="text-xs px-2.5 py-1 rounded-lg bg-pastel-blue/30 hover:bg-pastel-blue/50">Select all</button>
        <button onClick={() => setPicked([username])} className="text-xs px-2.5 py-1 rounded-lg border hover:bg-gray-50">Clear</button>
        <span className="text-xs text-gray-400 ml-auto">{picked.length} chosen</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {people.map(n => (
          <button key={n} onClick={() => toggle(n)}
            className={`px-2.5 py-2 rounded-xl text-xs font-semibold border-2 transition-colors text-left ${
              picked.includes(n) ? 'border-pastel-pink bg-pastel-pink/20 text-gray-800' : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'}`}>
            {picked.includes(n) ? '✓ ' : ''}{n}{n === username ? ' (you)' : ''}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border text-sm hover:bg-gray-50">Cancel</button>
        <button
          onClick={async () => { setBusy(true); await onHost(picked); setBusy(false) }}
          disabled={picked.length === 0 || busy}
          className="flex-1 py-2.5 rounded-xl bg-pastel-pink hover:bg-pastel-pink-dark disabled:opacity-40 text-sm font-semibold">
          {busy ? 'Starting…' : `Start with ${picked.length}`}
        </button>
      </div>
    </div>
  )
}

// ─── Rating grid, for one participant ───
export function VoteView({ matrix, session, username, onSubmit, onCancel }) {
  const [v, setV] = useState(() => ({ ...(session.votes?.[username] || {}) }))
  const [busy, setBusy] = useState(false)
  const missing = (matrix.options || []).flatMap(o =>
    (matrix.criteria || []).filter(c => !(Number(v[scoreKey(o.id, c.id)]) > 0)).map(c => `${o.name} · ${c.name}`))
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-gray-700">{matrix.title}</h2>
        {matrix.description && <p className="text-sm text-gray-500">{matrix.description}</p>}
        <p className="text-xs text-gray-400 mt-1">Rate each option out of 10 on every criterion — decimals are fine. 10 is best.</p>
      </div>
      {(matrix.options || []).map(o => (
        <div key={o.id} className="bg-white rounded-2xl border-2 border-gray-100 p-4 space-y-3">
          <div className="flex items-center gap-3">
            {o.imageUrl && <img src={o.imageUrl} alt="" className="w-12 h-12 rounded-lg object-cover" />}
            <div>
              <p className="font-bold text-gray-800">{o.name || 'Untitled option'}</p>
              {o.description && <p className="text-xs text-gray-400">{o.description}</p>}
            </div>
          </div>
          {(matrix.criteria || []).map(c => {
            const k = scoreKey(o.id, c.id)
            return (
              <div key={c.id} className="flex items-center justify-between gap-2">
                <span className="text-sm text-gray-600">{c.name || 'Criterion'}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <input
                    type="range" min="0" max="10" step="0.1"
                    value={Number(v[k]) || 0}
                    onChange={e => setV(prev => ({ ...prev, [k]: Number(e.target.value) }))}
                    className="w-28 sm:w-40 accent-pastel-pink-dark"
                  />
                  <input
                    type="number" min="0" max="10" step="0.1" placeholder="—"
                    value={v[k] ?? ''}
                    onChange={e => {
                      const n = e.target.value === '' ? '' : Math.max(0, Math.min(10, Number(e.target.value)))
                      setV(prev => ({ ...prev, [k]: n }))
                    }}
                    className="w-16 text-sm text-center border rounded-lg px-1.5 py-1 focus:ring-2 focus:ring-pastel-blue focus:border-transparent"
                  />
                  <span className="text-xs text-gray-300">/10</span>
                </div>
              </div>
            )
          })}
        </div>
      ))}
      {missing.length > 0 && (
        <p className="text-xs text-gray-400">Still to rate: {missing.slice(0, 4).join(', ')}{missing.length > 4 ? ` +${missing.length - 4} more` : ''}</p>
      )}
      <div className="flex gap-2">
        {onCancel && <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border text-sm hover:bg-gray-50">Back</button>}
        <button onClick={async () => { setBusy(true); await onSubmit(v); setBusy(false) }}
          disabled={missing.length > 0 || busy}
          className="flex-1 py-2.5 rounded-xl bg-pastel-pink hover:bg-pastel-pink-dark disabled:opacity-40 text-sm font-semibold">
          {busy ? 'Saving…' : 'Submit ratings'}
        </button>
      </div>
    </div>
  )
}

// ─── Live progress + results ───
function SessionView({ matrix, session, username, onVote, onClose, onReopen }) {
  const isHost = session.hostedBy === username
  const done = finishedVoters(matrix, session)
  const t = tally(matrix, session)
  const closed = session.status === 'closed'
  const [showConfetti, setShowConfetti] = useState(false)
  useEffect(() => { if (closed && t.winner) { setShowConfetti(true); const id = setTimeout(() => setShowConfetti(false), 5000); return () => clearTimeout(id) } }, [closed, t.winner?.id])
  const everyone = done.length === (session.participants || []).length && done.length > 0
  return (
    <div className="space-y-4">
      {showConfetti && <Confetti />}
      <div>
        <h2 className="text-lg font-bold text-gray-700">{matrix.title}</h2>
        <p className="text-xs text-gray-400">Hosted by {session.hostedBy} · {done.length} of {(session.participants || []).length} have rated it</p>
      </div>

      {closed && t.winner && (
        <div className="bg-white rounded-2xl border-2 border-pastel-pink p-5 text-center">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400">The decision</p>
          <p className="text-2xl font-black text-gray-800 mt-1">🏆 {t.winner.name}</p>
          <p className="text-sm text-gray-500 mt-1">{t.winner.total.toFixed(1)} average across {matrix.criteria.length} criteria</p>
          {t.winner.imageUrl && <img src={t.winner.imageUrl} alt="" className="mt-3 mx-auto rounded-xl max-h-44 object-cover" />}
        </div>
      )}
      {closed && !t.winner && (
        <div className="bg-white rounded-2xl border-2 border-gray-200 p-5 text-center">
          <p className="text-sm text-gray-500">{t.tied.length > 1 ? `It's a tie between ${t.tied.map(o => o.name).join(' and ')}.` : 'No ratings were submitted.'}</p>
        </div>
      )}

      {!closed && (
        <div className="flex flex-wrap gap-1.5">
          {(session.participants || []).map(n => (
            <span key={n} className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${done.includes(n) ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
              {done.includes(n) ? '✓ ' : ''}{n}
            </span>
          ))}
        </div>
      )}

      {!closed && (session.participants || []).includes(username) && (
        <button onClick={onVote} className="w-full py-3 rounded-xl bg-pastel-pink hover:bg-pastel-pink-dark text-sm font-semibold">
          {hasFinished(matrix, session, username) ? 'Change my ratings' : 'Rate this matrix'}
        </button>
      )}

      <div className="bg-white rounded-2xl border-2 border-gray-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-400">
              <th className="text-left p-2.5">Option</th>
              {matrix.criteria.map(c => <th key={c.id} className="p-2.5 font-semibold">{c.name}</th>)}
              <th className="p-2.5 font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            {t.byOption.map((o, i) => (
              <tr key={o.id} className={i === 0 && o.total > 0 ? 'bg-pastel-pink/10' : ''}>
                <td className="p-2.5 font-semibold text-gray-700">{o.name}</td>
                {o.perCriterion.map(c => <td key={c.id} className="p-2.5 text-center text-gray-600">{c.count ? c.avg.toFixed(1) : '—'}</td>)}
                <td className="p-2.5 text-center font-bold text-gray-800">{o.total.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isHost && !closed && (
        <button onClick={onClose} disabled={done.length === 0}
          className="w-full py-2.5 rounded-xl bg-pastel-blue/40 hover:bg-pastel-blue/60 disabled:opacity-40 text-sm font-semibold">
          {everyone ? '🥁 Everyone has rated — reveal the decision' : `Close early and reveal (${done.length} rated)`}
        </button>
      )}
      {isHost && closed && (
        <button onClick={onReopen} className="w-full py-2.5 rounded-xl border text-sm hover:bg-gray-50">Reopen for more ratings</button>
      )}
    </div>
  )
}

export default function DesignMatrix({ onBack }) {
  const { username } = useUser()
  const [matrices, setMatrices] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('library')
  const [selected, setSelected] = useState(null)
  const [reveal, setReveal] = useState(null)

  useEffect(() => { fetchMatrices() }, [])

  const fetchMatrices = async () => {
    try {
      const res = await fetch(`${REST_URL}/rest/v1/design_matrices?select=*&order=created_at.desc`, { headers: REST_HEADERS })
      if (res.ok) setMatrices(await res.json())
    } catch (err) { console.error('Failed to fetch matrices:', err) }
    finally { setLoading(false) }
  }

  const handleSave = (data) => {
    setMatrices(prev => {
      const exists = prev.find(m => m.id === data.id)
      if (exists) return prev.map(m => m.id === data.id ? data : m)
      return [data, ...prev]
    })
    setSelected(data)
    setView('detail')
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this matrix?')) return
    setMatrices(prev => prev.filter(m => m.id !== id))
    await fetch(`${REST_URL}/rest/v1/design_matrices?id=eq.${id}`, { method: 'DELETE', headers: REST_HEADERS })
  }

  // Every session change is a write of the whole scores blob, so read-modify-
  // write off the freshest copy we hold rather than the one in `selected`.
  const saveSession = async (matrix, session) => {
    const scores = withSession(matrix.scores, session)
    const next = { ...matrix, scores }
    setMatrices(prev => prev.map(m => m.id === matrix.id ? next : m))
    setSelected(next)
    await fetch(`${REST_URL}/rest/v1/design_matrices?id=eq.${matrix.id}`, {
      method: 'PATCH',
      headers: { ...REST_HEADERS, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ scores, updated_at: new Date().toISOString() }),
    }).catch(err => console.error('Failed to save the session:', err))
    return next
  }

  // Tell the people who were picked. Without this the matrix just appears
  // under "Waiting on you" and nobody knows to look.
  const notifyParticipants = async (matrix, participants) => {
    try {
      const res = await fetch(`${REST_URL}/rest/v1/profiles?select=id,display_name`, { headers: REST_HEADERS })
      if (!res.ok) return
      const byName = Object.fromEntries((await res.json()).map(p => [p.display_name, p.id]))
      for (const name of participants) {
        const uid = byName[name]
        if (!uid || name === username) continue
        const notif = {
          id: genId() + uid.slice(0, 4),
          user_id: uid,
          type: 'decision_matrix',
          title: '🗳️ Rate a decision',
          body: `${username} needs your ratings on "${matrix.title}"`,
        }
        await fetch(`${REST_URL}/rest/v1/notifications`, {
          method: 'POST',
          headers: { ...REST_HEADERS, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
          body: JSON.stringify(notif),
        })
        triggerPush(notif)
      }
    } catch (err) { console.error('Failed to notify participants:', err) }
  }

  const host = async (participants) => {
    const next = await saveSession(selected, {
      status: 'open', participants, votes: {},
      hostedBy: username, hostedAt: new Date().toISOString(),
    })
    notifyParticipants(next, participants)
    setView('detail')
  }

  const submitVote = async (v) => {
    const session = getSession(selected)
    await saveSession(selected, { ...session, votes: { ...(session.votes || {}), [username]: v } })
    setView('detail')
  }

  const closeSession = async () => {
    const session = getSession(selected)
    const next = await saveSession(selected, { ...session, status: 'closed', closedAt: new Date().toISOString() })
    const t = tally(next, getSession(next))
    setReveal({ winner: t.winner, tied: t.tied })
  }

  const reopenSession = async () => {
    const session = getSession(selected)
    await saveSession(selected, { ...session, status: 'open', closedAt: null })
  }

  return (
    <div className="flex-1 p-4 overflow-y-auto">
      {reveal && <RevealCeremony winner={reveal.winner} tied={reveal.tied} onDone={() => setReveal(null)} />}
      <div className="max-w-3xl mx-auto space-y-4">
        <button
          onClick={() => {
            if (view === 'library') onBack()
            else if (view === 'detail') { setView('library'); setSelected(null) }
            else if (view === 'edit' || view === 'host' || view === 'vote') setView('detail')
            else setView('library')
          }}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft size={14} /> Back
        </button>

        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading...</div>
        ) : view === 'library' ? (
          <MatrixLibrary matrices={matrices} onSelect={m => { setSelected(m); setView('detail') }} onCreate={() => { setSelected(null); setView('create') }} onDelete={handleDelete} username={username} />
        ) : view === 'create' ? (
          <MatrixEditor onSave={handleSave} onCancel={() => setView('library')} username={username} />
        ) : view === 'edit' ? (
          <MatrixEditor initial={selected} onSave={handleSave} onCancel={() => setView('detail')} username={username} />
        ) : view === 'host' && selected ? (
          <HostPicker matrix={selected} username={username} onHost={host} onCancel={() => setView('detail')} />
        ) : view === 'vote' && selected ? (
          <VoteView matrix={selected} session={getSession(selected) || { votes: {} }} username={username}
                    onSubmit={submitVote} onCancel={() => setView('detail')} />
        ) : view === 'detail' && selected ? (
          getSession(selected) ? (
            <SessionView
              matrix={selected} session={getSession(selected)} username={username}
              onVote={() => setView('vote')} onClose={closeSession} onReopen={reopenSession}
            />
          ) : (
            <>
              <MatrixViewer matrix={selected} onEdit={() => setView('edit')} />
              {selected.created_by === username && (selected.options || []).length > 0 && (selected.criteria || []).length > 0 && (
                <button onClick={() => setView('host')}
                  className="w-full py-3 rounded-xl bg-pastel-pink hover:bg-pastel-pink-dark text-sm font-semibold">
                  Host this — pick who rates it
                </button>
              )}
            </>
          )
        ) : null}
      </div>
    </div>
  )
}
