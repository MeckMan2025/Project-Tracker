const supabaseUrl = import.meta.env.VITE_SUPABASE_URL

export function triggerPush(notificationRecord) {
  if (!supabaseUrl) return

  fetch(`${supabaseUrl}/functions/v1/send-push`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ record: notificationRecord }),
  }).catch((err) => {
    console.warn('Push notification failed:', err)
  })
}
