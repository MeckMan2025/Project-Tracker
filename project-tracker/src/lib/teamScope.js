// Keeping one team's rows away from another's.
//
// Boards and tasks carry owner_team; everything behind the feature tabs
// carries team_number. Same idea, one rule, written once — because a filter
// that each call site invents for itself is a filter one of them gets wrong,
// and getting it wrong here means showing a team somebody else's work.
//
// NULL means Radical. That makes every row written before sister teams
// existed ours, which is true, and means a forgotten filter fails towards our
// own data rather than towards someone else's.

// The PostgREST fragment for "rows belonging to this team".
//
//   teamScope('38350')  ->  'team_number=eq.38350'
//   teamScope(null)     ->  'team_number=is.null'
//
// Pass the viewer's team number. Radical members pass nothing.
export function teamScope(teamNumber, column = 'team_number') {
  const n = String(teamNumber || '').trim()
  return n && n !== HOME ? `${column}=eq.${encodeURIComponent(n)}` : `${column}=is.null`
}

const HOME = '7196'

// Stamp a row with its owner on the way in, so the filter above has something
// to match next time. Radical rows are left unstamped, matching NULL.
export function stampTeam(row, teamNumber) {
  const n = String(teamNumber || '').trim()
  return n && n !== HOME ? { ...row, team_number: n } : row
}

// Is this row ours to show? For filtering in memory where a query cannot be
// changed — a last line, never the only one.
export function rowBelongs(row, teamNumber) {
  const mine = String(teamNumber || '').trim()
  const theirs = String(row?.team_number || '').trim()
  return (!mine || mine === HOME) ? !theirs : theirs === mine
}
