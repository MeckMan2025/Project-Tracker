import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'
import { useUser } from '../contexts/UserContext'

// Who is scouting what, right now, on a live Competition Day.
//
// A form announces the job it is on (team and match, or a pit visit) over a
// presence channel for that day; the board listens and shows the row as
// "scouting now" with the name. Presence, not a table: it is true only while
// the form is open, and it should vanish the moment the phone locks or the
// form closes, which is exactly what presence does and a row would not.

const channelName = (dayId) => `scouting-now-${dayId}`

// Call from a form while it is open on a live day. `job` is
// { kind: 'match', team, match } or { kind: 'pit', team }, or null for nothing.
export function useAnnounceScouting(dayId, job) {
  const { username } = useUser()
  const channelRef = useRef(null)
  const joinedRef = useRef(false)
  const jobRef = useRef(job)
  jobRef.current = job

  // Send whatever the current job is. Only once the channel has joined:
  // a track() sent before then is dropped, and nothing resends it.
  const push = () => {
    const ch = channelRef.current
    if (!ch || !joinedRef.current) return
    const j = jobRef.current
    if (!j || !j.team) { ch.untrack(); return }
    ch.track({ ...j, since: new Date().toISOString() })
  }

  const key = `${dayId || ''}|${username || ''}`
  useEffect(() => {
    if (!dayId || !username) return
    joinedRef.current = false
    const channel = supabase.channel(channelName(dayId), { config: { presence: { key: username } } })
    channelRef.current = channel
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') { joinedRef.current = true; push() }
      else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') { joinedRef.current = false }
    })
    return () => {
      joinedRef.current = false
      channelRef.current = null
      channel.untrack()
      supabase.removeChannel(channel)
    }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  const jobKey = job ? `${job.kind}|${job.team || ''}|${job.match || ''}` : ''
  useEffect(() => { push() }, [jobKey, key]) // eslint-disable-line react-hooks/exhaustive-deps
}

// Call from the board. Returns [{ username, kind, team, match, since }].
export function useWhoIsScouting(dayId) {
  const [who, setWho] = useState([])
  useEffect(() => {
    if (!dayId) { setWho([]); return }
    const channel = supabase.channel(channelName(dayId), { config: { presence: { key: `watch-${Math.random().toString(36).slice(2)}` } } })
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        const out = []
        Object.entries(state).forEach(([username, list]) => {
          if (username.startsWith('watch-')) return
          const p = list[list.length - 1]
          if (p?.team) out.push({ username, kind: p.kind, team: String(p.team).trim(), match: p.match == null ? '' : String(p.match).trim(), since: p.since })
        })
        setWho(out)
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [dayId])
  return who
}
