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

// The same rule, for code that runs outside a component and so cannot read
// myTeamNumber from usePermissions — module-level helpers, mostly.
//
// UserContext writes the signed-in team number here on every sign-in and
// localStorage.clear() on sign-out removes it, so it tracks the session. An
// absent value reads as Radical, which is the same safe direction teamScope
// takes: a missing answer shows us our own data, never somebody else's.
export function storedTeamScope(column = 'team_number') {
  let n = ''
  try { n = window.localStorage.getItem('scrum-team-number') || '' } catch { n = '' }
  return teamScope(n, column)
}

// Stamp a row with its owner on the way in, so the filter above has something
// to match next time. Radical rows are left unstamped, matching NULL.
export function stampTeam(row, teamNumber) {
  const n = String(teamNumber || '').trim()
  return n && n !== HOME ? { ...row, team_number: n } : row
}

// The same two rules again, for the supabase-js query builder rather than a
// URL. Some code reaches the database through the client instead of fetch, and
// a filter it cannot express is a filter it will not have.
//
// Both read the stored team number, so they work outside a component.
export function scopeQuery(query, column = 'team_number') {
  let n = ''
  try { n = window.localStorage.getItem('scrum-team-number') || '' } catch { n = '' }
  n = String(n || '').trim()
  return (n && n !== HOME) ? query.eq(column, n) : query.is(column, null)
}

// Stamp on the way in, for the same callers.
export function stampStored(row) {
  let n = ''
  try { n = window.localStorage.getItem('scrum-team-number') || '' } catch { n = '' }
  return stampTeam(row, n)
}

// Is this row ours to show? For filtering in memory where a query cannot be
// changed — a last line, never the only one.
export function rowBelongs(row, teamNumber) {
  const mine = String(teamNumber || '').trim()
  const theirs = String(row?.team_number || '').trim()
  return (!mine || mine === HOME) ? !theirs : theirs === mine
}
