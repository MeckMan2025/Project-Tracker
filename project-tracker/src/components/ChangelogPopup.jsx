import { useState } from 'react'
import { Sparkles, X } from 'lucide-react'
import { useUser } from '../contexts/UserContext'

// Add new entries at the TOP with the next id. Everything else is automatic.
const CHANGELOG = [
  {
    id: 160,
    date: '2026-09-04',
    items: [
      '\u{1F389} A confetti pops up in the corner on someone\'s birthday, and everyone gets a Happy Birthday notification with their name. It reads the birthdays already on the calendar, so there is nothing extra to fill in \u2014 two people sharing a day get one message between them, and on your own birthday you get the confetti without being pinged about yourself',
      '\u{1F49B} Daily Team Pulse is off the site for now \u2014 no daily popup, no Team Pulse under Special Controls, and no switch for it in Settings. Nothing anyone answered was deleted, and your on/off preference is remembered if it comes back',
      '\u{1F4F7} Notebook: adding a photo can\'t spin forever any more. A photo the browser couldn\'t open \u2014 usually an iPhone HEIC \u2014 left the loading circle going and the Submit button stuck grey with nothing to explain it. Now it says what went wrong and what to do instead',
      '\u2705 Notebook: the Submit button tells you what is still missing \u2014 what you did, why it mattered, a photo or a project link \u2014 instead of just being greyed out',
      '\u{1F5BC}\uFE0F Org chart shows people as squares now \u2014 profile picture on top, name underneath \u2014 laid out in a grid so they line up in rows and columns instead of a run-on line of name tags',
      '\u{1F5FA}\uFE0F Org chart is three equal departments now \u2014 Business, Hardware and Software side by side. Technical is gone as a layer above Hardware and Software, and each of the three shows its own lead',
    ],
  },
  {
    id: 159,
    date: '2026-09-04',
    items: [
      '\u{1F511} Resetting someone\'s password keeps the temporary password on screen now, with a Copy button, instead of wiping it the second you hit Reset. Three people had been locked out of the app that way \u2014 nobody knew what password to give them',
      '\u{1F9D1}\u200D\u{1F3EB} Mentors and coaches aren\'t marked present or absent any more \u2014 they run the meeting, they don\'t attend it. Their old attendance records were cleared out too',
      '\u{1F5DD}\uFE0F The key and trashcan icons in User Management only appear for people who can actually use them \u2014 Co-Founders, Mentors, Coaches, Business Lead and Technical Lead. Before this, some leads saw buttons that failed every time they tapped them',
    ],
  },
  {
    id: 158,
    date: '2026-09-03',
    items: [
      '\u{1F4CB} Starting today\'s attendance twice can\'t happen any more. Tapping the button again opens the session that already exists instead of starting a rival one \u2014 September 3rd had ended up with 13 copies of the same meeting',
      '\u{1F557} Evening meetings are filed under the right day. After about 7pm they were being saved as tomorrow, in attendance and in notebook entries',
      '\u{1F464} Changing your display name no longer makes you appear twice on every past meeting, once under your old name and once as a blank row under the new one',
      '\u{1F4D3} The Engineering Notebook has an activity card: how many people wrote an entry that day, with a date picker for any other day. Leads can open it to see who has written one and who hasn\'t',
    ],
  },
  {
    id: 157,
    date: '2026-08-17',
    items: [
      '🧪 Test notification button is back on the calendar for Kayden, with a choice of just yourself or the whole team',
      '🔔 A one-time prompt asks you to turn on notifications and says what they\'re for — tasks assigned to you, announcements, role changes, request decisions and upcoming meetings',
      '🕓 New meetings default to 4–8 PM on weekdays and 8 AM–2 PM at the weekend, and the times follow if you change the date',
    ],
  },
  {
    id: 156,
    date: '2026-08-15',
    items: [
      '🤏 Dragging a timeline note actually works now — it follows your cursor the whole way and joins the bottom of the day you drop it on. Leads, mentors and coaches only',
      '🏆 The First Meet note counts meetings away instead of days — Tuesdays, Thursdays and Saturdays',
      '🧑‍🏫 User Management has a Mentors tab beside RadMems and TeamRo — mentors and coaches live there instead of in the student roster',
      '🗑️ The PasMems tab is gone — removed members are still archived behind the scenes, there just isn\'t a page for it',
    ],
  },
  {
    id: 155,
    date: '2026-08-14',
    items: [
      '📅 Calendar is a sidebar tab now instead of hiding in the three-dots menu',
      '🔽 The calendar\'s All / Team / Business filter is a dropdown now instead of a row of chips you had to scroll sideways',
      '🗂️ The calendar filter now lists your boards — add a board and it shows up as a filter, showing that board\'s tasks and events',
      '📌 Calendar events can be filed under Other when none of the categories fit',
      '🗓️ The month and year sit above the calendar in big handwriting instead of in small text next to Today',
      '🔽 Month / Week / Day / Agenda is a dropdown now too, so the calendar header stays uncluttered',
      '⬇️ The calendar dashboard moved below the grid, so the calendar is the first thing you see',
      '📈 Timeline is the sticky-note wall on screen: meeting dates from the calendar run left to right, with notes hanging under each one',
      '🎨 Timeline notes are colored by who\'s doing the work — Business pink, Technical blue, Project Managers yellow, a mix green',
      '🏷️ The Calendar section in the sidebar is called Season Progress now, holding Calendar and Timeline',
      '⏭️ Timeline hides days once they pass. Unfinished notes ride forward to the next meeting; anything you ticked off stays on the day it got done, under Show past',
      '✏️ Timeline notes can be rewritten or moved to another date, and you can edit or delete your own comments',
      '💬 On the Timeline: leads, mentors and coaches pin the notes, anyone with a role can comment, and everyone can read the whole wall',
      '🔼 The dashboard toggle is just an arrow now, at the top right of Competition This Week',
      '📏 The calendar\'s top bar is one slim row now — title, date arrows, both dropdowns and the dashboard toggle all on one line',
      '🎓 Notebook: pick which mentor helped you and write what they actually did, so the entry shows how much was yours',
      '🛟 If a page ever breaks, you now get a message and a Back to Home button instead of a blank white screen',
    ],
  },
  {
    id: 154,
    date: '2026-08-12',
    items: [
      '🎨 Sidebar icons rotate through the usual pink, blue, and yellow so neighbouring tabs are easier to tell apart',
      '🎓 Notebook entries now record whether a mentor helped or you did it on your own, and which mentor it was — judges ask about this',
      '🔭 Scouting moved in with the other unfinished tabs until it\'s ready — the scouting kiosk and Competition Day still open the form as usual',
      '📏 Tidied the sidebar divider lines — no more doubled line above Home, and Special Controls closes off like every other section',
    ],
  },
  {
    id: 153,
    date: '2026-08-12',
    items: [
      '📋 My Tasks shows your three most important tasks, most urgent first, with progress, due date, and a quiet red mark when something is overdue. Finished tasks drop off on their own',
      '🙋 Tasks now record who assigned them and can name a mentor to ask for help',
      '👥 Leads get a Task load button on Home: who has fewer than three tasks, what\'s overdue, and one tap to assign — open anyone to see all their tasks',
      '📤 Attendance has an Export button that downloads the full log as a spreadsheet',
      '🧹 Unfinished role pages moved out of everyone\'s sidebar; co-founders can reach them from the menu under Unfinished Tabs',
      '📓 Engineering Notebook is back as a sidebar tab',
    ],
  },
  {
    id: 152,
    date: '2026-08-12',
    items: [
      '💬 Chat is co-founders only across the board — the alliance hubs now enforce it too, not just the main channels',
    ],
  },
  {
    id: 151,
    date: '2026-08-11',
    items: [
      '💾 Profile fields like Discipline and Timezone now save the instant you pick them, and tell you if a save fails instead of pretending it worked',
    ],
  },
  {
    id: 150,
    date: '2026-08-11',
    items: [
      '💾 Profiles save themselves — changes are stored a moment after you stop typing, no Save button needed',
      '🐛 Fixed profile saves that reported success without actually saving anything',
    ],
  },
  {
    id: 149,
    date: '2026-08-11',
    items: [
      '🗺️ Org chart: guests no longer appear, and the Software group shows its own "Software Lead" line',
    ],
  },
  {
    id: 148,
    date: '2026-08-11',
    items: [
      '👩‍💻 New Programming Lead role — a full lead like the others (reviews requests, edits content, manages members) and oversees the software side: the Software dashboard and all the software tabs',
    ],
  },
  {
    id: 147,
    date: '2026-08-11',
    items: [
      '🔑 Fixed changing your password hanging and not saving — it was waiting on something that could stall forever. It saves immediately now, and says so if it fails',
    ],
  },
  {
    id: 146,
    date: '2026-08-11',
    items: [
      '⚡ Changing a temporary password is instant now — it used to hang, and could even bounce you back to the same screen if the save didn\'t go through. It now confirms the save and tells you if something went wrong',
    ],
  },
  {
    id: 145,
    date: '2026-08-11',
    items: [
      '🔐 Anyone signing in with a temporary password is now asked to choose their own right away, with a clear explanation — this applies to new accounts and to any password a lead resets',
    ],
  },
  {
    id: 144,
    date: '2026-08-11',
    items: [
      '🔢 RadMems no longer lists someone twice once they have an account — approved emails disappear from the list as soon as the person signs up, and the count matches what you see',
    ],
  },
  {
    id: 143,
    date: '2026-08-11',
    items: [
      '🧹 Removing a member now also takes their email off the signup whitelist, so a removal actually sticks instead of them being able to re-register',
      '🔧 Fixed the deletion order that caused the lost accounts — it deleted the profile before the login, so a failure left an invisible account that blocked re-signup. The login goes first now',
    ],
  },
  {
    id: 142,
    date: '2026-08-11',
    items: [
      '👤 Clicking an approved email\'s name opens a full profile page just like a member\'s, with the same Roles panel — assign roles there and they apply automatically when the person signs up',
    ],
  },
  {
    id: 141,
    date: '2026-08-11',
    items: [
      '🔑 Former members can get back in — their accounts were never actually deleted, only their profiles. Signing in now rebuilds the missing profile automatically (with any roles pre-assigned to their email), instead of bouncing them out',
    ],
  },
  {
    id: 140,
    date: '2026-08-11',
    items: [
      '👥 Approved emails and real members are now literally the same card — same avatar, name, key and trash, same role chips. Tap the name to assign roles; they apply the moment the person signs up',
    ],
  },
  {
    id: 139,
    date: '2026-08-11',
    items: [
      '🎭 Approved emails work like real members now — tap the name to assign roles, and those roles land on their account automatically the moment they sign up',
    ],
  },
  {
    id: 138,
    date: '2026-08-11',
    items: [
      '🧩 Approved emails now use the exact same card as members — avatar, name, key and trash buttons, and a chip underneath — so RadMems reads as one consistent list',
    ],
  },
  {
    id: 137,
    date: '2026-08-11',
    items: [
      '⚙️ Approved emails in RadMems can now be managed like members — pick the role they\'ll get when they sign up, remove them from the approved list, or hit Create login to make their account outright',
      'ℹ️ Passwords can only be set once someone has an account: use Create login to make one (they choose their own password at first sign-in), or they can self-register',
    ],
  },
  {
    id: 136,
    date: '2026-08-11',
    items: [
      '🔑 Each approved email in RadMems has a "Create login" button — it fills the Add Member form with their name and email, so a lead just picks a password and the person can sign in (they change it on first login)',
    ],
  },
  {
    id: 135,
    date: '2026-08-11',
    items: [
      '🙋 Approved emails in RadMems show the person\'s name instead of a raw address, sorted in with everyone else — the email sits underneath in small text',
    ],
  },
  {
    id: 134,
    date: '2026-08-11',
    items: [
      '🎙️ Past meetings moved off the dashboard — the Meetings section is just Start/Stop now, and the full history lives in Special Controls → Meeting Stats, where leads can delete a record',
    ],
  },
  {
    id: 133,
    date: '2026-08-11',
    items: [
      '🎙️ The end-of-meeting recap is back for everyone — it pops live if you\'re on the app, or the next time you open it, and still only once per person',
    ],
  },
  {
    id: 132,
    date: '2026-08-11',
    items: [
      '📧 RadMems is one list now — approved emails sit alongside real members, sorted by name, each marked "no account yet" until they sign up',
    ],
  },
  {
    id: 131,
    date: '2026-08-11',
    items: [
      '🛡️ Removing a member now refuses to go through unless the archive to Past Members saves first — the archive was silently failing, which is how past members were lost with no record',
      '📧 Added 12 teammates to the signup whitelist so they can create their accounts',
    ],
  },
  {
    id: 130,
    date: '2026-08-11',
    items: [
      '📋 Tap any task to read its full details — description, assignee, due date, priority, skills. Everyone can look; editing stays with leads',
      '➡️ Move tasks between To Do / In Progress / Done with buttons in that popup — no more fighting drag-and-drop on your phone (leads move any task, you can move your own)',
    ],
  },
  {
    id: 129,
    date: '2026-08-11',
    items: [
      '🎙️ Meeting recorder on the PM dashboard — Start Meeting snapshots the team\'s state, Stop diffs it: tasks made and completed, purchases, requests, notebook entries, blockers resolved, bugs fixed. All computed from what actually changed',
      '🎉 When a meeting ends, everyone gets a recap popup of what the team got done (X to dismiss)',
      '📊 Special Controls → Meeting Stats lists every recorded meeting with its numbers',
      '⚖️ Design Matrix is a tab for technical members now (also still in Special Controls)',
    ],
  },
  {
    id: 128,
    date: '2026-08-11',
    items: [
      '🧪 Testing is a real tab now for hardware and software members (moved out of Special Controls), replacing the two separate placeholder testing tabs',
    ],
  },
  {
    id: 127,
    date: '2026-08-11',
    items: [
      '📱 The calendar is readable on phones now — month view shows compact day cells with colored dots (tap a day to see its events), and week view stacks days vertically instead of squeezing seven columns onto your screen',
    ],
  },
  {
    id: 126,
    date: '2026-08-11',
    items: [
      '✏️ Edit and Delete on calendar events are proper buttons now instead of tiny links — open any event and they\'re at the bottom (leads only, as before)',
    ],
  },
  {
    id: 125,
    date: '2026-08-11',
    items: [
      '⏰ New meetings default to Saturday hours, 8 AM – 2 PM (other event types keep 4–8 PM). Still changeable per event',
    ],
  },
  {
    id: 124,
    date: '2026-08-11',
    items: [
      '🗓️ Removed the Repeats option from the event form — existing recurring events (like weekly meetings) keep working, but new events are one-time',
    ],
  },
  {
    id: 123,
    date: '2026-08-11',
    items: [
      '📬 Requests now go to the right people the moment they\'re submitted — expense requests ping Finance and the business leads, while meetings, boards, tasks, and role requests ping the leads. No more requests sitting unseen until someone opens the queue',
    ],
  },
  {
    id: 122,
    date: '2026-08-11',
    items: [
      '👍 The ? ideas panel in the bell is for everyone now — see what teammates have pitched and thumbs-up the ones you want built. Co-founders still handle the reviewing',
      '🔍 The Scouting page uses the standard under-construction screen, so it takes ideas too',
    ],
  },
  {
    id: 121,
    date: '2026-08-11',
    items: [
      '💡 Under-construction pages now take ideas — tell us what the page should do and it goes straight to the co-founders',
      '❓ Co-founders get a blue ? icon in the bell collecting all pitched ideas and suggestions, with a mark-reviewed action',
    ],
  },
  {
    id: 121,
    date: '2026-08-11',
    items: [
      '🎉 Getting a new role is a moment now — when a lead gives you a role, a full-screen "Congratulations, you\'re now a ___!" celebration pops up with confetti and the role\'s own emoji, and stays until you close it',
      '🔔 New notifications slide in as a clean white card on your screen — and the app now asks permission to send real device notifications so they can reach you even outside the tab',
      '📨 Changing a role from someone\'s profile page notifies them too now (not just from User Management), with friendlier wording like "You\'re now a Project Manager!"',
      '💛 Leads can switch the Daily Team Pulse on or off for the whole team right from Special Controls',
      '🍔 Fixed the menu button covering page titles and Back buttons on several screens (Calendar, RadRank, Profile, Settings, Alliance Hubs, and the main board)',
    ],
  },
  {
    id: 120,
    date: '2026-08-11',
    items: [
      '🚧 Under-construction tabs are now boxed together in the sidebar under an "In the works" label, so it\'s obvious at a glance which parts of your role area are live and which are coming',
    ],
  },
  {
    id: 119,
    date: '2026-08-11',
    items: [
      '🗂️ Nav filter at the top of the sidebar — Role shows just your role\'s tabs, Gen shows the general app, All shows everything. It remembers your pick',
    ],
  },
  {
    id: 118,
    date: '2026-08-11',
    items: [
      '➕ The always-there "type here, press Enter" boxes on dashboards are now small "+ Add" buttons that open an input when tapped — report a bug, add a task, flag a blocked item, or queue an announcement without the boards feeling busy',
    ],
  },
  {
    id: 117,
    date: '2026-08-11',
    items: [
      '📊 Collapsed dashboard rows now show their key numbers right in the row — "2/4 ready · 1 blocked", "$450 balance · 3 upcoming", "4 events · 120 reached" — so leads see everything at a glance and only expand to work',
    ],
  },
  {
    id: 116,
    date: '2026-08-11',
    items: [
      '🧘 Lead dashboards are calm now — each board is a collapsible section. Boards for roles you hold start open; division-oversight boards start as one quiet row, and your open/closed choices are remembered',
      '📣 Announcements live in the bell too — an orange megaphone next to the requests icon, with a badge for anything posted in the last 3 days',
    ],
  },
  {
    id: 115,
    date: '2026-08-11',
    items: [
      '👑 Leads now see their whole division — a Business Lead gets every business tab and dashboard (Outreach, Finance, Communications), a Technical Lead gets all of hardware and software, and Co-Founders / Project Managers / Mentors / Coaches get both sides. Leads keep Special Controls',
    ],
  },
  {
    id: 114,
    date: '2026-08-11',
    items: [
      '🔢 FTC teams are a dropdown now too — scouting day setup picks from the same team list RadRank manages, and typing a brand-new number adds it to that list for everyone',
    ],
  },
  {
    id: 113,
    date: '2026-08-10',
    items: [
      '🧹 Removing a member now clears their traces everywhere — attendance records, cleanup duties, notifications, and push subscriptions go with them, and their open tasks flip to Up for Grabs instead of keeping a ghost name',
      '👥 Assigning people is a roster dropdown now, not a typed name — task assignee and the scouting day group/role pickers all choose from actual members',
    ],
  },
  {
    id: 112,
    date: '2026-08-10',
    items: [
      '💻 Software dashboard for Programming — derived status (Stable / Testing / Needs Fixes), Autonomous and TeleOp readiness chips, per-system statuses (drivetrain controls, intake controls, autonomous pathing, sensors…), a Known Bugs list, and programming tasks. Mirrors the hardware Robot Status board',
      '🧑‍💻 Five software-only tabs on the way: Software Design, Programming, Robot I/O, Code Testing, Bug Tracker (under construction)',
    ],
  },
  {
    id: 111,
    date: '2026-08-10',
    items: [
      '🤖 Robot Status — one shared dashboard for all of hardware: a headline status derived from your subsystems, current build priority, blocked items anyone can flag and resolve, next deadline with countdown, and click-to-advance subsystem statuses (Drivetrain, Intake, Climber, Electronics…)',
      '🔧 Five hardware-only tabs on the way: Design, Fabrication, Assembly, Electrical, Testing (under construction)',
    ],
  },
  {
    id: 110,
    date: '2026-08-10',
    items: [
      '📑 Four new Communications-only tabs: Announcements, Content Studio, Website, and Marketing (under construction)',
    ],
  },
  {
    id: 109,
    date: '2026-08-10',
    items: [
      '📣 Communications dashboard — Still To Communicate queue, Events To Promote (pulled straight from the team calendar, check off as promoted), Drafts For Approval (leads approve or deny, then mark Sent), and a Recently Published log',
    ],
  },
  {
    id: 108,
    date: '2026-08-10',
    items: [
      '💰 The season budget starts as "not set" instead of a made-up number — the Business Lead (or a co-founder) enters it on the Finance dashboard, and the Budget Remaining meter appears once it\'s real',
    ],
  },
  {
    id: 107,
    date: '2026-08-10',
    items: [
      '🧾 Expense Requests — anyone can ask before buying (item, cost, reason, optional link). Finance and leads approve, deny, or mark "needs discussion", from the new tab or straight from the requests panel in the bell',
      '📑 Three new Finance-only tabs: Budget Tracker, Fundraising, and Financial History (under construction)',
      '💸 Finance can schedule financial deadlines on the calendar — a new Finance Deadline category with quick-picks like "Registration payment due" and "Budget review"',
      '⭐ My Calendar now includes events that belong to your role and events you created',
    ],
  },
  {
    id: 106,
    date: '2026-08-10',
    items: [
      '💵 Finance dashboard — Current Balance, Raised This Season, Spent This Season, and a Budget Remaining meter, all computed from a real ledger: record money in or out with a date and description, and the numbers do their own math',
      '📅 Plus Upcoming Expenses (with amounts and due dates) and a Recent Activity feed. Leads can correct a mistaken entry; the tiles themselves can\'t be typed over',
    ],
  },
  {
    id: 105,
    date: '2026-08-10',
    items: [
      '💾 Fixed "Failed to save role" when changing roles from someone\'s profile page — the app was sending an expired login token with the save. It now falls back to a method that works',
    ],
  },
  {
    id: 104,
    date: '2026-08-10',
    items: [
      '✅ Role changes now just work — a frozen duplicate tab could silently jam the app\'s session checks, freezing your roles no matter what. Role updates now use a direct read that nothing can jam, and apply within ~5 seconds',
      '🧹 Removed the temporary Role Sync box from Settings',
    ],
  },
  {
    id: 103,
    date: '2026-08-10',
    items: [
      '🩺 Settings → Role Sync shows your current roles, whether the app can read your profile, and a "Refresh my roles" button — so a stuck role can be spotted instead of guessed at',
      '⚡ Role changes are now checked every 5 seconds instead of 15',
    ],
  },
  {
    id: 102,
    date: '2026-08-10',
    items: [
      '🔓 Stopped the app logging you out for no reason — a missing bit of session bookkeeping was treated as an expired login, so some people got kicked out on every visit. Sessions last 30 days as intended',
      '♻️ You no longer need to sign out and back in for a role change to take effect — it applies on its own within about 15 seconds',
    ],
  },
  {
    id: 101,
    date: '2026-08-10',
    items: [
      '🛠️ Role changes now show up reliably — the app had one way of reading your profile that could fail silently, leaving your roles stuck at whatever they were last time. It now falls back to the same method the rest of the app uses',
    ],
  },
  {
    id: 100,
    date: '2026-08-10',
    items: [
      '🔒 Fixed roles sticking around after they were removed — if the app couldn\'t read your profile it quietly fell back on a saved copy from your last visit, so old access could hang on. It now waits for the real answer instead',
    ],
  },
  {
    id: 99,
    date: '2026-08-10',
    items: [
      '🔄 Removing someone\'s role now takes effect on their screen right away — their dashboard and role-only tabs disappear instead of hanging around until they sign in again',
      '📱 Fixed the notification panel being stuck at the top of the screen on mobile',
    ],
  },
  {
    id: 98,
    date: '2026-08-10',
    items: [
      '✨ The full What\'s New history is readable again — "See all past updates" in the popup, or Settings → What\'s New any time. Nothing was ever deleted; the popup just only showed what was new since you last dismissed it',
    ],
  },
  {
    id: 97,
    date: '2026-08-10',
    items: [
      '🗑️ Dashboard trackers can no longer be deleted — they\'re shared team data and one stray click wiped them for everyone',
      '🔄 Losing a role now clears its dashboard properly; your profile is re-checked whenever you come back to the tab, so role changes don\'t sit stale',
    ],
  },
  {
    id: 96,
    date: '2026-08-10',
    items: [
      '📥 Requests moved into the notification bell — the outlined inbox icon next to "Notifications" swaps the panel to your requests, and leads can approve or deny right there. The Requests tab is gone from the sidebar',
    ],
  },
  {
    id: 95,
    date: '2026-08-10',
    items: [
      '🎪 Outreach role dashboard — Events This Season, People Reached, Outreach Hours, and Organizations Worked With, live on your Home page and editable in place',
      '📊 Dashboards now lay out by kind: plain numbers become a compact stat row, progress bars become meters, and only checklists and notes get full cards',
    ],
  },
  {
    id: 94,
    date: '2026-08-10',
    items: [
      '🗓️ Home reordered — the week calendar sits at the top, your dashboard sits under it in its own card, then the assigned-objective page and sticky notes',
      '🏆 New First Meet sticky note counting down to October 19',
      '📏 The assigned-objective page now stretches to line up with the sticky notes beside it, ruled lines and all',
    ],
  },
  {
    id: 93,
    date: '2026-08-10',
    items: [
      '⏱️ Season kickoff countdown is clearer — it read as two separate day counts; now it says "26 days + 14h 27m 26s"',
    ],
  },
  {
    id: 92,
    date: '2026-08-10',
    items: [
      '📓 Engineering Notebook is no longer a sidebar tab — open it with the button on the Home photo gallery instead, so everyone gets to it the same way',
      '📋 Tasks dropdown replaced by a single Workshops item',
    ],
  },
  {
    id: 91,
    date: '2026-08-10',
    items: [
      '📣 Outreach can add events to the calendar directly instead of filing a request for approval — events are tagged with the role that created them',
      '🚧 Two new Outreach-only tabs, Log Reach and Portfolio, under construction for now',
    ],
  },
  {
    id: 90,
    date: '2026-08-10',
    items: [
      '💬 Chat is limited to co-founders for the moment',
      '🎮 Special Controls is hidden from Outreach',
    ],
  },
  {
    id: 89,
    date: '2026-08-10',
    items: [
      '👤 Profiles slimmed down — work summary, current work, ownership, skills and tools, safety and permissions, and communication preferences are gone. Anything you already filled in is kept',
    ],
  },
  {
    id: 88,
    date: '2026-05-16',
    items: [
      '💛 Daily Team Pulse — a quick 15-second check-in once a day on mood, focus, and what\'s frustrating. Responses are anonymous. Leaders can see trends under Special Controls → Team Pulse. Turn it off any time in Settings',
    ],
  },
  {
    id: 87,
    date: '2026-05-16',
    items: [
      '📆 Recurring meetings can now be edited per-occurrence — change the room, description, or time for a single date without touching the rest of the series; same for deleting just one date',
    ],
  },
  {
    id: 86,
    date: '2026-05-16',
    items: [
      '⏰ New events default to 4 PM – 8 PM (still changeable, or clear them for an all-day event)',
    ],
  },
  {
    id: 85,
    date: '2026-05-16',
    items: [
      '🔔 Reminders now also notify the person who created the event — previously they were silently excluded',
    ],
  },
  {
    id: 84,
    date: '2026-05-16',
    items: [
      '🔔 Push notifications actually deliver now! Found the VAPID key pair was mismatched; rolled fresh keys and added a one-time auto-migration so all devices self-repair their stale subscriptions on next open',
    ],
  },
  {
    id: 83,
    date: '2026-05-16',
    items: [
      '🔍 Test Notification button is now a diagnostic — shows device state, DB subscription counts, and the raw edge-function response so we can see exactly why a push fails to deliver',
    ],
  },
  {
    id: 82,
    date: '2026-05-08',
    items: [
      '📱 Native iOS app foundations — plumbing for real APNs notifications via TestFlight (one-time Apple-portal setup required, see IOS_APP_SETUP.md)',
      '🪟 Notification bell on mobile now opens as a centered modal with blurred background instead of a cut-off corner dropdown',
    ],
  },
  {
    id: 81,
    date: '2026-05-08',
    items: [
      '🧪 Test Notification button on the calendar (bottom-right) sends a notification to yourself for verifying push setup',
    ],
  },
  {
    id: 80,
    date: '2026-05-08',
    items: [
      '🔔 Calendar events now send automatic reminder notifications — defaults to 1 hour before timed events / 8 AM on the day for all-day events; leads can change the time, write a custom message, or turn it off per event',
    ],
  },
  {
    id: 79,
    date: '2026-05-08',
    items: [
      '✏️ Leads can now edit calendar events — open an event and click the new Edit button',
    ],
  },
  {
    id: 78,
    date: '2026-05-08',
    items: [
      '⚡ Calendar paints instantly from cache while fresh data loads in the background',
      '🐛 Fixed missing calendar events — the supabase JS client was hanging on the load query; now uses raw REST',
    ],
  },
  {
    id: 77,
    date: '2026-05-08',
    items: [
      '🐛 Fixed calendar events disappearing right after creation — realtime listener was racing the optimistic insert',
    ],
  },
  {
    id: 76,
    date: '2026-05-08',
    items: [
      '↩️ Calendar filter pills moved back to their own row below the title',
    ],
  },
  {
    id: 75,
    date: '2026-05-08',
    items: [
      '🗜️ Calendar header collapsed to a single row — filter pills sit next to the month label',
      '✅ Calendar create modal closes immediately on submit; failures now show the actual database error',
    ],
  },
  {
    id: 74,
    date: '2026-05-08',
    items: [
      '📅 Calendar header tightened — title shortened to "Calendar", nav + filters fit in 2 rows',
      '🎨 Filter buttons (All / Team / Business / etc.) now have emojis and use the app gradient when active',
    ],
  },
  {
    id: 73,
    date: '2026-05-08',
    items: [
      '📅 New Robotics Operations Calendar — 6 categories (meetings, competitions, outreach, workshops, birthdays, fundraising) with their own colors',
      '🗂️ Month / Week / Day / Agenda views with a quick view switcher',
      '🎯 Department filters: All · Team · Business · Programming · Technical · My Calendar',
      '📊 Toggleable dashboard with Upcoming, Due Soon, Birthdays, and Next Competition',
      '🔁 Recurring events — daily / weekly / monthly / yearly',
      '🚨 Priority badges (Critical / Important / Normal) shown without overriding category color',
      '🎂 Birthday reactions — send 🎉 🎂 🥳 🤖 💚 to teammates',
      '📋 Tasks with due dates appear automatically; clicking jumps to the board and opens the task',
    ],
  },
  {
    id: 72,
    date: '2026-03-09',
    items: [
      '🔧 Fixed chat crashes caused by unhandled errors and aggressive polling',
    ],
  },
  {
    id: 71,
    date: '2026-03-08',
    items: [
      '🏁 Comp Day session editor redesigned with 6 tabs: Roles, Schedule, Matches, Rotation, Tasks, and Team Status',
    ],
  },
  {
    id: 70,
    date: '2026-03-08',
    items: [
      'Homepage shows your upcoming comp day role assignments at a glance',
    ],
  },
  {
    id: 69,
    date: '2026-03-08',
    items: [
      'Role-specific tools — Pit Crew gets a checklist + issues log, Bag Watch gets a shift timer, Break gets a countdown timer, Spirit gets cheer reminders, Safety Monitor gets a safety checklist',
    ],
  },
  {
    id: 68,
    date: '2026-03-08',
    items: [
      'New comp day roles: Strategy Lead 🧠 (scouting data + chat) and Safety Monitor 🦺 (safety checklist)',
    ],
  },
  {
    id: 67,
    date: '2026-03-08',
    items: [
      'Scouting Accountability grid — names × match blocks with ✅/❌, visible in Data tab anytime',
    ],
  },
  {
    id: 66,
    date: '2026-03-08',
    items: [
      'Comp Day screen lock — all 8 roles now lock screens to role-specific tabs when live',
    ],
  },
  {
    id: 65,
    date: '2026-03-08',
    items: [
      'Comp Day mode — leads assign roles (Scouting, Pit Crew, Drive Team, Spirit, Bag Watch, Break) per match block, members see their role front and center',
    ],
  },
  {
    id: 64,
    date: '2026-03-08',
    items: [
      'Navigation filter buttons (🏠 General, 🔧 Technical, 💼 Business) — Business hides Scouting tabs',
    ],
  },
  {
    id: 63,
    date: '2026-03-08',
    items: [
      'New Settings page — notifications, music, sound effects, password, and skip loading screen moved here from Profile',
    ],
  },
  {
    id: 62,
    date: '2026-03-08',
    items: [
      '📋 Tasks is now a dropdown with Scrum and Workshops sub-items',
    ],
  },
  {
    id: 61,
    date: '2026-03-08',
    items: [
      '💡 Suggestions moved from sidebar tab to the three-dots menu for cleaner navigation',
    ],
  },
  {
    id: 60,
    date: '2026-03-08',
    items: [
      'Notifications when teammates complete tasks (scoped: members see member completions only)',
    ],
  },
  {
    id: 59,
    date: '2026-03-08',
    items: [
      'Mini week calendar on the home page showing this week at a glance',
      'Calendar day cells now cap at 3 items with a +N more indicator',
      'Task priority colors and My Tasks section in calendar day details',
    ],
  },
  {
    id: 58,
    date: '2026-03-07',
    items: [
      '📐 New Design Matrix tool — compare design options with scores, images, and pick a winner (Special Controls → Technical)',
    ],
  },
  {
    id: 56,
    date: '2026-03-07',
    items: [
      '🗂️ Special Controls organized into categories: Main, Fun, Business, Technical, Modes, and Co-Founders',
    ],
  },
  {
    id: 55,
    date: '2026-03-07',
    items: [
      'Tasks now have a priority level (Low, Medium, High, Critical) — higher priority tasks sort to the top and get a colored side stripe',
    ],
  },
  {
    id: 54,
    date: '2026-03-07',
    items: [
      'Co-founders can now view team survey responses in Special Controls',
    ],
  },
  {
    id: 53,
    date: '2026-03-07',
    items: [
      'Added Team Login button to the welcome screen for easy team access',
    ],
  },
  {
    id: 52,
    date: '2026-03-07',
    items: [
      'Team accounts now have a Data tab with Scouting Data — each team only sees their own submissions',
    ],
  },
  {
    id: 51,
    date: '2026-03-07',
    items: [
      'Scouting Form is now available for team accounts (form only, no schedule)',
    ],
  },
  {
    id: 50,
    date: '2026-03-07',
    items: [
      'Fixed role changes not taking effect until page reload — roles now update instantly when a lead assigns them',
      'Fixed user management updates silently failing without feedback',
      'Suggestions: reviewers (leads/co-founders) can now also submit suggestions with ChatGPT prompt helper',
      'Suggestions: status now shows as clear labels (Pending/Approved/Denied) instead of tiny dots',
    ],
  },
  {
    id: 49,
    date: '2026-03-07',
    items: [
      '🖼 Workshop Gallery — share photos of what you made from workshops',
      '🗑 Leads can now delete any workshop from the library',
      '✅ "Done" button on live & video workshops in full-screen viewer',
      '📷 Add photos to each step in guided workshops',
    ],
  },
  {
    id: 48,
    date: '2026-03-07',
    items: [
      '🔧 Fixed suggestions not saving/persisting after refresh',
      '🔓 Everyone can now submit suggestions (including guests)',
    ],
  },
  {
    id: 47,
    date: '2026-03-07',
    items: [
      '💡 Suggestions page now includes a ChatGPT prompt helper to turn complex ideas into clear feature requests',
    ],
  },
  {
    id: 46,
    date: '2026-03-07',
    items: [
      '📊 Export scouting data to CSV — open in Google Sheets',
    ],
  },
  {
    id: 45,
    date: '2026-03-07',
    items: [
      '🎓 Workshops — create workshops (Live, Video, or Step-by-Step), submit for approval, and browse the Workshop Library',
      '📋 Workshop review system for leads: approve, request revisions, or deny submissions',
    ],
  },
  {
    id: 44,
    date: '2026-03-06',
    items: [
      '📸 Season Highlights — upload, view, and delete photos right from the home screen',
    ],
  },
  {
    id: 43,
    date: '2026-03-06',
    items: [
      '🏠 New off-season home screen with season photo placeholder and workshop requests',
    ],
  },
  {
    id: 42,
    date: '2026-03-06',
    items: [
      '👥 Team accounts no longer appear under Members in the Org Chart',
    ],
  },
  {
    id: 41,
    date: '2026-03-06',
    items: [
      '🤝 Alliance Hubs — create chat rooms between two teams, no duplicates allowed, and you can delete them',
    ],
  },
  {
    id: 40,
    date: '2026-03-06',
    items: [
      '📖 Team accounts now have AI Manual and Suggestions in their sidebar',
    ],
  },
  {
    id: 39,
    date: '2026-03-06',
    items: [
      '📝 Task assignee is now a text input instead of a dropdown',
    ],
  },
  {
    id: 38,
    date: '2026-03-06',
    items: [
      '📐 Added divider line between AI Manual and Boards in sidebar',
      '🔤 Fixed Boards tab appearing bold in sidebar',
    ],
  },
  {
    id: 37,
    date: '2026-03-06',
    items: [
      '⚡ Removed 5-second countdown from loading screen — tap to start goes straight in',
    ],
  },
  {
    id: 36,
    date: '2026-03-04',
    items: [
      '🏟️ Adding teams now requires selecting a league from a dropdown',
    ],
  },
  {
    id: 35,
    date: '2026-03-04',
    items: [
      '🔒 Team accounts no longer flash Radical tabs/goals on refresh',
      '🚫 Team accounts skip the loading screen entirely',
    ],
  },
  {
    id: 34,
    date: '2026-03-04',
    items: [
      '📋 Team sidebar now uses the same Boards tab as members (Chat + Boards only)',
      '🔧 Moved team Logout into the three-dots menu',
    ],
  },
  {
    id: 33,
    date: '2026-03-04',
    items: [
      '🔒 Fixed team accounts seeing Radical tabs/loading screen on refresh',
      '💬 Fixed team chat messages incorrectly showing as Radical',
      '📋 Fixed Radical members seeing other teams\' tasks',
    ],
  },
  {
    id: 32,
    date: '2026-03-04',
    items: [
      '📋 Team accounts now have a collapsible Boards dropdown matching the member sidebar style',
    ],
  },
  {
    id: 31,
    date: '2026-03-03',
    items: [
      '💬 Chat is back! Quick Chat restored for all members and team accounts',
      '📢 Channel selector — switch between All, Alliances, and Leagues channels',
    ],
  },
  {
    id: 30,
    date: '2026-03-02',
    items: [
      '🤝 Team accounts — add external FRC teams with number, name, and password from User Management',
      '🔑 Team login — teams sign in with just their team number and password',
      '📋 Separate team boards — each team gets their own private boards',
    ],
  },
  {
    id: 29,
    date: '2026-03-02',
    items: [
      '📱 Added native app support — coming soon to the App Store and Google Play!',
    ],
  },
  {
    id: 28,
    date: '2026-02-22',
    items: [
      '🔒 Role changes now take effect immediately — no refresh needed',
    ],
  },
  {
    id: 27,
    date: '2026-02-22',
    items: [
      '🧑‍🏫 Added coach quote about AI on the Radical Rundown page',
    ],
  },
  {
    id: 26,
    date: '2026-02-21',
    items: [
      '🔄 Spinning logo on the loading screen with transparent background',
      '🤘 Random radical loading messages — "Getting Radical...", "Revving the robots...", and more!',
    ],
  },
  {
    id: 24,
    date: '2026-02-21',
    items: [
      '🏁 Added Comp Day tab in Special Controls (leads/mentors only) — coming soon',
    ],
  },
  {
    id: 23,
    date: '2026-02-21',
    items: [
      '🔊 Sound effects on Add Task, Add Board, and Notebook entry submit — toggle on/off in Profile settings',
      '🔄 Spinning logo on loading screen',
    ],
  },
  {
    id: 22,
    date: '2026-02-21',
    items: [
      '🏆 WE\'RE GOING TO STATE! Confetti celebration + banner added — good luck team!',
    ],
  },
  {
    id: 21,
    date: '2026-02-21',
    items: [
      '⚡ Fixed account creation being slow/failing — now shows actual error messages instead of generic "non-2xx" error',
    ],
  },
  {
    id: 20,
    date: '2026-02-21',
    items: [
      '📝 Task descriptions are now required when creating or editing tasks',
    ],
  },
  {
    id: 19,
    date: '2026-02-21',
    items: [
      '🔧 Fixed whitelist & account creation not working due to auth token issue',
    ],
  },
  {
    id: 18,
    date: '2026-02-21',
    items: [
      '👑 Harshita (Team Lead) now appears first in Meet Our Leaders section',
    ],
  },
  {
    id: 17,
    date: '2026-02-21',
    items: [
      '🔀 Tasks page now has an All / Mine toggle to quickly see only your assigned tasks',
    ],
  },
  {
    id: 16,
    date: '2026-02-20',
    items: [
      '📱 Leader & Founder cards now show full photos on mobile with overlapping glassmorphism bio cards',
      '🎨 Fixed blue tint on Kayden\'s photo with color correction filter',
    ],
  },
  {
    id: 15,
    date: '2026-02-20',
    items: [
      '🧠 Radical Rundown now includes "The Founders" section — Kayden and Yukti bios with photo spots',
    ],
  },
  {
    id: 14,
    date: '2026-02-20',
    items: [
      '👥 Radical Rundown now features "Meet Our Leaders" — bios for Team Lead, Business Lead, and Technical Lead with photo spots',
    ],
  },
  {
    id: 13,
    date: '2026-02-20',
    items: [
      '🎵 New "Theme Song" added to the music playlist — AI-generated team anthem',
      '🎧 Radical Rundown now has a "Listen to our theme song" player for visitors',
    ],
  },
  {
    id: 12,
    date: '2026-02-20',
    items: [
      '📷 Upload a profile photo from your phone — shows on your profile, Org Chart cards, and modals',
    ],
  },
  {
    id: 11,
    date: '2026-02-20',
    items: [
      '📖 "The Radical Rundown" now shows a full About page for Team 7196 and Everything That\'s Scrum',
    ],
  },
  {
    id: 10,
    date: '2026-02-20',
    items: [
      '🏗️ Org Chart redesigned with proper tiers: Co-Founders → Coaches & Mentors → Team Lead → Business/Technical Leads → Members',
    ],
  },
  {
    id: 9,
    date: '2026-02-20',
    items: [
      '🔗 Org Chart "View Full Profile" button now opens a dedicated profile page for any team member',
    ],
  },
  {
    id: 8,
    date: '2026-02-20',
    items: [
      '👤 Org Chart now shows full profiles — status, skills, tools, systems, and more',
    ],
  },
  {
    id: 7,
    date: '2026-02-20',
    items: [
      '🚀 New welcome screen with "Get Radical" sign-in and "The Radical Rundown" for scouts & visitors',
    ],
  },
  {
    id: 6,
    date: '2026-02-20',
    items: [
      '🔢 Scouting counters now have a text box — type any number directly, or use -/+ buttons',
    ],
  },
  {
    id: 5,
    date: '2026-02-20',
    items: [
      '🛡️ Removed "Make Admin" button from User Management',
    ],
  },
  {
    id: 4,
    date: '2026-02-20',
    items: [
      '👁️ Password fields now have a show/hide toggle so you can see what you type',
    ],
  },
  {
    id: 3,
    date: '2026-02-19',
    items: [
      '📸 Notebook entries now support photo uploads directly from your device',
    ],
  },
  {
    id: 2,
    date: '2026-02-18',
    items: [
      '✅ Scouting is now fully functional — go scout some teams!',
      '🔭 Considered teams are now dynamic — add, remove, and re-rank from the Data tab',
      '⚠️ Error alerts when adding a considered team fails',
    ],
  },
  {
    id: 1,
    date: '2026-02-18',
    items: [
      '💡 Leads can now submit workshop ideas (not just review them)',
      '📋 Suggestions & Requests now show Pending / Approved / Denied sections',
      '🗑️ Workshop ideas can be deleted with confirmation',
    ],
  },
]

