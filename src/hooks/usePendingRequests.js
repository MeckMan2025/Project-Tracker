import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase'
import { useUser } from '../contexts/UserContext'

export function usePendingRequests({ type, boardId } = {}) {
  const { username } = useUser()
  const [requests, setRequests] = useState([])

  useEffect(() => {
    async function load() {
      let query = supabase
        .from('requests')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

      if (type) query = query.eq('type', type)
      if (boardId) query = query.eq('board_id', boardId)

      const { data, error } = await query
      if (error) {
        console.error('Failed to load requests:', error.message)
        return
      }
      if (data) setRequests(data)
    }
    load()
  }, [type, boardId])

  useEffect(() => {
    const channelName = `requests-badge-${type || 'all'}-${boardId || 'all'}`
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'requests' }, (payload) => {
        const r = payload.new
        if (r.status !== 'pending') return
        if (type && r.type !== type) return
        if (boardId && r.board_id !== boardId) return
        setRequests(prev => {
          if (prev.some(x => x.id === r.id)) return prev
          return [r, ...prev]
        })
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
  }, [type, boardId])

  const handleApprove = useCallback(async (request) => {
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
  }, [username])

  const handleDeny = useCallback(async (request) => {
    try {
      await supabase.from('requests').update({
        status: 'denied',
        reviewed_by: username,
      }).eq('id', request.id)

      setRequests(prev => prev.filter(r => r.id !== request.id))
    } catch (err) {
      console.error('Error denying request:', err)
    }
  }, [username])

  return { requests, count: requests.length, handleApprove, handleDeny }
}
