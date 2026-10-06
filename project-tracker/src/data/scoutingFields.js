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
//   'text'   — free text, never aggregated
// Everything is required. A half-filled row cannot be compared against a full
// one, so a scout who genuinely did not see something should say so in
// Comments rather than leave a silent gap in the averages.

export const SCOUTING_FIELDS = [
  { key: 'team_number',   label: 'Team',              hint: 'Team number',                type: 'text', required: true,  group: 'Match' },
  { key: 'match_number',  label: 'Match',             hint: 'Match number',               type: 'text', required: true,  group: 'Match' },
  { key: 'start_position',label: 'Starting Position', hint: 'Where the robot starts',     type: 'choice', required: true, group: 'Match',
    options: ['Left', 'Middle', 'Right', 'Other'] },

  { key: 'auto_scored',   label: 'Auto Scoring',      hint: 'Successful scoring actions', type: 'number', required: true, group: 'Autonomous' },
  { key: 'auto_missed',   label: 'Auto Misses',       hint: 'Failed attempts',            type: 'number', required: true, group: 'Autonomous' },
  { key: 'auto_reliability', label: 'Auto Reliability', hint: '0–3',                      type: 'scale', required: true,  min: 0, max: 3, group: 'Autonomous' },

  { key: 'teleop_scored', label: 'Teleop Scored',     hint: 'Total successful scoring actions', type: 'number', required: true, group: 'Teleop' },
  { key: 'teleop_missed', label: 'Teleop Misses',     hint: 'Failed attempts',            type: 'number', required: true, group: 'Teleop' },
  { key: 'cycle_count',   label: 'Cycle Count',       hint: 'Completed scoring cycles',   type: 'number', required: true, group: 'Teleop' },
  { key: 'avg_cycle_sec', label: 'Avg Cycle Time',    hint: 'Rough seconds per cycle',    type: 'number', required: true, group: 'Teleop' },

  { key: 'defense',       label: 'Defense',           hint: 'How much they played it',    type: 'choice', required: true, group: 'Defense',
    options: ['None', 'Some', 'Strong'] },
  { key: 'defense_resistance', label: 'Defense Resistance', hint: '1–5 — how well they handle being defended', type: 'scale', required: true, min: 1, max: 5, group: 'Defense' },

  { key: 'endgame',       label: 'Endgame',           hint: 'How it went',                type: 'choice', required: true, group: 'Endgame',
    options: ['Not attempted', 'Attempted', 'Successful', 'Failed'] },

  { key: 'robot_speed',   label: 'Robot Speed',       hint: '1–5',                        type: 'scale', required: true,  min: 1, max: 5, group: 'Ratings' },
  { key: 'driver_skill',  label: 'Driver Skill',      hint: '1–5',                        type: 'scale', required: true,  min: 1, max: 5, group: 'Ratings' },
  { key: 'consistency',   label: 'Consistency',       hint: '1–5',                        type: 'scale', required: true,  min: 1, max: 5, group: 'Ratings' },

  { key: 'penalties',     label: 'Penalties',         hint: 'How many',                   type: 'number', required: true, group: 'Problems' },
  { key: 'penalty_severity', label: 'Penalty Severity', hint: 'Worst one',                type: 'choice', required: true, group: 'Problems',
    options: ['None', 'Minor', 'Major'] },
  { key: 'breakdowns',    label: 'Breakdowns',        hint: 'Mechanical trouble',         type: 'choice', required: true, group: 'Problems',
    options: ['None', 'Minor', 'Major'] },

  { key: 'comments',      label: 'Comments',          hint: 'Anything unusual',           type: 'text', required: true, group: 'Notes' },
]

// The order groups appear in, taken from the fields themselves so the two can
// never disagree.
export const SCOUTING_GROUPS = SCOUTING_FIELDS.reduce(
  (acc, f) => (acc.includes(f.group) ? acc : [...acc, f.group]), [])

export const FIELD_BY_KEY = Object.fromEntries(SCOUTING_FIELDS.map(f => [f.key, f]))

// Worth averaging across matches: counts and ratings. A choice is a label and
// free text is prose — neither means anything as a mean.
export const NUMERIC_FIELDS = SCOUTING_FIELDS.filter(f => f.type === 'number' || f.type === 'scale')

export const blankEntry = () =>
  Object.fromEntries(SCOUTING_FIELDS.map(f => [f.key, '']))
