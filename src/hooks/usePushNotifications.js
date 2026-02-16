import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase'
import { useUser } from '../contexts/UserContext'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
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

  // Check current state on mount
  useEffect(() => {
    if (!isSupported) return
    setPermission(Notification.permission)

    navigator.serviceWorker.ready.then((reg) => {
      reg.pushManager.getSubscription().then((sub) => {
        setIsSubscribed(!!sub)
      })
    })
  }, [isSupported])

  const subscribe = useCallback(async () => {
    if (!isSupported || !user) return false

    try {
      const perm = await Notification.requestPermission()
      setPermission(perm)
      if (perm !== 'granted') return false

      const reg = await navigator.serviceWorker.ready
      const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
      if (!vapidPublicKey) {
        console.error('VITE_VAPID_PUBLIC_KEY not set')
        return false
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      })

      const subJson = sub.toJSON()
      const { error } = await supabase.from('push_subscriptions').upsert({
        user_id: user.id,
        endpoint: subJson.endpoint,
        p256dh: subJson.keys.p256dh,
        auth: subJson.keys.auth,
      }, { onConflict: 'user_id,endpoint' })

      if (error) {
        console.error('Failed to save push subscription:', error)
        return false
      }

      setIsSubscribed(true)
      return true
    } catch (err) {
      console.error('Push subscription failed:', err)
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
