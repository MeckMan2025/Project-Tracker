// Role dashboards & data trackers.
//
// Each role has a set of trackers. A tracker has:
//   id, role, name, type, visibility, value, (unit?, target?)
//   type:        'number' | 'progress' | 'checklist' | 'note' | 'event'
//   visibility:  'public'  -> shown in the Data tab's role subtab (everyone)
//                'role'    -> shown only on the dashboard (Home) of that role
//   value:       number (number/progress) | string (note) | [{text, done}] (checklist)
//                | {title, date, location, details} (event)
//
// Trackers are stored in one JSON doc so no new table/migration is needed.

// Bump this whenever SEED_TRACKERS gains new entries. On load, any seed whose id
// isn't in the saved doc gets appended once, then the doc records the new version
// so a tracker a lead later deletes stays deleted instead of coming back.
export const SEED_VERSION = 2

export const DASHBOARD_ROLES = [
  { role: 'Communications', side: 'business' },
  { role: 'Finance', side: 'business' },
  { role: 'Outreach', side: 'business' },
  { role: 'CAD', side: 'hardware' },
  { role: 'Assembly/Building', side: 'hardware' },
  { role: 'Wiring', side: 'hardware' },
  { role: 'Programming', side: 'software' },
  { role: 'Scouting', side: 'software' },
]

export const ROLE_NAMES = DASHBOARD_ROLES.map(r => r.role)

// Color per side (matches the org chart)
export const SIDE_THEME = {
  business: { text: 'text-orange-700', chip: 'bg-orange-100 text-orange-700', bar: 'bg-orange-400', ring: 'border-orange-200' },
  hardware: { text: 'text-blue-700', chip: 'bg-blue-100 text-blue-700', bar: 'bg-blue-400', ring: 'border-blue-200' },
  software: { text: 'text-green-700', chip: 'bg-green-100 text-green-700', bar: 'bg-green-400', ring: 'border-green-200' },
}

export const sideForRole = (role) => (DASHBOARD_ROLES.find(r => r.role === role)?.side) || 'business'

// Starter trackers — shown until leads customize them in-app.
export const SEED_TRACKERS = [
  // Communications
  { id: 'com-sponsors', role: 'Communications', name: 'Sponsors Contacted', type: 'number', value: 0, visibility: 'public' },
  { id: 'com-posts', role: 'Communications', name: 'Social Posts', type: 'number', value: 0, visibility: 'public' },
  { id: 'com-todo', role: 'Communications', name: 'To Post / Update', type: 'checklist', value: [], visibility: 'role' },

  // Finance
  { id: 'fin-budget', role: 'Finance', name: 'Budget Remaining', type: 'progress', unit: '$', target: 3000, value: 3000, visibility: 'public' },
  { id: 'fin-raised', role: 'Finance', name: 'Funds Raised', type: 'number', unit: '$', value: 0, visibility: 'public' },
  { id: 'fin-expenses', role: 'Finance', name: 'Expense Log', type: 'checklist', value: [], visibility: 'role' },

  // Outreach
  { id: 'out-events', role: 'Outreach', name: 'Events This Season', type: 'number', value: 0, visibility: 'public' },
  { id: 'out-reached', role: 'Outreach', name: 'People Reached', type: 'number', value: 0, visibility: 'public' },
  { id: 'out-hours', role: 'Outreach', name: 'Outreach Hours', type: 'number', unit: 'hrs', value: 0, visibility: 'public' },
  { id: 'out-orgs', role: 'Outreach', name: 'Organizations Worked With', type: 'number', value: 0, visibility: 'public' },
  { id: 'out-next', role: 'Outreach', name: 'Next Outreach Event', type: 'event', value: { title: '', date: '', location: '', details: '' }, visibility: 'public' },
  { id: 'out-upcoming', role: 'Outreach', name: 'Upcoming Events', type: 'checklist', value: [], visibility: 'role' },

  // CAD
  { id: 'cad-parts', role: 'CAD', name: 'Parts Designed', type: 'number', value: 0, visibility: 'public' },
  { id: 'cad-todo', role: 'CAD', name: 'CAD To-Do', type: 'checklist', value: [], visibility: 'role' },

  // Assembly/Building
  { id: 'asm-progress', role: 'Assembly/Building', name: 'Build Progress', type: 'progress', unit: '%', target: 100, value: 0, visibility: 'public' },
  { id: 'asm-subsystems', role: 'Assembly/Building', name: 'Subsystems', type: 'checklist', value: [], visibility: 'role' },

  // Wiring
  { id: 'wir-progress', role: 'Wiring', name: 'Wiring Progress', type: 'progress', unit: '%', target: 100, value: 0, visibility: 'public' },
  { id: 'wir-todo', role: 'Wiring', name: 'Wiring Checklist', type: 'checklist', value: [], visibility: 'role' },

  // Programming
  { id: 'prg-auto', role: 'Programming', name: 'Autonomous Progress', type: 'progress', unit: '%', target: 100, value: 0, visibility: 'public' },
  { id: 'prg-opmodes', role: 'Programming', name: 'OpModes Done', type: 'number', value: 0, visibility: 'public' },
  { id: 'prg-todo', role: 'Programming', name: 'Code To-Do', type: 'checklist', value: [], visibility: 'role' },

  // Scouting
  { id: 'sco-teams', role: 'Scouting', name: 'Teams Scouted', type: 'number', value: 0, visibility: 'public' },
  { id: 'sco-matches', role: 'Scouting', name: 'Matches Logged', type: 'number', value: 0, visibility: 'public' },
]

export const uid = () => 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
