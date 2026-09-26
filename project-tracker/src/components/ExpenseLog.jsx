import { useState, useEffect } from 'react'
import { useUser } from '../contexts/UserContext'
import { usePermissions } from '../hooks/usePermissions'
import { Receipt, Plus, X, Loader2, ExternalLink, Trash2, Check } from 'lucide-react'
import { Field, inputClass as input, todayLocal, prettyDate, newId } from './logForm'

const RECEIPT_BUCKET = 'expense-receipts'
const TEAMS = ['Programming', 'Business', 'Technical', 'Other']

// Straight to the storage REST API with the anon key, like the notebook's
// photos. supabase.storage.upload() runs auth.getSession() first, and on a
// phone waking up with an expired token that can hang forever — the upload
// never goes out and Submit stays stuck.
const UPLOAD_TIMEOUT_MS = 20000
async function uploadReceipt(supabaseUrl, supabaseKey, file) {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().slice(0, 5)
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS)
  try {
    const res = await fetch(`${supabaseUrl}/storage/v1/object/${RECEIPT_BUCKET}/${path}`, {
      method: 'POST',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': file.type || 'application/octet-stream',
        'x-upsert': 'false',
      },
      body: file,
      signal: controller.signal,
    })
    if (!res.ok) throw new Error(`upload ${res.status}: ${await res.text().catch(() => '')}`)
    return `${supabaseUrl}/storage/v1/object/public/${RECEIPT_BUCKET}/${path}`
  } finally {
    clearTimeout(timer)
  }
}

const BLANK = {
  purchase_date: todayLocal(),
  item: '',
  store: '',
  team: '',
  team_other: '',
  reimbursement: '',
}

