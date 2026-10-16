import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { restHeaders } from '../lib/restHeaders'
import { storedTeamScope } from '../lib/teamScope'

// One scouting day's setup document, kept current. Null until it has loaded
// or when there is no such day. Pass null for no day at all.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL

export function useDayDoc(scheduleId) {
  const [doc, setDoc] = useState(null)

  useEffect(() => {
    setDoc(null)
    if (!scheduleId) return
    let active = true
    const load = async () => {
      try {
        const res = await fetch(
          `${supabaseUrl}/rest/v1/scouting_schedule?${storedTeamScope()}&id=eq.${encodeURIComponent(scheduleId)}&select=data`,
          { headers: restHeaders() }
        )
        if (!res.ok) return
        const rows = await res.json()
        if (active) setDoc(rows?.[0]?.data || {})
      } catch { /* the next change reloads it */ }
    }
    load()
    const channel = supabase
      .channel(`day-doc-${scheduleId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scouting_schedule' }, (payload) => {
        if (payload.new?.id === scheduleId && payload.new?.data) setDoc(payload.new.data)
      })
      .subscribe()
    return () => { active = false; supabase.removeChannel(channel) }
  }, [scheduleId])

  return doc
}
