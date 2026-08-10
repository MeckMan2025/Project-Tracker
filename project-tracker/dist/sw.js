// Service Worker — Push notification receiver only (no caching/offline)

const ICON = '/ScrumLogo.png'

self.addEventListener('push', (event) => {
  let data = { title: 'New Notification', body: '', icon: ICON }
  try {
    if (event.data) {
      data = { ...data, ...event.data.json() }
    }
  } catch (e) {
    if (event.data) data.body = event.data.text()
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || ICON,
      badge: ICON,
      tag: data.tag || data.title,
      renotify: true,
      data: data,
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus existing window if found
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus()
        }
      }
      // Otherwise open a new window
      return clients.openWindow('/')
    })
  )
})

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim())
})
