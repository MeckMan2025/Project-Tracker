import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase'

const REST_URL = import.meta.env.VITE_SUPABASE_URL
const REST_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const REST_HEADERS = { 'apikey': REST_KEY, 'Authorization': `Bearer ${REST_KEY}` }

async function restGet(table, query = '') {
  const res = await fetch(`${REST_URL}/rest/v1/${table}?${query}`, { headers: REST_HEADERS })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export function useNotebookFlash() {
  const [activeFlash, setActiveFlash] = useState(null)
  const [presentUsers, setPresentUsers] = useState([])
  const [completedUsers, setCompletedUsers] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchFlashState = useCallback(async () => {
    try {
      // 1. Get the active flash (if any)
      const flashes = await restGet('notebook_flash', 'is_active=eq.true&limit=1')
      const flash = flashes[0] || null
      setActiveFlash(flash)

      if (!flash) {
        setPresentUsers([])
        setCompletedUsers([])
        setLoading(false)
        return
      }

      // 2. Get present users from the attendance session
      const records = await restGet('attendance_records', `session_id=eq.${flash.session_id}&status=eq.present&select=username`)
      const present = records.map(r => r.username)
      setPresentUsers(present)

      // 3. Get entries linked to this flash, then their participants
      const entries = await restGet('notebook_entries', `flash_id=eq.${flash.id}&select=id`)
      const entryIds = entries.map(e => e.id)

      if (entryIds.length > 0) {
        // Fetch participants for all flash entries
        const filter = entryIds.map(id => `entry_id.eq.${id}`).join(',')
        const participants = await restGet('notebook_entry_participants', `or=(${filter})&select=username`)
        const completed = [...new Set(participants.map(p => p.username))]
        setCompletedUsers(completed)
      } else {
        setCompletedUsers([])
      }
    } catch (err) {
      console.error('Failed to fetch flash state:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial load
  useEffect(() => {
    fetchFlashState()
  }, [fetchFlashState])

  // Realtime subscriptions
  useEffect(() => {
    const channel = supabase
      .channel('notebook-flash-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notebook_flash' }, () => {
        fetchFlashState()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notebook_entry_participants' }, () => {
        fetchFlashState()
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notebook_entries' }, (payload) => {
        // Only refetch if the new entry has a flash_id
        if (payload.new?.flash_id) fetchFlashState()
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [fetchFlashState])

  return {
    activeFlash,
    presentUsers,
    completedUsers,
    exemptUsers: activeFlash?.exempt_users || [],
    loading,
    refetch: fetchFlashState,
  }
}
