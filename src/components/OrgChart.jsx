import { useState, useEffect } from 'react'
import { X, Users } from 'lucide-react'
import { supabase } from '../supabase'
import { usePermissions } from '../hooks/usePermissions'
import NotificationBell from './NotificationBell'

// ── Tier → card border color ──
const TIER_BORDER = {
  guest: 'border-yellow-300',
  teammate: 'border-blue-300',
  top: 'border-pink-400',
}
const TIER_BG = {
  guest: 'bg-yellow-50',
  teammate: 'bg-blue-50',
  top: 'bg-pink-50',
}

// ── Helpers to classify profiles into bracket rows ──
function isFounder(p) {
  if (p.role === 'cofounder') return true
  const label = (p.primary_role_label || '').toLowerCase()
  return label.includes('founder') || label.includes('cofounder')
}

function isLeadOrCoach(p) {
  if (p.role === 'lead' || p.role === 'coach') return true
  const label = (p.primary_role_label || '').toLowerCase()
  return label.includes('lead')
}

function isMentor(p) {
  return p.role === 'mentor'
}

const TECHNICAL_TAGS = ['Technical', 'Programming', 'CAD', 'Build']
const BUSINESS_TAGS = ['Business']

function classifyMember(p) {
  const tags = p.function_tags || []
  const hasBiz = tags.some(t => BUSINESS_TAGS.some(b => t.includes(b)))
  const hasTech = tags.some(t => TECHNICAL_TAGS.some(b => t.includes(b)))
  if (hasBiz && !hasTech) return 'business'
  if (hasTech && !hasBiz) return 'technical'
  if (hasBiz && hasTech) return 'technical' // dual-tag defaults to technical
  return 'untagged'
}

function deriveTier(p) {
  if (p.authority_tier) return p.authority_tier
  if (p.role === 'guest') return 'guest'
  const elevated = ['lead', 'coach', 'mentor', 'cofounder']
  if (elevated.includes(p.role)) return 'top'
  return 'teammate'
}

