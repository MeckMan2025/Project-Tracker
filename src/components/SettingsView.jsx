import { useState, useEffect, useRef } from 'react'
import { Settings, Bell, Music, Volume2, Lock, Zap } from 'lucide-react'
import { supabase } from '../supabase'
import { useUser } from '../contexts/UserContext'
import { usePushNotifications } from '../hooks/usePushNotifications'
import PasswordInput from './PasswordInput'

const MUSIC_OPTIONS = [
  { id: 'random', label: 'Random', description: 'Pick a random song each time' },
  { id: 'intro', label: 'Intro', description: 'Original intro track' },
  { id: 'radical-robotics', label: 'Radical Robotics', description: 'Radical Robotics anthem' },
  { id: 'radical-theme', label: 'Theme Song', description: 'AI-generated team theme song' },
  { id: 'off', label: 'Off', description: 'No music on startup' },
]

export default function SettingsView() {
  const { user } = useUser()
  const { isSupported: pushSupported, isSubscribed: pushSubscribed, permission: pushPermission, subscribe: pushSubscribe, unsubscribe: pushUnsubscribe } = usePushNotifications()
  const [notifPrefs, setNotifPrefs] = useState({ enabled: true, calendar: true, chat: true })
  const [pushBusy, setPushBusy] = useState(false)
  const [pushError, setPushError] = useState('')
  const notifPrefsLoaded = useRef(false)

  const [musicPref, setMusicPref] = useState(() => localStorage.getItem('scrum-music-pref') || 'off')
  const [sfxEnabled, setSfxEnabled] = useState(() => localStorage.getItem('scrum-sfx-enabled') !== 'false')
  const [skipLoading, setSkipLoading] = useState(() => localStorage.getItem('scrum-skip-loading') === 'true')

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState(false)
  const [pwSubmitting, setPwSubmitting] = useState(false)

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  // Load notification prefs from profile
  useEffect(() => {
    if (!user) return
    fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${user.id}&select=notification_prefs`, {
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` },
    })
      .then(res => res.ok ? res.json() : [])
      .then(rows => {
        if (rows[0]?.notification_prefs) setNotifPrefs(rows[0].notification_prefs)
      })
      .catch(() => {})
  }, [user])

  // Auto-save notification prefs
  useEffect(() => {
    if (!user) return
    if (!notifPrefsLoaded.current) {
      notifPrefsLoaded.current = true
      return
    }
    fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${user.id}`, {
      method: 'PATCH',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({ notification_prefs: notifPrefs }),
    }).catch(err => console.error('Failed to save notification prefs:', err))
  }, [notifPrefs, user])

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
        <Settings size={22} className="text-pastel-orange-dark" />
        Settings
      </h2>

      {/* ─── Skip Loading Screen ─── */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <Zap size={16} className="text-pastel-orange-dark" />
          Loading Screen
        </h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-700">Skip loading animation</p>
            <p className="text-xs text-gray-400">Go straight to the app without the intro</p>
          </div>
          <button
            onClick={() => {
              const next = !skipLoading
              setSkipLoading(next)
              localStorage.setItem('scrum-skip-loading', String(next))
            }}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              skipLoading ? 'bg-pastel-blue-dark' : 'bg-gray-300'
            }`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              skipLoading ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
        </div>
      </section>

      {/* ─── Push Notifications ─── */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <Bell size={16} className="text-pastel-blue-dark" />
          Push Notifications
        </h3>
        {!pushSupported ? (
          <p className="text-sm text-gray-400">Push notifications are not supported in this browser.</p>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700">Enable push notifications</p>
                <p className="text-xs text-gray-400">
                  {pushPermission === 'denied'
                    ? 'Notifications are blocked in browser settings'
                    : pushSubscribed
                    ? 'Receiving push notifications on this device'
                    : 'Not subscribed on this device'}
                </p>
              </div>
              <button
                onClick={async () => {
                  setPushBusy(true)
                  setPushError('')
                  try {
                    if (pushSubscribed) {
                      const ok = await pushUnsubscribe()
                      if (ok) {
                        setNotifPrefs(prev => ({ ...prev, enabled: false }))
                      } else {
                        setPushError('Failed to unsubscribe')
                      }
                    } else {
                      const ok = await pushSubscribe()
                      if (ok) {
                        setNotifPrefs(prev => ({ ...prev, enabled: true }))
                      } else {
                        setPushError(
                          pushPermission === 'denied'
                            ? 'Blocked in browser settings — check site permissions'
                            : 'Subscribe failed — check browser console for details'
                        )
                      }
                    }
                  } catch (err) {
                    setPushError(err.message)
                  }
                  setPushBusy(false)
                }}
                disabled={pushPermission === 'denied' || pushBusy}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-40 ${
                  pushSubscribed && notifPrefs.enabled ? 'bg-pastel-blue-dark' : 'bg-gray-300'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  pushSubscribed && notifPrefs.enabled ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>
            {pushBusy && <p className="text-xs text-gray-400">Working...</p>}
            {pushError && <p className="text-xs text-red-500">{pushError}</p>}

            {pushSubscribed && (
              <>
                <div className="flex items-center justify-between pl-4 border-l-2 border-gray-100">
                  <p className="text-sm text-gray-600">Calendar events</p>
                  <button
                    onClick={() => setNotifPrefs(prev => ({ ...prev, calendar: !prev.calendar }))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      notifPrefs.calendar ? 'bg-pastel-blue-dark' : 'bg-gray-300'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      notifPrefs.calendar ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>
                <p className="text-xs text-gray-400 italic">Leads can force-send important notifications even if you turn these off.</p>
              </>
            )}
          </div>
        )}
      </section>

      {/* ─── Startup Music ─── */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <Music size={16} className="text-pastel-pink-dark" />
          Startup Music
        </h3>
        <p className="text-xs text-gray-400 mb-3">Choose which song plays when you open the app.</p>
        <div className="space-y-2">
          {MUSIC_OPTIONS.map(opt => (
            <button
              key={opt.id}
              onClick={() => {
                setMusicPref(opt.id)
                localStorage.setItem('scrum-music-pref', opt.id)
              }}
              className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-colors ${
                musicPref === opt.id
                  ? 'border-pastel-pink bg-pastel-pink/10'
                  : 'border-gray-200 hover:border-pastel-pink/50'
              }`}
            >
              <p className="text-sm font-medium text-gray-700">{opt.label}</p>
              <p className="text-xs text-gray-400">{opt.description}</p>
            </button>
          ))}
        </div>
      </section>

      {/* ─── Sound Effects ─── */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <Volume2 size={16} className="text-pastel-blue-dark" />
          Sound Effects
        </h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-700">Enable button sounds</p>
            <p className="text-xs text-gray-400">Play a sound when adding tasks and boards</p>
          </div>
          <button
            onClick={() => {
              const next = !sfxEnabled
              setSfxEnabled(next)
              localStorage.setItem('scrum-sfx-enabled', String(next))
            }}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              sfxEnabled ? 'bg-pastel-blue-dark' : 'bg-gray-300'
            }`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              sfxEnabled ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
        </div>
      </section>

      {/* ─── Change Password ─── */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
        <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <Lock size={16} className="text-pastel-blue-dark" />
          Change Password
        </h3>
        <form onSubmit={async (e) => {
          e.preventDefault()
          setPwError('')
          setPwSuccess(false)
          if (newPassword.length < 6) {
            setPwError('Password must be at least 6 characters')
            return
          }
          if (newPassword !== confirmPassword) {
            setPwError('Passwords do not match')
            return
          }
          setPwSubmitting(true)
          try {
            const { error } = await supabase.auth.updateUser({ password: newPassword })
            if (error) throw error
            setPwSuccess(true)
            setNewPassword('')
            setConfirmPassword('')
            setTimeout(() => setPwSuccess(false), 3000)
          } catch (err) {
            setPwError(err.message)
          } finally {
            setPwSubmitting(false)
          }
        }} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">New Password</label>
            <PasswordInput value={newPassword} onChange={setNewPassword} placeholder="Enter new password" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Confirm Password</label>
            <PasswordInput value={confirmPassword} onChange={setConfirmPassword} placeholder="Confirm new password" />
          </div>
          {pwError && <p className="text-sm text-red-500">{pwError}</p>}
          {pwSuccess && <p className="text-sm text-green-500">Password updated successfully!</p>}
          <button
            type="submit"
            disabled={pwSubmitting || !newPassword || !confirmPassword}
            className="px-4 py-2 bg-pastel-blue text-gray-700 rounded-lg text-sm font-medium hover:bg-pastel-blue-dark hover:text-white transition-colors disabled:opacity-40"
          >
            {pwSubmitting ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </section>
    </div>
  )
}
