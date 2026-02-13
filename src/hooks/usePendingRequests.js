import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase'
import { useUser } from '../contexts/UserContext'

export function usePendingRequests({ type, boardId } = {}) {
  const { username, user } = useUser()
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
        reviewed_at: new Date().toISOString(),
      }).eq('id', request.id)

      // Notify requester
      if (request.requested_by_user_id) {
        await supabase.from('notifications').insert({
          id: String(Date.now()) + Math.random().toString(36).slice(2),
          user_id: request.requested_by_user_id,
          type: 'request_approved',
          title: 'Request Approved',
          body: `Your ${request.type === 'task' ? 'task' : 'event'} request "${request.data?.title || request.data?.name}" was approved by ${username}.`,
        })
      }

      setRequests(prev => prev.filter(r => r.id !== request.id))
    } catch (err) {
      console.error('Error approving request:', err)
    }
  }, [username])

  const handleDeny = useCallback(async (request, reason = '') => {
    try {
      await supabase.from('requests').update({
        status: 'denied',
        reviewed_by: username,
        reviewed_at: new Date().toISOString(),
        decision_reason: reason,
      }).eq('id', request.id)

      // Notify requester
      if (request.requested_by_user_id) {
        await supabase.from('notifications').insert({
          id: String(Date.now()) + Math.random().toString(36).slice(2),
          user_id: request.requested_by_user_id,
          type: 'request_denied',
          title: 'Request Denied',
          body: `Your ${request.type === 'task' ? 'task' : 'event'} request "${request.data?.title || request.data?.name}" was denied by ${username}.${reason ? ' Reason: ' + reason : ''}`,
        })
      }

      setRequests(prev => prev.filter(r => r.id !== request.id))
    } catch (err) {
      console.error('Error denying request:', err)
    }
  }, [username])

  const handleRemind = useCallback(async (request) => {
    if (!user) return { success: false, error: 'Not logged in' }

    try {
      // Check cooldown (1 hour)
      const { data: recentReminders } = await supabase
        .from('request_reminders')
        .select('reminded_at')
        .eq('request_id', request.id)
        .eq('reminded_by_user_id', user.id)
        .order('reminded_at', { ascending: false })
        .limit(1)

      if (recentReminders && recentReminders.length > 0) {
        const lastRemind = new Date(recentReminders[0].reminded_at)
        const hourAgo = new Date(Date.now() - 60 * 60 * 1000)
        if (lastRemind > hourAgo) {
          return { success: false, error: 'Please wait 1 hour between reminders' }
        }
      }

      // Insert reminder record
      await supabase.from('request_reminders').insert({
        id: String(Date.now()) + Math.random().toString(36).slice(2),
        request_id: request.id,
        reminded_by_user_id: user.id,
      })

      // Get all top-tier approvers
      const { data: approvers } = await supabase
        .from('profiles')
        .select('id')
        .eq('authority_tier', 'top')

      // Insert notification for each approver
      if (approvers && approvers.length > 0) {
        const notifications = approvers.map(a => ({
          id: String(Date.now()) + Math.random().toString(36).slice(2) + a.id.slice(0, 4),
          user_id: a.id,
          type: 'request_reminder',
          title: 'Request Reminder',
          body: `${username} is reminding you about a pending ${request.type === 'task' ? 'task' : 'event'} request: "${request.data?.title || request.data?.name}"`,
        }))
        await supabase.from('notifications').insert(notifications)
      }

      return { success: true }
    } catch (err) {
      console.error('Error sending reminder:', err)
      return { success: false, error: err.message }
    }
  }, [user, username])

  return { requests, count: requests.length, handleApprove, handleDeny, handleRemind }
}
