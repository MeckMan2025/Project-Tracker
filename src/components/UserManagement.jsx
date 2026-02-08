import { useState, useEffect } from 'react'
import { UserPlus, Trash2, Upload, Shield, Users, KeyRound } from 'lucide-react'
import { supabase } from '../supabase'
import { useUser } from '../contexts/UserContext'

function UserManagement() {
  const { user } = useUser()
  const [whitelistedEmails, setWhitelistedEmails] = useState([])
  const [registeredMembers, setRegisteredMembers] = useState([])
  const [activeSection, setActiveSection] = useState('whitelist')
  const [showAddForm, setShowAddForm] = useState(false)
  const [showBulkImport, setShowBulkImport] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newRole, setNewRole] = useState('member')
  const [bulkText, setBulkText] = useState('')
  const [error, setError] = useState('')
  const [resetTarget, setResetTarget] = useState(null)
  const [resetPassword, setResetPassword] = useState('')
  const [resetError, setResetError] = useState('')
  const [resetSuccess, setResetSuccess] = useState('')
  const [resetSubmitting, setResetSubmitting] = useState(false)
  const [createTarget, setCreateTarget] = useState(null)
  const [createDisplayName, setCreateDisplayName] = useState('')
  const [createPassword, setCreatePassword] = useState('')
  const [createError, setCreateError] = useState('')
  const [createSuccess, setCreateSuccess] = useState('')
  const [createSubmitting, setCreateSubmitting] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: emails } = await supabase
        .from('approved_emails')
        .select('*')
        .order('created_at', { ascending: false })
      if (emails) setWhitelistedEmails(emails)

      const { data: members } = await supabase
        .from('profiles')
        .select('id, display_name, role, created_at')
        .order('created_at', { ascending: false })
      if (members) setRegisteredMembers(members)
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

  const handleAddEmail = async (e) => {
    e.preventDefault()
    if (!newEmail.trim()) return
    setError('')

    const { data, error: insertError } = await supabase
      .from('approved_emails')
      .insert({
        email: newEmail.toLowerCase().trim(),
        role: newRole,
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
    setNewRole('member')
    setShowAddForm(false)
  }

  const handleRemoveEmail = async (id) => {
    const { error } = await supabase.from('approved_emails').delete().eq('id', id)
    if (!error) {
      setWhitelistedEmails(prev => prev.filter(e => e.id !== id))
    }
  }

  const handleBulkImport = async () => {
    // Split on newlines, commas, semicolons, or spaces to handle any format
    const lines = bulkText
      .split(/[\n,;\s]+/)
      .map(l => l.trim().toLowerCase())
      .filter(l => l && l.includes('@'))
    if (lines.length === 0) {
      setError('No valid emails found. Paste emails separated by newlines, commas, or spaces.')
      return
    }
    setError('')

    // Insert one at a time to avoid upsert issues with RLS
    let added = []
    let failed = 0
    for (const email of lines) {
      const { data, error: insertError } = await supabase
        .from('approved_emails')
        .insert({ email, role: 'member', added_by: user.id })
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

  const handleChangeRole = async (memberId, role) => {
    const { error } = await supabase.from('profiles').update({ role }).eq('id', memberId)
    if (!error) {
      setRegisteredMembers(prev => prev.map(m => m.id === memberId ? { ...m, role } : m))
    }
  }

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
      // Add to members list
      setRegisteredMembers(prev => [{
        id: data.userId,
        display_name: data.displayName,
        role: createTarget.role,
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

  const roleBadge = (role) => {
    const colors = {
      lead: 'bg-pastel-orange/50 text-orange-700',
      mentor: 'bg-pastel-blue/50 text-blue-700',
      coach: 'bg-purple-100 text-purple-700',
      member: 'bg-gray-100 text-gray-600',
    }
    return colors[role] || colors.member
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
          <div className="w-10 shrink-0" />
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
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-pastel-blue focus:border-transparent text-sm"
                  >
                    <option value="member">Member</option>
                    <option value="lead">Lead</option>
                    <option value="mentor">Mentor</option>
                    <option value="coach">Coach</option>
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
                  <p className="text-sm text-gray-500">Paste email addresses, one per line. All will be added as &quot;member&quot; role.</p>
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
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full mr-3 ${roleBadge(entry.role)}`}>
                        {entry.role}
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
                registeredMembers.map((member) => (
                  <div key={member.id} className="flex items-center justify-between bg-white rounded-xl shadow-sm border border-gray-100 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-gray-700 block truncate">{member.display_name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { setResetTarget(member); setResetPassword(''); setResetError(''); setResetSuccess('') }}
                        title="Reset password"
                        className="p-1.5 rounded-lg hover:bg-pastel-blue/20 transition-colors"
                      >
                        <KeyRound size={14} className="text-gray-400 hover:text-pastel-blue-dark" />
                      </button>
                      <select
                        value={member.role}
                        onChange={(e) => handleChangeRole(member.id, e.target.value)}
                        className="text-xs border rounded-lg px-2 py-1 focus:ring-2 focus:ring-pastel-blue focus:border-transparent"
                      >
                        <option value="member">member</option>
                        <option value="lead">lead</option>
                        <option value="mentor">mentor</option>
                        <option value="coach">coach</option>
                      </select>
                    </div>
                  </div>
                ))
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
    </div>
  )
}

export default UserManagement
