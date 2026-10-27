// The Radical Rundown, one entry per season. The page keeps every season and
// lets a visitor shift between them, so last year's page is never overwritten
// — it just stops being the default once the next season is written.
//
// Shared sections (what's inside the app, the scouting write-up, the interest
// form, the theme song, the coach quote) live in TeamInfoPage itself. Only the
// parts that change year to year are here.
//
// To start a new season: copy the latest entry, give it the new key, and edit.
// The newest key is the default on the page.

const KAYDEN = {
  name: 'Kayden',
  role: 'Cofounder',
  emoji: '🧠',
  color: 'text-pastel-pink-dark',
  photo: '/leaders/kayden.jpg',
  photoPosition: 'center 40%',
  bio: `If you see someone awake at 1:47 a.m. asking Claude to "just fix one more thing," that's probably me. Claude is an AI coding assistant by Anthropic — and my go-to partner for building this app. I led the development of our platform, turning our team's organization challenges into a structured, working system. Beyond building the app myself, I also get teammates involved by helping them create their own small projects within it, because the best way to learn is by doing. The real technical challenge wasn't just building features; it was convincing Claude to properly interpret my late-night grammar mistakes. Somehow, between caffeine and debugging, we built something that actually works.`,
}

const YUKTI = {
  name: 'Yukti',
  role: 'Cofounder',
  emoji: '🚀',
  color: 'text-pastel-blue-dark',
  photo: '/leaders/yukti.jpg',
  photoPosition: '50% 0%',
  bio: 'Every system starts with a prototype, and I built the first one. Creating the original version of our team app is what made this whole idea feel real and exciting. Seeing the first prototype come to life showed us that we could actually solve our organization challenges, and that momentum pushed us to keep improving it into what it is today.',
  reverse: true,
}

