import { useState, useEffect } from 'react'
import { Send } from 'lucide-react'
import { supabase } from '../supabase'
import { useUser } from '../contexts/UserContext'
import { usePermissions } from '../hooks/usePermissions'

const STARTING_POSITIONS = ['Close to goal', 'Far from goal', 'Center']

const ROLE_OPTIONS = [
  'Defense',
  'Far zone cycling',
  'Close zone cycling',
  'Stealing from opposing loading zone',
  'Controlling the gate',
  'Scoring balls in depot',
  'Indexing balls',
  'Not contributing',
]

const STABILITY_OPTIONS = [
  { value: 'no', label: 'No issues' },
  { value: 'major', label: 'Major subsystem broke' },
  { value: 'shutdown', label: 'Fully shut off (stationary)' },
]

const INITIAL_FORM_STATE = {
  teamNumber: '',
  allianceColor: '',
  matchNumber: '',
  startingPosition: '',
  autoArtifactsMissed: 0,
  autoClassified: 0,
  autoOverflowed: 0,
  autoInMotifOrder: 0,
  teleArtifactsMissed: 0,
  teleClassified: 0,
  teleOverflowed: 0,
  teleInMotifOrder: 0,
  teleArtifactsInDepot: 0,
  teleDidLeave: null,
  parkingStatus: '',
  doublePark: null,
  allianceScore: '',
  leavePoints: '',
  artifactPoints: '',
  patternPoints: '',
  basePoints: '',
  foulPoints: '',
  patternRP: false,
  goalRP: false,
  movementRP: false,
  noneRP: false,
  robotStability: '',
  roles: [],
  observations: '',
}

function CounterWidget({ label, value, onChange }) {
  return (
    <div className="bg-white rounded-lg p-3 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <span className="text-lg font-bold text-gray-800 min-w-[2rem] text-center">{value}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onChange(-1)}
          className="py-3 rounded-lg bg-pastel-pink hover:bg-pastel-pink-dark text-gray-700 font-bold text-sm active:scale-95 transition-transform"
        >
          -1
        </button>
        <button
          type="button"
          onClick={() => onChange(1)}
          className="py-3 rounded-lg bg-pastel-blue hover:bg-pastel-blue-dark text-gray-700 font-bold text-sm active:scale-95 transition-transform"
        >
          +1
        </button>
        <button
          type="button"
          onClick={() => onChange(2)}
          className="py-3 rounded-lg bg-pastel-orange hover:bg-pastel-orange-dark text-gray-700 font-bold text-sm active:scale-95 transition-transform"
        >
          +2
        </button>
        <button
          type="button"
          onClick={() => onChange(3)}
          className="py-3 rounded-lg bg-pastel-pink-dark hover:bg-pastel-pink text-gray-700 font-bold text-sm active:scale-95 transition-transform"
        >
          +3
        </button>
      </div>
    </div>
  )
}

function SectionHeader({ title }) {
  return (
    <h2 className="text-lg font-semibold text-gray-700 border-b-2 border-pastel-pink pb-1">
      {title}
    </h2>
  )
}

