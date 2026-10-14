// What we record about a team in a match.
//
// One definition drives the form, the table, the CSV export and the averages,
// so adding a field is an entry here and nothing else. That matters for
// scouting in particular: the game changes every season, and the parts that
// change are mostly these.
//
// type:
//   'number' — a count, kept as a number so it can be averaged
//   'choice' — pick one of options
//   'scale'  — a rating; min..max inclusive, shown as buttons
//   'yesno'  — Yes / No, stored as 1 / 0 so a team's matches average into a
//              share. Older rows held a count here; anything above 0 is a Yes.
//   'text'   — free text, never aggregated
// Everything is required. A half-filled row cannot be compared against a full
// one, so a scout who genuinely did not see something should say so in
// Comments rather than leave a silent gap in the averages.

const YES_NO = ['Yes', 'No']

export const SCOUTING_FIELDS = [
  { key: 'team_number',   label: 'Team',  hint: 'Team number',  type: 'text', required: true, group: 'Match' },
  { key: 'match_number',  label: 'Match', hint: 'Match number', type: 'text', required: true, group: 'Match' },
  // Tapped on a picture of the field rather than picked off a list: a scout
  // looking at the field should not have to translate what they can see into
  // somebody else's word for it.
  { key: 'start_position',label: 'Starting Position', hint: 'Tap where the robot starts', type: 'field', required: true, group: 'Match',
    options: ['Left', 'Middle', 'Right'] },

  // Shot vs made, not "did they score": a team that attempts ten and lands two
  // is a different team from one that attempts two and lands two, and the old
  // yes/no could not tell them apart. auto_collected is gone — collecting with
  // nothing to show for it was never the question.
  { key: 'auto_shot',     label: 'Auto Shot',   hint: 'How many they attempted', type: 'number', required: true, group: 'Autonomous' },
  { key: 'auto_made',     label: 'Auto Made',   hint: 'How many went in',        type: 'number', required: true, group: 'Autonomous' },
  { key: 'auto_leave',    label: 'Leave',       hint: 'Did they leave the start?', type: 'yesno', required: true, group: 'Autonomous', options: YES_NO },
  { key: 'auto_park',     label: 'Park',        hint: 'Did they park?',          type: 'yesno', required: true, group: 'Autonomous', options: YES_NO },
  { key: 'auto_reliability', label: 'Auto Reliability', hint: 'How much of it worked', type: 'percent', required: true, group: 'Autonomous' },
  { key: 'auto_notes',    label: 'Auto Notes',  hint: 'Anything about their auto', type: 'text', required: false, group: 'Autonomous' },

  { key: 'teleop_shot',   label: 'Teleop Shot', hint: 'How many they attempted', type: 'number', required: true, group: 'Teleop' },
  { key: 'teleop_made',   label: 'Teleop Made', hint: 'How many went in',        type: 'number', required: true, group: 'Teleop' },
  { key: 'teleop_tips',   label: 'Tips',        hint: 'Times they tipped over',  type: 'number', required: true, group: 'Teleop' },
  { key: 'cycle_count',   label: 'Cycle Count', hint: 'Completed scoring cycles', type: 'number', required: true, group: 'Teleop' },
  { key: 'avg_cycle_sec', label: 'Avg Cycle Time', hint: 'Rough seconds per cycle', type: 'number', required: true, group: 'Teleop' },
  { key: 'teleop_notes',  label: 'Teleop Notes', hint: 'Anything about their teleop', type: 'text', required: false, group: 'Teleop' },

  { key: 'defense',       label: 'Defense', hint: 'How much they played it', type: 'choice', required: true, group: 'Defense',
    options: ['None', 'Some', 'Strong'] },
  { key: 'defense_resistance', label: 'Defense Resistance', hint: 'How well they handle being defended', type: 'percent', required: true, group: 'Defense' },

  // More than one can be true in the same endgame, so this is tick-all rather
  // than pick-one.
  { key: 'endgame',       label: 'Endgame', hint: 'Everything they did', type: 'multi', required: true, group: 'Endgame',
    options: ['Garden', 'Parking', 'Flowers', 'Nothing'] },
  { key: 'flowers_owned', label: 'Flowers Owned', hint: 'Which ones they finished owning', type: 'multi', required: false, group: 'Endgame',
    options: ['Left', 'Centre Left', 'Centre Right', 'Right'] },
  { key: 'rp_points',     label: 'RP Points', hint: 'Ranking points they earned', type: 'multi', required: false, group: 'Endgame',
    options: ['Win', 'Auto', 'Endgame', 'Tie'] },

  { key: 'robot_speed',   label: 'Robot Speed',  hint: '1–5', type: 'scale', required: true, min: 1, max: 5, group: 'Ratings' },
  { key: 'driver_skill',  label: 'Driver Skill', hint: '1–5', type: 'scale', required: true, min: 1, max: 5, group: 'Ratings' },
  { key: 'consistency',   label: 'Consistency',  hint: '1–5', type: 'scale', required: true, min: 1, max: 5, group: 'Ratings' },

  // Counted, not graded. "Major" told you the worst one and nothing about how
  // often, which is the half that decides whether to pick them.
  { key: 'minors',        label: 'Minor Penalties', hint: 'How many', type: 'number', required: true, group: 'Problems' },
  { key: 'majors',        label: 'Major Penalties', hint: 'How many', type: 'number', required: true, group: 'Problems' },
  { key: 'breakdowns',    label: 'Breakdowns', hint: 'Mechanical trouble', type: 'choice', required: true, group: 'Problems',
    options: ['None', 'Minor', 'Major'] },

  { key: 'comments',      label: 'Comments', hint: 'Anything unusual', type: 'text', required: true, group: 'Notes' },
]

// The order groups appear in, taken from the fields themselves so the two can
// never disagree.
export const SCOUTING_GROUPS = SCOUTING_FIELDS.reduce(
  (acc, f) => (acc.includes(f.group) ? acc : [...acc, f.group]), [])

export const FIELD_BY_KEY = Object.fromEntries(SCOUTING_FIELDS.map(f => [f.key, f]))

// Worth averaging across matches: counts, ratings and yes/no (as a share of
// matches). A choice is a label and free text is prose — neither means
// anything as a mean.
export const NUMERIC_FIELDS = SCOUTING_FIELDS.filter(f => f.type === 'number' || f.type === 'scale' || f.type === 'yesno' || f.type === 'percent')

// A stored yes/no as 1, 0 or null. Rows saved before these were yes/no hold
// a count, and any count above zero means they did it.
export const yesNo = (v) => (v == null || v === '' ? null : Number(v) > 0 ? 1 : 0)

// A stored value as a person should read it, in a table or a CSV.
export const displayValue = (f, v) => {
  if (v == null || v === '') return ''
  if (f?.type === 'yesno') return yesNo(v) ? 'Yes' : 'No'
  return String(v)
}

export const blankEntry = () =>
  Object.fromEntries(SCOUTING_FIELDS.map(f => [f.key, '']))
