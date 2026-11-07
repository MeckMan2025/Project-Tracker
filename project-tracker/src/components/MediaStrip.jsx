import { useState, useEffect, useCallback, useRef } from 'react'
import { Camera, ChevronLeft, ChevronRight, Download, Trash2, X, Plus, Loader2 } from 'lucide-react'
import { restHeaders, ensureUserToken } from '../lib/restHeaders'
import { storedTeamScope, stampStored } from '../lib/teamScope'
import { uploadImageFile } from '../lib/photos'
import { savePhoto } from '../lib/savePhoto'
import { useUser } from '../contexts/UserContext'
import { usePermissions } from '../hooks/usePermissions'

// The photos the Media people took, along the bottom of a Home screen. Only
// this team's (season_photos is walled per team). Tap one to see it big, and
// save it to the camera roll from there.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// caption: put in front of each upload's caption (the Competition Day's name).
export default function MediaStrip({ title = 'Photos from Media', todayOnly = false, limit = 40, caption = '' }) {
  const { username } = useUser()
  const { hasLeadTag } = usePermissions()
  const [photos, setPhotos] = useState([])
  const [at, setAt] = useState(null)        // index of the open photo
  const [saving, setSaving] = useState(false)
  // Anyone can add photos here, from the camera or the camera roll, several at once.
  const fileRef = useRef(null)
  const [adding, setAdding] = useState(0)     // photos still uploading
  const [addError, setAddError] = useState('')
  const addPhotos = async (e) => {
    const files = [...(e.target.files || [])]
    e.target.value = ''
    if (!files.length) return
    setAddError(''); setAdding(files.length)
    let failed = 0
    for (const file of files) {
      try {
        await ensureUserToken()
        const url = await uploadImageFile(supabaseUrl, supabaseKey, 'season-photos', file)
        const res = await fetch(`${supabaseUrl}/rest/v1/season_photos`, {
          method: 'POST', headers: restHeaders({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
          body: JSON.stringify(stampStored({ url, caption: caption || '', uploaded_by: username || '' })),
        })
        if (!res.ok) throw new Error(await res.text())
      } catch (err) { console.error('Photo upload failed:', err); failed++ }
      setAdding(n => n - 1)
    }
    if (failed) setAddError(`${failed} photo${failed === 1 ? '' : 's'} didn't upload. Check your connection and try again.`)
    load()
  }

  const load = useCallback(async () => {
    try {
      await ensureUserToken()
      const day = new Date(); day.setHours(0, 0, 0, 0)
      const res = await fetch(`${supabaseUrl}/rest/v1/season_photos?${storedTeamScope()}${todayOnly ? `&created_at=gte.${encodeURIComponent(day.toISOString())}` : ''}&select=*&order=created_at.desc&limit=${limit}`, { headers: restHeaders() })
      if (res.ok) setPhotos(await res.json())
    } catch { /* keep what we had */ }
  }, [todayOnly, limit])
  useEffect(() => {
    load()
    const t = setInterval(() => { if (document.visibilityState === 'visible') load() }, 60000)
    return () => clearInterval(t)
  }, [load])

  const open = at != null ? photos[at] : null
  const save = async () => {
    if (!open) return
    setSaving(true)
    await savePhoto(open.url, `ets-${String(open.created_at || '').slice(0, 10) || 'photo'}`)
    setSaving(false)
  }
  const remove = async () => {
    if (!open || !confirm('Delete this photo for everyone?')) return
    await fetch(`${supabaseUrl}/rest/v1/season_photos?id=eq.${encodeURIComponent(open.id)}`, { method: 'DELETE', headers: restHeaders() }).catch(() => {})
    setAt(null); load()
  }

  return (
    <>
      <section className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm p-3">
        <div className="flex items-center justify-between gap-2 mb-2">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
            <Camera size={13} className="text-pastel-pink-dark" /> {title}{photos.length > 0 && <span className="font-normal normal-case text-gray-400">· tap to save</span>}
          </h2>
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={addPhotos} />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={adding > 0}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-pastel-pink hover:bg-pastel-pink-dark text-xs font-semibold text-gray-800 disabled:opacity-60 shrink-0">
            {adding > 0 ? <><Loader2 size={13} className="animate-spin" /> Uploading {adding}…</> : <><Plus size={13} /> Add photos</>}
          </button>
        </div>
        {addError && <p className="text-[11px] text-red-500 mb-1">{addError}</p>}
        {!photos.length && <p className="text-xs text-gray-400">No photos yet. Add the first one.</p>}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {photos.map((p, i) => (
            <button key={p.id} type="button" onClick={() => setAt(i)} title={p.caption || ''}
              className="shrink-0 w-24 h-24 rounded-lg overflow-hidden bg-gray-100 hover:ring-2 hover:ring-pastel-pink">
              <img src={p.url} alt={p.caption || 'Photo'} className="w-full h-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      </section>

      {open && (
        <div className="fixed inset-0 z-[95] bg-black/85 flex items-center justify-center p-4" onClick={() => setAt(null)}>
          <div className="relative max-w-3xl w-full" onClick={e => e.stopPropagation()}>
            {photos.length > 1 && (
              <>
                <button type="button" onClick={() => setAt((at - 1 + photos.length) % photos.length)} aria-label="Previous"
                  className="absolute left-2 top-1/2 -translate-y-1/2 z-10 p-2 bg-black/40 hover:bg-black/60 rounded-full"><ChevronLeft size={22} className="text-white" /></button>
                <button type="button" onClick={() => setAt((at + 1) % photos.length)} aria-label="Next"
                  className="absolute right-2 top-1/2 -translate-y-1/2 z-10 p-2 bg-black/40 hover:bg-black/60 rounded-full"><ChevronRight size={22} className="text-white" /></button>
              </>
            )}
            <img src={open.url} alt={open.caption || 'Photo'} className="w-full max-h-[75vh] object-contain rounded-lg" />
            <div className="flex items-center justify-between gap-2 mt-2 flex-wrap">
              <p className="text-sm text-white/70 min-w-0 truncate">
                {open.caption || ''}{open.uploaded_by ? `${open.caption ? ' · ' : ''}${open.uploaded_by}` : ''}
                {photos.length > 1 && <span className="ml-2">{at + 1} / {photos.length}</span>}
              </p>
              <div className="flex gap-2">
                <button type="button" onClick={save} disabled={saving}
                  className="flex items-center gap-1 px-3 py-1.5 bg-pastel-pink hover:bg-pastel-pink-dark rounded-lg text-sm font-semibold text-gray-800 disabled:opacity-60">
                  <Download size={14} /> {saving ? 'Saving…' : 'Save to phone'}
                </button>
                {(hasLeadTag || open.uploaded_by === username) && (
                  <button type="button" onClick={remove} className="flex items-center gap-1 px-3 py-1.5 bg-red-500/80 hover:bg-red-500 rounded-lg text-sm text-white"><Trash2 size={14} /> Delete</button>
                )}
                <button type="button" onClick={() => setAt(null)} className="flex items-center gap-1 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm text-white"><X size={14} /> Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
