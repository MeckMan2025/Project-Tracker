import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase'
import { useUser } from '../contexts/UserContext'

function urlBase64ToUint8Array(base64String) {
  const cleaned = base64String.trim().replace(/\s/g, '')
  const padding = '='.repeat((4 - (cleaned.length % 4)) % 4)
  const base64 = (cleaned + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export function usePushNotifications() {
  const { user } = useUser()
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [permission, setPermission] = useState('default')

  const isSupported =
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window

  // Check current state on mount and sync browser subscription to DB
  useEffect(() => {
    if (!isSupported) return
    setPermission(Notification.permission)

    navigator.serviceWorker.ready.then(async (reg) => {
      const sub = await reg.pushManager.getSubscription()
      setIsSubscribed(!!sub)

      // If browser has a subscription but user is logged in, ensure it's in the DB
      // (covers case where table didn't exist when user first subscribed)
      if (sub && user) {
        const subJson = sub.toJSON()
        supabase.from('push_subscriptions').upsert({
          user_id: user.id,
          endpoint: subJson.endpoint,
          p256dh: subJson.keys.p256dh,
          auth: subJson.keys.auth,
        }, { onConflict: 'user_id,endpoint' }).then(({ error }) => {
          if (error) console.warn('Failed to sync push subscription to DB:', error)
        })
      }
    })
  }, [isSupported, user])

  const subscribe = useCallback(async () => {
    console.log('[Push] subscribe called, isSupported:', isSupported, 'user:', !!user)
    if (!isSupported) { console.warn('[Push] Not supported'); return false }
    if (!user) { console.warn('[Push] No user'); return false }

    try {
      const perm = await Notification.requestPermission()
      console.log('[Push] Permission result:', perm)
      setPermission(perm)
      if (perm !== 'granted') return false

      const reg = await navigator.serviceWorker.ready
      console.log('[Push] Service worker ready')
      const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY || 'BOsf982V29Nx1vB0xFyqlvwxhAux35ugOfmbfBsEldZmelFCgkL4Wt0yp7Xr3aip8oWMH5os_D8HoQLXDH1byJ4'
      if (!vapidPublicKey) {
        console.error('[Push] VITE_VAPID_PUBLIC_KEY not set')
        return false
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      })
      console.log('[Push] Browser subscription created')

      const subJson = sub.toJSON()
      const { error } = await supabase.from('push_subscriptions').upsert({
        user_id: user.id,
        endpoint: subJson.endpoint,
        p256dh: subJson.keys.p256dh,
        auth: subJson.keys.auth,
      }, { onConflict: 'user_id,endpoint' })

      if (error) {
        console.error('[Push] DB save failed:', error)
        return false
      }

      console.log('[Push] Subscription saved to DB')
      setIsSubscribed(true)
      return true
    } catch (err) {
      console.error('[Push] Subscribe error:', err)
      return false
    }
  }, [isSupported, user])

  const unsubscribe = useCallback(async () => {
    if (!isSupported || !user) return false

    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        const endpoint = sub.endpoint
        await sub.unsubscribe()
        await supabase.from('push_subscriptions')
          .delete()
          .eq('user_id', user.id)
          .eq('endpoint', endpoint)
      }
      setIsSubscribed(false)
      return true
    } catch (err) {
      console.error('Push unsubscribe failed:', err)
      return false
    }
  }, [isSupported, user])

  return { isSupported, isSubscribed, permission, subscribe, unsubscribe }
}
