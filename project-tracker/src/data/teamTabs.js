// What a visiting team can reach, in one place.
//
// App.jsx enforces this list and TeamHomeView explains it. They used to be
// written out separately, and drifted: the welcome screen was still offering
// Chat, Scouting, Data and the AI Manual long after teams stopped having any
// of them. A team being told about a tab that is not there is worse than not
// being told at all — they go looking for it and conclude the app is broken.
//
// Adding a tab here is the only change needed; the guide follows.

export const TEAM_TABS = [
  {
    id: 'home',
    how: ['Your week, your tasks and your notebook photos, all on one page.', 'Tap a day in This Week or a task in My Tasks to jump to it.'],
    name: 'Home',
    icon: 'Home',
    description: 'Where you are now — your team, and anything new.',
  },
  {
    id: 'boards',
    how: ['Tap Add Folder to make a board — Build, Programming, Business, whatever your team needs.', 'Add a task, give it a person and a due date, then drag it across as it gets done.'],
    name: 'Boards',
    icon: 'FolderKanban',
    description: 'Your scrum boards, as many as you need. Make tasks, drag them along as they get done. Only your team can see them.',
  },
  {
    id: 'calendar',
    how: ['Tap a day to add a meeting, competition or deadline.', 'Everything on it shows up in This Week on Home.'],
    name: 'Calendar',
    icon: 'Calendar',
    description: 'Meetings, competitions and deadlines.',
  },
  {
    id: 'notebook',
    how: ['After each meeting tap New Entry and answer one question at a time.', 'Add a photo, then read it all back as a real notebook, by date or by project.'],
    name: 'Engineering Notebook',
    icon: 'BookOpen',
    description: 'Your team\'s own notebook. Write up each meeting one question at a time and read it back as a real notebook. Nobody outside your team can see it.',
  },
  {
    id: 'team-growth',
    how: ['Fills in by itself from your notebook entries and finished tasks.', 'Pick a section — Engagement, Learning, Deadlines and more — and filter by person or date.'],
    name: 'Team Growth',
    icon: 'LineChart',
    description: 'What your own notebook and tasks say about how your team is growing, as charts. Only your team\'s entries count.',
  },
  {
    // One entry in the guide, three pages behind it.
    id: 'logs-outreach',
    how: ['Outreach: log each event, who went and how many people you reached.', 'Expenses: log a purchase with its receipt. Mentor: fills itself in from notebook entries that say a mentor helped.'],
    also: ['logs-expenses', 'logs-mentor'],
    name: 'Logs',
    icon: 'ScrollText',
    description: 'Your outreach, your expenses and your mentor log. Only your team sees them.',
  },
  {
    id: 'user-management',
    how: ['Your coach adds each member and mentor with their email.', 'They sign in with their own account and land in your team, nobody else\'s.'],
    name: 'User Management',
    icon: 'Shield',
    description: 'Add your own members and mentors. Your coach runs this — nobody outside your team appears here.',
  },
  {
    id: 'suggestions',
    how: ['Type an idea or a bug and send it.', 'It comes straight to the people who build ETS.'],
    name: 'Suggestions',
    icon: 'Lightbulb',
    description: 'Tell us what would make this better. We read them.',
  },
  {
    id: 'profile',
    how: ['Set your name, nickname and picture.'],
    name: 'Profile',
    icon: 'User',
    description: 'Your own details.',
  },
  {
    id: 'settings',
    how: ['Switch light or dark, choose notifications, and sign out.'],
    name: 'Settings',
    icon: 'Settings',
    description: 'Theme, notifications, and signing out.',
  },
]

export const TEAM_TAB_IDS = TEAM_TABS.flatMap(t => [t.id, ...(t.also || [])])