function ScoutingForm() {
  const { username } = useUser()
  const [formData, setFormData] = useState(() => {
    const draft = localStorage.getItem('scouting-draft')
    return draft ? JSON.parse(draft) : { ...INITIAL_FORM_STATE }
  })
  const [submitFeedback, setSubmitFeedback] = useState(null)

  useEffect(() => {
    localStorage.setItem('scouting-draft', JSON.stringify(formData))
  }, [formData])

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const incrementCounter = (field, amount) => {
    setFormData(prev => ({
      ...prev,
      [field]: Math.max(0, prev[field] + amount),
    }))
  }

  const toggleRole = (role) => {
    setFormData(prev => ({
      ...prev,
      roles: prev.roles.includes(role)
        ? prev.roles.filter(r => r !== role)
        : [...prev.roles, role],
    }))
  }

  const toggleRP = (field) => {
    if (field === 'noneRP') {
      setFormData(prev => ({
        ...prev,
        patternRP: false,
        goalRP: false,
        movementRP: false,
        noneRP: !prev.noneRP,
      }))
    } else {
      setFormData(prev => ({
        ...prev,
        noneRP: false,
        [field]: !prev[field],
      }))
    }
  }

  const handleSubmit = async () => {
    const id = String(Date.now()) + Math.random().toString(36).slice(2)
    const record = {
      ...formData,
      id,
      submittedAt: new Date().toISOString(),
    }
    // Save to localStorage (existing behavior)
    const existing = JSON.parse(localStorage.getItem('scouting-records') || '[]')
    existing.push(record)
    localStorage.setItem('scouting-records', JSON.stringify(existing))

    // Check for active scouting period
    let scoutingPeriodId = ''
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
      let token = supabaseKey
      try {
        const { data: s } = await supabase.auth.getSession()
        if (s?.session?.access_token) token = s.session.access_token
      } catch (e) { /* fall back to anon key */ }
      const periodRes = await fetch(
        `${supabaseUrl}/rest/v1/scouting_periods?is_active=eq.true&select=id&limit=1`,
        { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${token}` } }
      )
      if (periodRes.ok) {
        const periods = await periodRes.json()
        if (periods && periods.length > 0) scoutingPeriodId = periods[0].id
      }
    } catch { /* ignore - submit without period link */ }

    // Also save to Supabase for shared analytics
    const { error } = await supabase.from('scouting_records').insert({
      id,
      data: formData,
      submitted_by: username || '',
      submitted_at: new Date().toISOString(),
      scouting_period_id: scoutingPeriodId,
    })
    if (error) {
      console.error('Failed to save scouting record to Supabase:', error.message)
    }

    setFormData({ ...INITIAL_FORM_STATE })
    localStorage.removeItem('scouting-draft')
    setSubmitFeedback('Scouting data saved!')
    setTimeout(() => setSubmitFeedback(null), 3000)
  }

  return (
    <div className="flex-1 flex flex-col min-w-0">

      <main className="flex-1 p-4 pl-14 md:pl-4 overflow-y-auto">
        <div className="max-w-lg mx-auto space-y-6 pb-8">

          {/* Team Info */}
          <section className="space-y-3">
            <SectionHeader title="Team Info" />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Team Number</label>
                <input
                  type="number"
                  value={formData.teamNumber}
                  onChange={(e) => updateField('teamNumber', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-pastel-blue focus:border-transparent"
                  placeholder="e.g. 7196"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Alliance Color</label>
                <select
                  value={formData.allianceColor}
                  onChange={(e) => updateField('allianceColor', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-pastel-blue focus:border-transparent"
                >
                  <option value="">Select...</option>
                  <option value="Red">Red</option>
                  <option value="Blue">Blue</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Match Number</label>
                <input
                  type="number"
                  value={formData.matchNumber}
                  onChange={(e) => updateField('matchNumber', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-pastel-blue focus:border-transparent"
                  placeholder="e.g. 1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Starting Position</label>
                <select
                  value={formData.startingPosition}
                  onChange={(e) => updateField('startingPosition', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-pastel-blue focus:border-transparent"
                >
                  <option value="">Select...</option>
                  {STARTING_POSITIONS.map(pos => (
                    <option key={pos} value={pos}>{pos}</option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* Autonomous Phase */}
          <section className="space-y-3">
            <SectionHeader title="Autonomous Phase" />
            <div className="space-y-3">
              <CounterWidget label="# Artifacts Missed" value={formData.autoArtifactsMissed} onChange={(d) => incrementCounter('autoArtifactsMissed', d)} />
              <CounterWidget label="# Artifacts Classified" value={formData.autoClassified} onChange={(d) => incrementCounter('autoClassified', d)} />
              <CounterWidget label="# Artifacts Overflowed" value={formData.autoOverflowed} onChange={(d) => incrementCounter('autoOverflowed', d)} />
              <CounterWidget label="# Artifacts in MOTIF Order" value={formData.autoInMotifOrder} onChange={(d) => incrementCounter('autoInMotifOrder', d)} />
            </div>
          </section>

          {/* Tele-Op Phase */}
          <section className="space-y-3">
            <SectionHeader title="Tele-Operated Phase" />
            <div className="space-y-3">
              <CounterWidget label="# Artifacts Missed" value={formData.teleArtifactsMissed} onChange={(d) => incrementCounter('teleArtifactsMissed', d)} />
              <CounterWidget label="# Artifacts Classified" value={formData.teleClassified} onChange={(d) => incrementCounter('teleClassified', d)} />
              <CounterWidget label="# Artifacts Overflowed" value={formData.teleOverflowed} onChange={(d) => incrementCounter('teleOverflowed', d)} />
              <CounterWidget label="# Artifacts in MOTIF Order" value={formData.teleInMotifOrder} onChange={(d) => incrementCounter('teleInMotifOrder', d)} />
              <CounterWidget label="# Artifacts in DEPOT" value={formData.teleArtifactsInDepot} onChange={(d) => incrementCounter('teleArtifactsInDepot', d)} />

              <div className="bg-white rounded-lg p-3 shadow-sm">
                <span className="text-sm font-medium text-gray-700 block mb-2">Did they leave?</span>
                <div className="flex gap-4">
                  {['Yes', 'No'].map(opt => (
                    <label key={opt} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="teleDidLeave"
                        checked={formData.teleDidLeave === (opt === 'Yes')}
                        onChange={() => updateField('teleDidLeave', opt === 'Yes')}
                        className="w-5 h-5 accent-pastel-pink-dark"
                      />
                      <span className="text-sm">{opt}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Endgame */}
          <section className="space-y-3">
            <SectionHeader title="Endgame" />
            <div className="bg-white rounded-lg p-3 shadow-sm space-y-4">
              <div>
                <span className="text-sm font-medium text-gray-700 block mb-2">Parking Status</span>
                <div className="flex gap-4">
                  {[{ value: 'none', label: 'No park' }, { value: 'partial', label: 'Partial' }, { value: 'full', label: 'Full' }].map(opt => (
                    <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="parkingStatus"
                        checked={formData.parkingStatus === opt.value}
                        onChange={() => updateField('parkingStatus', opt.value)}
                        className="w-5 h-5 accent-pastel-pink-dark"
                      />
                      <span className="text-sm">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-700 block mb-2">Double Park</span>
                <div className="flex gap-4">
                  {['Yes', 'No'].map(opt => (
                    <label key={opt} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="doublePark"
                        checked={formData.doublePark === (opt === 'Yes')}
                        onChange={() => updateField('doublePark', opt === 'Yes')}
                        className="w-5 h-5 accent-pastel-pink-dark"
                      />
                      <span className="text-sm">{opt}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Score Card */}
          <section className="space-y-3">
            <SectionHeader title="Score Card" />
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Alliance Score', field: 'allianceScore' },
                { label: 'Leave Points', field: 'leavePoints' },
                { label: 'Artifact Points', field: 'artifactPoints' },
                { label: 'Pattern Points (0-36)', field: 'patternPoints' },
                { label: 'Base Points', field: 'basePoints' },
                { label: 'Foul Points', field: 'foulPoints' },
              ].map(({ label, field }) => (
                <div key={field}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                  <input
                    type="number"
                    value={formData[field]}
                    onChange={(e) => updateField(field, e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-pastel-blue focus:border-transparent"
                  />
                </div>
              ))}
            </div>
          </section>

          {/* Ranking Points */}
          <section className="space-y-3">
            <SectionHeader title="Ranking Points (RP Earned)" />
            <div className="space-y-2">
              {[
                { field: 'patternRP', label: 'Pattern RP' },
                { field: 'goalRP', label: 'Goal RP' },
                { field: 'movementRP', label: 'Movement RP' },
                { field: 'noneRP', label: 'None of the Above' },
              ].map(({ field, label }) => (
                <label key={field} className="flex items-center gap-3 p-3 bg-white rounded-lg shadow-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData[field]}
                    onChange={() => toggleRP(field)}
                    className="w-5 h-5 accent-pastel-pink-dark"
                  />
                  <span className="text-sm font-medium text-gray-700">{label}</span>
                </label>
              ))}
            </div>
          </section>

          {/* Overall Performance */}
          <section className="space-y-3">
            <SectionHeader title="Overall Performance" />
            <div className="bg-white rounded-lg p-3 shadow-sm">
              <span className="text-sm font-medium text-gray-700 block mb-2">
                Did the robot shut down at any point during the match?
              </span>
              <div className="space-y-2">
                {STABILITY_OPTIONS.map(opt => (
                  <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="robotStability"
                      checked={formData.robotStability === opt.value}
                      onChange={() => updateField('robotStability', opt.value)}
                      className="w-5 h-5 accent-pastel-pink-dark"
                    />
                    <span className="text-sm">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </section>

          {/* Role Classification */}
          <section className="space-y-3">
            <SectionHeader title="Role Classification" />
            <p className="text-sm text-gray-500">What role(s) was this robot filling during the match?</p>
            <div className="flex flex-wrap gap-2">
              {ROLE_OPTIONS.map(role => (
                <button
                  key={role}
                  type="button"
                  onClick={() => toggleRole(role)}
                  className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                    formData.roles.includes(role)
                      ? 'bg-pastel-pink text-gray-700 font-medium shadow-sm'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {role}
                </button>
              ))}
            </div>
          </section>

          {/* Observations */}
          <section className="space-y-3">
            <SectionHeader title="Observations / Comments" />
            <textarea
              value={formData.observations}
              onChange={(e) => updateField('observations', e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-pastel-blue focus:border-transparent resize-none"
              placeholder="Driver skill notes, mechanical issues, strategy insights, match anomalies..."
            />
          </section>

          {/* Submit */}
          <button
            type="button"
            onClick={handleSubmit}
            className="w-full py-4 bg-pastel-pink hover:bg-pastel-pink-dark rounded-xl text-lg font-semibold text-gray-700 transition-colors flex items-center justify-center gap-2 active:scale-[0.98]"
          >
            <Send size={20} />
            Submit Scouting Data
          </button>
          {submitFeedback && (
            <div className="text-center text-green-600 font-medium animate-pulse">
              {submitFeedback}
            </div>
          )}

        </div>
      </main>
    </div>
  )
}

export default ScoutingForm
