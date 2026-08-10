import { useState, useEffect, useRef, useCallback } from 'react'
import { Check, Lock, X, Flag, Trophy, Sparkles, ChevronRight, ChevronLeft } from 'lucide-react'
import { STAGES } from '../data/timelineStages'
import { usePermissions } from '../hooks/usePermissions'
import { useUser } from '../contexts/UserContext'
import { supabase } from '../supabase'

const ROW_ID = 'default'
const LOCAL_KEY = 'season-timeline-state'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const REST = `${SUPABASE_URL}/rest/v1/season_timeline`
const REST_HEADERS = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
}
// Unique per browser tab so we can ignore our own realtime echoes (which would otherwise clobber edits)
const CLIENT_ID = Math.random().toString(36).slice(2, 12)

// Triumphant little fanfare using the Web Audio API (no sound files needed)
function playFanfare() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return
    const ctx = new AC()
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5] // C5 E5 G5 C6 E6
    notes.forEach((f, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.value = f
      osc.connect(gain)
      gain.connect(ctx.destination)
      const t = ctx.currentTime + i * 0.11
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(0.35, t + 0.03)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.6)
      osc.start(t)
      osc.stop(t + 0.65)
    })
  } catch { /* audio not available */ }
}

// Subtle descending tone when a stage is sent backward
function playRegressSound() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return
    const ctx = new AC()
    const notes = [523.25, 392.0] // C5 -> G4 (descending)
    notes.forEach((f, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = f
      osc.connect(gain)
      gain.connect(ctx.destination)
      const t = ctx.currentTime + i * 0.14
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.03)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.4)
      osc.start(t)
      osc.stop(t + 0.45)
    })
  } catch { /* audio not available */ }
}

const itemId = (stageId, section, i) => `${stageId}:${section}:${i}`

