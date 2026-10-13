import { useState, useEffect, useMemo } from 'react'
import { restHeaders } from '../lib/restHeaders'
import { useUser } from '../contexts/UserContext'
import { usePermissions } from '../hooks/usePermissions'
import { Check, Loader2, ArrowRight, ArrowLeft, ClipboardList } from 'lucide-react'
import { PIT_FIELDS, PIT_GROUPS, blankPitEntry } from '../data/pitFields'
import { ALL_TEAMS } from '../data/teams'
import { teamScope } from '../lib/teamScope'

// Pit scouting: one row per team you visit.
//
// Same machinery as match scouting — the field definitions drive the pages,
// the inputs and the saved row — and deliberately the same look, because a
// scout should not have to learn two forms on the one day they have no time to.
//
// What is different is the attitude to blanks. Match scouting refuses a
// half-filled row, because an average built from partial rows is a lie. A pit
// sheet is a conversation with whoever is standing there: the robot may be in
// pieces, the driver may be in a match, and "I did not get to ask" is a real
// answer. Only the team and the scout's name are required.

const TABLE = 'pit_scouting'

export default function PitScoutingForm() {
  const { username } = useUser()
  const { myTeamNumber } = usePermissions()
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const headers = restHeaders()

  const [form, setForm] = useState(() => ({
    ...blankPitEntry(),
    scout_name: username || '',
    visited_at: new Date().toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    }),
  }))
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [rows, setRows] = useState([])
  const [unavailable, setUnavailable] = useState(false)

  const SCOPE = teamScope(myTeamNumber)

  // What has already been scouted, so the form can say so rather than letting
  // two people write the same team up twice without noticing.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(
          `${supabaseUrl}/rest/v1/${TABLE}?${SCOPE}&select=id,team_number,scout_name,created_at&order=created_at.desc`,
          { headers },
        )
        if (!res.ok) { if (!cancelled) setUnavailable(true); return }
        const data = await res.json()
        if (!cancelled) setRows(Array.isArray(data) ? data : [])
      } catch { if (!cancelled) setUnavailable(true) }
    })()
    return () => { cancelled = true }
  }, [myTeamNumber]) // eslint-disable-line

  const set = (key, value) => { setForm(f => ({ ...f, [key]: value })); setError('') }

  const pages = PIT_GROUPS
  const fieldsOn = (group) => PIT_FIELDS.filter(f => f.group === group)
  const onLast = step === pages.length - 1

  // Only what we will not guess at. Everything else can be blank.
  const missing = PIT_FIELDS.filter(f => f.required && !String(form[f.key] || '').trim())
  const ready = missing.length === 0

  const already = useMemo(() => {
    const t = String(form.team_number || '').trim()
    if (!t) return null
    return rows.find(r => String(r.team_number).trim() === t) || null
  }, [form.team_number, rows])

  const submit = async () => {
    if (!ready || saving) return
    setSaving(true); setError('')
    try {
      const row = { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, scout: username }
      PIT_FIELDS.forEach(f => {
        const raw = form[f.key]
        row[f.key] = raw === '' || raw == null ? null : String(raw).trim()
      })
      // Whose row this is. team_number is the team being scouted, so the owner
      // lives in its own column.
      const mine = String(myTeamNumber || '').trim()
      if (mine && mine !== '7196') row.team_number_owner = mine

      const res = await fetch(`${supabaseUrl}/rest/v1/${TABLE}`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify(row),
      })
      if (!res.ok) throw new Error(await res.text())
      setRows(prev => [{ ...row, created_at: new Date().toISOString() }, ...prev])
      setStep(0)
      // A fresh sheet for the next pit, keeping who you are and roughly when.
      setForm({
        ...blankPitEntry(),
        scout_name: form.scout_name,
        visited_at: new Date().toLocaleString('en-US', {
          month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
        }),
      })
      setSaved(true); setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      console.error('Failed to save pit row:', err)
      setError("Couldn't save — your answers are still here. Check your connection and try again.")
    } finally {
      setSaving(false)
    }
  }

  const input = 'w-full border-2 border-pastel-yellow-dark/30 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-pastel-yellow-dark focus:border-transparent'
  const chip = (on) => `px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
    on ? 'border-pastel-yellow-dark bg-pastel-yellow text-gray-900 shadow-sm'
       : 'border-pastel-yellow-dark/25 bg-white text-gray-500 hover:bg-pastel-yellow/35'}`

  const Field = ({ f }) => (
    <div className="mb-4">
      <label className="block text-sm font-semibold text-gray-700 mb-0.5">
        {f.label}{f.required && <span className="text-pastel-orange-dark"> *</span>}
      </label>
      {f.hint && <p className="text-[11px] text-gray-400 mb-1">{f.hint}</p>}

      {f.key === 'team_number' ? (
        <>
          <input type="text" inputMode="numeric" value={form.team_number}
                 onChange={e => {
                   const v = e.target.value
                   const known = ALL_TEAMS.find(t => String(t.number) === v.trim())
                   setForm(f2 => ({ ...f2, team_number: v, team_name: known ? known.name : f2.team_name }))
                 }}
                 placeholder="Team number" className={input} />
          {already && (
            <p className="text-[11px] text-pastel-orange-dark mt-1">
              Already scouted by {already.scout_name || 'someone'}. Saving adds a second visit.
            </p>
          )}
        </>
      ) : f.type === 'choice' ? (
        <div className="flex flex-wrap gap-1.5">
          {f.options.map(opt => (
            <button key={opt} type="button"
                    onClick={() => set(f.key, form[f.key] === opt ? '' : opt)}
                    className={chip(form[f.key] === opt)}>
              {opt}
            </button>
          ))}
        </div>
      ) : f.type === 'photo' ? (
        <input type="url" value={form[f.key]} onChange={e => set(f.key, e.target.value)}
               placeholder="Paste a link to a photo" className={input} />
      ) : ['strengths', 'weaknesses', 'final_notes', 'alliance_why', 'known_problems', 'auto_what'].includes(f.key) ? (
        <textarea rows={2} value={form[f.key]} onChange={e => set(f.key, e.target.value)}
                  placeholder="Short answer" className={input} />
      ) : (
        <input type="text" value={form[f.key]} onChange={e => set(f.key, e.target.value)}
               placeholder={f.hint || 'Short answer'} className={input} />
      )}
    </div>
  )

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="px-4 py-3 ml-14 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-xl font-bold bg-gradient-to-r from-pastel-yellow-dark via-pastel-orange-dark to-pastel-orange-dark bg-clip-text text-transparent">
              Pit Scouting
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">
              {pages[step]} · {step + 1} of {pages.length}
              {rows.length > 0 && ` · ${rows.length} pit${rows.length === 1 ? '' : 's'} done`}
            </p>
          </div>
          <ClipboardList size={18} className="text-pastel-yellow-dark shrink-0" />
        </div>
        <div className="h-1 bg-gray-100">
          <div className="h-1 bg-pastel-yellow-dark transition-all"
               style={{ width: `${((step + 1) / pages.length) * 100}%` }} />
        </div>
      </header>

      <main className="flex-1 p-4 overflow-y-auto">
        <div className="max-w-xl mx-auto">
          {saved && (
            <div className="flex items-center justify-center gap-1.5 text-sm text-green-600 font-medium mb-3">
              <Check size={15} /> Saved.
            </div>
          )}
          {unavailable && (
            <p className="text-sm text-pastel-orange-dark mb-3">
              The pit scouting table isn't set up yet — run supabase/pit_scouting.sql.
            </p>
          )}

          <h2 className="text-base font-bold text-gray-800 mb-3">{pages[step]}</h2>
          {fieldsOn(pages[step]).map(f => <Field key={f.key} f={f} />)}

          {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

          <div className="flex items-center justify-between gap-2 mt-5">
            <button type="button" onClick={() => setStep(s => Math.max(0, s - 1))}
                    disabled={step === 0}
                    className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium text-gray-500 disabled:opacity-40">
              <ArrowLeft size={15} /> Back
            </button>

            {onLast ? (
              <button type="button" onClick={submit} disabled={!ready || saving}
                      title={ready ? '' : `Still needed: ${missing.map(f => f.label).join(', ')}`}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                        ready && !saving
                          ? 'bg-pastel-yellow hover:bg-pastel-yellow-dark text-gray-800'
                          : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}>
                {saving ? <><Loader2 size={15} className="animate-spin" /> Saving…</> : <><Check size={15} /> Save pit</>}
              </button>
            ) : (
              <button type="button" onClick={() => setStep(s => Math.min(pages.length - 1, s + 1))}
                      className="flex items-center gap-1 px-4 py-2 rounded-lg bg-pastel-yellow hover:bg-pastel-yellow-dark text-gray-800 text-sm font-semibold transition-colors">
                Next <ArrowRight size={15} />
              </button>
            )}
          </div>

          {!ready && onLast && (
            <p className="text-[11px] text-gray-400 mt-2 text-right">
              Still needed: {missing.map(f => f.label).join(', ')}
            </p>
          )}
        </div>
      </main>
    </div>
  )
}
