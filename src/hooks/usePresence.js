import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export function usePresence(username) {
  const [onlineUsers, setOnlineUsers] = useState([])

  useEffect(() => {
    if (!username) return

    const channel = supabase.channel('online-presence', {
      config: { presence: { key: username } },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        const users = Object.entries(state).map(([key, presences]) => ({
          username: key,
          online_at: presences[0]?.online_at,
        }))
        setOnlineUsers(users)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ online_at: new Date().toISOString() })
        }
      })

    return () => {
      channel.untrack()
      supabase.removeChannel(channel)
    }
  }, [username])

  return onlineUsers
}
