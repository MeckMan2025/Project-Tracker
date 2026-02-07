import { useState, useEffect } from 'react'
import { Check, X, Clock } from 'lucide-react'
import { supabase } from '../supabase'
import { useUser } from '../contexts/UserContext'

function RequestsView() {
  const { username } = useUser()
  const [requests, setRequests] = useState([])

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('requests')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
      if (error) {
        console.error('Failed to load requests:', error.message)
        return
      }
      if (data) setRequests(data)
    }
    load()
  }, [])

  useEffect(() => {
    const channel = supabase
      .channel('requests-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'requests' }, (payload) => {
        if (payload.new.status === 'pending') {
          setRequests(prev => {
            if (prev.some(r => r.id === payload.new.id)) return prev
            return [payload.new, ...prev]
          })
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'requests' }, (payload) => {
        if (payload.new.status !== 'pending') {
          setRequests(prev => prev.filter(r => r.id !== payload.new.id))
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'requests' }, (payload) => {
        setRequests(prev => prev.filter(r => r.id !== payload.old.id))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const handleApprove = async (request) => {
    try {
      if (request.type === 'task') {
        const d = request.data
        const task = {
          id: String(Date.now()),
          board_id: request.board_id || 'business',
          title: d.title,
          description: d.description || '',
          assignee: d.assignee || '',
          due_date: d.dueDate || '',
          status: d.status || 'todo',
          skills: d.skills || [],
          created_at: new Date().toISOString().split('T')[0],
        }
        await supabase.from('tasks').insert(task)
      } else if (request.type === 'calendar_event') {
        const d = request.data
        const event = {
          id: String(Date.now()),
          date_key: d.date_key,
          name: d.name,
          description: d.description || '',
          added_by: request.requested_by,
        }
        await supabase.from('calendar_events').insert(event)
      }

      await supabase.from('requests').update({
        status: 'approved',
        reviewed_by: username,
      }).eq('id', request.id)

      setRequests(prev => prev.filter(r => r.id !== request.id))
    } catch (err) {
      console.error('Error approving request:', err)
    }
  }

  const handleDeny = async (request) => {
    try {
      await supabase.from('requests').update({
        status: 'denied',
        reviewed_by: username,
      }).eq('id', request.id)

      setRequests(prev => prev.filter(r => r.id !== request.id))
    } catch (err) {
      console.error('Error denying request:', err)
    }
  }

  const formatDate = (timestamp) => {
    const date = new Date(timestamp)
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  }

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="py-4 px-4 flex items-center">
          <div className="w-10 shrink-0" />
          <div className="flex-1 text-center">
            <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-pastel-blue-dark via-pastel-pink-dark to-pastel-orange-dark bg-clip-text text-transparent">
              Requests
            </h1>
            <p className="text-sm text-gray-500">
              {requests.length} pending {requests.length === 1 ? 'request' : 'requests'}
            </p>
          </div>
          <div className="w-10 shrink-0" />
        </div>
      </header>

      <main className="flex-1 p-4 overflow-y-auto">
        <div className="max-w-2xl mx-auto space-y-3">
          {requests.length === 0 ? (
            <div className="text-center mt-20">
              <Clock size={48} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-400">No pending requests</p>
            </div>
          ) : (
            requests.map((r) => (
              <div
                key={r.id}
                className="bg-white rounded-xl shadow-sm border border-gray-100 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        r.type === 'task'
                          ? 'bg-pastel-pink/40 text-pastel-pink-dark'
                          : 'bg-pastel-orange/40 text-pastel-orange-dark'
                      }`}>
                        {r.type === 'task' ? 'Task' : 'Calendar Event'}
                      </span>
                      <span className="text-xs text-gray-400">{formatDate(r.created_at)}</span>
                    </div>
                    <p className="text-sm font-semibold text-gray-700">
                      {r.data?.title || r.data?.name}
                    </p>
                    {r.data?.description && (
                      <p className="text-xs text-gray-500 mt-0.5">{r.data.description}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      Requested by <span className="font-medium text-pastel-pink-dark">{r.requested_by}</span>
                      {r.board_id && r.type === 'task' && (
                        <> for board <span className="font-medium">{r.board_id}</span></>
                      )}
                    </p>
                    {r.type === 'task' && r.data?.assignee && (
                      <p className="text-xs text-gray-400">Assignee: {r.data.assignee}</p>
                    )}
                    {r.type === 'calendar_event' && r.data?.date_key && (
                      <p className="text-xs text-gray-400">Date: {r.data.date_key}</p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => handleApprove(r)}
                      className="p-2 rounded-lg bg-green-50 hover:bg-green-100 text-green-600 transition-colors"
                      title="Approve"
                    >
                      <Check size={18} />
                    </button>
                    <button
                      onClick={() => handleDeny(r)}
                      className="p-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 transition-colors"
                      title="Deny"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  )
}

export default RequestsView
