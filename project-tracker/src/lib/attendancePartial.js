import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../supabase'

// Partial-attendance data (late arrivals / early departures + meeting length)
// lives in one JSON doc so no DB schema change is needed.
//   data = {
//     sessions: { [sessionId]: { durationMin } },
//     timing:   { ["sessionId|username"]: { lateMin, lateExcused, earlyMin, earlyExcused } }
//   }
const DOC_ID = 'attendance_partial'
export const DEFAULT_DURATION = 240

// Automatic meeting length until a lead overrides it:
// 240 min on weekdays, 360 min on weekends (Sat/Sun).
export function defaultDurationForDate(sessionDate) {
  if (!sessionDate) return DEFAULT_DURATION
  const day = new Date(sessionDate + 'T00:00:00').getDay() // 0 = Sun … 6 = Sat
  return (day === 0 || day === 6) ? 360 : 240
}

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY
const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }

export const timingKey = (sessionId, username) => `${sessionId}|${username}`

export function sessionDuration(sessionId, partial, sessionDate) {
  const d = partial?.sessions?.[sessionId]?.durationMin
  return d && d > 0 ? d : defaultDurationForDate(sessionDate)
}

export function recordTiming(sessionId, username, partial) {
  return partial?.timing?.[timingKey(sessionId, username)] || {}
}

// % of the meeting a person was actually present. Counts ALL missed time
// (late + early), whether excused or not — excused is only a label.
export function presencePct(sessionId, username, status, partial, sessionDate) {
  if (status === 'absent' || status === 'excused' || status === 'no record' || !status) return 0
  const dur = sessionDuration(sessionId, partial, sessionDate)
  const t = recordTiming(sessionId, username, partial)
  const missed = Math.max(0, (Number(t.lateMin) || 0) + (Number(t.earlyMin) || 0))
  return Math.max(0, Math.min(100, Math.round(((dur - missed) / dur) * 100)))
}

// Unexcused missed minutes (for a "how much did they skip without an excuse" view)
export function unexcusedMissed(sessionId, username, partial) {
  const t = recordTiming(sessionId, username, partial)
  return (t.lateExcused ? 0 : (Number(t.lateMin) || 0)) + (t.earlyExcused ? 0 : (Number(t.earlyMin) || 0))
}

export function useAttendancePartial() {
  const [partial, setPartial] = useState({ sessions: {}, timing: {} })
  const ref = useRef({ sessions: {}, timing: {} })
  const apply = (d) => {
    const merged = { sessions: (d && d.sessions) || {}, timing: (d && d.timing) || {} }
    ref.current = merged
    setPartial(merged)
  }

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${url}/rest/v1/scouting_schedule?id=eq.${DOC_ID}&select=data`, { headers })
        if (res.ok) { const rows = await res.json(); apply(rows?.[0]?.data) }
      } catch { /* ignore */ }
    })()
    const ch = supabase
      .channel('attendance-partial')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scouting_schedule' }, (p) => {
        if (p.new?.id === DOC_ID) apply(p.new.data)
      })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

  const persist = useCallback(async (next) => {
    apply(next)
    try {
      await fetch(`${url}/rest/v1/scouting_schedule`, {
        method: 'POST',
        headers: { ...headers, Prefer: 'resolution=merge-duplicates, return=minimal' },
        body: JSON.stringify({ id: DOC_ID, data: next }),
      })
    } catch { /* ignore */ }
  }, [])

  const setSessionDurationMin = useCallback((sessionId, min) => {
    const next = { ...ref.current, sessions: { ...ref.current.sessions, [sessionId]: { durationMin: Math.max(1, Number(min) || DEFAULT_DURATION) } } }
    persist(next)
  }, [persist])

  const setTiming = useCallback((sessionId, username, patch) => {
    const k = timingKey(sessionId, username)
    const cur = ref.current.timing?.[k] || {}
    const next = { ...ref.current, timing: { ...ref.current.timing, [k]: { ...cur, ...patch } } }
    persist(next)
  }, [persist])

  return { partial, setSessionDurationMin, setTiming }
}
