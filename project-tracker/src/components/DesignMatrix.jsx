import { useState, useEffect, useRef } from 'react'
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
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-700">Design Matrix Library</h2>
        <button
          onClick={onCreate}
          className="flex items-center gap-2 px-4 py-2 bg-pastel-pink hover:bg-pastel-pink-dark rounded-lg transition-colors text-sm font-medium"
        >
          <Plus size={16} /> New Matrix
        </button>
      </div>
      {matrices.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-lg mb-2">No design matrices yet</p>
          <p className="text-sm">Create one to start comparing design options</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {matrices.map(m => {
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

  const setScore = (optId, critId, value) => {
    setScores(prev => ({ ...prev, [`${optId}_${critId}`]: value === '' ? '' : Number(value) }))
  }

  const getTotal = (optId) => criteria.reduce((sum, c) => sum + (Number(scores[`${optId}_${c.id}`]) || 0), 0)
  const highestTotal = Math.max(...options.map(o => getTotal(o.id)), 0)

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
      if (!res.ok) throw new Error('Save failed')
      onSave(data)
    } catch (err) { console.error(err); showFeedback('Failed to save') }
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
        <h3 className="font-semibold text-gray-700">Design Matrix</h3>
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
              <tr className="bg-gray-800 text-white">
                <th className="border border-gray-300 px-3 py-2 text-left font-semibold min-w-[120px]">
                  Design Options →
                </th>
                {options.map(opt => (
                  <th key={opt.id} className="border border-gray-300 px-2 py-2 text-center min-w-[100px]">
                    <input
                      value={opt.name} onChange={e => updateOption(opt.id, 'name', e.target.value)}
                      placeholder="Option name"
                      className="w-full text-center text-xs font-semibold bg-transparent text-white placeholder-gray-400 focus:outline-none border-b border-transparent focus:border-gray-400"
                    />
                    <div className="flex items-center justify-center gap-1 mt-1">
                      <button onClick={() => triggerUpload(opt.id)} className="text-gray-400 hover:text-white" title="Upload image">
                        <Camera size={11} />
                      </button>
                      {uploading === opt.id && <span className="text-[10px] text-gray-400">...</span>}
                      <button onClick={() => removeOption(opt.id)} className="text-gray-400 hover:text-red-300" title="Remove option">
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </th>
                ))}
                <th className="border border-gray-300 px-2 py-2">
                  <button onClick={addOption} className="text-gray-400 hover:text-white mx-auto flex items-center gap-1 text-xs">
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
                  {options.map(opt => (
                    <td key={opt.id} className="border border-gray-300 px-1 py-1 text-center">
                      <input
                        type="number" min="0" max="10"
                        value={scores[`${opt.id}_${c.id}`] ?? ''}
                        onChange={e => setScore(opt.id, c.id, e.target.value)}
                        className="w-full text-center text-sm py-1 bg-transparent focus:outline-none focus:bg-blue-50 rounded"
                      />
                    </td>
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

              {/* Totals row */}
              {options.length > 0 && criteria.length > 0 && (
                <tr className="bg-gray-800 text-white font-bold">
                  <td className="border border-gray-300 px-3 py-2 text-sm">TOTAL</td>
                  {options.map(opt => {
                    const total = getTotal(opt.id)
                    const isHighest = total > 0 && total === highestTotal
                    return (
                      <td key={opt.id} className={`border border-gray-300 px-2 py-2 text-center text-sm ${isHighest ? 'bg-amber-500 text-white' : ''}`}>
                        <span className="inline-flex items-center gap-1 justify-center">
                          {isHighest && <Trophy size={13} />}
                          {total}
                        </span>
                      </td>
                    )
                  })}
                  <td className="border border-gray-300" />
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
            <tr className="bg-gray-800 text-white">
              <th className="border border-gray-300 px-3 py-2 text-left font-semibold min-w-[120px]">Design Options →</th>
              {matrix.options.map(opt => {
                const total = getTotal(opt.id)
                const isHighest = total > 0 && total === highestTotal
                return (
                  <th key={opt.id} className={`border border-gray-300 px-3 py-2 text-center font-semibold min-w-[100px] ${isHighest ? 'bg-amber-500' : ''}`}>
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
            <tr className="bg-gray-800 text-white font-bold">
              <td className="border border-gray-300 px-3 py-2 text-sm">TOTAL</td>
              {matrix.options.map(opt => {
                const total = getTotal(opt.id)
                const isHighest = total > 0 && total === highestTotal
                return (
                  <td key={opt.id} className={`border border-gray-300 px-3 py-2 text-center text-sm ${isHighest ? 'bg-amber-500 text-white' : ''}`}>
                    <span className="inline-flex items-center gap-1 justify-center">
                      {isHighest && <Trophy size={13} />} {total}
                    </span>
                  </td>
                )
              })}
            </tr>
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
export default function DesignMatrix({ onBack }) {
  const { username } = useUser()
  const [matrices, setMatrices] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('library')
  const [selected, setSelected] = useState(null)

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

  return (
    <div className="flex-1 p-4 overflow-y-auto">
      <div className="max-w-3xl mx-auto space-y-4">
        <button
          onClick={() => {
            if (view === 'library') onBack()
            else if (view === 'detail') { setView('library'); setSelected(null) }
            else if (view === 'edit') setView('detail')
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
        ) : view === 'detail' && selected ? (
          <MatrixViewer matrix={selected} onEdit={() => setView('edit')} />
        ) : null}
      </div>
    </div>
  )
}