export default function SeasonTimeline() {
  const { hasLeadTag } = usePermissions()
  const { username } = useUser()
  const canEdit = hasLeadTag

  const [currentStage, setCurrentStage] = useState(0)
  const [checked, setChecked] = useState({})
  const [loaded, setLoaded] = useState(false)
  const [dbAvailable, setDbAvailable] = useState(true)
  const [openIndex, setOpenIndex] = useState(null)
  const [advanceOverlay, setAdvanceOverlay] = useState(null) // { toIndex }
  const [regressNotice, setRegressNotice] = useState(null) // stage index we were sent back to

  const railRef = useRef(null)
  const currentBoxRef = useRef(null)
  const checkedRef = useRef({})
  const stageRef = useRef(0)

  // ---- Load shared state (DB, with localStorage fallback) ----
  const loadLocal = () => {
    try {
      const raw = JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}')
      setCurrentStage(raw.current_stage || 0)
      setChecked(raw.checked || {})
    } catch { /* ignore */ }
  }

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const res = await fetch(`${REST}?id=eq.${ROW_ID}&select=*`, { headers: REST_HEADERS })
        if (!active) return
        if (!res.ok) { setDbAvailable(false); loadLocal(); setLoaded(true); return }
        const rows = await res.json()
        if (!Array.isArray(rows) || rows.length === 0) {
          await fetch(REST, {
            method: 'POST',
            headers: { ...REST_HEADERS, Prefer: 'return=minimal' },
            body: JSON.stringify({ id: ROW_ID, current_stage: 0, checked: {} }),
          })
          stageRef.current = 0; checkedRef.current = {}
          setCurrentStage(0); setChecked({})
        } else {
          stageRef.current = rows[0].current_stage || 0
          checkedRef.current = rows[0].checked || {}
          setCurrentStage(rows[0].current_stage || 0)
          setChecked(rows[0].checked || {})
        }
        setDbAvailable(true)
      } catch {
        if (active) { setDbAvailable(false); loadLocal() }
      } finally {
        if (active) setLoaded(true)
      }
    }
    load()

    // Realtime sync (best-effort — works if the table is in the realtime publication)
    const channel = supabase
      .channel('season_timeline_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'season_timeline' }, payload => {
        const row = payload.new
        if (!row || row.id !== ROW_ID) return
        if (row.updated_by === CLIENT_ID) return // ignore our own writes so we don't clobber local edits
        stageRef.current = row.current_stage || 0
        checkedRef.current = row.checked || {}
        setCurrentStage(row.current_stage || 0)
        setChecked(row.checked || {})
      })
      .subscribe()

    return () => { active = false; supabase.removeChannel(channel) }
  }, [])

  // ---- Persist ----
  const persist = useCallback(async (nextStage, nextChecked) => {
    // Always keep a local backup so nothing is lost
    localStorage.setItem(LOCAL_KEY, JSON.stringify({ current_stage: nextStage, checked: nextChecked }))
    try {
      const res = await fetch(`${REST}?id=eq.${ROW_ID}`, {
        method: 'PATCH',
        headers: { ...REST_HEADERS, Prefer: 'return=minimal' },
        body: JSON.stringify({
          current_stage: nextStage,
          checked: nextChecked,
          updated_at: new Date().toISOString(),
          updated_by: CLIENT_ID,
        }),
      })
      setDbAvailable(res.ok)
    } catch {
      setDbAvailable(false)
    }
  }, [username])

  // ---- Auto-center the current stage in the rail ----
  useEffect(() => {
    if (!loaded) return
    const el = currentBoxRef.current
    if (el && el.scrollIntoView) {
      el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
    }
  }, [currentStage, loaded])

  // ---- Helpers ----
  const isChecked = (id) => !!checked[id]

  const toggleItem = (stage, section, i) => {
    if (!canEdit) return
    const id = itemId(stage.id, section, i)
    const cur = checkedRef.current
    const curStage = stageRef.current
    const wasChecked = !!cur[id]
    const next = { ...cur }
    if (wasChecked) delete next[id]
    else next[id] = { by: username || 'lead', at: new Date().toISOString() }
    checkedRef.current = next
    setChecked(next)

    const stageIndex = STAGES.findIndex(s => s.id === stage.id)
    // Unchecking a requirement in an already-completed (earlier) stage sends the team back to it
    if (wasChecked && stageIndex > -1 && stageIndex < curStage) {
      stageRef.current = stageIndex
      setCurrentStage(stageIndex)
      persist(stageIndex, next)
      setRegressNotice(stageIndex)
      playRegressSound()
      setTimeout(() => setRegressNotice(null), 3000)
    } else {
      persist(curStage, next)
    }
  }

  const stageCounts = (stage) => {
    const all = [
      ...stage.technical.map((_, i) => itemId(stage.id, 'tech', i)),
      ...stage.business.map((_, i) => itemId(stage.id, 'biz', i)),
      ...stage.advance.map((_, i) => itemId(stage.id, 'adv', i)),
    ]
    const advIds = stage.advance.map((_, i) => itemId(stage.id, 'adv', i))
    const doneAll = all.filter(id => checked[id]).length
    const doneAdv = advIds.filter(id => checked[id]).length
    return { doneAll, totalAll: all.length, doneAdv, totalAdv: advIds.length, ready: doneAdv === advIds.length }
  }

  const handleAdvance = (fromIndex) => {
    if (!canEdit) return
    const toIndex = fromIndex + 1
    playFanfare()
    setAdvanceOverlay({ toIndex })
    setOpenIndex(null)
    // Advance after the overlay's dramatic beat
    setTimeout(() => {
      stageRef.current = toIndex
      setCurrentStage(toIndex)
      persist(toIndex, checkedRef.current)
    }, 1400)
    setTimeout(() => setAdvanceOverlay(null), 3200)
  }

  const scrollRail = (dir) => {
    if (railRef.current) railRef.current.scrollBy({ left: dir * 260, behavior: 'smooth' })
  }

  const seasonComplete = currentStage >= STAGES.length

  return (
    <div className="relative">
      <style>{`
        @keyframes st-pop { 0% { transform: scale(0.4); opacity: 0 } 60% { transform: scale(1.12) } 100% { transform: scale(1); opacity: 1 } }
        @keyframes st-rise { 0% { transform: translateY(14px); opacity: 0 } 100% { transform: translateY(0); opacity: 1 } }
        @keyframes st-confetti { 0% { transform: translateY(0) rotate(0); opacity: 1 } 100% { transform: translateY(120px) rotate(320deg); opacity: 0 } }
        @keyframes st-glow { 0%,100% { box-shadow: 0 0 0 0 rgba(96,165,214,0.0) } 50% { box-shadow: 0 0 24px 4px rgba(236,72,153,0.35) } }
        .st-current { animation: st-glow 2.4s ease-in-out infinite; }
      `}</style>

      {/* Header row */}
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-2">
          <Flag size={18} className="text-pastel-pink-dark" />
          <h2 className="font-semibold text-gray-700">Season Timeline</h2>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-400 mr-1">
            {seasonComplete ? 'Season complete 🎉' : `Stage ${currentStage + 1} of ${STAGES.length}`}
          </span>
          <button onClick={() => scrollRail(-1)} className="p-1 rounded-md hover:bg-gray-100 text-gray-400" aria-label="Scroll left">
            <ChevronLeft size={16} />
          </button>
          <button onClick={() => scrollRail(1)} className="p-1 rounded-md hover:bg-gray-100 text-gray-400" aria-label="Scroll right">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* The rail */}
      <div
        ref={railRef}
        className="flex items-stretch gap-0 overflow-x-auto pb-3 pt-6 px-2 scrollbar-hide snap-x"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {STAGES.map((stage, i) => {
          const status = i < currentStage ? 'done' : i === currentStage ? 'current' : 'upcoming'
          const counts = stageCounts(stage)
          const isCurrent = status === 'current'
          return (
            <div key={stage.id} className="flex items-center shrink-0 snap-center">
              {/* connector line (not before the first) */}
              {i > 0 && (
                <div className={`h-1 w-6 md:w-10 rounded-full ${i <= currentStage ? 'bg-pastel-pink-dark/70' : 'bg-gray-200'}`} />
              )}

              <button
                ref={isCurrent ? currentBoxRef : null}
                onClick={() => setOpenIndex(i)}
                className={`relative rounded-2xl border-2 text-left transition-all duration-300 shrink-0
                  ${isCurrent
                    ? 'st-current w-56 p-4 scale-105 bg-white border-pastel-pink-dark shadow-xl z-[1]'
                    : status === 'done'
                      ? 'w-40 p-3 bg-pastel-blue/15 border-pastel-blue/50 hover:border-pastel-blue'
                      : 'w-40 p-3 bg-white/70 border-gray-200 opacity-80 hover:opacity-100'}`}
              >
                {/* stage badge */}
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`flex items-center justify-center rounded-full font-bold
                    ${isCurrent ? 'w-7 h-7 text-sm bg-pastel-pink-dark text-white' : status === 'done' ? 'w-6 h-6 text-xs bg-pastel-blue-dark text-white' : 'w-6 h-6 text-xs bg-gray-200 text-gray-500'}`}>
                    {status === 'done' ? <Check size={14} /> : i + 1}
                  </span>
                  {isCurrent && <span className="text-[10px] font-bold uppercase tracking-wider text-pastel-pink-dark">You are here</span>}
                  {status === 'upcoming' && <Lock size={12} className="text-gray-300" />}
                </div>

                <p className={`font-semibold text-gray-700 leading-tight ${isCurrent ? 'text-sm' : 'text-xs'}`}>
                  {stage.title}
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5">{stage.target}</p>

                {/* progress bar */}
                <div className="mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${counts.ready ? 'bg-green-400' : 'bg-pastel-pink-dark/70'}`}
                    style={{ width: `${counts.totalAdv ? (counts.doneAdv / counts.totalAdv) * 100 : 0}%` }}
                  />
                </div>
                {isCurrent && (
                  <p className={`mt-1.5 text-[11px] font-medium ${counts.ready ? 'text-green-600' : 'text-gray-400'}`}>
                    {counts.ready ? '● Ready to advance' : `${counts.doneAdv}/${counts.totalAdv} critical done`}
                  </p>
                )}
              </button>
            </div>
          )
        })}
      </div>

      {/* Stage detail modal */}
      {openIndex !== null && (
        <StageDetail
          stage={STAGES[openIndex]}
          index={openIndex}
          status={openIndex < currentStage ? 'done' : openIndex === currentStage ? 'current' : 'upcoming'}
          counts={stageCounts(STAGES[openIndex])}
          isChecked={isChecked}
          canEdit={canEdit}
          onToggle={toggleItem}
          onClose={() => setOpenIndex(null)}
          onAdvance={() => handleAdvance(openIndex)}
          isLastStage={openIndex === STAGES.length - 1}
        />
      )}

      {/* Dramatic advance overlay */}
      {advanceOverlay && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          {/* confetti */}
          {Array.from({ length: 24 }).map((_, i) => (
            <span
              key={i}
              className="absolute top-1/3 w-2 h-2 rounded-sm"
              style={{
                left: `${8 + (i * 3.6)}%`,
                background: ['#60a5d6', '#ec4899', '#fbbf24', '#34d399'][i % 4],
                animation: `st-confetti ${1 + (i % 5) * 0.2}s ease-in ${(i % 6) * 0.06}s forwards`,
              }}
            />
          ))}
          <div className="text-center px-6" style={{ animation: 'st-pop 0.6s ease-out' }}>
            <Trophy size={64} className="mx-auto text-amber-300 mb-3" />
            <p className="text-white/80 text-lg font-medium" style={{ animation: 'st-rise 0.6s ease-out 0.2s both' }}>
              Stage Complete!
            </p>
            <h2 className="text-3xl md:text-4xl font-extrabold text-white mt-1" style={{ animation: 'st-rise 0.6s ease-out 0.35s both' }}>
              {advanceOverlay.toIndex >= STAGES.length
                ? 'Season Complete! 🎉'
                : <>Onward to Stage {advanceOverlay.toIndex + 1}</>}
            </h2>
            {advanceOverlay.toIndex < STAGES.length && (
              <p className="text-xl text-pastel-pink-dark font-bold mt-2 flex items-center justify-center gap-2" style={{ animation: 'st-rise 0.6s ease-out 0.5s both' }}>
                <Sparkles size={18} /> {STAGES[advanceOverlay.toIndex].title} <Sparkles size={18} />
              </p>
            )}
          </div>
        </div>
      )}

      {/* Sent-back notice */}
      {regressNotice !== null && (
        <div
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-xl bg-amber-500 text-white shadow-lg flex items-center gap-2 text-sm font-semibold max-w-[90vw]"
          style={{ animation: 'st-rise 0.4s ease-out' }}
        >
          <ChevronLeft size={16} className="shrink-0" />
          <span className="truncate">Sent back to Stage {regressNotice + 1}: {STAGES[regressNotice].title}</span>
        </div>
      )}

      {!dbAvailable && loaded && (
        <p className="text-[10px] text-amber-500 px-1 mt-1">
          Saving locally only — run the season_timeline SQL to sync across the team.
        </p>
      )}
    </div>
  )
}

