import { useState, useEffect } from 'react'
import { X, Users, CheckCircle, Lock, XCircle, Wrench, Clock, Briefcase, Cpu, ClipboardList, GraduationCap } from 'lucide-react'
import { supabase } from '../supabase'
import NotificationBell from './NotificationBell'
import { usePresenceContext } from '../contexts/PresenceContext'
import OnlineDot from './OnlineDot'
import { BUSINESS_ROLES, TECHNICAL_ROLES, TECHNICAL_GROUPS, LEADERSHIP_TAGS, ROLE_DESC } from '../data/orgRoles'

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

const TIER_BORDER = { guest: 'border-yellow-300', teammate: 'border-blue-300', top: 'border-pink-400' }
const TIER_BG = { guest: 'bg-yellow-50', teammate: 'bg-blue-50', top: 'bg-pink-50' }

const hasTag = (p, tag) => (p.function_tags || []).some(t => t === tag)

// Pink "top" border = leadership, derived from the actual role tags so every
// leader is highlighted consistently (the authority_tier field is unreliable).
const LEADERSHIP_TAGS_FOR_BORDER = ['Co-Founder', 'Mentor', 'Coach', 'Project Manager', 'Business Lead', 'Technical Lead', 'Programming Lead']
function deriveTier(p) {
  const tags = p.function_tags || []
  if (tags.some(t => LEADERSHIP_TAGS_FOR_BORDER.includes(t))) return 'top'
  if (p.role === 'guest' || tags.includes('Guest')) return 'guest'
  return 'teammate'
}

// ── Color themes: orange = Business, blue = Hardware, green = Software ──
const THEME = {
  orange: {
    box: 'bg-orange-50 border-orange-300', title: 'text-orange-700',
    mini: 'border-orange-300 bg-white/70', miniLabel: 'text-orange-700',
    chip: 'bg-orange-100 text-orange-800 hover:bg-orange-200',
    leadChip: 'bg-orange-500 text-white hover:bg-orange-600',
  },
  blue: {
    box: 'bg-blue-50 border-blue-300', title: 'text-blue-700',
    mini: 'border-blue-300 bg-white/70', miniLabel: 'text-blue-700',
    chip: 'bg-blue-100 text-blue-800 hover:bg-blue-200',
    leadChip: 'bg-blue-500 text-white hover:bg-blue-600',
  },
  green: {
    box: 'bg-green-50 border-green-300', title: 'text-green-700',
    mini: 'border-green-300 bg-white/70', miniLabel: 'text-green-700',
    chip: 'bg-green-100 text-green-800 hover:bg-green-200',
    leadChip: 'bg-green-500 text-white hover:bg-green-600',
  },
}

// Shared "___ Lead:" line
function LeadLine({ label, leads, theme, onClick }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
      <span className="text-sm font-semibold text-gray-500">{label} Lead:</span>
      {leads.length > 0
        ? leads.map(p => <PersonChip key={p.id} profile={p} onClick={onClick} className={theme.leadChip} />)
        : <span className="text-sm italic text-gray-300">Unassigned</span>}
    </div>
  )
}