export default function ExpenseLog() {
  const { username } = useUser()
  const { canOrganizeNotebook: isLead } = usePermissions()
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  const headers = { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ ...BLANK })
  const [file, setFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const res = await fetch(
          `${supabaseUrl}/rest/v1/expense_log?select=*&order=purchase_date.desc,created_at.desc`,
          { headers },
        )
        if (!res.ok) throw new Error(await res.text())
        const data = await res.json()
        if (alive) setRows(data)
      } catch (err) {
        // The table may not exist yet — the log reads as empty rather than
        // breaking the page.
        console.error('Failed to load expenses:', err)
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, []) // eslint-disable-line

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  // The form's own rule: a receipt is required when reimbursement is needed.
  const needsReceipt = form.reimbursement === 'Yes'
  const ready =
    form.purchase_date &&
    form.item.trim() &&
    form.store.trim() &&
    form.team &&
    (form.team !== 'Other' || form.team_other.trim()) &&
    form.reimbursement &&
    (!needsReceipt || !!file)

  const submit = async () => {
    if (!ready || saving) return
    setSaving(true)
    setError('')
    try {
      let receipt_url = null
      if (file) receipt_url = await uploadReceipt(supabaseUrl, supabaseKey, file)

      const row = {
        id: newId(),
        username,
        purchase_date: form.purchase_date,
        item: form.item.trim(),
        store: form.store.trim(),
        team: form.team,
        team_other: form.team === 'Other' ? form.team_other.trim() : null,
        reimbursement: form.reimbursement === 'Yes',
        receipt_url,
      }

      const res = await fetch(`${supabaseUrl}/rest/v1/expense_log`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify(row),
      })
      if (!res.ok) throw new Error(await res.text())

      setRows(prev => [row, ...prev])
      setForm({ ...BLANK })
      setFile(null)
      setShowForm(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      console.error('Failed to log expense:', err)
      setError('That didn’t save. Check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id) => {
    const keep = rows
    setRows(prev => prev.filter(r => r.id !== id))
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/expense_log?id=eq.${id}`, { method: 'DELETE', headers })
      if (!res.ok) throw new Error(await res.text())
    } catch (err) {
      console.error('Failed to remove expense:', err)
      setRows(keep) // put it back rather than letting it look deleted
    }
  }

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="px-4 py-3 ml-14 flex items-start justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-pastel-blue-dark via-pastel-pink-dark to-pastel-orange-dark bg-clip-text text-transparent">
              Expense Log
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">Log ALL team expenses here</p>
          </div>
          <button
            onClick={() => { setShowForm(v => !v); setError('') }}
            className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg bg-pastel-pink hover:bg-pastel-pink-dark transition-colors font-medium shrink-0"
          >
            {showForm ? <><X size={14} /> Close</> : <><Plus size={14} /> Log an expense</>}
          </button>
        </div>
      </header>

      <main className="flex-1 p-4 overflow-y-auto">
        <div className="max-w-2xl mx-auto space-y-3">

          {saved && (
            <div className="flex items-center justify-center gap-1.5 text-sm text-green-600 font-medium">
              <Check size={15} /> Logged.
            </div>
          )}

          {/* ── The form ─────────────────────────────────────────────────── */}
          {showForm && (
            <div className="space-y-3">
              <Field label="Date of Purchase" required>
                <input
                  type="date"
                  value={form.purchase_date}
                  onChange={e => set('purchase_date', e.target.value)}
                  className={input}
                />
              </Field>

              <Field label="What item was purchased?" required>
                <input
                  type="text"
                  value={form.item}
                  onChange={e => set('item', e.target.value)}
                  placeholder="Your answer"
                  className={input}
                />
              </Field>

              <Field label="Link or name of store purchased from" required>
                <input
                  type="text"
                  value={form.store}
                  onChange={e => set('store', e.target.value)}
                  placeholder="Your answer"
                  className={input}
                />
              </Field>

              <Field label="What team was the purchase for?" required>
                <div className="space-y-2">
                  {TEAMS.map(t => (
                    <label key={t} className="flex items-center gap-2.5 cursor-pointer text-sm text-gray-600">
                      <input
                        type="radio"
                        name="team"
                        checked={form.team === t}
                        onChange={() => set('team', t)}
                        className="accent-pastel-pink-dark w-4 h-4"
                      />
                      {t === 'Other' ? (
                        <span className="flex items-center gap-2 flex-1">
                          Other:
                          <input
                            type="text"
                            value={form.team_other}
                            onChange={e => { set('team_other', e.target.value); set('team', 'Other') }}
                            className="flex-1 border-b border-dotted border-gray-300 text-sm focus:outline-none focus:border-pastel-blue-dark bg-transparent"
                          />
                        </span>
                      ) : t}
                    </label>
                  ))}
                </div>
              </Field>

              <Field label="Is reimbursement needed?" required>
                <div className="space-y-2">
                  {['Yes', 'No'].map(v => (
                    <label key={v} className="flex items-center gap-2.5 cursor-pointer text-sm text-gray-600">
                      <input
                        type="radio"
                        name="reimbursement"
                        checked={form.reimbursement === v}
                        onChange={() => set('reimbursement', v)}
                        className="accent-pastel-pink-dark w-4 h-4"
                      />
                      {v}
                    </label>
                  ))}
                </div>
              </Field>

              <Field label={`Upload image of receipt${needsReceipt ? '' : ' (optional unless reimbursement is needed)'}`} required={needsReceipt}>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={e => setFile(e.target.files?.[0] || null)}
                  className="text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-pastel-blue/30 file:text-gray-700 hover:file:bg-pastel-blue/50 file:cursor-pointer"
                />
                {needsReceipt && !file && (
                  <p className="text-xs text-pastel-pink-dark mt-2">
                    A receipt is required to be reimbursed.
                  </p>
                )}
              </Field>

              {error && <p className="text-sm text-red-500 text-center">{error}</p>}

              <button
                onClick={submit}
                disabled={!ready || saving}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-pastel-pink hover:bg-pastel-pink-dark disabled:bg-gray-100 disabled:text-gray-400 transition-colors font-medium text-gray-800"
              >
                {saving ? <><Loader2 size={15} className="animate-spin" /> Saving…</> : 'Submit'}
              </button>
            </div>
          )}

          {/* ── The log ──────────────────────────────────────────────────── */}
          {!showForm && (
            loading ? (
              <p className="text-sm text-gray-400 text-center py-10">Loading…</p>
            ) : rows.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
                <Receipt size={36} className="mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500 font-medium">Nothing logged yet.</p>
                <p className="text-sm text-gray-400 mt-1">
                  Log an expense and it shows up here.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {rows.map(r => (
                  <div key={r.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-800 truncate">{r.item}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {prettyDate(r.purchase_date)}
                          <span className="mx-1.5 text-gray-300">·</span>
                          {r.store}
                          <span className="mx-1.5 text-gray-300">·</span>
                          {r.team === 'Other' ? (r.team_other || 'Other') : r.team}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">Logged by {r.username}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {r.reimbursement && (
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-pastel-orange/40 text-gray-700">
                            Reimburse
                          </span>
                        )}
                        {r.receipt_url && (
                          <a
                            href={r.receipt_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-pastel-blue-dark hover:underline flex items-center gap-1"
                          >
                            <ExternalLink size={12} /> Receipt
                          </a>
                        )}
                        {/* Your own mistakes, and a lead can clear anyone's. */}
                        {(isLead || r.username === username) && (
                          <button
                            onClick={() => remove(r.id)}
                            className="text-gray-300 hover:text-red-400 transition-colors"
                            title="Remove this expense"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </main>
    </div>
  )
}
