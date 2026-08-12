// Role catalog for the Org Chart. Each department (Business / Technical) has a
// set of specific roles. People are placed into a role box by matching
// function_tags. Descriptions power the hover tooltips.

export const BUSINESS_ROLES = [
  { tag: 'Communications', desc: 'Team communications, emails, the team website, and social media.' },
  { tag: 'Finance', desc: 'Budget, fundraising, and reimbursements.' },
  { tag: 'Outreach', desc: 'Community events and STEM outreach.' },
]

// Technical splits into two sides: Hardware (blue) and Software (green).
export const TECHNICAL_GROUPS = [
  {
    key: 'hardware', label: 'Hardware', color: 'blue',
    roles: [
      { tag: 'CAD', desc: 'Designs robot parts and assemblies in 3D CAD.' },
      { tag: 'Assembly/Building', desc: 'Fabricates and assembles the physical robot.' },
      { tag: 'Wiring', desc: 'Wires motors, sensors, and manages the electronics.' },
    ],
  },
  {
    key: 'software', label: 'Software', color: 'green',
    roles: [
      { tag: 'Programming', desc: 'Writes autonomous and driver-control code.' },
      { tag: 'Scouting', desc: 'Collects and analyzes match data on other teams.' },
    ],
  },
]

// Flattened technical roles (used for catalog/extra-tag detection).
export const TECHNICAL_ROLES = TECHNICAL_GROUPS.flatMap(g => g.roles)

// Leadership / support role descriptions (tooltips for those sections)
export const LEAD_DESC = {
  'Business Lead': 'Leads the business subteam and its members.',
  'Technical Lead': 'Leads the technical subteam and its members.',
  'Programming Lead': 'Leads the software subteam and its members.',
  'Project Manager': 'Coordinates timelines, tasks, and the whole team.',
  'Co-Founder': 'Founded and oversees the team.',
  'Mentor': 'Adult mentor guiding the team.',
  'Coach': 'Team coach and adult supervisor.',
}

// Tags that describe leadership/standing, NOT a functional role box.
export const LEADERSHIP_TAGS = new Set([
  'Co-Founder', 'Coach', 'Mentor', 'Team Lead', 'Project Manager',
  'Business Lead', 'Technical Lead', 'Programming Lead', 'Team', 'Business', 'Technical',
])

// Build a { tag -> description } lookup from everything above.
export const ROLE_DESC = (() => {
  const m = {}
  for (const r of [...BUSINESS_ROLES, ...TECHNICAL_ROLES]) m[r.tag] = r.desc
  for (const [k, v] of Object.entries(LEAD_DESC)) m[k] = v
  return m
})()
