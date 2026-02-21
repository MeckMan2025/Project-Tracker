import { useState, useEffect } from 'react'
import { X, Users, CheckCircle, Lock, XCircle, Wrench, Clock } from 'lucide-react'
import { supabase } from '../supabase'
import { usePermissions } from '../hooks/usePermissions'
import NotificationBell from './NotificationBell'

const STATUS_MAP = {
  'available': { label: 'Available', icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-50' },
  'locked-in': { label: 'Locked In', icon: Lock, color: 'text-yellow-600', bg: 'bg-yellow-50' },
  'dnd': { label: "Don't Talk To Me", icon: XCircle, color: 'text-red-500', bg: 'bg-red-50' },
  'in-lab': { label: 'In Lab', icon: Wrench, color: 'text-blue-500', bg: 'bg-blue-50' },
  'out': { label: 'Out', icon: Clock, color: 'text-gray-400', bg: 'bg-gray-50' },
}

const SKILL_LEVEL_COLORS = {
  beginner: 'bg-gray-100 text-gray-600',
  working: 'bg-blue-100 text-blue-700',
  strong: 'bg-green-100 text-green-700',
  expert: 'bg-purple-100 text-purple-700',
}

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
function hasTag(p, tag) {
  return (p.function_tags || []).some(t => t === tag)
}

function isCoFounder(p) {
  return hasTag(p, 'Co-Founder')
}

function isCoachOrMentor(p) {
  return hasTag(p, 'Coach') || hasTag(p, 'Mentor')
}

function isTeamLead(p) {
  return hasTag(p, 'Team Lead')
}

function isBusinessLead(p) {
  return hasTag(p, 'Business Lead')
}

function isTechnicalLead(p) {
  return hasTag(p, 'Technical Lead')
}

const TECHNICAL_TAGS = ['Technical', 'Programming', 'CAD', 'Build', 'Website', 'Scouting']
const BUSINESS_TAGS = ['Business', 'Communications']

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
function ProfileModal({ profile, onClose, onViewProfile }) {
  const [full, setFull] = useState(null)
  const [loading, setLoading] = useState(false)
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  useEffect(() => {
    if (!profile) return
    setLoading(true)
    fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${profile.id}&select=*`, {
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` },
    })
      .then(res => res.ok ? res.json() : [])
      .then(rows => { if (rows[0]) setFull(rows[0]) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [profile?.id])

  if (!profile) return null
  const tier = deriveTier(profile)
  const tags = profile.function_tags || []
  const data = full || profile
  const status = STATUS_MAP[data.status] || STATUS_MAP['available']
  const StatusIcon = status.icon
  const skills = data.skills || {}
  const tools = data.tools || []
  const systemsOwned = data.systems_owned || []
  const safetyCerts = data.safety_certs || []
  const permissions = data.permissions || []
  const commStyle = data.comm_style || ''
  const commNotes = data.comm_notes || ''

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-[51] flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm pointer-events-auto relative max-h-[85vh] overflow-y-auto">
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

          {/* Status */}
          {full && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg mb-4 ${status.bg}`}>
              <StatusIcon size={16} className={status.color} />
              <span className="text-sm font-medium text-gray-700">{status.label}</span>
            </div>
          )}

          {/* Function Tags */}
          {tags.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Roles</p>
              <div className="flex flex-wrap gap-1.5">
                {tags.map(tag => (
                  <span key={tag} className="px-2.5 py-1 rounded-full text-xs font-medium bg-pastel-blue/30 text-pastel-blue-dark">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Bio */}
          {data.short_bio && (
            <div className="mb-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Bio</p>
              <p className="text-sm text-gray-700 leading-relaxed">{data.short_bio}</p>
            </div>
          )}

          {loading && <p className="text-xs text-gray-400 text-center mb-4 animate-pulse">Loading full profile...</p>}

          {full && (
            <>
              {/* Discipline */}
              {data.discipline && (
                <div className="mb-4">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Discipline</p>
                  <span className="text-sm px-2.5 py-1 rounded-full bg-pastel-orange/30 text-pastel-orange-dark font-medium">{data.discipline}</span>
                </div>
              )}

              {/* Systems Owned */}
              {systemsOwned.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Systems Owned</p>
                  <div className="flex flex-wrap gap-1.5">
                    {systemsOwned.map(s => (
                      <span key={s} className="px-2.5 py-1 rounded-full text-xs font-medium bg-pastel-pink/30 text-pastel-pink-dark">{s}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Skills */}
              {Object.keys(skills).length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Skills</p>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(skills).map(([skill, level]) => (
                      <span key={skill} className={`px-2.5 py-1 rounded-full text-xs font-medium ${SKILL_LEVEL_COLORS[level] || 'bg-gray-100 text-gray-600'}`}>
                        {skill} · {level}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Tools */}
              {tools.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Tools</p>
                  <div className="flex flex-wrap gap-1.5">
                    {tools.map(t => (
                      <span key={t} className="px-2.5 py-1 rounded-full text-xs font-medium bg-pastel-blue/20 text-pastel-blue-dark">{t}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Safety & Permissions */}
              {(safetyCerts.length > 0 || permissions.length > 0) && (
                <div className="mb-4">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Safety & Permissions</p>
                  <div className="flex flex-wrap gap-1.5">
                    {safetyCerts.map(c => (
                      <span key={c} className="px-2.5 py-1 rounded-full text-xs font-medium bg-pastel-orange/20 text-orange-700">{c}</span>
                    ))}
                    {permissions.map(p => (
                      <span key={p} className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">{p}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Communication */}
              {(commStyle || commNotes) && (
                <div className="mb-4">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Communication</p>
                  {commStyle && <p className="text-sm text-gray-700">Prefers: <span className="font-medium">{commStyle.replace('-', ' ')}</span></p>}
                  {commNotes && <p className="text-sm text-gray-500 italic mt-1">{commNotes}</p>}
                </div>
              )}
            </>
          )}

          <button
            onClick={() => { onViewProfile(profile.id); onClose() }}
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
function OrgChart({ onViewProfile }) {
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedProfile, setSelectedProfile] = useState(null)

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  const headers = { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }

  // Fetch all profiles via REST API
  useEffect(() => {
    async function fetchProfiles() {
      try {
        const res = await fetch(
          `${supabaseUrl}/rest/v1/profiles?select=id,display_name,primary_role_label,function_tags,short_bio,authority_tier,role`,
          { headers }
        )
        if (res.ok) {
          setProfiles(await res.json())
        }
      } catch (e) {
        console.error('Failed to load org chart:', e)
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

  // ── Classify into tiers (each person appears in their highest tier only) ──
  const placed = new Set()
  const place = (list) => { list.forEach(p => placed.add(p.id)); return list }

  const coFounders = place(profiles.filter(p => isCoFounder(p)))
  const coachesMentors = place(profiles.filter(p => !placed.has(p.id) && isCoachOrMentor(p)))
  const teamLeads = place(profiles.filter(p => !placed.has(p.id) && isTeamLead(p)))
  const businessLeads = place(profiles.filter(p => !placed.has(p.id) && isBusinessLead(p)))
  const technicalLeads = place(profiles.filter(p => !placed.has(p.id) && isTechnicalLead(p)))
  const members = profiles.filter(p => !placed.has(p.id))

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

              {/* Tier 1 — Co-Founders */}
              {coFounders.length > 0 && (
                <>
                  <BracketRow label="Co-Founders">
                    {coFounders.map(p => (
                      <PersonCard key={p.id} profile={p} onClick={handleCardClick} />
                    ))}
                  </BracketRow>
                  <BracketLine />
                </>
              )}

              {/* Tier 2 — Coaches & Mentors */}
              {coachesMentors.length > 0 && (
                <>
                  <BracketRow label="Coaches & Mentors">
                    {coachesMentors.map(p => (
                      <PersonCard key={p.id} profile={p} onClick={handleCardClick} />
                    ))}
                  </BracketRow>
                  <BracketLine />
                </>
              )}

              {/* Tier 3 — Team Lead */}
              {teamLeads.length > 0 && (
                <>
                  <BracketRow label="Team Lead">
                    {teamLeads.map(p => (
                      <PersonCard key={p.id} profile={p} onClick={handleCardClick} />
                    ))}
                  </BracketRow>
                  <BracketLine />
                </>
              )}

              {/* Tier 4 — Business Lead & Technical Lead */}
              {(businessLeads.length > 0 || technicalLeads.length > 0) && (
                <>
                  <div className="mb-6">
                    <div className="grid grid-cols-2 gap-6">
                      <div className="flex flex-col items-center">
                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Business Lead</p>
                        <div className="flex flex-wrap justify-center gap-3">
                          {businessLeads.length > 0 ? (
                            businessLeads.map(p => (
                              <PersonCard key={p.id} profile={p} onClick={handleCardClick} />
                            ))
                          ) : (
                            <span className="text-xs text-gray-300 italic">—</span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-center">
                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Technical Lead</p>
                        <div className="flex flex-wrap justify-center gap-3">
                          {technicalLeads.length > 0 ? (
                            technicalLeads.map(p => (
                              <PersonCard key={p.id} profile={p} onClick={handleCardClick} />
                            ))
                          ) : (
                            <span className="text-xs text-gray-300 italic">—</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  <BracketLine />
                </>
              )}

              {/* Tier 5 — Members under Business / Technical */}
              {members.length > 0 && (
                <div className="mb-6">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3 text-center">Members</p>
                  <div className="grid grid-cols-2 gap-6">
                    {/* Business column */}
                    <div className="flex flex-col items-center">
                      <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-2">Business</p>
                      <div className="flex flex-wrap justify-center gap-2">
                        {businessMembers.length > 0 ? (
                          businessMembers.map(p => (
                            <PersonCard key={p.id} profile={p} onClick={handleCardClick} />
                          ))
                        ) : (
                          <span className="text-xs text-gray-300 italic">—</span>
                        )}
                        {/* Untagged members go under Business */}
                        {untaggedMembers.map(p => (
                          <PersonCard key={p.id} profile={p} onClick={handleCardClick} />
                        ))}
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
                          <span className="text-xs text-gray-300 italic">—</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Profile Detail Modal */}
      {selectedProfile && (
        <ProfileModal profile={selectedProfile} onClose={() => setSelectedProfile(null)} onViewProfile={onViewProfile} />
      )}
    </div>
  )
}

export default OrgChart
