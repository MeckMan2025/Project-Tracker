// The teams we scout. One list, so the scouting form's dropdown and RadRank's
// table can never disagree about who is at this competition.
//
// A team not on this list is still scoutable — the form has an "Other team"
// option that takes a number, and RadRank shows those under Other Teams. This
// is the shortlist, not a fence.
// state, city and league come from FTCScout (api.ftcscout.org), from each
// team's latest league meet. league is the FIRST league code; '' when a team
// has not played a league meet yet.
export const LEAGUE_NAMES = { MP: 'Machu Picchu', ZIN: 'Zinnia' }
export const STATE_NAMES = { IA: 'Iowa', WI: 'Wisconsin' }
export const ALL_TEAMS = [
  { number: '367', name: 'Organized Chaos', state: 'IA', city: 'Solon', league: 'ZIN' },
  { number: '4177', name: 'Finger Tightans', state: 'IA', city: 'Riverside', league: 'ZIN' },
  { number: '4237', name: 'Cyberhawks', state: 'IA', city: 'Donnellson', league: 'ZIN' },
  { number: '5062', name: 'Mechanaries', state: 'IA', city: 'Solon', league: 'ZIN' },
  { number: '6072', name: 'Wildbot Robotics', state: 'IA', city: 'Columbus Junction', league: 'ZIN' },
  { number: '6093', name: 'Deviation From The Norm', state: 'IA', city: 'Bettendorf ', league: 'MP' },
  { number: '6458', name: 'Burgbots', state: 'IA', city: 'Williamsburg', league: 'ZIN' },
  { number: '6545', name: 'Knight Riders', state: 'IA', city: 'Davenport', league: 'MP' },
  { number: '6603', name: 'Guild of Gears', state: 'IA', city: 'Eldridge', league: 'MP' },
  { number: '8588', name: 'Finger Puppet Mafia', state: 'IA', city: 'De Witt', league: 'MP' },
  { number: '8672', name: 'UBett', state: 'IA', city: 'Bettendorf', league: 'MP' },
  { number: '8696', name: 'Trobotix', state: 'IA', city: 'Iowa City', league: 'ZIN' },
  { number: '8743', name: 'Raw Bacon', state: 'IA', city: 'Iowa City', league: 'ZIN' },
  { number: '8813', name: 'The Winter Soldiers', state: 'IA', city: 'Bettendorf', league: 'MP' },
  { number: '8988', name: 'Bellevue Blockheads', state: 'IA', city: 'Bellevue', league: 'MP' },
  { number: '10082', name: 'Mechanicats', state: 'IA', city: 'Durant', league: 'MP' },
  { number: '10139', name: 'Glitch Mob', state: 'IA', city: 'Davenport', league: 'MP' },
  { number: '10602', name: 'Pioneer Robotics', state: 'IA', city: 'Fairfield', league: 'ZIN' },
  { number: '11721', name: 'Central Processing Units', state: 'IA', city: 'Davenport', league: 'MP' },
  { number: '12745', name: 'Long John Launchers', state: 'IA', city: 'Danville', league: 'ZIN' },
  { number: '13532', name: 'EagleBots FTC 13532', state: 'IA', city: 'Iowa City', league: 'ZIN' },
  { number: '15050', name: 'Lightning Bots', state: 'IA', city: 'North Liberty', league: 'MP' },
  { number: '15055', name: 'DeDucktive Thinkers', state: 'IA', city: 'Solon', league: 'ZIN' },
  { number: '18482', name: 'Mechanical Soup', state: 'IA', city: 'West Burlington', league: 'ZIN' },
  { number: '20097', name: 'Robo Raptors', state: 'IA', city: 'Dubuque', league: 'MP' },
  { number: '22064', name: 'ThunderBots', state: 'IA', city: 'North Liberty', league: 'ZIN' },
  { number: '22479', name: 'Royal Robots', state: 'IA', city: 'Dubuque', league: 'MP' },
  { number: '23971', name: 'Trobotix JV', state: 'IA', league: 'ZIN' },
  { number: '24296', name: 'TopBot', state: 'IA', city: 'Bettendorf', league: 'MP' },
  { number: '25656', name: 'Pioneer Robotics', state: 'IA', city: 'Davenport', league: '' },
  { number: '25788', name: 'Byte Brawlers', state: 'IA', city: 'Wellman', league: 'ZIN' },
  { number: '31541', name: 'Davenport West', state: 'IA', city: 'Davenport', league: 'MP' },
  { number: '32494', name: 'Screw Ups-Washington Middle School', state: 'IA', city: 'Dubuque', league: 'MP' },
  // Practice day (Wisconsin) — names from ftc-events.firstinspires.org.
  { number: '4115', name: 'Highland Kilts', league: '' },
  { number: '4116', name: 'Volta Robotics', state: 'WI', city: 'Mequon', league: '' },
  { number: '7974', name: 'Great Scott!', state: 'WI', city: 'Mequon', league: '' },
  { number: '8680', name: 'Kraken-Pinion', state: 'WI', city: 'Mequon', league: '' },
  { number: '9224', name: 'Techno G.O.A.T.S.', state: 'WI', city: 'Mequon', league: '' },
  { number: '9225', name: 'Dynamite Social Club', state: 'WI', city: 'Mequon', league: '' },
  { number: '13201', name: 'Team Hazmat', state: 'WI', city: 'Brookfield', league: '' },
  { number: '14631', name: 'Laser Tech', state: 'WI', city: 'Wales', league: '' },
  { number: '16460', name: 'GEarheads', state: 'WI', city: 'Brookfield', league: '' },
  { number: '20293', name: 'Laser Bots', state: 'WI', city: 'Wales', league: '' },
  { number: '21180', name: 'Error 418', state: 'WI', city: 'Brookfield', league: '' },
  { number: '26691', name: 'THUNDERHeads', state: 'WI', city: 'Middleton', league: '' },
  // Rookies in 2026: no league meets on record yet.
  { number: '38350', name: 'Prime Suspects', state: 'IA', city: 'Bettendorf', league: '' },
  { number: '36910', name: 'Ned Zeppelin Robo Storm', state: 'IA', city: 'Camanche', league: '' },
  { number: '36461', name: 'πranhas', state: 'IA', city: 'Davenport', league: '' },
]

export const TEAM_BY_NUMBER = Object.fromEntries(ALL_TEAMS.map(t => [t.number, t.name]))
export const teamLabel = (number) =>
  TEAM_BY_NUMBER[String(number)] ? `${number} — ${TEAM_BY_NUMBER[String(number)]}` : String(number)
