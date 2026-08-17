import { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Plus, X, MessageCircle, Trash2, Check, Send, Pencil, ChevronLeft, ChevronRight } from 'lucide-react'
import NotificationBell from './NotificationBell'
import { supabase } from '../supabase'
import { useUser } from '../contexts/UserContext'
import { usePermissions } from '../hooks/usePermissions'

// The season timeline — the sticky-note wall, on screen. Meeting dates from the
// calendar run left to right; note cards hang underneath each date, colored by
// who's doing the work; anyone can comment on a card.

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const headers = { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
const writeHeaders = { ...headers, 'Content-Type': 'application/json', Prefer: 'return=minimal' }

const HAND = { fontFamily: "'Kalam', cursive" }

// Who's doing it. Colors follow the team palette, plus green for a mix.
export const SIDES = [
  { id: 'business',  label: 'Business',  bg: '#FFCAD4', edge: '#F4A3B5' },
  { id: 'technical', label: 'Technical', bg: '#A8D8EA', edge: '#7EC8E3' },
  { id: 'pm',        label: 'Project Managers', bg: '#FFD6A5', edge: '#FFBB70' },
  { id: 'mix',       label: 'A mix',     bg: '#C3E8C9', edge: '#93D3A2' },
]
const sideOf = (id) => SIDES.find(s => s.id === id) || SIDES[3]

const pad2 = (n) => String(n).padStart(2, '0')
const toKey = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
const fromKey = (k) => { const [y, m, d] = String(k).split('-').map(Number); return new Date(y, m - 1, d) }
const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r }

// Same expansion the calendar uses, so a weekly meeting shows every week here too.
function expandRecurrence(event, from, to) {
  if (!event.date_key) return []
  const start = fromKey(event.date_key)
  if (Number.isNaN(start.getTime())) return []
  const exceptions = new Set(event.exception_dates || [])
  if (!event.recurrence || event.recurrence === 'none') {
    if (start < from || start > to) return []
    return exceptions.has(toKey(start)) ? [] : [toKey(start)]
  }
  const until = event.recurrence_until ? fromKey(event.recurrence_until) : to
  const stop = until < to ? until : to
  const keys = []
  let cursor = new Date(start)
  for (let i = 0; i < 366 * 3 && cursor <= stop; i++) {
    const k = toKey(cursor)
    if (cursor >= from && !exceptions.has(k)) keys.push(k)
    if (event.recurrence === 'daily') cursor = addDays(cursor, 1)
    else if (event.recurrence === 'weekly') cursor = addDays(cursor, 7)
    else if (event.recurrence === 'monthly') cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, cursor.getDate())
    else if (event.recurrence === 'yearly') cursor = new Date(cursor.getFullYear() + 1, cursor.getMonth(), cursor.getDate())
    else break
  }
  return keys
}

