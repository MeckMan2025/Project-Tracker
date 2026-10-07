// How scouting is actually organised at a competition.
//
// Three groups, each covering all four alliance positions, each led by a head
// scouter. Groups rotate across matches so nobody is on for an hour straight,
// and each rotation is tied to a field — at a two-field event you cannot watch
// both, so the group follows the field.
//
// Sample data, matching the layout the team already keeps in a spreadsheet.
// Replace GROUPS and ROTATION with the real fetch when there is one; every
// component below reads these shapes and nothing else.

export const POSITIONS = ['Red 1', 'Red 2', 'Blue 1', 'Blue 2']

export const GROUPS = [
  {
    id: 1,
    head: 'Braden',
    members: { 'Red 1': 'Kayden', 'Red 2': 'Ashrit', 'Blue 1': 'Jacob', 'Blue 2': 'Charan' },
  },
  {
    id: 2,
    head: 'Rian',
    members: { 'Red 1': 'Kashvi', 'Red 2': 'Ricky', 'Blue 1': 'Alexiandria', 'Blue 2': 'Reyansh' },
  },
  {
    id: 3,
    head: 'Arav',
    members: { 'Red 1': 'Anish', 'Red 2': 'Keegan', 'Blue 1': 'Weston', 'Blue 2': 'Daegus' },
  },
]

export const STANDBY = ['Yukti', 'Chethan', 'Isabella']

// Which group has which matches, and on which field. The odd/even split is
// what a two-field event looks like: one group takes the odds, another the
// evens, and they swap after the first rotation so nobody gets every early
// match two events running.
export const ROTATION = [
  { group: 1, field: 'Field A', colour: '#3b82f6', matches: [1, 3, 5, 7, 9] },
  { group: 2, field: 'Field B', colour: '#ef4444', matches: [2, 4, 6, 8, 10] },
  { group: 3, field: 'Field C', colour: '#22c55e', matches: [11, 13, 15, 17, 19] },
  { group: 1, field: 'Field A', colour: '#3b82f6', matches: [12, 14, 16, 18, 20] },
  { group: 2, field: 'Field B', colour: '#ef4444', matches: [21, 23, 25, 27, 29] },
]

// Where one person sits in all of this: their group, their position, and the
// matches that follow from it. Matched on first name, which is what the
// spreadsheet holds — a full display name still finds them.
export function findMe(name) {
  const first = String(name || '').trim().split(/\s+/)[0].toLowerCase()
  if (!first) return null

  for (const g of GROUPS) {
    if (g.head.toLowerCase() === first) {
      return { group: g.id, position: 'Head scouter', head: g.head }
    }
    for (const pos of POSITIONS) {
      if ((g.members[pos] || '').toLowerCase() === first) {
        return { group: g.id, position: pos, head: g.head }
      }
    }
  }
  if (STANDBY.some(s => s.toLowerCase() === first)) {
    return { group: null, position: 'Stand by', head: null }
  }
  return null
}

export const matchesForGroup = (groupId) =>
  ROTATION.filter(r => r.group === groupId)