// ── Person Card ──
function PersonCard({ profile, onClick }) {
  const tier = deriveTier(profile)
  return (
    <button
      onClick={() => onClick(profile)}
      className={`flex flex-col items-center px-4 py-3 rounded-xl border-2 shadow-sm bg-white/80 backdrop-blur-sm
        hover:shadow-md hover:scale-[1.03] active:scale-[0.98] transition-all cursor-pointer min-w-[120px] max-w-[160px]
        ${TIER_BORDER[tier] || 'border-gray-200'}`}
    >
      {/* Avatar circle */}
      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-gray-600 mb-1.5 ${TIER_BG[tier] || 'bg-gray-100'}`}>
        {(profile.display_name || '?').charAt(0).toUpperCase()}
      </div>
      <span className="text-sm font-semibold text-gray-800 text-center leading-tight truncate w-full">
        {profile.display_name || 'Unknown'}
      </span>
      {profile.primary_role_label && (
        <span className="text-[11px] text-gray-400 mt-0.5 text-center leading-tight truncate w-full">
          {profile.primary_role_label}
        </span>
      )}
    </button>
  )
}

// ── Profile Detail Modal ──
function ProfileModal({ profile, onClose }) {
  if (!profile) return null
  const tier = deriveTier(profile)
  const tags = profile.function_tags || []

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm pointer-events-auto relative max-h-[80vh] overflow-y-auto">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1 rounded hover:bg-gray-100 transition-colors"
          >
            <X size={16} className="text-gray-400" />
          </button>

          {/* Avatar + Name */}
          <div className="flex flex-col items-center mb-4">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-gray-600 mb-2 border-2 ${TIER_BORDER[tier]} ${TIER_BG[tier]}`}>
              {(profile.display_name || '?').charAt(0).toUpperCase()}
            </div>
            <h2 className="text-lg font-bold text-gray-800">{profile.display_name || 'Unknown'}</h2>
            {profile.primary_role_label && (
              <span className="text-sm text-gray-500">{profile.primary_role_label}</span>
            )}
          </div>

          {/* Function Tags */}
          {tags.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Function Tags</p>
              <div className="flex flex-wrap gap-1.5">
                {tags.map(tag => (
                  <span
                    key={tag}
                    className="px-2.5 py-1 rounded-full text-xs font-medium bg-pastel-blue/30 text-pastel-blue-dark"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Short Bio */}
          {profile.short_bio && (
            <div className="mb-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Bio</p>
              <p className="text-sm text-gray-700 leading-relaxed">{profile.short_bio}</p>
            </div>
          )}

          {/* View Profile button — placeholder, links to profile tab */}
          <button
            onClick={onClose}
            className="w-full mt-2 px-4 py-2.5 bg-pastel-pink hover:bg-pastel-pink-dark rounded-lg transition-colors text-sm font-medium text-gray-700 text-center"
          >
            View Profile
          </button>
        </div>
      </div>
    </>
  )
}

// ── Row wrapper with label ──
function BracketRow({ label, children, className = '' }) {
  if (!children || (Array.isArray(children) && children.length === 0)) return null
  return (
    <div className={`mb-6 ${className}`}>
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3 text-center">{label}</p>
      <div className="flex flex-wrap justify-center gap-3">
        {children}
      </div>
    </div>
  )
}

// ── Connecting bracket line (decorative) ──
function BracketLine() {
  return (
    <div className="flex justify-center my-1">
      <div className="w-px h-6 bg-gray-200" />
    </div>
  )
}

// ── Main Component ──
function OrgChart() {
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedProfile, setSelectedProfile] = useState(null)

  // Fetch all profiles with retry for sleeping DB
  useEffect(() => {
    async function fetchProfiles() {
      for (let i = 0; i < 3; i++) {
        try {
          const { data, error } = await Promise.race([
            supabase.from('profiles').select('id, display_name, primary_role_label, function_tags, short_bio, authority_tier, role'),
            new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 30000))
          ])
          if (data && !error) {
            setProfiles(data)
            break
          }
        } catch (e) {
          if (i < 2) await new Promise(r => setTimeout(r, 2000))
        }
      }
      setLoading(false)
    }
    fetchProfiles()
  }, [])

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('org-chart-profiles')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setProfiles(prev => {
            if (prev.some(p => p.id === payload.new.id)) return prev
            return [...prev, payload.new]
          })
        } else if (payload.eventType === 'UPDATE') {
          setProfiles(prev => prev.map(p => p.id === payload.new.id ? { ...p, ...payload.new } : p))
        } else if (payload.eventType === 'DELETE') {
          setProfiles(prev => prev.filter(p => p.id !== payload.old.id))
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  // ── Classify into rows ──
  const founders = profiles.filter(p => isFounder(p))
  const leadsCoaches = profiles.filter(p => !isFounder(p) && isLeadOrCoach(p))
  const mentors = profiles.filter(p => !isFounder(p) && !isLeadOrCoach(p) && isMentor(p))
  const members = profiles.filter(p => !isFounder(p) && !isLeadOrCoach(p) && !isMentor(p))

  const businessMembers = members.filter(p => classifyMember(p) === 'business')
  const technicalMembers = members.filter(p => classifyMember(p) === 'technical')
  const untaggedMembers = members.filter(p => classifyMember(p) === 'untagged')

  const handleCardClick = (profile) => {
    setSelectedProfile(profile)
  }

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="px-4 py-4 pl-14 flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-pastel-blue-dark via-pastel-pink-dark to-pastel-orange-dark bg-clip-text text-transparent flex items-center gap-2">
              <Users size={22} className="text-pastel-pink-dark" />
              Org Chart
            </h1>
            <p className="text-sm text-gray-500">Tap a card to view member details</p>
          </div>
          <NotificationBell />
        </div>
      </header>

      <main className="flex-1 p-4 overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          {loading ? (
            <div className="flex justify-center py-20">
              <div className="text-sm text-gray-400">Loading team...</div>
            </div>
          ) : profiles.length === 0 ? (
            <div className="flex flex-col items-center py-20 text-gray-400">
              <Users size={48} className="mb-3 opacity-40" />
              <p className="text-sm">No team members found</p>
            </div>
          ) : (
            <div className="bg-white/70 rounded-xl shadow-sm p-6">

              {/* Row 1 — Founders / Cofounders */}
              {founders.length > 0 && (
                <>
                  <BracketRow label="Founders">
                    {founders.map(p => (
                      <PersonCard key={p.id} profile={p} onClick={handleCardClick} />
                    ))}
                  </BracketRow>
                  <BracketLine />
                </>
              )}

              {/* Row 2 — Leads & Coaches */}
              {leadsCoaches.length > 0 && (
                <>
                  <BracketRow label="Leads & Coaches">
                    {leadsCoaches.map(p => (
                      <PersonCard key={p.id} profile={p} onClick={handleCardClick} />
                    ))}
                  </BracketRow>
                  <BracketLine />
                </>
              )}

              {/* Row 3 — Members (Business | Untagged | Technical) */}
              {members.length > 0 && (
                <>
                  <div className="mb-6">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3 text-center">Members</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Business column */}
                      <div className="flex flex-col items-center">
                        <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-2">Business</p>
                        <div className="flex flex-wrap justify-center gap-2">
                          {businessMembers.length > 0 ? (
                            businessMembers.map(p => (
                              <PersonCard key={p.id} profile={p} onClick={handleCardClick} />
                            ))
                          ) : (
                            <span className="text-xs text-gray-300 italic">None</span>
                          )}
                        </div>
                      </div>

                      {/* Untagged column */}
                      <div className="flex flex-col items-center">
                        <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-2">General</p>
                        <div className="flex flex-wrap justify-center gap-2">
                          {untaggedMembers.length > 0 ? (
                            untaggedMembers.map(p => (
                              <PersonCard key={p.id} profile={p} onClick={handleCardClick} />
                            ))
                          ) : (
                            <span className="text-xs text-gray-300 italic">None</span>
                          )}
                        </div>
                      </div>

                      {/* Technical column */}
                      <div className="flex flex-col items-center">
                        <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-2">Technical</p>
                        <div className="flex flex-wrap justify-center gap-2">
                          {technicalMembers.length > 0 ? (
                            technicalMembers.map(p => (
                              <PersonCard key={p.id} profile={p} onClick={handleCardClick} />
                            ))
                          ) : (
                            <span className="text-xs text-gray-300 italic">None</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  <BracketLine />
                </>
              )}

              {/* Row 4 — Mentors */}
              {mentors.length > 0 && (
                <BracketRow label="Mentors">
                  {mentors.map(p => (
                    <PersonCard key={p.id} profile={p} onClick={handleCardClick} />
                  ))}
                </BracketRow>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Profile Detail Modal */}
      {selectedProfile && (
        <ProfileModal profile={selectedProfile} onClose={() => setSelectedProfile(null)} />
      )}
    </div>
  )
}

export default OrgChart
