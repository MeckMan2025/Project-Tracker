// Active competition season — derived automatically from the current date so
// new notebook entries are always filed under the correct season without anyone
// having to remember to bump a constant each year.
//
// FTC seasons are named "<startYear>-<endYear>" and kick off in the fall. We
// roll over to the new season in MAY (after the prior season's championship),
// so summer offseason prep is filed under the UPCOMING season, not the one that
// just ended. Adjust `ROLLOVER_MONTH` if your team's boundary differs.
const ROLLOVER_MONTH = 5 // May

function seasonForDate(now) {
  const y = now.getFullYear()
  const m = now.getMonth() + 1 // 1-12
  return m >= ROLLOVER_MONTH ? `${y}-${y + 1}` : `${y - 1}-${y}`
}

export const ACTIVE_SEASON = seasonForDate(new Date())

// The season immediately before the active one (used for untagged/legacy entries).
export const PREVIOUS_SEASON = (() => {
  const [start, end] = ACTIVE_SEASON.split('-').map(Number)
  return `${start - 1}-${end - 1}`
})()

// The season an entry belongs to (falls back to the previous season for untagged/legacy entries)
export const seasonOf = (entry) => (entry && entry.season) || PREVIOUS_SEASON
