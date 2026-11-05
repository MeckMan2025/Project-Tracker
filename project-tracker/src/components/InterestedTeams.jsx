import { useState, useEffect } from 'react'
import { onlyMyTeam, storedTeamScope } from '../lib/teamScope'
import { restHeaders } from '../lib/restHeaders'
import { ArrowLeft, Users, Trash2 } from 'lucide-react'
import { supabase } from '../supabase'

function InterestedTeams({ onBack, canDelete }) {
  const [submissions, setSubmissions] = useState([])
  // The starter survey a team fills in on its first sign-in (TeamHomeView).
  const [surveys, setSurveys] = useState([])
  const [loading, setLoading] = useState(true)

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  const headers = restHeaders({ 'Content-Type': 'application/json' })

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(
          `${supabaseUrl}/rest/v1/interested_teams?${storedTeamScope()}&select=*&order=created_at.desc`,
          { headers }
        )
        if (res.ok) setSubmissions(await res.json())
        const sRes = await fetch(`${supabaseUrl}/rest/v1/team_survey_responses?select=*&order=submitted_at.desc`, { headers })
        if (sRes.ok) setSurveys(await sRes.json())
      } catch (err) {
        console.error('Failed to load interested teams:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('interested-teams-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'interested_teams' }, onlyMyTeam((payload) => {
        setSubmissions(prev => {
          if (prev.some(s => s.id === payload.new.id)) return prev
          return [payload.new, ...prev]
        })
      }))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'interested_teams' }, onlyMyTeam((payload) => {
        setSubmissions(prev => prev.filter(s => s.id !== payload.old.id))
      }))
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const handleDelete = async (id) => {
    try {
      await fetch(`${supabaseUrl}/rest/v1/interested_teams?id=eq.${id}`, {
        method: 'DELETE',
        headers,
      })
      setSubmissions(prev => prev.filter(s => s.id !== id))
    } catch (err) {
      console.error('Failed to delete:', err)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 pb-8">
      <div className="max-w-lg mx-auto space-y-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors mb-2"
        >
          <ArrowLeft size={16} /> Back to Special Controls
        </button>

        <div className="flex items-center gap-2 mb-2">
          <Users size={20} className="text-pastel-blue-dark" />
          <h2 className="text-lg font-bold text-gray-800">Interested Teams</h2>
          <span className="ml-auto text-sm text-gray-400">{submissions.length} submission{submissions.length !== 1 ? 's' : ''}</span>
        </div>

        {loading ? (
          <div className="text-center py-8 text-gray-400 text-sm">Loading...</div>
        ) : submissions.length === 0 ? (
          <div className="text-center py-12">
            <Users size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-400 text-sm">No teams have submitted interest yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {submissions.map((s) => (
              <div
                key={s.id}
                className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm p-4 flex items-start gap-3"
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pastel-blue/40 to-pastel-pink/40 flex items-center justify-center flex-shrink-0">
                  <Users size={18} className="text-gray-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 text-sm">{s.team_name}</p>
                  <p className="text-gray-600 text-xs">{s.contact_name}</p>
                  <p className="text-gray-400 text-[11px] mt-1">
                    {new Date(s.created_at).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
                    })}
                  </p>
                </div>
                {canDelete && (
                  <button
                    onClick={() => handleDelete(s.id)}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors"
                    title="Remove"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 pt-4">
          <span className="text-lg">📝</span>
          <h2 className="text-lg font-bold text-gray-800">Starter Survey</h2>
          <span className="ml-auto text-sm text-gray-400">{surveys.length} response{surveys.length !== 1 ? 's' : ''}</span>
        </div>
        <p className="text-xs text-gray-500 -mt-2">What teams answered the first time they signed in.</p>
        {!loading && surveys.length > 0 && (() => {
          const counts = {}
          surveys.forEach(r => { if (r.usage_frequency) counts[r.usage_frequency] = (counts[r.usage_frequency] || 0) + 1 })
          const rows = Object.entries(counts).sort((a, b) => b[1] - a[1])
          return rows.length > 0 && (
            <div className="bg-white/80 rounded-xl shadow-sm p-4 space-y-1.5">
              <p className="text-xs font-semibold text-gray-500">How often they'd use it</p>
              {rows.map(([label, n]) => (
                <div key={label} className="flex items-center gap-2 text-xs">
                  <span className="w-36 shrink-0 text-gray-600">{label}</span>
                  <div className="flex-1 h-3 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full bg-pastel-pink-dark" style={{ width: `${(n / surveys.length) * 100}%` }} />
                  </div>
                  <span className="w-6 text-right font-semibold text-gray-600">{n}</span>
                </div>
              ))}
            </div>
          )
        })()}
        {loading ? null : surveys.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-6">No survey answers yet.</p>
        ) : (
          <div className="space-y-3">
            {surveys.map((r, i) => (
              <div key={r.id || i} className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-gray-800 text-sm">
                    {r.team_number ? `Team ${r.team_number}` : 'Radical'}
                    {r.team_name ? <span className="font-normal text-gray-500"> · {r.team_name}</span> : null}
                  </p>
                  <span className="text-[11px] text-gray-400 shrink-0">
                    {r.submitted_at ? new Date(r.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                  </span>
                </div>
                {r.usage_frequency && <p className="text-xs text-gray-600 mt-1"><span className="text-gray-400">Would use it:</span> {r.usage_frequency}</p>}
                {r.feature_request && <p className="text-xs text-gray-600 mt-1"><span className="text-gray-400">Wishes for:</span> {r.feature_request}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default InterestedTeams