export default function TimelineView() {
  const { username } = useUser()
  const { canAddTimelineNotes, canCommentTimeline } = usePermissions()
  const [events, setEvents] = useState([])
  const [cards, setCards] = useState([])
  const [comments, setComments] = useState([])
  const [openCard, setOpenCard] = useState(null)
  const [addingAt, setAddingAt] = useState(null)   // date_key the new card belongs to
  const [showPast, setShowPast] = useState(false)
  const [draft, setDraft] = useState('')
  const [draftSide, setDraftSide] = useState('mix')
  const todayRef = useRef(null)
  // Press-and-hold to drag a note onto another date. Pointer events rather than
  // a drag library: the strip sits inside a rotateX wrapper (scrollbar on top),
  // and hit-testing by screen point is unaffected by that transform.
  const [dragId, setDragId] = useState(null)
  const [hoverKey, setHoverKey] = useState(null)
  const dragRef = useRef(null)      // { card } once the hold has armed
  const pressRef = useRef(null)     // { card, x, y, timer, el, pointerId }
  const movedRef = useRef(false)    // suppresses the click that follows a drag
  const hoverRef = useRef(null)     // read on drop, so it can't lag behind state
  const [ghost, setGhost] = useState(null)  // { card, x, y } — the note under the cursor
  const [hoverIndex, setHoverIndex] = useState(null)  // which slot in the stack
  const indexRef = useRef(null)

  // ------------------------------------------------------------------- Load
  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const [ev, cd, cm] = await Promise.all([
          fetch(`${supabaseUrl}/rest/v1/calendar_events?select=*&order=date_key.asc`, { headers }),
          fetch(`${supabaseUrl}/rest/v1/timeline_cards?select=*&order=created_at.asc`, { headers }),
          fetch(`${supabaseUrl}/rest/v1/timeline_comments?select=*&order=created_at.asc`, { headers }),
        ])
        if (!alive) return
        if (ev.ok) setEvents(await ev.json())
        if (cd.ok) setCards(await cd.json())
        if (cm.ok) setComments(await cm.json())
      } catch (err) {
        console.error('Timeline load failed:', err)
      }
    }
    load()
    const ch = supabase
      .channel('timeline-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'timeline_cards' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'timeline_comments' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_events' }, load)
      .subscribe()
    return () => { alive = false; supabase.removeChannel(ch) }
  }, [])

  const todayKey = toKey(new Date())

  // --------------------------------------------------------------- Columns
  // One column per meeting date. Dates that already hold cards stay even if the
  // meeting is later deleted, so a note can never end up with nowhere to live.
  const allColumns = useMemo(() => {
    const from = addDays(new Date(), -60)
    const to = addDays(new Date(), 365)
    const keys = new Set()
    events.forEach(ev => {
      const cat = ev.category || ev.event_type
      if (cat !== 'meeting') return
      expandRecurrence(ev, from, to).forEach(k => keys.add(k))
    })
    cards.forEach(c => keys.add(c.date_key))
    return [...keys].sort()
  }, [events, cards])

  // Past dates drop off the strip. Anything finished stays put on the day it
  // was done (visible under "past days"); anything still open rides forward to
  // the next meeting so it can't be left behind.
  const visibleColumns = useMemo(
    () => (showPast ? allColumns : allColumns.filter(k => k >= todayKey)),
    [allColumns, showPast, todayKey]
  )
  const firstUpcoming = visibleColumns.find(k => k >= todayKey) || null

  const carriedOver = useMemo(
    () => (showPast ? [] : cards.filter(c => c.date_key < todayKey && !c.done)),
    [cards, showPast, todayKey]
  )

  // Milestones ride above the line: anything big landing on or after this
  // column but before the next one.
  const milestones = useMemo(() => {
    const from = addDays(new Date(), -60)
    const to = addDays(new Date(), 365)
    const out = []
    events.forEach(ev => {
      const cat = ev.category || ev.event_type
      if (cat === 'meeting' || cat === 'birthday') return
      expandRecurrence(ev, from, to).forEach(k => out.push({ key: k, name: ev.name, cat }))
    })
    return out.sort((a, b) => a.key.localeCompare(b.key))
  }, [events])

  const milestoneFor = (key, nextKey) =>
    milestones.filter(m => m.key >= key && (!nextKey || m.key < nextKey))

  // Highest sort value on a date, so a new note goes to the bottom.
  const nextSortFor = (key) =>
    cards.filter(c => c.date_key === key).reduce((m, c) => Math.max(m, c.sort || 0), 0) + 1

  // A sort value placing the note in slot `idx` of that date — halfway between
  // its new neighbours. sort is a float, so there is always room between two.
  const sortForSlot = (key, idx, movingId) => {
    const list = cards.filter(c => c.date_key === key && c.id !== movingId).sort(bySort)
    if (idx == null || idx >= list.length) {
      return (list.length ? (list[list.length - 1].sort || 0) : 0) + 1
    }
    const next = list[idx].sort || 0
    if (idx === 0) return next - 1
    return ((list[idx - 1].sort || 0) + next) / 2
  }

  const bySort = (a, b) => (a.sort || 0) - (b.sort || 0) ||
    String(a.created_at || '').localeCompare(String(b.created_at || ''))

  const cardsFor = (key) => {
    const own = cards.filter(c => c.date_key === key).sort(bySort)
    return key === firstUpcoming ? [...carriedOver, ...own] : own
  }
  const commentsFor = (id) => comments.filter(c => c.card_id === id)

  // Land on today rather than the far past.
  useEffect(() => {
    if (todayRef.current) todayRef.current.scrollIntoView({ inline: 'center', block: 'nearest' })
  }, [visibleColumns.length])

  const cancelPress = () => {
    if (pressRef.current?.timer) clearTimeout(pressRef.current.timer)
    pressRef.current = null
    dragRef.current = null
    hoverRef.current = null
    indexRef.current = null
    setDragId(null)
    setHoverKey(null)
    setHoverIndex(null)
    setGhost(null)
  }

  const beginPress = (e, card) => {
    if (!canAddTimelineNotes) return
    const el = e.currentTarget
    const pointerId = e.pointerId
    const timer = setTimeout(() => {
      dragRef.current = { card }
      hoverRef.current = card.date_key
      setDragId(card.id)
      setHoverKey(card.date_key)
      setGhost({ card, x: last.x, y: last.y })
      try { el.setPointerCapture(pointerId) } catch { /* ignore */ }
    }, 220)
    // The hold fires later, so remember where the pointer actually is.
    const last = { x: e.clientX, y: e.clientY }
    pressRef.current = { card, x: e.clientX, y: e.clientY, timer, el, pointerId, last }
    movedRef.current = false
  }

  const onPointerMove = (e) => {
    const press = pressRef.current
    if (!press) return
    // Before the hold arms, a real movement means the user is scrolling.
    if (!dragRef.current) {
      press.last = { x: e.clientX, y: e.clientY }
      if (Math.abs(e.clientX - press.x) > 8 || Math.abs(e.clientY - press.y) > 8) {
        clearTimeout(press.timer)
        pressRef.current = null
      }
      return
    }
    movedRef.current = true
    setGhost(g => (g ? { ...g, x: e.clientX, y: e.clientY } : g))
    const under = document.elementFromPoint(e.clientX, e.clientY)
    const col = under?.closest?.('[data-date-key]')
    const key = col ? col.getAttribute('data-date-key') : null
    hoverRef.current = key
    setHoverKey(key)

    // Which gap in the stack the note is aimed at: the first note whose middle
    // sits below the pointer. The gap opens there, so the drop is aimed rather
    // than guessed at.
    if (!col) { indexRef.current = null; setHoverIndex(null); return }
    const notes = [...col.querySelectorAll('[data-note-id]')]
      .filter(n => n.getAttribute('data-note-id') !== dragRef.current.card.id)
    let idx = notes.length
    for (let i = 0; i < notes.length; i++) {
      const r = notes[i].getBoundingClientRect()
      if (e.clientY < r.top + r.height / 2) { idx = i; break }
    }
    indexRef.current = idx
    setHoverIndex(idx)
  }

  const endPress = () => {
    const dragging = dragRef.current
    const target = hoverRef.current
    if (dragging && target) {
      const sort = sortForSlot(target, indexRef.current, dragging.card.id)
      if (target !== dragging.card.date_key || sort !== dragging.card.sort) {
        editCard(dragging.card, { date_key: target, sort })
      }
    }
    if (pressRef.current?.timer) clearTimeout(pressRef.current.timer)
    pressRef.current = null
    dragRef.current = null
    hoverRef.current = null
    indexRef.current = null
    setDragId(null)
    setHoverKey(null)
    setHoverIndex(null)
    setGhost(null)
  }

  // ------------------------------------------------------------------ Write
  const addCard = async () => {
    const title = draft.trim()
    if (!title || !addingAt) return
    const row = {
      id: String(Date.now()) + Math.random().toString(36).slice(2, 7),
      date_key: addingAt,
      title,
      side: draftSide,
      sort: nextSortFor(addingAt),
      created_by: username || '',
    }
    setCards(prev => [...prev, row])
    setDraft(''); setAddingAt(null)
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/timeline_cards`, {
        method: 'POST', headers: writeHeaders, body: JSON.stringify(row),
      })
      if (!res.ok) throw new Error(await res.text())
    } catch (err) {
      console.error('Timeline card save failed:', err)
      setCards(prev => prev.filter(c => c.id !== row.id))
    }
  }

  const toggleDone = async (card) => {
    setCards(prev => prev.map(c => c.id === card.id ? { ...c, done: !c.done } : c))
    await fetch(`${supabaseUrl}/rest/v1/timeline_cards?id=eq.${card.id}`, {
      method: 'PATCH', headers: writeHeaders, body: JSON.stringify({ done: !card.done }),
    }).catch(err => console.error('Timeline toggle failed:', err))
  }

  const editCard = async (card, patch) => {
    setCards(prev => prev.map(c => c.id === card.id ? { ...c, ...patch } : c))
    setOpenCard(prev => prev && prev.id === card.id ? { ...prev, ...patch } : prev)
    const res = await fetch(`${supabaseUrl}/rest/v1/timeline_cards?id=eq.${card.id}`, {
      method: 'PATCH', headers: writeHeaders, body: JSON.stringify(patch),
    }).catch(err => { console.error('Timeline edit failed:', err); return null })
    if (res && !res.ok) console.error('Timeline edit rejected:', await res.text())
  }

  const setSide = async (card, side) => {
    setCards(prev => prev.map(c => c.id === card.id ? { ...c, side } : c))
    setOpenCard(prev => prev && prev.id === card.id ? { ...prev, side } : prev)
    await fetch(`${supabaseUrl}/rest/v1/timeline_cards?id=eq.${card.id}`, {
      method: 'PATCH', headers: writeHeaders, body: JSON.stringify({ side }),
    }).catch(err => console.error('Timeline side failed:', err))
  }

  const removeCard = async (card) => {
    if (!confirm(`Delete "${card.title}"?`)) return
    setCards(prev => prev.filter(c => c.id !== card.id))
    setOpenCard(null)
    await fetch(`${supabaseUrl}/rest/v1/timeline_cards?id=eq.${card.id}`, {
      method: 'DELETE', headers,
    }).catch(err => console.error('Timeline delete failed:', err))
  }

  const addComment = async (cardId, body) => {
    const text = body.trim()
    if (!text) return
    const row = {
      id: String(Date.now()) + Math.random().toString(36).slice(2, 7),
      card_id: cardId,
      author: username || 'Someone',
      body: text,
    }
    setComments(prev => [...prev, { ...row, created_at: new Date().toISOString() }])
    await fetch(`${supabaseUrl}/rest/v1/timeline_comments`, {
      method: 'POST', headers: writeHeaders, body: JSON.stringify(row),
    }).catch(err => console.error('Timeline comment failed:', err))
  }

  const editComment = async (id, body) => {
    const text = body.trim()
    if (!text) return
    setComments(prev => prev.map(c => c.id === id ? { ...c, body: text } : c))
    await fetch(`${supabaseUrl}/rest/v1/timeline_comments?id=eq.${id}`, {
      method: 'PATCH', headers: writeHeaders, body: JSON.stringify({ body: text }),
    }).catch(err => console.error('Comment edit failed:', err))
  }

  const removeComment = async (id) => {
    setComments(prev => prev.filter(c => c.id !== id))
    await fetch(`${supabaseUrl}/rest/v1/timeline_comments?id=eq.${id}`, {
      method: 'DELETE', headers,
    }).catch(err => console.error('Comment delete failed:', err))
  }


  // One note, used by every column. Kept as a function so the stack can have a
  // placeholder spliced into it while dragging.
  const noteCard = (c) => {
    const s = sideOf(c.side)
    const n = commentsFor(c.id).length
    return (
      <button
        key={c.id}
        data-note-id={c.id}
        onPointerDown={(e) => beginPress(e, c)}
        onPointerMove={onPointerMove}
        onPointerUp={endPress}
        onPointerCancel={cancelPress}
        onClick={() => { if (!movedRef.current) setOpenCard(c) }}
        className={`w-full text-left rounded-sm px-2 py-1.5 shadow-sm transition-transform hover:-translate-y-0.5 ${
          canAddTimelineNotes ? 'cursor-grab active:cursor-grabbing' : ''
        }`}
        style={{
          ...HAND,
          background: s.bg,
          border: `1px solid ${s.edge}`,
          // Leads drag from the note, so the browser must not claim the gesture
          // for scrolling first.
          touchAction: canAddTimelineNotes ? 'none' : 'auto',
        }}
      >
        <span className={`text-xs leading-snug block ${c.done ? 'line-through text-gray-500' : 'text-gray-800'}`}>
          {c.title}
        </span>
        {/* Rolled forward from a day that has passed. */}
        {!showPast && c.date_key < todayKey && (
          <span className="text-[9px] text-gray-500 block">
            ↪ from {fromKey(c.date_key).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </span>
        )}
        {n > 0 && (
          <span className="mt-0.5 inline-flex items-center gap-0.5 text-[10px] text-gray-600">
            <MessageCircle size={9} /> {n}
          </span>
        )}
      </button>
    )
  }

  // ----------------------------------------------------------------- Render
  return (
    <div className="flex-1 flex flex-col min-w-0">
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-20">
        <div className="pl-14 pr-3 sm:px-4 py-1.5 sm:ml-14 flex items-center gap-2">
          <h1 className="text-lg md:text-xl font-bold bg-gradient-to-r from-pastel-blue-dark via-pastel-pink-dark to-pastel-orange-dark bg-clip-text text-transparent shrink-0">
            Timeline
          </h1>
          <div className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {SIDES.map(s => (
              <span key={s.id} className="flex items-center gap-1 text-[10px] text-gray-500 whitespace-nowrap">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: s.bg, border: `1px solid ${s.edge}` }} />
                {s.label}
              </span>
            ))}
          </div>
          <button
            onClick={() => setShowPast(p => !p)}
            className={`ml-auto shrink-0 text-[10px] font-semibold px-2 py-1 rounded-lg border transition-colors ${
              showPast
                ? 'bg-pastel-blue/40 border-pastel-blue-dark text-gray-700'
                : 'bg-white border-gray-200 text-gray-500 hover:bg-pastel-blue/20'
            }`}
          >
            {showPast ? 'Hide past' : 'Show past'}
          </button>
          <div className="shrink-0"><NotificationBell /></div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-3 sm:p-4">
        {visibleColumns.length === 0 ? (
          <p className="text-center text-gray-400 mt-10 text-sm">
            No meetings on the calendar yet — add meetings and they'll line up here.
          </p>
        ) : (
          // rotateX flips the scroller so its bar sits along the top; the row
          // inside flips back so the cards read the right way up.
          <div className="overflow-x-auto" style={{ transform: 'rotateX(180deg)' }}>
          <div className="flex gap-3 items-stretch min-w-max pt-1 pb-4" style={{ transform: 'rotateX(180deg)' }}>
            {visibleColumns.map((key, i) => {
              const d = fromKey(key)
              const isToday = key === todayKey
              const past = key < todayKey
              const marks = milestoneFor(key, visibleColumns[i + 1])
              const list = cardsFor(key)
              return (
                <div
                  key={key}
                  ref={isToday ? todayRef : null}
                  data-date-key={key}
                  className={`w-40 shrink-0 flex flex-col rounded-lg transition-colors min-h-[55vh] ${
                    dragId && hoverKey === key ? 'bg-pastel-blue/25 ring-2 ring-pastel-blue-dark' : ''
                  }`}
                >
                  {/* Milestones sit above the line, like the big notes on the wall. */}
                  <div className="min-h-[42px] flex flex-col justify-end gap-1 mb-1">
                    {marks.map((m, n) => (
                      <div
                        key={m.key + n}
                        className="rounded-lg px-1.5 py-1 text-[10px] leading-tight text-gray-700 shadow-sm bg-pastel-orange border border-pastel-orange-dark"
                        style={HAND}
                      >
                        <span className="font-bold">{fromKey(m.key).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                        {' · '}{m.name}
                      </div>
                    ))}
                  </div>

                  {/* The date card, on the line */}
                  {/* Notebook-tab look: white card, pastel underline, pink when
                      it's today — the same language as the rest of the app. */}
                  <div
                    className={`rounded-lg px-2 py-1.5 text-center shadow-sm border ${
                      isToday ? 'bg-pastel-pink border-pastel-pink-dark' : 'bg-white/90 border-gray-200'
                    } ${past ? 'opacity-50' : ''}`}
                    style={HAND}
                  >
                    <div className="text-base font-bold text-gray-700 leading-none">
                      {d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </div>
                    <div className={`text-[10px] ${isToday ? 'text-gray-600' : 'text-gray-400'}`}>
                      {isToday ? 'Today' : d.toLocaleDateString(undefined, { weekday: 'short' })}
                    </div>
                    <div
                      className="h-0.5 rounded-full mt-1"
                      style={{ background: isToday ? '#F4A3B5' : '#A8D8EA' }}
                    />
                  </div>
                  <div className="h-3 w-px bg-gray-300 mx-auto" />

                  {/* Note cards hanging below */}
                  <div className="space-y-1.5">
                    {(() => {
                      // The dragged note leaves the stack and a dashed slot opens
                      // where it will land, so it drops into a real position
                      // instead of appearing somewhere in the pile.
                      const slot = dragId && hoverKey === key ? hoverIndex : null
                      const rest = list.filter(c => c.id !== dragId)
                      const gap = <div key="gap" className="h-9 rounded-sm border-2 border-dashed border-pastel-blue-dark bg-pastel-blue/20" />
                      const out = []
                      rest.forEach((c, i) => {
                        if (slot === i) out.push(gap)
                        out.push(noteCard(c))
                      })
                      if (slot != null && slot >= rest.length) out.push(gap)
                      return out
                    })()}

                    {canAddTimelineNotes && (
                      addingAt === key ? (
                        <div className="rounded-sm border border-dashed border-gray-300 p-1.5 bg-white/70">
                          <textarea
                            autoFocus
                            rows={2}
                            value={draft}
                            onChange={e => setDraft(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addCard() } }}
                            placeholder="What needs doing?"
                            className="w-full text-xs border rounded px-1.5 py-1 resize-none"
                          />
                          <div className="flex gap-1 mt-1">
                            {SIDES.map(s => (
                              <button
                                key={s.id}
                                onClick={() => setDraftSide(s.id)}
                                title={s.label}
                                className={`w-4 h-4 rounded-sm ${draftSide === s.id ? 'ring-2 ring-gray-400' : ''}`}
                                style={{ background: s.bg, border: `1px solid ${s.edge}` }}
                              />
                            ))}
                            <button onClick={addCard} className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded bg-pastel-blue/50 hover:bg-pastel-blue">Add</button>
                            <button onClick={() => { setAddingAt(null); setDraft('') }} className="text-[10px] px-1 text-gray-400 hover:text-gray-600">✕</button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setAddingAt(key); setDraft('') }}
                          className="w-full flex items-center justify-center gap-1 rounded-sm border border-dashed border-gray-300 py-1 text-[10px] text-gray-400 hover:text-gray-600 hover:border-gray-400"
                        >
                          <Plus size={10} /> Note
                        </button>
                      )
                    )}
                  </div>

                  {/* Grows to fill the column so the whole band under a date
                      accepts a drop, not just the notes already there. */}
                  <div className="flex-1 min-h-[40px] flex items-start justify-center pt-1">
                    {dragId && hoverKey === key && (
                      <span className="text-[10px] text-pastel-blue-dark font-semibold">drop here</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          </div>
        )}
      </main>


      {/* The note travels with the pointer. Portalled to <body> because the
          strip's rotateX wrapper would otherwise both flip it and act as the
          containing block for position:fixed. */}
      {ghost && createPortal(
        <div
          className="fixed z-[200] pointer-events-none w-36 rounded-sm px-2 py-1.5 shadow-lg -rotate-2"
          style={{
            ...HAND,
            left: ghost.x,
            top: ghost.y,
            transform: 'translate(-50%, -50%) rotate(-2deg)',
            background: sideOf(ghost.card.side).bg,
            border: `1px solid ${sideOf(ghost.card.side).edge}`,
          }}
        >
          <span className="text-xs leading-snug text-gray-800">{ghost.card.title}</span>
        </div>,
        document.body
      )}
      {openCard && (
        <CardModal
          card={cards.find(c => c.id === openCard.id) || openCard}
          comments={commentsFor(openCard.id)}
          canEdit={canAddTimelineNotes}
          canComment={canCommentTimeline}
          onClose={() => setOpenCard(null)}
          onToggleDone={toggleDone}
          onSetSide={setSide}
          onEdit={editCard}
          dateOptions={allColumns}
          onEditComment={editComment}
          onDeleteComment={removeComment}
          username={username}
          onDelete={removeCard}
          onComment={addComment}
        />
      )}
    </div>
  )
}

function CardModal({ card, comments, canEdit, canComment, onClose, onToggleDone, onSetSide, onDelete, onComment, onEdit, dateOptions = [], onEditComment, onDeleteComment, username }) {
  const [text, setText] = useState('')
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(card.title)
  const s = sideOf(card.side)

  const send = () => { onComment(card.id, text); setText('') }

  // Meeting dates either side of this note, from the same list the strip uses.
  const days = [...new Set([card.date_key, ...dateOptions])].sort()
  const at = days.indexOf(card.date_key)
  const prevDate = at > 0 ? days[at - 1] : null
  const nextDate = at >= 0 && at < days.length - 1 ? days[at + 1] : null
  const labelOf = (k) => fromKey(k).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  const shiftDate = (dir) => {
    const target = dir > 0 ? nextDate : prevDate
    if (target) onEdit(card, { date_key: target })
  }

  const saveTitle = () => {
    const next = title.trim()
    // An empty note would be unreadable on the wall, so keep the old text.
    if (next && next !== card.title) onEdit(card, { title: next })
    else setTitle(card.title)
    setEditing(false)
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[85vh] flex flex-col overflow-hidden">
        <div className="p-3.5" style={{ background: s.bg, borderBottom: `1px solid ${s.edge}` }}>
          <div className="flex items-start gap-2">
            {editing ? (
              <textarea
                autoFocus
                rows={3}
                value={title}
                onChange={e => setTitle(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveTitle() }
                  if (e.key === 'Escape') { setTitle(card.title); setEditing(false) }
                }}
                className="flex-1 text-sm text-gray-800 leading-snug rounded-lg px-2 py-1 border border-black/10 bg-white/70 resize-none"
                style={HAND}
              />
            ) : (
              <p
                onClick={() => canEdit && setEditing(true)}
                title={canEdit ? 'Click to edit' : undefined}
                className={`flex-1 text-sm text-gray-800 leading-snug ${canEdit ? 'cursor-text hover:bg-black/5 rounded px-1 -mx-1' : ''}`}
                style={HAND}
              >
                {card.title}
              </p>
            )}
            <button onClick={onClose} className="p-1 rounded hover:bg-black/10"><X size={15} /></button>
          </div>

          {editing ? (
            <div className="flex items-center gap-1.5 mt-1.5">
              {/* Moving a note is just changing which day it hangs under. */}
              <select
                value={card.date_key}
                onChange={e => onEdit(card, { date_key: e.target.value })}
                className="text-[10px] rounded-lg px-1.5 py-1 border border-black/10 bg-white/70"
              >
                {[...new Set([card.date_key, ...dateOptions])].sort().map(k => (
                  <option key={k} value={k}>
                    {fromKey(k).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </option>
                ))}
              </select>
              <button
                onClick={saveTitle}
                className="ml-auto text-[10px] font-semibold px-2 py-1 rounded-lg bg-white/80 hover:bg-white text-gray-700"
              >
                Save
              </button>
              <button
                onClick={() => { setTitle(card.title); setEditing(false) }}
                className="text-[10px] px-1.5 py-1 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
            </div>
          ) : (
            <p className="text-[10px] text-gray-600 mt-1">
              {fromKey(card.date_key).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
              {card.created_by ? ` · added by ${card.created_by}` : ''}
            </p>
          )}
        </div>

        {/* Bump a note to the next (or previous) meeting date. Keeps the note,
            its color and its comments — only the day changes. */}
        {canEdit && (
          <div className="px-3.5 py-2 flex items-center gap-1.5 border-b border-gray-100">
            <button
              onClick={() => shiftDate(-1)}
              disabled={!prevDate}
              title={prevDate ? `Move back to ${labelOf(prevDate)}` : 'No earlier meeting'}
              className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ChevronLeft size={15} />
            </button>
            <span className="text-[11px] text-gray-500 tabular-nums">{labelOf(card.date_key)}</span>
            <button
              onClick={() => shiftDate(1)}
              disabled={!nextDate}
              title={nextDate ? `Move to ${labelOf(nextDate)}` : 'No later meeting'}
              className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ChevronRight size={15} />
            </button>
            {nextDate && (
              <button
                onClick={() => shiftDate(1)}
                className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-pastel-blue/40 hover:bg-pastel-blue text-gray-700"
              >
                Next meeting
              </button>
            )}
          </div>
        )}

        {canEdit && (
          <div className="px-3.5 py-2 flex items-center gap-1.5 border-b border-gray-100">
            {SIDES.map(o => (
              <button
                key={o.id}
                onClick={() => onSetSide(card, o.id)}
                title={o.label}
                className={`w-5 h-5 rounded-sm ${card.side === o.id ? 'ring-2 ring-gray-400' : ''}`}
                style={{ background: o.bg, border: `1px solid ${o.edge}` }}
              />
            ))}
            <button
              onClick={() => onToggleDone(card)}
              className={`ml-auto inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg ${
                card.done ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <Check size={11} /> {card.done ? 'Done' : 'Mark done'}
            </button>
            <button
              onClick={() => setEditing(e => !e)}
              title="Edit note"
              className="p-1 rounded text-gray-400 hover:text-gray-600"
            >
              <Pencil size={14} />
            </button>
            <button onClick={() => onDelete(card)} className="p-1 rounded text-gray-300 hover:text-red-400">
              <Trash2 size={14} />
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-3.5 py-2.5 space-y-2">
          <h3 className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
            Comments {comments.length > 0 && `(${comments.length})`}
          </h3>
          {comments.length === 0 ? (
            <p className="text-xs text-gray-400">No comments yet.</p>
          ) : comments.map(c => (
            <Comment
              key={c.id}
              comment={c}
              /* Your own words are yours to fix; leads can tidy anyone's. */
              canManage={canEdit || (username && c.author === username)}
              onSave={onEditComment}
              onDelete={onDeleteComment}
            />
          ))}
        </div>

        {canComment && (
          <div className="p-2.5 border-t border-gray-100 flex gap-1.5">
            <input
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') send() }}
              placeholder="Add a comment…"
              className="flex-1 text-xs border rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-pastel-blue focus:border-transparent"
            />
            <button
              onClick={send}
              disabled={!text.trim()}
              className="px-2.5 rounded-lg bg-pastel-blue/50 hover:bg-pastel-blue disabled:opacity-40 text-gray-700"
            >
              <Send size={13} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function Comment({ comment, canManage, onSave, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [body, setBody] = useState(comment.body)

  const save = () => {
    const next = body.trim()
    if (next && next !== comment.body) onSave?.(comment.id, next)
    else setBody(comment.body)
    setEditing(false)
  }

  return (
    <div className="bg-gray-50 rounded-lg px-2.5 py-1.5 group">
      <div className="flex items-center gap-1">
        <p className="text-[10px] font-semibold text-gray-500 flex-1">{comment.author}</p>
        {canManage && !editing && (
          <>
            <button onClick={() => setEditing(true)} className="p-0.5 text-gray-300 hover:text-gray-600" title="Edit">
              <Pencil size={11} />
            </button>
            <button
              onClick={() => { if (confirm('Delete this comment?')) onDelete?.(comment.id) }}
              className="p-0.5 text-gray-300 hover:text-red-400"
              title="Delete"
            >
              <Trash2 size={11} />
            </button>
          </>
        )}
      </div>
      {editing ? (
        <div className="mt-1">
          <textarea
            autoFocus
            rows={2}
            value={body}
            onChange={e => setBody(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save() }
              if (e.key === 'Escape') { setBody(comment.body); setEditing(false) }
            }}
            className="w-full text-xs border rounded-lg px-2 py-1 resize-none"
          />
          <div className="flex gap-1 mt-1">
            <button onClick={save} className="text-[10px] font-semibold px-2 py-0.5 rounded bg-pastel-blue/50 hover:bg-pastel-blue">Save</button>
            <button onClick={() => { setBody(comment.body); setEditing(false) }} className="text-[10px] px-1 text-gray-400 hover:text-gray-600">Cancel</button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-gray-700 whitespace-pre-wrap break-words">{comment.body}</p>
      )}
    </div>
  )
}