// ── Clickable name chip (keeps profiles) ──
function PersonChip({ profile, onClick, className = '' }) {
  const { isOnline } = usePresenceContext()
  return (
    <button
      onClick={() => onClick(profile)}
      className={`inline-flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${className}`}
      title={`View ${profile.display_name || 'member'}'s profile`}
    >
      {profile.avatar_url ? (
        <img src={profile.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover" />
      ) : (
        <span className="w-5 h-5 rounded-full bg-white/60 flex items-center justify-center text-[10px] font-bold">
          {(profile.display_name || '?').charAt(0).toUpperCase()}
        </span>
      )}
      {profile.display_name || 'Unknown'}
      <OnlineDot online={isOnline(profile.display_name)} size={7} ring={false} className="ml-0.5" />
    </button>
  )
}

// ── Role mini-box with hover tooltip ──
function RoleBox({ role, people, theme, onClick }) {
  return (
    <div className={`group relative rounded-lg border-2 p-2.5 ${theme.mini}`}>
      <p className={`text-xs font-bold uppercase tracking-wide mb-1.5 text-center ${theme.miniLabel}`}>{role.tag}</p>
      {people.length > 0 ? (
        <div className="flex flex-wrap justify-center gap-1.5">
          {people.map(p => <PersonChip key={p.id} profile={p} onClick={onClick} className={theme.chip} />)}
        </div>
      ) : (
        <p className="text-xs italic text-gray-300 text-center">Unassigned</p>
      )}
      {/* Tooltip */}
      <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-52 z-20
        opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="bg-gray-800 text-white text-[11px] leading-snug rounded-lg px-3 py-2 shadow-lg text-center">
          {role.desc}
          <div className="absolute left-1/2 -translate-x-1/2 top-full w-2 h-2 bg-gray-800 rotate-45 -mt-1" />
        </div>
      </div>
    </div>
  )
}

// ── Business department (single orange box, flat roles) ──
function BusinessDepartment({ roles, leads, membersByTag, onClick }) {
  const theme = THEME.orange
  return (
    <div className={`h-full flex flex-col rounded-2xl border-2 shadow-sm p-4 ${theme.box}`}>
      <div className="flex items-center justify-center gap-2 mb-1">
        <Briefcase size={20} className={theme.title} />
        <h2 className={`text-lg font-black ${theme.title}`}>Business</h2>
      </div>
      <LeadLine label="Business" leads={leads} theme={theme} onClick={onClick} />
      <div className="grid grid-cols-1 gap-2.5 flex-1">
        {roles.map(role => (
          <RoleBox key={role.tag} role={role} people={membersByTag(role.tag)} theme={theme} onClick={onClick} />
        ))}
      </div>
    </div>
  )
}

// ── Technical department (Hardware = blue, Software = green sub-boxes) ──
function TechnicalDepartment({ groups, leads, softwareLeads = [], membersByTag, onClick }) {
  return (
    <div className="h-full flex flex-col rounded-2xl border-2 border-gray-200 bg-white/50 shadow-sm p-4">
      <div className="flex items-center justify-center gap-2 mb-1">
        <Cpu size={20} className="text-gray-600" />
        <h2 className="text-lg font-black text-gray-700">Technical</h2>
      </div>
      <LeadLine label="Technical" leads={leads} theme={THEME.blue} onClick={onClick} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
        {groups.map(g => {
          const theme = THEME[g.color] || THEME.blue
          return (
            <div key={g.key} className={`flex flex-col rounded-xl border-2 p-3 ${theme.box}`}>
              <h3 className={`text-sm font-black text-center ${theme.title}`}>{g.label}</h3>
              {/* The software side has its own lead. */}
              {g.key === 'software' && softwareLeads.length > 0 && (
                <LeadLine label="Software" leads={softwareLeads} theme={theme} onClick={onClick} />
              )}
              <p className="text-[10px] uppercase tracking-wider text-gray-400 text-center mb-2">Sub-roles</p>
              <div className="grid grid-cols-1 gap-2.5 flex-1">
                {g.roles.map(role => (
                  <RoleBox key={role.tag} role={role} people={membersByTag(role.tag)} theme={theme} onClick={onClick} />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Person Card (leadership sections) ──
function PersonCard({ profile, onClick }) {
  const tier = deriveTier(profile)
  const primaryTag = (profile.function_tags || [])[0]
  const { isOnline } = usePresenceContext()
  return (
    <button
      onClick={() => onClick(profile)}
      title={ROLE_DESC[primaryTag] || 'View profile'}
      className={`flex flex-col items-center px-4 py-3 rounded-xl border-2 shadow-sm bg-white/80 backdrop-blur-sm
        hover:shadow-md hover:scale-[1.03] active:scale-[0.98] transition-all cursor-pointer min-w-[120px] max-w-[160px]
        ${TIER_BORDER[tier] || 'border-gray-200'}`}
    >
      <div className="relative mb-1.5">
        {profile.avatar_url ? (
          <img src={profile.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
        ) : (
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-gray-600 ${TIER_BG[tier] || 'bg-gray-100'}`}>
            {(profile.display_name || '?').charAt(0).toUpperCase()}
          </div>
        )}
        <span className="absolute -bottom-0.5 -right-0.5">
          <OnlineDot online={isOnline(profile.display_name)} size={12} />
        </span>
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

// ── Profile Detail Modal (unchanged) ──
function ProfileModal({ profile, onClose, onViewProfile }) {
  const { isOnline } = usePresenceContext()
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
          <button onClick={onClose} className="absolute top-3 right-3 p-1 rounded hover:bg-gray-100 transition-colors">
            <X size={16} className="text-gray-400" />
          </button>

          <div className="flex flex-col items-center mb-4">
            <div className="relative mb-2">
              {(data.avatar_url || profile.avatar_url) ? (
                <img src={data.avatar_url || profile.avatar_url} alt="" className={`w-16 h-16 rounded-full object-cover border-2 ${TIER_BORDER[tier]}`} />
              ) : (
                <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-gray-600 border-2 ${TIER_BORDER[tier]} ${TIER_BG[tier]}`}>
                  {(profile.display_name || '?').charAt(0).toUpperCase()}
                </div>
              )}
              <span className="absolute bottom-0.5 right-0.5">
                <OnlineDot online={isOnline(profile.display_name)} size={15} />
              </span>
            </div>
            <h2 className="text-lg font-bold text-gray-800">{profile.display_name || 'Unknown'}</h2>
            {profile.primary_role_label && <span className="text-sm text-gray-500">{profile.primary_role_label}</span>}
          </div>

          {full && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg mb-4 ${status.bg}`}>
              <StatusIcon size={16} className={status.color} />
              <span className="text-sm font-medium text-gray-700">{status.label}</span>
            </div>
          )}

          {tags.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Roles</p>
              <div className="flex flex-wrap gap-1.5">
                {tags.map(tag => (
                  <span key={tag} className="px-2.5 py-1 rounded-full text-xs font-medium bg-pastel-blue/30 text-pastel-blue-dark">{tag}</span>
                ))}
              </div>
            </div>
          )}

          {data.short_bio && (
            <div className="mb-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Bio</p>
              <p className="text-sm text-gray-700 leading-relaxed">{data.short_bio}</p>
            </div>
          )}

          {loading && <p className="text-xs text-gray-400 text-center mb-4 animate-pulse">Loading full profile...</p>}

          {full && (
            <>
              {data.discipline && (
                <div className="mb-4">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Discipline</p>
                  <span className="text-sm px-2.5 py-1 rounded-full bg-pastel-orange/30 text-pastel-orange-dark font-medium">{data.discipline}</span>
                </div>
              )}
              {systemsOwned.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Systems Owned</p>
                  <div className="flex flex-wrap gap-1.5">
                    {systemsOwned.map(s => <span key={s} className="px-2.5 py-1 rounded-full text-xs font-medium bg-pastel-pink/30 text-pastel-pink-dark">{s}</span>)}
                  </div>
                </div>
              )}
              {Object.keys(skills).length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Skills</p>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(skills).map(([skill, level]) => (
                      <span key={skill} className={`px-2.5 py-1 rounded-full text-xs font-medium ${SKILL_LEVEL_COLORS[level] || 'bg-gray-100 text-gray-600'}`}>{skill} · {level}</span>
                    ))}
                  </div>
                </div>
              )}
              {tools.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Tools</p>
                  <div className="flex flex-wrap gap-1.5">
                    {tools.map(t => <span key={t} className="px-2.5 py-1 rounded-full text-xs font-medium bg-pastel-blue/20 text-pastel-blue-dark">{t}</span>)}
                  </div>
                </div>
              )}
              {(safetyCerts.length > 0 || permissions.length > 0) && (
                <div className="mb-4">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Safety & Permissions</p>
                  <div className="flex flex-wrap gap-1.5">
                    {safetyCerts.map(c => <span key={c} className="px-2.5 py-1 rounded-full text-xs font-medium bg-pastel-orange/20 text-orange-700">{c}</span>)}
                    {permissions.map(p => <span key={p} className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">{p}</span>)}
                  </div>
                </div>
              )}
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

// ── Bottom leadership section ──
function LeaderSection({ title, icon: Icon, people, onClick, accent }) {
  if (!people.length) return null
  return (
    <div className="bg-white/70 rounded-2xl shadow-sm border border-gray-100 p-4 mt-6">
      <div className="flex items-center justify-center gap-2 mb-3">
        <Icon size={18} className={accent} />
        <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500">{title}</h2>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        {people.map(p => <PersonCard key={p.id} profile={p} onClick={onClick} />)}
      </div>
    </div>
  )
}

// ── Project Managers — cute rounded box with the ombre gradient ──
function ProjectManagerNote({ people, onClick }) {
  return (
    <div className="flex justify-center mt-6">
      <div
        className="rounded-2xl shadow-sm border border-white/60 p-5 text-center w-full max-w-md"
        style={{ background: 'linear-gradient(140deg, #dbeafe 0%, #fce7f3 55%, #ffedd5 100%)' }}
      >
        <div className="flex items-center justify-center gap-2 mb-3">
          <ClipboardList size={18} className="text-pink-600" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-700">Project Managers</h2>
        </div>
        {people.length > 0 ? (
          <div className="flex flex-wrap justify-center gap-3">
            {people.map(p => <PersonCard key={p.id} profile={p} onClick={onClick} />)}
          </div>
        ) : (
          <p className="text-xs italic text-gray-500">Unassigned</p>
        )}
      </div>
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

  useEffect(() => {
    async function fetchProfiles() {
      try {
        const res = await fetch(
          `${supabaseUrl}/rest/v1/profiles?select=id,display_name,primary_role_label,function_tags,short_bio,authority_tier,role,avatar_url`,
          { headers }
        )
        if (res.ok) {
          const rows = await res.json()
          // Guests aren't team members — keep them off the org chart.
          setProfiles(rows.filter(r => deriveTier(r) !== 'guest'))
        }
      } catch (e) { console.error('Failed to load org chart:', e) }
      setLoading(false)
    }
    fetchProfiles()
  }, [])

  useEffect(() => {
    const channel = supabase
      .channel('org-chart-profiles')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          if (deriveTier(payload.new) !== 'guest') {
            setProfiles(prev => prev.some(p => p.id === payload.new.id) ? prev : [...prev, payload.new])
          }
        } else if (payload.eventType === 'UPDATE') {
          setProfiles(prev => prev.map(p => p.id === payload.new.id ? { ...p, ...payload.new } : p))
        } else if (payload.eventType === 'DELETE') {
          setProfiles(prev => prev.filter(p => p.id !== payload.old.id))
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  const membersByTag = (tag) => profiles.filter(p => hasTag(p, tag))

  // Include any custom role tags that aren't in the catalog or leadership set
  const catalogTags = new Set([...BUSINESS_ROLES, ...TECHNICAL_ROLES].map(r => r.tag))
  const extraTags = [...new Set(profiles.flatMap(p => p.function_tags || []))]
    .filter(t => !LEADERSHIP_TAGS.has(t) && !catalogTags.has(t))
  const extraTech = extraTags.map(t => ({ tag: t, desc: ROLE_DESC[t] || 'Custom team role.' }))

  const businessRoles = BUSINESS_ROLES
  // Custom (non-catalog) role tags get appended to the last technical group (Software).
  const technicalGroups = TECHNICAL_GROUPS.map((g, i) =>
    i === TECHNICAL_GROUPS.length - 1 && extraTech.length
      ? { ...g, roles: [...g.roles, ...extraTech] }
      : g
  )

  const businessLeads = profiles.filter(p => hasTag(p, 'Business Lead'))
  const technicalLeads = profiles.filter(p => hasTag(p, 'Technical Lead'))
  const softwareLeads = profiles.filter(p => hasTag(p, 'Programming Lead'))
  const projectManagers = profiles.filter(p => hasTag(p, 'Project Manager') || hasTag(p, 'Team Lead'))
  const mentorsCoaches = profiles.filter(p => hasTag(p, 'Mentor') || hasTag(p, 'Coach'))

  const handleCardClick = (profile) => setSelectedProfile(profile)

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="px-4 py-4 pl-14 flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-pastel-blue-dark via-pastel-pink-dark to-pastel-orange-dark bg-clip-text text-transparent flex items-center gap-2">
              <Users size={22} className="text-pastel-pink-dark" />
              Org Chart
            </h1>
            <p className="text-sm text-gray-500">Hover a role for its description · tap a name to view the profile</p>
          </div>
          <NotificationBell />
        </div>
      </header>

      <main className="flex-1 p-4 overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          {loading ? (
            <div className="flex justify-center py-20"><div className="text-sm text-gray-400">Loading team...</div></div>
          ) : profiles.length === 0 ? (
            <div className="flex flex-col items-center py-20 text-gray-400">
              <Users size={48} className="mb-3 opacity-40" />
              <p className="text-sm">No team members found</p>
            </div>
          ) : (
            <>
              {/* Departments: Business (left, orange) · Technical (right — Hardware blue / Software green) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
                <BusinessDepartment roles={businessRoles} leads={businessLeads} membersByTag={membersByTag} onClick={handleCardClick} />
                <TechnicalDepartment groups={technicalGroups} leads={technicalLeads} softwareLeads={softwareLeads} membersByTag={membersByTag} onClick={handleCardClick} />
              </div>

              {/* Project Managers — ombre sticky note, its own box */}
              <ProjectManagerNote people={projectManagers} onClick={handleCardClick} />

              {/* Mentors & Coaches */}
              <LeaderSection title="Mentors & Coaches" icon={GraduationCap} people={mentorsCoaches} onClick={handleCardClick} accent="text-purple-500" />
            </>
          )}
        </div>
      </main>

      {selectedProfile && (
        <ProfileModal profile={selectedProfile} onClose={() => setSelectedProfile(null)} onViewProfile={onViewProfile} />
      )}
    </div>
  )
}

export default OrgChart