export const RUNDOWN_SEASONS = {
  '2025-2026': {
    label: '2025–26',
    game: 'DECODE',
    theme: 'pastel',
    // Paragraphs beside the team selfie
    story: [
      'Last season, we won the Control Award and were chosen as an alliance partner. This year, Everything That\'s Radical is mainly composed of members that are new to FTC, and the team is ecstatic to learn STEM-based skills with FIRST!',
      'Each student grows from the experiences within the FIRST Tech Challenge program, no matter if it is designing and building a robot, putting together a portfolio and presentation, or through outreach. Every student on our team is also able to take advantage of the many Applied Science Classes that Pleasant Valley High School provides, and many of our team members have taken one or more of these classes.',
    ],
    // One card per leader, alternating sides
    leaders: [
      {
        name: 'Harshita', role: 'Project Manager', emoji: '🚀', color: 'text-pastel-orange-dark',
        photo: '/leaders/harshita.jpg', photoPosition: 'center',
        bio: "Somebody has to keep all the moving parts aligned — and that's me. I connect our business and technical teams, coordinate responsibilities, and make sure our progress doesn't stall. When deadlines approach or chaos starts creeping in, I focus on keeping us organized, calm, and moving forward together.",
      },
      {
        name: 'Lily', role: 'Business Lead', emoji: '💼', color: 'text-pastel-pink-dark',
        photo: '/leaders/lily.jpg', reverse: true,
        bio: "Behind every working robot is a working plan — and that's where I come in. I handle outreach, sponsorships, and presentations, and I make sure our team communicates as well as it competes. While the robot team fine-tunes mechanisms, I'm building connections and making sure we have the resources and strategy to succeed. Organization might not score points directly — but it wins seasons.",
      },
      {
        name: 'Nick', role: 'Technical Lead', emoji: '🔧', color: 'text-pastel-blue-dark',
        photo: '/leaders/nick.jpg', photoPosition: 'center 30%',
        bio: "SNAP! …did you hear that? Don't worry — I probably already fixed it. I oversee build, CAD, and programming to make sure our robot performs the way we designed it to. My job is turning ideas into something precise, reliable, and competition-ready. If it spins, lifts, drives, or occasionally makes a questionable noise — I'm on it.",
      },
    ],
    founders: [KAYDEN, YUKTI],
  },

  '2026-2027': {
    label: '2026–27',
    game: 'BIOBUZZ',
    theme: 'biobuzz',
    story: [
      'Last season, we won the Sustain Award, and we were chosen as an alliance partner for the playoff match. This year, Everything That\'s Radical is composed of ongoing members and people who are new to FTC, and we are very ecstatic to learn STEM-based skills with FIRST!',
      'This year we started a whole new FTC team, 38350 Prime Suspects. We have been mentoring and teaching them all the skills they need to be successful in FTC competitions and how to lead a successful team.',
      'Each student grows from the experiences within the FIRST Tech Challenge program, no matter if it is designing and building a robot, putting together a portfolio and presentation, or through outreach. Every student on our team is also able to take advantage of the many Applied Science Classes that Pleasant Valley High School provides, and many of our team members have taken one or more of these classes.',
    ],
    // Two project managers share one card, then each department is a lead
    // with a co-lead beside them.
    managers: {
      role: 'Project Managers', emoji: '🐝', color: 'text-amber-700',
      people: [
        { name: 'Kayden', photo: '/leaders/kayden.jpg', photoPosition: 'center 40%' },
        { name: 'Yukti', photo: '/leaders/yukti.jpg', photoPosition: '50% 0%' },
      ],
      bio: "Somebody has to keep all the moving parts aligned — and that's us. We connect our business, technical and programming teams, coordinate responsibilities, and make sure our progress doesn't stall. When deadlines approach or chaos starts creeping in, we focus on keeping our group organized and calm, ensuring that we move forward together.",
    },
    departments: [
      {
        name: 'Business', emoji: '🍯', color: 'text-amber-700', accent: 'border-amber-400', tint: 'bg-amber-100/60',
        lead: {
          name: 'Lily', role: 'Business Lead', photo: '/leaders/lily.jpg',
          bio: "Behind every working robot is a working plan — and that's where I come in. I handle outreach, sponsorships, and presentations, and I make sure our team communicates as well as it competes. While the robot team fine-tunes mechanisms, I'm building connections and making sure we have the resources and strategy to succeed. Organization might not score points directly — but it wins seasons.",
        },
        colead: {
          name: 'Varsha', role: 'Business Co-lead', photo: '/leaders/varsha.jpg',
          bio: "It can be hard for Lily to do everything by herself, and that's why I'm here! I help support Lily by working alongside her in handling outreach and sponsorships, ensuring that business runs smoothly. Two heads work better than one, and with the two of us managing connections and working together, we will have a successful season!",
        },
      },
      {
        name: 'Technical / Hardware', emoji: '🔧', color: 'text-yellow-700', accent: 'border-yellow-400', tint: 'bg-yellow-100/60',
        lead: {
          name: 'James', role: 'Technical / Hardware Lead', photo: '/leaders/james.jpg',
          bio: "SNAP! …did you hear that? Don't worry — I probably already fixed it. I oversee build, CAD, and hardware to make sure our robot performs the way we designed it to. My job is turning ideas into something precise, reliable, and competition-ready. If it spins, lifts, drives, or occasionally makes a questionable noise — I'm on it.",
        },
        colead: {
          name: 'Braden', role: 'Technical / Hardware Co-lead', photo: '/leaders/braden.jpg',
          bio: 'I work and lead alongside James on any technical and hardware work and projects to make our robot the most efficient and successful it can be. I make the robot ready to work for our competitions, and I fix and clean it before and after matches. I also talk to judges in the pit and play a major role in that.',
        },
      },
      {
        name: 'Programming', emoji: '💻', color: 'text-orange-700', accent: 'border-orange-300', tint: 'bg-orange-100/60',
        lead: {
          name: 'Pragnya', role: 'Programming Lead', photo: '/leaders/pragnya.jpg',
          bio: 'Behind every working robot there is code to make it work, and this is what I enjoy doing! I learned to code from our mentor, Mr. Seamer, and I also learned how to work along with my team to make the robot move and shoot.',
        },
        colead: {
          name: 'Saumyaa', role: 'Programming Co-lead', photo: '/leaders/saumyaa.jpg',
          bio: 'I work along with Pragnya on any programming and code-related materials that are used to make the robot function, actually move and shoot, and meet our goals for our upcoming competitions. Last year I was also part of the Drive Team and spent lots of time learning and executing strategies on the field itself.',
        },
      },
    ],
    founders: [{ ...KAYDEN, color: 'text-amber-700' }, { ...YUKTI, color: 'text-orange-700' }],
  },
}

// Newest first, so the first one is the default
export const RUNDOWN_KEYS = Object.keys(RUNDOWN_SEASONS).sort().reverse()
export const LATEST_RUNDOWN = RUNDOWN_KEYS[0]
