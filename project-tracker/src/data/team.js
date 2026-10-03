// Who we are. The number was written out by hand in a dozen places — the
// loading screen, the about page, the scouting seed, the alliance hub
// placeholder — so changing it meant finding all of them.
export const HOME_TEAM_NUMBER = '7196'
export const HOME_TEAM_NAME = "Everything That's Radical"

// Accounts for OTHER teams sign in as team<number>@teams.radical. Ours is not
// one of those: a Radical member has a real email and a real profile, so the
// home number must never resolve to a team account.
export const teamLoginEmail = (number) => `team${String(number).trim()}@teams.radical`
export const isHomeTeamNumber = (value) => String(value || '').trim() === HOME_TEAM_NUMBER
