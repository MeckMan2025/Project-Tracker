// LOCAL DEV STAND-IN for the main app's src/hooks/usePermissions.js.
// Returns only the flags SwotView reads, derived the same way the main app
// derives them from function tags. Do not merge this file.
import { useUser } from '../contexts/UserContext'

const LEAD_TAGS = ['Co-Founder', 'Mentor', 'Coach', 'Project Manager', 'Business Lead', 'Technical Lead', 'Programming Lead']

export function usePermissions() {
  const { functionTags } = useUser()
  const isGuest = functionTags.length === 0
  const hasLeadTag = functionTags.some(t => LEAD_TAGS.includes(t))

  return {
    isGuest,
    hasLeadTag,
    canEditContent: hasLeadTag,
  }
}
