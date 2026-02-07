import { useState, useEffect } from 'react'
import { UserPlus, Trash2, Upload, Shield, Users } from 'lucide-react'
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
    const lines = bulkText.split('\n').map(l => l.trim().toLowerCase()).filter(l => l && l.includes('@'))
    if (lines.length === 0) return
    setError('')

    const entries = lines.map(email => ({
      email,
      role: 'member',
      added_by: user.id,
    }))

    const { data, error: upsertError } = await supabase
      .from('approved_emails')
      .upsert(entries, { onConflict: 'email', ignoreDuplicates: true })
      .select()

    if (upsertError) {
      setError(upsertError.message)
      return
    }

    if (data) {
      setWhitelistedEmails(prev => {
        const existing = new Set(prev.map(e => e.email))
        const newEntries = data.filter(e => !existing.has(e.email))
        return [...newEntries, ...prev]
      })
    }
    setBulkText('')
    setShowBulkImport(false)
  }

  const handleChangeRole = async (memberId, role) => {
    const { error } = await supabase.from('profiles').update({ role }).eq('id', memberId)
    if (!error) {
      setRegisteredMembers(prev => prev.map(m => m.id === memberId ? { ...m, role } : m))
    }
  }

  const bulkCount = bulkText.split('\n').filter(l => l.trim() && l.includes('@')).length

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
                      <button
                        onClick={() => handleRemoveEmail(entry.id)}
                        className="opacity-60 md:opacity-0 md:group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-50 transition-opacity"
                      >
                        <Trash2 size={14} className="text-gray-400 hover:text-red-400" />
                      </button>
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
                ))
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default UserManagement
