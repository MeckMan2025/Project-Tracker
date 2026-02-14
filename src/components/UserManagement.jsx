import { useState, useEffect } from 'react'
import { UserPlus, Trash2, Upload, Shield, Users, KeyRound, Info, X } from 'lucide-react'
import { supabase } from '../supabase'
import { useUser } from '../contexts/UserContext'
import { usePermissions } from '../hooks/usePermissions'

const ALL_ROLES = [
  'Mentor', 'Coach', 'Team Lead', 'Business Lead', 'Technical Lead',
  'Website', 'Build', 'CAD', 'Scouting', 'Outreach', 'Communications', 'Programming',
]

const ROLE_DESCRIPTIONS = {
  'Mentor': 'TBD',
  'Coach': 'TBD',
  'Team Lead': 'TBD',
  'Business Lead': 'TBD',
  'Technical Lead': 'TBD',
  'Website': 'TBD',
  'Build': 'TBD',
  'CAD': 'TBD',
  'Scouting': 'TBD',
  'Outreach': 'TBD',
  'Communications': 'TBD',
  'Programming': 'TBD',
}

function UserManagement() {
  const { user } = useUser()
  const { isAuthorityAdmin, canManageUsers, isTop } = usePermissions()
  const [whitelistedEmails, setWhitelistedEmails] = useState([])
  const [registeredMembers, setRegisteredMembers] = useState([])
  const [activeSection, setActiveSection] = useState('whitelist')
  const [showAddForm, setShowAddForm] = useState(false)
  const [showBulkImport, setShowBulkImport] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newTier, setNewTier] = useState('teammate')
  const [bulkText, setBulkText] = useState('')
  const [error, setError] = useState('')
  const [resetTarget, setResetTarget] = useState(null)
  const [resetPassword, setResetPassword] = useState('')
  const [resetError, setResetError] = useState('')
  const [resetSuccess, setResetSuccess] = useState('')
  const [resetSubmitting, setResetSubmitting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteSubmitting, setDeleteSubmitting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [createTarget, setCreateTarget] = useState(null)
  const [createDisplayName, setCreateDisplayName] = useState('')
  const [createPassword, setCreatePassword] = useState('')
  const [createError, setCreateError] = useState('')
  const [createSuccess, setCreateSuccess] = useState('')
  const [createSubmitting, setCreateSubmitting] = useState(false)
  const [showRoleInfo, setShowRoleInfo] = useState(false)
  const [debugMsg, setDebugMsg] = useState('Loading...')

  useEffect(() => {
    async function load() {
      let msg = ''
      const { data: emails, error: emailErr } = await supabase
        .from('approved_emails')
        .select('*')
        .order('created_at', { ascending: false })
      if (emailErr) msg += 'Whitelist error: ' + emailErr.message + ' | '
      else msg += 'Whitelist: ' + (emails ? emails.length : 0) + ' rows | '
      if (emails) setWhitelistedEmails(emails)

      const { data: members, error: memberErr } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })
      if (memberErr) msg += 'Members error: ' + memberErr.message
      else msg += 'Members: ' + (members ? members.length : 0) + ' rows'
      if (members) setRegisteredMembers(members)

      setDebugMsg(msg)
    }
    load()
  }, [])

  useEffect(() => {
    const channel = supabase
      .channel('approved-emails-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'approved_emails' }, (payload) => {
        setWhitelistedEmails(prev => {
          if (prev.some(e => e.id === payload.new.id)) return prev
          return [payload.new, ...prev]
        })
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'approved_emails' }, (payload) => {
        setWhitelistedEmails(prev => prev.filter(e => e.id !== payload.old.id))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  // --- Whitelist handlers ---

  const handleAddEmail = async (e) => {
    e.preventDefault()
    if (!newEmail.trim()) return
    setError('')

    const { data, error: insertError } = await supabase
      .from('approved_emails')
      .insert({
        email: newEmail.toLowerCase().trim(),
        role: newTier,
        added_by: user.id,
      })
      .select()
      .single()

    if (insertError) {
      if (insertError.message.includes('duplicate') || insertError.code === '23505') {
        setError('This email is already on the whitelist')
      } else {
        setError(insertError.message)
      }
      return
    }

    if (data) {
      setWhitelistedEmails(prev => [data, ...prev])
    }
    setNewEmail('')
    setNewTier('teammate')
    setShowAddForm(false)
  }

  const handleRemoveEmail = async (id) => {
    const { error } = await supabase.from('approved_emails').delete().eq('id', id)
    if (!error) {
      setWhitelistedEmails(prev => prev.filter(e => e.id !== id))
    }
  }

  const handleBulkImport = async () => {
    const lines = bulkText
      .split(/[\n,;\s]+/)
      .map(l => l.trim().toLowerCase())
      .filter(l => l && l.includes('@'))
    if (lines.length === 0) {
      setError('No valid emails found. Paste emails separated by newlines, commas, or spaces.')
      return
    }
    setError('')

    let added = []
    let failed = 0
    for (const email of lines) {
      const { data, error: insertError } = await supabase
        .from('approved_emails')
        .insert({ email, role: 'teammate', added_by: user.id })
        .select()
        .single()

      if (insertError) {
        failed++
      } else if (data) {
        added.push(data)
      }
    }

    if (added.length > 0) {
      setWhitelistedEmails(prev => [...added, ...prev])
    }

    if (failed > 0 && added.length > 0) {
      setError(`Added ${added.length} emails. ${failed} skipped (duplicates or errors).`)
    } else if (failed > 0 && added.length === 0) {
      setError(`All ${failed} emails were already on the whitelist or failed to add.`)
    } else {
      setBulkText('')
      setShowBulkImport(false)
    }
  }

  // --- Member role toggle ---

  const handleToggleRole = async (memberId, role) => {
    const member = registeredMembers.find(m => m.id === memberId)
    if (!member) return
    const currentRoles = member.function_tags || []
    const updated = currentRoles.includes(role)
      ? currentRoles.filter(r => r !== role)
      : [...currentRoles, role]
    const { error } = await supabase.from('profiles').update({ function_tags: updated }).eq('id', memberId)
    if (!error) {
      setRegisteredMembers(prev => prev.map(m => m.id === memberId ? { ...m, function_tags: updated } : m))
    }
  }

  // --- Modal handlers ---

  const handleResetPassword = async () => {
    setResetError('')
    setResetSuccess('')
    if (resetPassword.length < 6) {
      setResetError('Password must be at least 6 characters')
      return
    }
    setResetSubmitting(true)
    try {
      const { data, error } = await supabase.functions.invoke('admin-reset-password', {
        body: { userId: resetTarget.id, newPassword: resetPassword },
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      setResetSuccess(`Password reset successfully. Tell ${resetTarget.display_name} their temporary password.`)
      setResetPassword('')
    } catch (err) {
      setResetError(err.message)
    } finally {
      setResetSubmitting(false)
    }
  }

  const handleDeleteMember = async () => {
    setDeleteError('')
    setDeleteSubmitting(true)
    try {
      const { data, error } = await supabase.functions.invoke('admin-delete-user', {
        body: { userId: deleteTarget.id },
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      setRegisteredMembers(prev => prev.filter(m => m.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch (err) {
      setDeleteError(err.message)
    } finally {
      setDeleteSubmitting(false)
    }
  }

  const handleCreateAccount = async () => {
    setCreateError('')
    setCreateSuccess('')
    if (!createDisplayName.trim()) {
      setCreateError('Display name is required')
      return
    }
    if (createPassword.length < 6) {
      setCreateError('Password must be at least 6 characters')
      return
    }
    setCreateSubmitting(true)
    try {
      const { data, error } = await supabase.functions.invoke('admin-create-user', {
        body: {
          email: createTarget.email,
          password: createPassword,
          displayName: createDisplayName.trim(),
          role: createTarget.role,
        },
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      setCreateSuccess(`Account created for ${createDisplayName.trim()}. Tell them their temporary password.`)
      setRegisteredMembers(prev => [{
        id: data.userId,
        display_name: data.displayName,
        authority_tier: createTarget.role === 'guest' ? 'guest' : 'teammate',
        created_at: new Date().toISOString(),
      }, ...prev])
      setCreateDisplayName('')
      setCreatePassword('')
    } catch (err) {
      setCreateError(err.message)
    } finally {
      setCreateSubmitting(false)
    }
  }

  const bulkCount = bulkText.split(/[\n,;\s]+/).filter(l => l.trim() && l.includes('@')).length

  const tagColors = [
    'bg-purple-100 text-purple-700',
    'bg-green-100 text-green-700',
    'bg-pastel-pink/50 text-pink-700',
    'bg-blue-100 text-blue-700',
    'bg-orange-100 text-orange-700',
    'bg-teal-100 text-teal-700',
  ]

  const getTagColor = (tag) => {
    let hash = 0
    for (let i = 0; i < tag.length; i++) hash = tag.charCodeAt(i) + ((hash << 5) - hash)
    return tagColors[Math.abs(hash) % tagColors.length]
  }

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="py-4 px-4 flex items-center">
          <div className="w-10 shrink-0" />
          <div className="flex-1 text-center">
            <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-pastel-blue-dark via-pastel-pink-dark to-pastel-orange-dark bg-clip-text text-transparent">
              User Management
            </h1>
            <p className="text-sm text-gray-500">Manage team access</p>
          </div>
          <button
            onClick={() => setShowRoleInfo(true)}
            className="w-10 shrink-0 flex items-center justify-center p-1.5 rounded-lg hover:bg-pastel-blue/20 transition-colors"
            title="Role descriptions"
          >
            <Info size={18} className="text-gray-400" />
          </button>
        </div>
        <div className="flex border-t">
          <button
            onClick={() => setActiveSection('whitelist')}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              activeSection === 'whitelist'
                ? 'text-pastel-pink-dark border-b-2 border-pastel-pink-dark'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Shield size={14} className="inline mr-1" />
            Whitelist ({whitelistedEmails.length})
          </button>
          <button
            onClick={() => setActiveSection('members')}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              activeSection === 'members'
                ? 'text-pastel-pink-dark border-b-2 border-pastel-pink-dark'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Users size={14} className="inline mr-1" />
            Members ({registeredMembers.length})
          </button>
        </div>
      </header>

      <main className="flex-1 p-4 overflow-y-auto">
        <div className="max-w-2xl mx-auto">
          {debugMsg && <p className="text-xs text-red-500 mb-2 bg-red-50 p-2 rounded">{debugMsg}</p>}
          {activeSection === 'whitelist' ? (
            <>
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => { setShowAddForm(true); setShowBulkImport(false); setError('') }}
                  className="flex items-center gap-2 px-3 py-2 bg-pastel-pink hover:bg-pastel-pink-dark rounded-lg transition-colors text-sm text-gray-700"
                >
                  <UserPlus size={16} />
                  Add Email
                </button>
                <button
                  onClick={() => { setShowBulkImport(true); setShowAddForm(false); setError('') }}
                  className="flex items-center gap-2 px-3 py-2 bg-pastel-blue hover:bg-pastel-blue-dark rounded-lg transition-colors text-sm text-gray-700"
                >
                  <Upload size={16} />
                  Bulk Import
                </button>
              </div>

              {showAddForm && (
                <form onSubmit={handleAddEmail} className="bg-white rounded-xl shadow-sm border p-4 mb-4 space-y-3">
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="Email address"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-pastel-blue focus:border-transparent text-sm"
                    autoFocus
                    required
                  />
                  <select
                    value={newTier}
                    onChange={(e) => setNewTier(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-pastel-blue focus:border-transparent text-sm"
                  >
                    <option value="teammate">Member</option>
                    <option value="guest">Guest</option>
                  </select>
                  {error && <p className="text-sm text-red-500">{error}</p>}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => { setShowAddForm(false); setError('') }}
                      className="flex-1 px-3 py-2 text-sm border rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 px-3 py-2 text-sm bg-pastel-pink hover:bg-pastel-pink-dark rounded-lg"
                    >
                      Add
                    </button>
                  </div>
                </form>
              )}

              {showBulkImport && (
                <div className="bg-white rounded-xl shadow-sm border p-4 mb-4 space-y-3">
                  <p className="text-sm text-gray-500">Paste email addresses, one per line. All will be added as &quot;teammate&quot; tier.</p>
                  <textarea
                    value={bulkText}
                    onChange={(e) => setBulkText(e.target.value)}
                    placeholder={"student1@school.edu\nstudent2@school.edu\nstudent3@school.edu"}
                    rows={6}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-pastel-blue focus:border-transparent text-sm font-mono"
                    autoFocus
                  />
                  {error && <p className="text-sm text-red-500">{error}</p>}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => { setShowBulkImport(false); setBulkText(''); setError('') }}
                      className="flex-1 px-3 py-2 text-sm border rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleBulkImport}
                      className="flex-1 px-3 py-2 text-sm bg-pastel-blue hover:bg-pastel-blue-dark rounded-lg"
                    >
                      Import {bulkCount} email{bulkCount !== 1 ? 's' : ''}
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {whitelistedEmails.length === 0 ? (
                  <p className="text-center text-gray-400 mt-10">No whitelisted emails yet. Add emails to allow team members to sign up.</p>
                ) : (
                  whitelistedEmails.map((entry) => (
                    <div key={entry.id} className="group flex items-center justify-between bg-white rounded-xl shadow-sm border border-gray-100 px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-gray-700 block truncate">{entry.email}</span>
                      </div>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full mr-3 ${
                        entry.role === 'guest' ? 'bg-yellow-100 text-yellow-700' : 'bg-pastel-blue/50 text-blue-700'
                      }`}>
                        {entry.role === 'guest' ? 'Guest' : 'Member'}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => { setCreateTarget(entry); setCreateDisplayName(''); setCreatePassword(''); setCreateError(''); setCreateSuccess('') }}
                          title="Create account"
                          className="p-1.5 rounded-lg hover:bg-pastel-blue/20 transition-colors"
                        >
                          <UserPlus size={14} className="text-gray-400 hover:text-pastel-blue-dark" />
                        </button>
                        <button
                          onClick={() => handleRemoveEmail(entry.id)}
                          className="opacity-60 md:opacity-0 md:group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-50 transition-opacity"
                        >
                          <Trash2 size={14} className="text-gray-400 hover:text-red-400" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <div className="space-y-2">
              {registeredMembers.length === 0 ? (
                <p className="text-center text-gray-400 mt-10">No registered members yet.</p>
              ) : (
                registeredMembers.map((member) => {
                  const memberRoles = member.function_tags || []

                  return (
                    <div key={member.id} className="group bg-white rounded-xl shadow-sm border border-gray-100 px-4 py-3">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-sm font-medium text-gray-700 truncate">{member.display_name}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => { setResetTarget(member); setResetPassword(''); setResetError(''); setResetSuccess('') }}
                            title="Reset password"
                            className="p-1.5 rounded-lg hover:bg-pastel-blue/20 transition-colors"
                          >
                            <KeyRound size={14} className="text-gray-400 hover:text-pastel-blue-dark" />
                          </button>
                          {member.id !== user.id && (
                            <button
                              onClick={() => { setDeleteTarget(member); setDeleteError('') }}
                              title="Delete member"
                              className="p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                            >
                              <Trash2 size={14} className="text-gray-400 hover:text-red-400" />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {ALL_ROLES.map(role => {
                          const active = memberRoles.includes(role)
                          return (
                            <button
                              key={role}
                              onClick={() => handleToggleRole(member.id, role)}
                              className={`text-xs px-2.5 py-1 rounded-full font-medium transition-all ${
                                active
                                  ? getTagColor(role)
                                  : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                              }`}
                            >
                              {role}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )}
        </div>
      </main>

      {/* Create Account Modal */}
      {createTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm space-y-4">
            <h3 className="font-semibold text-gray-700">
              Create Account
            </h3>
            <p className="text-sm text-gray-500">{createTarget.email}</p>
            <input
              type="text"
              value={createDisplayName}
              onChange={(e) => { setCreateDisplayName(e.target.value); setCreateError(''); setCreateSuccess('') }}
              placeholder="Display name"
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-pastel-blue focus:border-transparent"
              autoFocus
            />
            <input
              type="password"
              value={createPassword}
              onChange={(e) => { setCreatePassword(e.target.value); setCreateError(''); setCreateSuccess('') }}
              placeholder="Temporary password (min 6 characters)"
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-pastel-blue focus:border-transparent"
            />
            {createError && <p className="text-sm text-red-500">{createError}</p>}
            {createSuccess && <p className="text-sm text-green-600">{createSuccess}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => setCreateTarget(null)}
                className="flex-1 px-3 py-2 text-sm border rounded-lg hover:bg-gray-50"
              >
                {createSuccess ? 'Close' : 'Cancel'}
              </button>
              {!createSuccess && (
                <button
                  onClick={handleCreateAccount}
                  disabled={createSubmitting || !createDisplayName || !createPassword}
                  className="flex-1 px-3 py-2 text-sm bg-pastel-pink hover:bg-pastel-pink-dark disabled:opacity-50 rounded-lg font-medium text-gray-700"
                >
                  {createSubmitting ? 'Creating...' : 'Create Account'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Member Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm space-y-4">
            <h3 className="font-semibold text-gray-700">
              Remove {deleteTarget.display_name}?
            </h3>
            <p className="text-sm text-gray-500">
              This will permanently delete their account. They will need to be re-created to access the app again.
            </p>
            {deleteError && <p className="text-sm text-red-500">{deleteError}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 px-3 py-2 text-sm border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteMember}
                disabled={deleteSubmitting}
                className="flex-1 px-3 py-2 text-sm bg-red-500 hover:bg-red-600 disabled:opacity-50 rounded-lg font-medium text-white"
              >
                {deleteSubmitting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password Reset Modal */}
      {resetTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm space-y-4">
            <h3 className="font-semibold text-gray-700">
              Reset Password for {resetTarget.display_name}
            </h3>
            <input
              type="password"
              value={resetPassword}
              onChange={(e) => { setResetPassword(e.target.value); setResetError(''); setResetSuccess('') }}
              placeholder="New password (min 6 characters)"
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-pastel-blue focus:border-transparent"
              autoFocus
            />
            {resetError && <p className="text-sm text-red-500">{resetError}</p>}
            {resetSuccess && <p className="text-sm text-green-600">{resetSuccess}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => setResetTarget(null)}
                className="flex-1 px-3 py-2 text-sm border rounded-lg hover:bg-gray-50"
              >
                {resetSuccess ? 'Close' : 'Cancel'}
              </button>
              {!resetSuccess && (
                <button
                  onClick={handleResetPassword}
                  disabled={resetSubmitting || !resetPassword}
                  className="flex-1 px-3 py-2 text-sm bg-pastel-pink hover:bg-pastel-pink-dark disabled:opacity-50 rounded-lg font-medium text-gray-700"
                >
                  {resetSubmitting ? 'Resetting...' : 'Reset'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Role Descriptions Modal */}
      {showRoleInfo && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm space-y-3 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-700">Role Permissions</h3>
              <button onClick={() => setShowRoleInfo(false)} className="p-1 rounded hover:bg-gray-100">
                <X size={16} className="text-gray-400" />
              </button>
            </div>
            <div className="space-y-2">
              {ALL_ROLES.map(role => (
                <div key={role} className="flex items-start gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 mt-0.5 ${getTagColor(role)}`}>{role}</span>
                  <p className="text-sm text-gray-600">{ROLE_DESCRIPTIONS[role]}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default UserManagement
