import { useState, useEffect } from 'react'

// The team roster, for dropdowns. One shared source so every "pick a person"
// control agrees with RadMems instead of relying on typed names.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export function useMemberNames() {
  const [names, setNames] = useState([])

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const res = await fetch(
          `${supabaseUrl}/rest/v1/profiles?select=display_name,function_tags&order=display_name`,
          { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
        )
        if (!res.ok || !active) return
        const rows = await res.json()
        setNames(
          (Array.isArray(rows) ? rows : [])
            .filter(r => !(r.function_tags || []).includes('Team')) // team accounts aren't people
            .map(r => r.display_name)
            .filter(Boolean)
        )
      } catch { /* ignore */ }
    })()
    return () => { active = false }
  }, [])

  return names
}