// ---- Stage detail modal ----
function StageDetail({ stage, index, status, counts, isChecked, canEdit, onToggle, onClose, onAdvance, isLastStage }) {
  const sections = [
    { key: 'tech', label: stage.technicalLabel || 'Technical Requirements', items: stage.technical },
    { key: 'biz', label: stage.businessLabel || 'Business Requirements', items: stage.business },
    { key: 'adv', label: stage.advanceLabel || 'Ready to Advance When', items: stage.advance, critical: true },
  ]

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[88vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="p-4 border-b flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className={`flex items-center justify-center w-7 h-7 rounded-full text-sm font-bold text-white ${status === 'done' ? 'bg-pastel-blue-dark' : status === 'current' ? 'bg-pastel-pink-dark' : 'bg-gray-300'}`}>
                {status === 'done' ? <Check size={15} /> : index + 1}
              </span>
              <h2 className="font-bold text-gray-800 text-lg leading-tight">{stage.title}</h2>
            </div>
            <p className="text-xs text-gray-400 mt-1 ml-9">{stage.target}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
        </div>

        {/* Ready-to-advance gate */}
        <div className={`mx-4 mt-3 rounded-xl p-3 border ${counts.ready ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-700">
                Stage completion: {counts.doneAll} of {counts.totalAll}
              </p>
              <p className="text-xs text-gray-500">
                Critical remaining: {counts.totalAdv - counts.doneAdv}
              </p>
            </div>
            <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${counts.ready ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
              {counts.ready ? '✓ Ready to Advance' : 'Not ready'}
            </span>
          </div>
        </div>

        {/* checklists */}
        <div className="p-4 overflow-y-auto space-y-5">
          {sections.map(section => (
            <div key={section.key}>
              <h3 className={`text-xs font-bold uppercase tracking-wider mb-2 ${section.critical ? 'text-pastel-pink-dark' : 'text-gray-400'}`}>
                {section.label}{section.critical && ' ★'}
              </h3>
              <div className="space-y-1">
                {section.items.map((item, i) => {
                  const id = `${stage.id}:${section.key}:${i}`
                  const done = isChecked(id)
                  return (
                    <button
                      key={id}
                      onClick={() => onToggle(stage, section.key, i)}
                      disabled={!canEdit}
                      className={`w-full flex items-start gap-2.5 text-left px-2 py-1.5 rounded-lg transition-colors ${canEdit ? 'hover:bg-gray-50 cursor-pointer' : 'cursor-default'}`}
                    >
                      <span className={`mt-0.5 shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${done ? 'bg-green-500 border-green-500' : 'border-gray-300'}`}>
                        {done && <Check size={13} className="text-white" />}
                      </span>
                      <span className={`text-sm ${done ? 'text-gray-400 line-through' : 'text-gray-700'}`}>{item}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* footer / advance */}
        {status === 'current' && (
          <div className="p-4 border-t bg-white">
            {!canEdit ? (
              <p className="text-xs text-center text-gray-400">Only leads, mentors, and coaches can check items and advance stages.</p>
            ) : (
              <button
                onClick={onAdvance}
                disabled={!counts.ready}
                className={`w-full py-3 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all ${counts.ready ? 'bg-gradient-to-r from-pastel-blue-dark via-pastel-pink-dark to-pastel-orange-dark hover:brightness-105 shadow-lg' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
              >
                {isLastStage ? <><Trophy size={18} /> Complete the Season</> : <>Confirm & Move On <ChevronRight size={18} /></>}
              </button>
            )}
            {canEdit && !counts.ready && (
              <p className="text-[11px] text-center text-gray-400 mt-2">
                Check off all ★ critical requirements to unlock.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
