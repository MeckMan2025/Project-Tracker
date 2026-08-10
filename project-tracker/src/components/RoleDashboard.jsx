import { useState, useEffect } from 'react'
import { Plus, Trash2, X, ChevronDown, Eye, EyeOff } from 'lucide-react'
import { SIDE_THEME, sideForRole, uid } from '../data/roleTrackers'

// ── Single tracker card ──
function TrackerCard({ tracker, editable, onChange, onDelete, theme }) {
  const [draft, setDraft] = useState(tracker.value)
  useEffect(() => { setDraft(tracker.value) }, [tracker.value])

  const commit = (val) => onChange({ ...tracker, value: val })

  const badge = tracker.visibility === 'public'
    ? { label: 'Public', cls: 'bg-green-100 text-green-700', Icon: Eye }
    : { label: 'Role', cls: 'bg-gray-100 text-gray-500', Icon: EyeOff }

  const toggleVisibility = () => onChange({ ...tracker, visibility: tracker.visibility === 'public' ? 'role' : 'public' })

  return (
    <div className={`bg-white rounded-xl border p-3.5 shadow-sm ${theme.ring}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="text-sm font-bold text-gray-700 leading-tight">{tracker.name}</h4>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={editable ? toggleVisibility : undefined}
            disabled={!editable}
            title={editable ? 'Toggle Public / Role-only' : badge.label}
            className={`flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${badge.cls} ${editable ? 'hover:opacity-80' : ''}`}
          >
            <badge.Icon size={10} /> {badge.label}
          </button>
          {editable && (
            <button onClick={() => onDelete(tracker.id)} className="p-1 rounded hover:bg-red-50" title="Delete tracker">
              <Trash2 size={13} className="text-gray-300 hover:text-red-400" />
            </button>
          )}
        </div>
      </div>

      {/* NUMBER */}
      {tracker.type === 'number' && (
        editable ? (
          <div className="flex items-baseline gap-1">
            {tracker.unit === '$' && <span className="text-lg font-black text-gray-400">$</span>}
            <input
              type="number"
              value={draft}
              onChange={e => setDraft(e.target.value === '' ? '' : Number(e.target.value))}
              onBlur={() => commit(Number(draft) || 0)}
              className="w-24 text-2xl font-black text-gray-800 border-b border-gray-200 focus:border-pastel-blue focus:outline-none"
            />
            {tracker.unit && tracker.unit !== '$' && <span className="text-sm text-gray-400">{tracker.unit}</span>}
          </div>
        ) : (
          <p className="text-2xl font-black text-gray-800">
            {tracker.unit === '$' ? '$' : ''}{tracker.value}{tracker.unit && tracker.unit !== '$' ? ` ${tracker.unit}` : ''}
          </p>
        )
      )}

      {/* PROGRESS */}
      {tracker.type === 'progress' && (() => {
        const target = tracker.target || 100
        const val = Number(tracker.value) || 0
        const pct = Math.max(0, Math.min(100, Math.round((val / target) * 100)))
        return (
          <div>
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-sm font-bold text-gray-700">
                {tracker.unit === '$' ? '$' : ''}{val}{tracker.unit === '%' ? '' : tracker.unit === '$' ? '' : ''} / {tracker.unit === '$' ? '$' : ''}{target}{tracker.unit === '%' ? '%' : ''}
              </span>
              <span className="text-xs text-gray-400">{pct}%</span>
            </div>
            <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
              <div className={`h-full rounded-full ${theme.bar} transition-all`} style={{ width: `${pct}%` }} />
            </div>
            {editable && (
              <input
                type="number"
                value={draft}
                onChange={e => setDraft(e.target.value === '' ? '' : Number(e.target.value))}
                onBlur={() => commit(Number(draft) || 0)}
                className="mt-2 w-full text-sm border rounded-lg px-2 py-1 focus:ring-2 focus:ring-pastel-blue focus:border-transparent"
                placeholder="Update value"
              />
            )}
          </div>
        )
      })()}

      {/* CHECKLIST */}
      {tracker.type === 'checklist' && (() => {
        const items = Array.isArray(tracker.value) ? tracker.value : []
        const done = items.filter(i => i.done).length
        const toggle = (i) => commit(items.map((it, idx) => idx === i ? { ...it, done: !it.done } : it))
        const removeItem = (i) => commit(items.filter((_, idx) => idx !== i))
        const addItem = (text) => text.trim() && commit([...items, { text: text.trim(), done: false }])
        return (
          <div>
            {items.length > 0 && <p className="text-[11px] text-gray-400 mb-1.5">{done}/{items.length} done</p>}
            <div className="space-y-1">
              {items.map((it, i) => (
                <div key={i} className="flex items-center gap-2 group">
                  <input type="checkbox" checked={!!it.done} disabled={!editable} onChange={() => toggle(i)} className="accent-pastel-pink-dark shrink-0" />
                  <span className={`text-sm flex-1 ${it.done ? 'line-through text-gray-300' : 'text-gray-600'}`}>{it.text}</span>
                  {editable && (
                    <button onClick={() => removeItem(i)} className="opacity-0 group-hover:opacity-100 p-0.5"><X size={12} className="text-gray-300 hover:text-red-400" /></button>
                  )}
                </div>
              ))}
              {items.length === 0 && <p className="text-xs italic text-gray-300">Nothing yet</p>}
            </div>
            {editable && (
              <input
                type="text"
                placeholder="+ Add item, press Enter"
                onKeyDown={e => { if (e.key === 'Enter') { addItem(e.target.value); e.target.value = '' } }}
                className="mt-2 w-full text-sm border rounded-lg px-2 py-1 focus:ring-2 focus:ring-pastel-blue focus:border-transparent"
              />
            )}
          </div>
        )
      })()}

      {/* NOTE */}
      {tracker.type === 'note' && (
        editable ? (
          <textarea
            rows={3}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={() => commit(draft)}
            placeholder="Write an update…"
            className="w-full text-sm border rounded-lg px-2 py-1 focus:ring-2 focus:ring-pastel-blue focus:border-transparent resize-none"
          />
        ) : (
          <p className="text-sm text-gray-600 whitespace-pre-wrap">{tracker.value || <span className="italic text-gray-300">No update yet</span>}</p>
        )
      )}
    </div>
  )
}

// ── Add-tracker form ──
const TYPES = [
  { value: 'number', label: 'Number' },
  { value: 'progress', label: 'Progress bar' },
  { value: 'checklist', label: 'Checklist' },
  { value: 'note', label: 'Note' },
]
function AddTracker({ role, onAdd, onCancel }) {
  const [name, setName] = useState('')
  const [type, setType] = useState('number')
  const [visibility, setVisibility] = useState('public')
  const [unit, setUnit] = useState('')
  const [target, setTarget] = useState(100)

  const submit = () => {
    if (!name.trim()) return
    const t = { id: uid(), role, name: name.trim(), type, visibility }
    if (type === 'number') { t.value = 0; if (unit) t.unit = unit }
    else if (type === 'progress') { t.value = 0; t.target = Number(target) || 100; if (unit) t.unit = unit }
    else if (type === 'checklist') t.value = []
    else t.value = ''
    onAdd(t)
  }

  return (
    <div className="bg-white rounded-xl border p-3.5 shadow-sm space-y-2">
      <input value={name} onChange={e => setName(e.target.value)} placeholder="Tracker name" autoFocus className="w-full text-sm border rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-pastel-blue focus:border-transparent" />
      <div className="flex gap-2">
        <select value={type} onChange={e => setType(e.target.value)} className="flex-1 text-sm border rounded-lg px-2 py-1.5 bg-white">
          {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <select value={visibility} onChange={e => setVisibility(e.target.value)} className="flex-1 text-sm border rounded-lg px-2 py-1.5 bg-white">
          <option value="public">Public (Data tab)</option>
          <option value="role">Role-only (dashboard)</option>
        </select>
      </div>
      {(type === 'number' || type === 'progress') && (
        <div className="flex gap-2">
          <input value={unit} onChange={e => setUnit(e.target.value)} placeholder="Unit (e.g. $, %)" className="flex-1 text-sm border rounded-lg px-2 py-1.5" />
          {type === 'progress' && <input type="number" value={target} onChange={e => setTarget(e.target.value)} placeholder="Target" className="w-24 text-sm border rounded-lg px-2 py-1.5" />}
        </div>
      )}
      <div className="flex gap-2 pt-1">
        <button onClick={onCancel} className="flex-1 text-sm border rounded-lg py-1.5 hover:bg-gray-50">Cancel</button>
        <button onClick={submit} disabled={!name.trim()} className="flex-1 text-sm bg-pastel-pink hover:bg-pastel-pink-dark disabled:opacity-50 rounded-lg py-1.5 font-semibold text-gray-700">Add</button>
      </div>
    </div>
  )
}

// ── A role's dashboard section ──
export default function RoleDashboard({ role, trackers, upsertTracker, removeTracker, editable = false, publicOnly = false, collapsible = false, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  const [adding, setAdding] = useState(false)
  const theme = SIDE_THEME[sideForRole(role)]

  let list = trackers.filter(t => t.role === role)
  if (publicOnly) list = list.filter(t => t.visibility === 'public')

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={collapsible ? () => setOpen(o => !o) : undefined}
          className={`flex items-center gap-2 ${collapsible ? 'cursor-pointer' : 'cursor-default'}`}
        >
          {collapsible && <ChevronDown size={16} className={`text-gray-400 transition-transform ${open ? '' : '-rotate-90'}`} />}
          <h3 className={`text-base font-black ${theme.text}`}>{role}</h3>
          <span className="text-xs text-gray-400">({list.length})</span>
        </button>
        {editable && open && (
          <button onClick={() => setAdding(a => !a)} className="flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-700 px-2 py-1 rounded-lg hover:bg-gray-100">
            <Plus size={13} /> Tracker
          </button>
        )}
      </div>

      {open && (
        <>
          {adding && editable && (
            <div className="mb-3">
              <AddTracker role={role} onAdd={(t) => { upsertTracker(t); setAdding(false) }} onCancel={() => setAdding(false)} />
            </div>
          )}
          {list.length === 0 && !adding ? (
            <p className="text-sm text-gray-400 mb-2">{publicOnly ? 'No public trackers yet.' : 'No trackers yet.'}</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {list.map(t => (
                <TrackerCard key={t.id} tracker={t} editable={editable} theme={theme} onChange={upsertTracker} onDelete={removeTracker} />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  )
}
