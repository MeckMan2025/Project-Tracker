import { useState, useEffect, useMemo } from 'react'
import { useUser } from '../contexts/UserContext'
import { usePermissions } from '../hooks/usePermissions'
import { Plus, X, Check, Loader2, Trash2, Download, Pencil } from 'lucide-react'
import {
  SCOUTING_FIELDS, SCOUTING_GROUPS, NUMERIC_FIELDS, blankEntry,
} from '../data/scoutingFields'

// Match scouting: one row per team per match.
//
// The form, the table, the per-team averages and the CSV all read the same
// field definitions, so a season that changes the game changes one file.

const TABLE = 'match_scouting'

export default function ScoutingForm() {
  const { username } = useUser()
  const { hasLeadTag } = usePermissions()
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  const headers = { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [unavailable, setUnavailable] = useState(false)
  const [form, setForm] = useState(blankEntry())
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [editing, setEditing] = useState(false)
  const [view, setView] = useState('matches')   // matches | teams
  const [teamFilter, setTeamFilter] = useState('')

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const res = await fetch(`${supabaseUrl}/rest/v1/${TABLE}?select=*&order=created_at.desc`, { headers })
        if (!res.ok) {
          const body = await res.text().catch(() => '')
          // The table doesn't exist until the migration runs. Say so plainly
          // rather than showing an empty page that looks like lost data.
          if (alive && /match_scouting|relation/i.test(body)) setUnavailable(true)
          throw new Error(body)
        }
        const data = await res.json()
        if (alive) setRows(Array.isArray(data) ? data : [])
      } catch (err) {
        console.error('Failed to load scouting:', err)
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, []) // eslint-disable-line

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const ready = form.team_number.toString().trim() && form.match_number.toString().trim()

  const submit = async () => {
    if (!ready || saving) return
    setSaving(true); setError('')
    try {
      const row = { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, scout: username }
      SCOUTING_FIELDS.forEach(f => {
        const raw = form[f.key]
        if (raw === '' || raw == null) { row[f.key] = null; return }
        row[f.key] = (f.type === 'number' || f.type === 'scale') ? Number(raw) : String(raw).trim()
      })
      const res = await fetch(`${supabaseUrl}/rest/v1/${TABLE}`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify(row),
      })
      if (!res.ok) throw new Error(await res.text())
      setRows(prev => [{ ...row, created_at: new Date().toISOString() }, ...prev])
      // Team and match stay: scouting is one team after another in the same
      // match, or the same team match after match. Retyping them every time is
      // the fastest way to put people off doing it.
      setForm({ ...blankEntry(), team_number: form.team_number, match_number: form.match_number })
      setSaved(true); setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      console.error('Failed to save scouting row:', err)
      setError("Couldn't save — your entry is still here. Check your connection and try again.")
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id) => {
    const keep = rows
    setRows(prev => prev.filter(r => r.id !== id))
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/${TABLE}?id=eq.${id}`, { method: 'DELETE', headers })
      if (!res.ok) throw new Error(await res.text())
    } catch (err) {
      console.error('Failed to remove row:', err)
      setRows(keep)
    }
  }

  const teams = useMemo(
    () => Array.from(new Set(rows.map(r => r.team_number).filter(Boolean)))
      .sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true })),
    [rows])

  const shown = useMemo(
    () => (teamFilter ? rows.filter(r => String(r.team_number) === teamFilter) : rows),
    [rows, teamFilter])

  // Per-team averages. A blank is skipped rather than counted as zero — a scout
  // who didn't see something must not drag a team's average down.
  const byTeam = useMemo(() => teams.map(t => {
    const mine = rows.filter(r => String(r.team_number) === String(t))
    const avg = {}
    NUMERIC_FIELDS.forEach(f => {
      const vals = mine.map(r => r[f.key]).filter(v => v != null && v !== '')
      avg[f.key] = vals.length ? Math.round((vals.reduce((a, b) => a + Number(b), 0) / vals.length) * 10) / 10 : null
    })
    return { team: t, matches: mine.length, avg }
  }), [teams, rows])

  const exportCsv = () => {
    const cols = ['team_number', 'match_number', ...SCOUTING_FIELDS.map(f => f.key).filter(k => k !== 'team_number' && k !== 'match_number'), 'scout', 'created_at']
    const esc = (v) => {
      const s = v == null ? '' : String(v)
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const csv = [cols.join(','), ...shown.map(r => cols.map(c => esc(r[c])).join(','))].join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `scouting-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return <Frame><p className="text-sm text-gray-400 text-center py-12">Loading…</p></Frame>

  if (unavailable) {
    return (
      <Frame>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-10 text-center">
          <p className="text-gray-600 font-medium">Not set up yet.</p>
          <p className="text-sm text-gray-400 mt-1 max-w-md mx-auto">
            Scouting needs its table before anything can be saved. Run{' '}
            <code className="text-gray-500">supabase/match_scouting.sql</code>, then reload.
          </p>
        </div>
      </Frame>
    )
  }

  return (
    <Frame
      sub={`${rows.length} ${rows.length === 1 ? 'match scouted' : 'matches scouted'}${teams.length ? ` · ${teams.length} teams` : ''}`}
      action={
        <button
          onClick={() => { setShowForm(v => !v); setError('') }}
          className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg bg-pastel-pink hover:bg-pastel-pink-dark transition-colors font-medium shrink-0"
        >
          {showForm ? <><X size={14} /> Close</> : <><Plus size={14} /> Scout a match</>}
        </button>
      }
    >
      {saved && (
        <div className="flex items-center justify-center gap-1.5 text-sm text-green-600 font-medium">
          <Check size={15} /> Saved — team and match kept for the next one.
        </div>
      )}

      {showForm ? (
        <div className="space-y-3">
          {SCOUTING_GROUPS.map(group => (
            <section key={group} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <h2 className="font-semibold text-gray-700 mb-2">{group}</h2>
              <div className="space-y-3">
                {SCOUTING_FIELDS.filter(f => f.group === group).map(f => (
                  <Field key={f.key} field={f} value={form[f.key]} onChange={v => set(f.key, v)} />
                ))}
              </div>
            </section>
          ))}

          {error && <p className="text-sm text-red-500 text-center">{error}</p>}

          <button
            onClick={submit}
            disabled={!ready || saving}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-pastel-pink hover:bg-pastel-pink-dark disabled:bg-gray-100 disabled:text-gray-400 transition-colors font-medium text-gray-800"
          >
            {saving ? <><Loader2 size={15} className="animate-spin" /> Saving…</> : 'Save match'}
          </button>
          {!ready && (
            <p className="text-xs text-gray-400 text-center -mt-1">
              Still needed: team number and match number.
            </p>
          )}
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
          <p className="text-gray-500 font-medium">Nothing scouted yet.</p>
          <p className="text-sm text-gray-400 mt-1">Scout a match and it shows up here.</p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-1.5 flex-wrap text-xs">
            {[['matches', 'By match'], ['teams', 'By team']].map(([v, label]) => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                  view === v ? 'bg-pastel-pink text-gray-800' : 'bg-white text-gray-500 border border-gray-200 hover:bg-pastel-blue/20'
                }`}>
                {label}
              </button>
            ))}
            {teams.length > 1 && (
              <select value={teamFilter} onChange={e => setTeamFilter(e.target.value)}
                      className="border rounded-lg px-2 py-1 text-xs">
                <option value="">All teams</option>
                {teams.map(t => <option key={t} value={t}>Team {t}</option>)}
              </select>
            )}
            <button onClick={exportCsv}
                    className="ml-auto flex items-center gap-1 px-2.5 py-1 rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-pastel-blue/20">
              <Download size={13} /> CSV
            </button>
            {hasLeadTag && (
              <button onClick={() => setEditing(v => !v)}
                      className={`p-1.5 rounded-lg transition-colors ${editing ? 'bg-pastel-pink text-gray-800' : 'text-gray-400 hover:bg-pastel-blue/25'}`}
                      title={editing ? 'Done' : 'Remove rows'}>
                {editing ? <Check size={14} /> : <Pencil size={14} />}
              </button>
            )}
          </div>

          {view === 'matches'
            ? <MatchTable rows={shown} editing={editing} onRemove={remove} />
            : <TeamTable rows={byTeam.filter(t => !teamFilter || String(t.team) === teamFilter)} />}
        </>
      )}
    </Frame>
  )
}

/* ── Layout ──────────────────────────────────────────────────────────────── */

function Frame({ sub, action, children }) {
  return (
    <div className="flex-1 flex flex-col min-w-0">
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="px-4 py-3 ml-14 flex items-start justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-pastel-blue-dark via-pastel-pink-dark to-pastel-orange-dark bg-clip-text text-transparent">
              Scouting
            </h1>
            {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
          </div>
          {action}
        </div>
      </header>
      <main className="flex-1 p-4 overflow-y-auto">
        <div className="max-w-3xl mx-auto space-y-3">{children}</div>
      </main>
    </div>
  )
}

function Field({ field: f, value, onChange }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700">
        {f.label} {f.required && <span className="text-pastel-pink-dark">*</span>}
      </label>
      {f.hint && <p className="text-[11px] text-gray-400 mb-1">{f.hint}</p>}

      {f.type === 'number' ? (
        <input type="number" inputMode="numeric" min="0" value={value}
               onChange={e => onChange(e.target.value)} placeholder="0"
               className="w-28 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-pastel-blue focus:border-transparent" />
      ) : f.type === 'text' && f.key === 'comments' ? (
        <textarea rows={2} value={value} onChange={e => onChange(e.target.value)}
                  placeholder="Anything unusual"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-pastel-blue focus:border-transparent" />
      ) : f.type === 'text' ? (
        <input type="text" value={value} onChange={e => onChange(e.target.value)}
               placeholder={f.hint}
               className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-pastel-blue focus:border-transparent" />
      ) : f.type === 'scale' ? (
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: f.max - f.min + 1 }, (_, i) => f.min + i).map(n => (
            <button key={n} type="button"
                    onClick={() => onChange(value === String(n) ? '' : String(n))}
                    className={`w-9 h-9 rounded-lg text-sm font-semibold border transition-colors ${
                      String(value) === String(n)
                        ? 'border-pastel-pink-dark bg-pastel-pink/30 text-gray-800'
                        : 'border-gray-200 bg-white text-gray-500 hover:bg-pastel-blue/15'
                    }`}>
              {n}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {f.options.map(opt => (
            <button key={opt} type="button"
                    onClick={() => onChange(value === opt ? '' : opt)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      value === opt
                        ? 'border-pastel-pink-dark bg-pastel-pink/30 text-gray-800'
                        : 'border-gray-200 bg-white text-gray-500 hover:bg-pastel-blue/15'
                    }`}>
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const COMPACT = ['match_number', 'auto_scored', 'teleop_scored', 'cycle_count',
                 'defense', 'endgame', 'driver_skill', 'consistency', 'breakdowns']

function MatchTable({ rows, editing, onRemove }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
            <th className="px-3 py-2 font-semibold whitespace-nowrap">Team</th>
            {COMPACT.map(k => {
              const f = SCOUTING_FIELDS.find(x => x.key === k)
              return <th key={k} className="px-3 py-2 font-semibold whitespace-nowrap">{f.label}</th>
            })}
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} className="border-b border-gray-50 last:border-0 align-top">
              <td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap">{r.team_number}</td>
              {COMPACT.map(k => (
                <td key={k} className="px-3 py-2 text-gray-600 whitespace-nowrap">
                  {r[k] == null || r[k] === '' ? <span className="text-gray-300">—</span> : String(r[k])}
                </td>
              ))}
              <td className="px-3 py-2 text-right">
                {editing && (
                  <button onClick={() => onRemove(r.id)} title="Remove this row"
                          className="text-gray-300 hover:text-red-400 transition-colors">
                    <Trash2 size={14} />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {/* Comments don't fit a column, but they are the most useful thing a
          scout writes, so they sit under the table rather than being lost. */}
      {rows.some(r => r.comments) && (
        <div className="border-t border-gray-100 p-3 space-y-1.5">
          {rows.filter(r => r.comments).map(r => (
            <p key={r.id} className="text-xs text-gray-500">
              <span className="font-medium text-gray-700">{r.team_number}</span>
              <span className="text-gray-400"> · match {r.match_number} — </span>
              {r.comments}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

function TeamTable({ rows }) {
  const cols = NUMERIC_FIELDS
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
            <th className="px-3 py-2 font-semibold whitespace-nowrap">Team</th>
            <th className="px-3 py-2 font-semibold whitespace-nowrap">Matches</th>
            {cols.map(f => <th key={f.key} className="px-3 py-2 font-semibold whitespace-nowrap">{f.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map(t => (
            <tr key={t.team} className="border-b border-gray-50 last:border-0">
              <td className="px-3 py-2 font-medium text-gray-800">{t.team}</td>
              <td className="px-3 py-2 text-gray-400">{t.matches}</td>
              {cols.map(f => (
                <td key={f.key} className="px-3 py-2 text-gray-600 whitespace-nowrap">
                  {t.avg[f.key] == null ? <span className="text-gray-300">—</span> : t.avg[f.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-[11px] text-gray-400 px-3 py-2 border-t border-gray-100">
        Averages across every match scouted. A blank is skipped, not counted as
        zero — a scout who didn't see something shouldn't drag a team down.
      </p>
    </div>
  )
}
