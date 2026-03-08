import { useState, useEffect, useRef } from 'react'
import { ArrowLeft, Plus, Trash2, Trophy, Camera, X, ChevronDown, ChevronUp, Save, Eye, Edit3 } from 'lucide-react'
import { useUser } from '../contexts/UserContext'

const REST_URL = import.meta.env.VITE_SUPABASE_URL
const REST_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const REST_HEADERS = { 'apikey': REST_KEY, 'Authorization': `Bearer ${REST_KEY}` }
const REST_JSON = { ...REST_HEADERS, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' }

function genId() {
  return String(Date.now()) + Math.random().toString(36).slice(2)
}

// ─── Image upload helper ───
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
            const winnerOption = winner ? m.options.find(o => o.id === winner.id) : null
            const thumbnail = winnerOption?.imageUrl || m.options.find(o => o.imageUrl)?.imageUrl
            return (
              <div
                key={m.id}
                className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer overflow-hidden"
                onClick={() => onSelect(m)}
              >
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
                        <button
                          onClick={e => { e.stopPropagation(); onDelete(m.id) }}
                          className="text-gray-300 hover:text-red-400 transition-colors p-1 flex-shrink-0"
                        >
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

// ─── Get winner from matrix data ───
function getWinner(matrix) {
  if (!matrix.options.length || !matrix.criteria.length) return null
  const totals = matrix.options.map(opt => {
    const total = matrix.criteria.reduce((sum, crit) => {
      const key = `${opt.id}_${crit.id}`
      return sum + (Number(matrix.scores[key]) || 0)
    }, 0)
    return { id: opt.id, name: opt.name, total }
  })
  totals.sort((a, b) => b.total - a.total)
  if (totals[0]?.total === 0) return null
  return totals[0]
}

// ─── Matrix Builder / Editor ───
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

  const addOption = () => {
    setOptions(prev => [...prev, { id: genId(), name: '', description: '', imageUrl: '' }])
  }

  const updateOption = (id, field, value) => {
    setOptions(prev => prev.map(o => o.id === id ? { ...o, [field]: value } : o))
  }

  const removeOption = (id) => {
    setOptions(prev => prev.filter(o => o.id !== id))
    setScores(prev => {
      const next = { ...prev }
      Object.keys(next).forEach(k => { if (k.startsWith(id + '_')) delete next[k] })
      return next
    })
    if (decision.chosen === id) setDecision(prev => ({ ...prev, chosen: '' }))
  }

  const addCriterion = () => {
    setCriteria(prev => [...prev, { id: genId(), name: '' }])
  }

  const updateCriterion = (id, name) => {
    setCriteria(prev => prev.map(c => c.id === id ? { ...c, name } : c))
  }

  const removeCriterion = (id) => {
    setCriteria(prev => prev.filter(c => c.id !== id))
    setScores(prev => {
      const next = { ...prev }
      Object.keys(next).forEach(k => { if (k.endsWith('_' + id)) delete next[k] })
      return next
    })
  }

  const setScore = (optId, critId, value) => {
    const num = value === '' ? '' : Number(value)
    setScores(prev => ({ ...prev, [`${optId}_${critId}`]: num }))
  }

  const getTotal = (optId) => {
    return criteria.reduce((sum, c) => sum + (Number(scores[`${optId}_${c.id}`]) || 0), 0)
  }

  const highestTotal = Math.max(...options.map(o => getTotal(o.id)), 0)

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !uploadTargetRef.current) return
    const optId = uploadTargetRef.current
    setUploading(optId)
    try {
      const url = await uploadImage(file)
      updateOption(optId, 'imageUrl', url)
      showFeedback('Image uploaded')
    } catch {
      showFeedback('Image upload failed')
    } finally {
      setUploading(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const triggerUpload = (optId) => {
    uploadTargetRef.current = optId
    fileInputRef.current?.click()
  }

  const handleSave = async () => {
    if (!title.trim()) { showFeedback('Title is required'); return }
    if (options.length < 2) { showFeedback('Add at least 2 options'); return }
    if (criteria.length < 1) { showFeedback('Add at least 1 criterion'); return }
    if (options.some(o => !o.name.trim())) { showFeedback('All options need a name'); return }
    if (criteria.some(c => !c.name.trim())) { showFeedback('All criteria need a name'); return }

    setSaving(true)
    try {
      const data = {
        id: initial?.id || genId(),
        title: title.trim(),
        description: description.trim(),
        options,
        criteria,
        scores,
        decision,
        created_by: initial?.created_by || username,
        created_at: initial?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      const method = initial ? 'PATCH' : 'POST'
      const url = initial
        ? `${REST_URL}/rest/v1/design_matrices?id=eq.${initial.id}`
        : `${REST_URL}/rest/v1/design_matrices`

      const res = await fetch(url, { method, headers: REST_JSON, body: JSON.stringify(data) })
      if (!res.ok) throw new Error('Save failed')
      onSave(data)
    } catch (err) {
      console.error(err)
      showFeedback('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <input type="file" ref={fileInputRef} accept="image/*" onChange={handleImageUpload} className="hidden" />

      {/* Title & Description */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm p-4 space-y-3">
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Matrix Title *"
          className="w-full text-xl font-bold text-gray-700 bg-transparent border-b border-gray-200 focus:border-pastel-blue-dark focus:outline-none pb-2"
        />
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Optional description..."
          rows={2}
          className="w-full text-sm text-gray-500 bg-transparent border-b border-gray-100 focus:border-pastel-blue-dark focus:outline-none resize-none"
        />
      </div>

      {/* Design Options */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-700">Design Options</h3>
          <button onClick={addOption} className="flex items-center gap-1 text-sm text-pastel-blue-dark hover:text-blue-600">
            <Plus size={14} /> Add Option
          </button>
        </div>
        {options.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-4">Add design options to compare (e.g. Roller Intake, Conveyor Intake)</p>
        )}
        {options.map((opt, i) => (
          <div key={opt.id} className="border border-gray-100 rounded-xl p-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-400 w-6">{i + 1}.</span>
              <input
                value={opt.name}
                onChange={e => updateOption(opt.id, 'name', e.target.value)}
                placeholder="Option name *"
                className="flex-1 font-medium text-gray-700 bg-transparent border-b border-gray-200 focus:border-pastel-blue-dark focus:outline-none text-sm pb-1"
              />
              <button onClick={() => removeOption(opt.id)} className="text-gray-300 hover:text-red-400 p-1">
                <Trash2 size={14} />
              </button>
            </div>
            <input
              value={opt.description || ''}
              onChange={e => updateOption(opt.id, 'description', e.target.value)}
              placeholder="Short description (optional)"
              className="w-full text-xs text-gray-500 bg-transparent border-b border-gray-100 focus:border-pastel-blue-dark focus:outline-none ml-6 pb-1"
              style={{ width: 'calc(100% - 1.5rem)' }}
            />
            <div className="flex items-center gap-2 ml-6">
              {opt.imageUrl ? (
                <div className="relative group">
                  <img
                    src={opt.imageUrl}
                    alt={opt.name}
                    className="w-16 h-16 object-cover rounded-lg cursor-pointer border border-gray-200"
                    onClick={() => setImagePreview(opt.imageUrl)}
                  />
                  <button
                    onClick={() => updateOption(opt.id, 'imageUrl', '')}
                    className="absolute -top-1 -right-1 bg-red-400 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={10} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => triggerUpload(opt.id)}
                  disabled={uploading === opt.id}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 border border-dashed border-gray-300 rounded-lg px-3 py-2"
                >
                  <Camera size={12} />
                  {uploading === opt.id ? 'Uploading...' : 'Add Image'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Criteria */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-700">Evaluation Criteria</h3>
          <button onClick={addCriterion} className="flex items-center gap-1 text-sm text-pastel-blue-dark hover:text-blue-600">
            <Plus size={14} /> Add Criterion
          </button>
        </div>
        {criteria.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-4">Add criteria to evaluate options (e.g. Reliability, Speed, Cost)</p>
        )}
        {criteria.map((c, i) => (
          <div key={c.id} className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-400 w-6">{i + 1}.</span>
            <input
              value={c.name}
              onChange={e => updateCriterion(c.id, e.target.value)}
              placeholder="Criterion name *"
              className="flex-1 text-sm text-gray-700 bg-transparent border-b border-gray-200 focus:border-pastel-blue-dark focus:outline-none pb-1"
            />
            <button onClick={() => removeCriterion(c.id)} className="text-gray-300 hover:text-red-400 p-1">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* Scoring Matrix */}
      {options.length > 0 && criteria.length > 0 && (
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm p-4 space-y-3">
          <h3 className="font-semibold text-gray-700">Scoring</h3>
          <div className="overflow-x-auto -mx-2 px-2">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left text-xs text-gray-400 font-medium pb-2 pr-2 min-w-[100px]">Criteria</th>
                  {options.map(opt => (
                    <th key={opt.id} className="text-center text-xs text-gray-600 font-semibold pb-2 px-1 min-w-[70px]">
                      <div className="truncate max-w-[80px] mx-auto">{opt.name || '—'}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {criteria.map(c => (
                  <tr key={c.id} className="border-t border-gray-50">
                    <td className="text-xs text-gray-600 py-2 pr-2">{c.name || '—'}</td>
                    {options.map(opt => (
                      <td key={opt.id} className="text-center py-2 px-1">
                        <input
                          type="number"
                          value={scores[`${opt.id}_${c.id}`] ?? ''}
                          onChange={e => setScore(opt.id, c.id, e.target.value)}
                          className="w-14 text-center text-sm border border-gray-200 rounded-lg py-1 focus:border-pastel-blue-dark focus:outline-none mx-auto"
                          min="0"
                          max="10"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className="border-t-2 border-gray-200">
                  <td className="text-xs font-bold text-gray-700 py-2 pr-2">TOTAL</td>
                  {options.map(opt => {
                    const total = getTotal(opt.id)
                    const isHighest = total > 0 && total === highestTotal
                    return (
                      <td key={opt.id} className="text-center py-2 px-1">
                        <span className={`inline-flex items-center gap-1 text-sm font-bold ${isHighest ? 'text-amber-600' : 'text-gray-700'}`}>
                          {isHighest && <Trophy size={12} />}
                          {total}
                        </span>
                      </td>
                    )
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Final Decision */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm p-4 space-y-3">
        <h3 className="font-semibold text-gray-700">Final Decision</h3>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Chosen Option</label>
          <select
            value={decision.chosen}
            onChange={e => setDecision(prev => ({ ...prev, chosen: e.target.value }))}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:border-pastel-blue-dark focus:outline-none bg-white"
          >
            <option value="">Select winning option...</option>
            {options.filter(o => o.name.trim()).map(o => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Why was this chosen?</label>
          <textarea
            value={decision.reason}
            onChange={e => setDecision(prev => ({ ...prev, reason: e.target.value }))}
            placeholder="Explain the reasoning..."
            rows={2}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:border-pastel-blue-dark focus:outline-none resize-none"
          />
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Additional Notes (optional)</label>
          <textarea
            value={decision.notes}
            onChange={e => setDecision(prev => ({ ...prev, notes: e.target.value }))}
            placeholder="Any extra notes..."
            rows={2}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:border-pastel-blue-dark focus:outline-none resize-none"
          />
        </div>
      </div>

      {/* Feedback & Actions */}
      {feedback && (
        <div className="text-center text-amber-600 font-medium animate-pulse text-sm">{feedback}</div>
      )}
      <div className="flex gap-3">
        <button
          onClick={onCancel}
          className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors text-sm font-medium"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 py-3 rounded-xl bg-pastel-blue hover:bg-pastel-blue-dark transition-colors text-sm font-medium flex items-center justify-center gap-2"
        >
          <Save size={16} />
          {saving ? 'Saving...' : initial ? 'Update Matrix' : 'Save Matrix'}
        </button>
      </div>

      {/* Image Preview Modal */}
      {imagePreview && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setImagePreview(null)}>
          <div className="relative max-w-2xl max-h-[80vh]">
            <img src={imagePreview} alt="Preview" className="max-w-full max-h-[80vh] object-contain rounded-xl" />
            <button
              onClick={() => setImagePreview(null)}
              className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Matrix Viewer ───
function MatrixViewer({ matrix, onEdit, onBack }) {
  const [imagePreview, setImagePreview] = useState(null)
  const winner = getWinner(matrix)
  const chosenOption = matrix.options.find(o => o.id === matrix.decision?.chosen)

  const getTotal = (optId) => {
    return matrix.criteria.reduce((sum, c) => sum + (Number(matrix.scores[`${optId}_${c.id}`]) || 0), 0)
  }
  const highestTotal = Math.max(...matrix.options.map(o => getTotal(o.id)), 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-700">{matrix.title}</h2>
          {matrix.description && <p className="text-sm text-gray-400 mt-1">{matrix.description}</p>}
          <p className="text-xs text-gray-400 mt-1">
            Created by {matrix.created_by} · {new Date(matrix.created_at).toLocaleDateString()}
          </p>
        </div>
        <button onClick={onEdit} className="flex items-center gap-1 text-sm text-pastel-blue-dark hover:text-blue-600">
          <Edit3 size={14} /> Edit
        </button>
      </div>

      {/* Options with images */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {matrix.options.map(opt => {
          const total = getTotal(opt.id)
          const isWinner = total > 0 && total === highestTotal
          return (
            <div
              key={opt.id}
              className={`bg-white/80 rounded-xl p-3 text-center ${isWinner ? 'ring-2 ring-amber-400' : 'border border-gray-100'}`}
            >
              {opt.imageUrl && (
                <img
                  src={opt.imageUrl}
                  alt={opt.name}
                  className="w-full h-24 object-cover rounded-lg mb-2 cursor-pointer"
                  onClick={() => setImagePreview(opt.imageUrl)}
                />
              )}
              <p className="text-sm font-semibold text-gray-700 flex items-center justify-center gap-1">
                {isWinner && <Trophy size={14} className="text-amber-500" />}
                {opt.name}
              </p>
              {opt.description && <p className="text-xs text-gray-400 mt-0.5">{opt.description}</p>}
              <p className={`text-lg font-bold mt-1 ${isWinner ? 'text-amber-600' : 'text-gray-600'}`}>{total} pts</p>
            </div>
          )
        })}
      </div>

      {/* Score Table */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm p-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-left text-xs text-gray-400 font-medium pb-2 pr-2">Criteria</th>
              {matrix.options.map(opt => (
                <th key={opt.id} className="text-center text-xs text-gray-600 font-semibold pb-2 px-2">
                  {opt.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.criteria.map(c => (
              <tr key={c.id} className="border-t border-gray-50">
                <td className="text-xs text-gray-600 py-2 pr-2">{c.name}</td>
                {matrix.options.map(opt => (
                  <td key={opt.id} className="text-center text-sm text-gray-700 py-2 px-2">
                    {matrix.scores[`${opt.id}_${c.id}`] ?? '—'}
                  </td>
                ))}
              </tr>
            ))}
            <tr className="border-t-2 border-gray-200">
              <td className="text-xs font-bold text-gray-700 py-2 pr-2">TOTAL</td>
              {matrix.options.map(opt => {
                const total = getTotal(opt.id)
                const isHighest = total > 0 && total === highestTotal
                return (
                  <td key={opt.id} className="text-center py-2 px-2">
                    <span className={`font-bold ${isHighest ? 'text-amber-600' : 'text-gray-700'}`}>
                      {total}
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
          <h3 className="font-semibold text-amber-800 flex items-center gap-2">
            <Trophy size={16} /> Final Decision
          </h3>
          {chosenOption && (
            <p className="text-sm text-amber-700"><span className="font-medium">Chosen:</span> {chosenOption.name}</p>
          )}
          {matrix.decision?.reason && (
            <p className="text-sm text-amber-700"><span className="font-medium">Why:</span> {matrix.decision.reason}</p>
          )}
          {matrix.decision?.notes && (
            <p className="text-sm text-amber-600"><span className="font-medium">Notes:</span> {matrix.decision.notes}</p>
          )}
        </div>
      )}

      {/* Image Preview Modal */}
      {imagePreview && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setImagePreview(null)}>
          <div className="relative max-w-2xl max-h-[80vh]">
            <img src={imagePreview} alt="Preview" className="max-w-full max-h-[80vh] object-contain rounded-xl" />
            <button
              onClick={() => setImagePreview(null)}
              className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1"
            >
              <X size={20} />
            </button>
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
  const [view, setView] = useState('library') // library | create | edit | detail
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    fetchMatrices()
  }, [])

  const fetchMatrices = async () => {
    try {
      const res = await fetch(`${REST_URL}/rest/v1/design_matrices?select=*&order=created_at.desc`, { headers: REST_HEADERS })
      if (res.ok) setMatrices(await res.json())
    } catch (err) {
      console.error('Failed to fetch matrices:', err)
    } finally {
      setLoading(false)
    }
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
      <div className="max-w-2xl mx-auto space-y-4">
        <button
          onClick={() => {
            if (view === 'library') { onBack() }
            else if (view === 'detail') { setView('library'); setSelected(null) }
            else if (view === 'edit') { setView('detail') }
            else { setView('library') }
          }}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft size={14} /> Back
        </button>

        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading...</div>
        ) : view === 'library' ? (
          <MatrixLibrary
            matrices={matrices}
            onSelect={m => { setSelected(m); setView('detail') }}
            onCreate={() => { setSelected(null); setView('create') }}
            onDelete={handleDelete}
            username={username}
          />
        ) : view === 'create' ? (
          <MatrixEditor
            onSave={handleSave}
            onCancel={() => setView('library')}
            username={username}
          />
        ) : view === 'edit' ? (
          <MatrixEditor
            initial={selected}
            onSave={handleSave}
            onCancel={() => setView('detail')}
            username={username}
          />
        ) : view === 'detail' && selected ? (
          <MatrixViewer
            matrix={selected}
            onEdit={() => setView('edit')}
            onBack={() => { setView('library'); setSelected(null) }}
          />
        ) : null}
      </div>
    </div>
  )
}
