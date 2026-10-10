import { restHeaders, hasUserToken } from '../lib/restHeaders'
import { supabase } from '../supabase'
import { stampTeam } from '../lib/teamScope'
import { ACTIVE_SEASON } from '../data/season'
import { claimNotebookAttendance } from '../lib/notebookAttendance'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const AUDIO_BUCKET = 'notebook-audio'

// ─── Is the server side switched on? ──────────────────────────────────────
// The voice columns arrive with supabase/en_helper.sql. Until then a voice
// entry has nowhere to go, so the Helper says so instead of failing at Save.
export async function voiceBackendReady() {
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/notebook_entries?select=ai_status&limit=1`, { headers: restHeaders() })
    return res.ok
  } catch {
    // Offline: assume it's there. Saving queues on the phone either way.
    return true
  }
}

// ─── Waiting room on the phone ────────────────────────────────────────────
// A recording is written here before anything is sent, and removed only once
// the entry is saved. Bad shop wifi, a closed app or a dead battery leaves it
// here to send next time, so a student never loses what they said.

const DB_NAME = 'en-helper'
const STORE = 'pending'

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function withStore(mode, fn) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    const result = fn(tx.objectStore(STORE))
    tx.oncomplete = () => { db.close(); resolve(result?.result ?? result) }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

// The item carries its audio as an ArrayBuffer (item.audio, item.audioType)
// rather than a Blob: older iPhones could not store a Blob in IndexedDB.
export async function queueEntry(item) {
  await withStore('readwrite', store => store.put(item))
}

export async function pendingEntries(username) {
  try {
    const all = await withStore('readonly', store => store.getAll())
    return (all || []).filter(e => e.username === username)
  } catch {
    return []
  }
}

async function dropEntry(id) {
  await withStore('readwrite', store => store.delete(id)).catch(() => {})
}

// ─── Sending one ──────────────────────────────────────────────────────────

// A phone waking from sleep can hold an expired token, and an upload sent
// without a live one is refused. Refresh only then, and never wait forever on
// it: the client's refresh can sit on a lock.
async function freshSession() {
  if (hasUserToken()) return
  await Promise.race([
    supabase.auth.getSession(),
    new Promise(resolve => setTimeout(resolve, 4000)),
  ]).catch(() => {})
}

async function uploadClip(path, buffer, type) {
  const res = await fetch(`${supabaseUrl}/storage/v1/object/${AUDIO_BUCKET}/${path}`, {
    method: 'POST',
    headers: { ...restHeaders(), 'Content-Type': type || 'audio/wav', 'x-upsert': 'false' },
    body: buffer,
  })
  if (res.ok) return
  const text = await res.text().catch(() => '')
  // Already there from an earlier try that lost its connection afterwards.
  if (res.status === 409 || /already exists|Duplicate/i.test(text)) return
  throw new Error(`upload ${res.status}: ${text.slice(0, 200)}`)
}

async function insertEntry(row) {
  const res = await fetch(`${supabaseUrl}/rest/v1/notebook_entries`, {
    method: 'POST',
    headers: restHeaders({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
    body: JSON.stringify(row),
  })
  if (res.ok) return
  const text = await res.text().catch(() => '')
  // Same: saved by an earlier try whose answer never arrived.
  if (res.status === 409 || /duplicate key/i.test(text)) return
  throw new Error(`save ${res.status}: ${text.slice(0, 200)}`)
}

// Ask the server to transcribe and polish now. Not awaited by anything: if it
// doesn't arrive, the 15 minute job picks the entry up anyway.
export function requestProcessing(entryId) {
  fetch(`${supabaseUrl}/functions/v1/notebook-voice`, {
    method: 'POST',
    headers: restHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ action: 'process', entry_id: entryId }),
    keepalive: true,
  }).catch(() => {})
}

// Send one queued recording. Resolves { claimed } (true when it won the
// meeting's attendance back) or throws, leaving it queued.
export async function sendEntry(item, scope) {
  await freshSession()
  const ext = item.audioType === 'audio/wav' ? 'wav' : (item.audioType || '').includes('mp4') ? 'm4a' : 'webm'
  const path = `${item.team_number || 'radical'}/${item.id}.${ext}`
  await uploadClip(path, item.audio, item.audioType)

  // An ordinary notebook row, so the list, the book, the dashboards and the
  // attendance rule all count it. The AI fills in the written fields later;
  // until then they are empty, which every view already handles.
  await insertEntry(stampTeam({
    id: item.id,
    username: item.username,
    meeting_date: item.meeting_date,
    category: 'Technical',
    custom_category: '',
    what_did: '',
    why_option: '',
    why_note: '',
    engagement: item.engagement,
    engagement_note: '',
    mentor_help: false,
    mentor_name: '',
    mentor_note: '',
    project_id: '',
    project_link: '',
    photo_url: item.photo_url || '',
    season: ACTIVE_SEASON,
    signals: [],
    signal_data: {},
    next_step: '',
    source: 'voice',
    ai_status: 'pending',
    ai_attempts: 0,
    audio_path: path,
    created_at: item.created_at,
  }, item.team_number))

  await dropEntry(item.id)
  requestProcessing(item.id)
  const claimed = await claimNotebookAttendance(item.username, item.meeting_date, scope)
  return { claimed }
}

// Entries the AI hasn't finished a few minutes on. Nudged again when the
// student opens the Helper, so a missed nudge never depends on the scheduler.
export async function nudgeUnfinished(username, scope) {
  try {
    const since = new Date(Date.now() - 2 * 60_000).toISOString()
    const q = `${scope}&username=eq.${encodeURIComponent(username)}&source=eq.voice` +
      `&ai_status=in.(pending,failed)&ai_attempts=lt.5&created_at=lt.${since}&select=id&limit=3`
    const res = await fetch(`${supabaseUrl}/rest/v1/notebook_entries?${q}`, { headers: restHeaders() })
    if (!res.ok) return
    for (const row of await res.json()) requestProcessing(row.id)
  } catch { /* the scheduler covers it */ }
}

export async function latestVoiceEntry(username, scope) {
  try {
    const q = `${scope}&username=eq.${encodeURIComponent(username)}&source=eq.voice` +
      '&select=id,meeting_date,ai_status,polished,transcript,created_at&order=created_at.desc&limit=1'
    const res = await fetch(`${supabaseUrl}/rest/v1/notebook_entries?${q}`, { headers: restHeaders() })
    return res.ok ? (await res.json())[0] || null : null
  } catch {
    return null
  }
}