const LATEST_ID = CHANGELOG[0].id

// The full history, openable from Settings. The popup below only ever shows
// what's new since you last dismissed it, so this is the way to read the rest.
export function ChangelogModal({ onClose }) {
  return <ChangelogCard entries={CHANGELOG} onClose={onClose} showingAll />
}

function ChangelogCard({ entries, onClose, showAll, showingAll }) {
  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-[100]" onClick={onClose} />
      <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm pointer-events-auto animate-bounce-in overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 flex items-center gap-2 bg-pastel-orange/30">
            <Sparkles size={20} className="text-pastel-orange-dark" />
            <span className="text-sm font-semibold text-gray-700">
              {showingAll ? 'What\'s New — all updates' : "What's New"}
            </span>
            <button onClick={onClose} className="p-1 rounded hover:bg-white/50 transition-colors ml-auto">
              <X size={16} className="text-gray-500" />
            </button>
          </div>

          <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
            {entries.map(entry => (
              <div key={entry.id}>
                <p className="text-xs text-gray-400 font-medium mb-1.5">{entry.date}</p>
                <ul className="space-y-1.5">
                  {entry.items.map((item, i) => (
                    <li key={i} className="text-sm text-gray-700">{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="px-5 pb-5 space-y-2">
            {showAll && (
              <button
                onClick={showAll}
                className="w-full py-2 rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-100 transition-colors"
              >
                See all past updates
              </button>
            )}
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl font-semibold text-gray-700 bg-pastel-orange hover:bg-pastel-orange-dark transition-colors"
            >
              {showingAll ? 'Close' : 'Got it!'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

function ChangelogPopup() {
  const { user } = useUser()
  const [dismissed, setDismissed] = useState(false)
  const [seeAll, setSeeAll] = useState(false)

  if (!user?.id || dismissed) return null

  const key = `changelog-last-seen-${user.id}`
  const lastSeen = parseInt(localStorage.getItem(key) || '0', 10)
  if (LATEST_ID <= lastSeen) return null

  const dismiss = () => {
    localStorage.setItem(key, String(LATEST_ID))
    setDismissed(true)
  }

  return (
    <ChangelogCard
      entries={seeAll ? CHANGELOG : CHANGELOG.filter(e => e.id > lastSeen)}
      onClose={dismiss}
      showAll={seeAll ? null : () => setSeeAll(true)}
      showingAll={seeAll}
    />
  )
}

export default ChangelogPopup
