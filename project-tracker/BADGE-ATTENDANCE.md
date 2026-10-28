# Badge scans → Project-Tracker attendance

Teammates scan their badges at a kiosk on **PV Robotics Badge Attendance**
(https://attendance.firstpvrobotics.com). The scans live in that site's own database. This
file is for whoever connects them to Project-Tracker's attendance, most likely with Claude.

## Status (2026-10-27)

- **The badge-scan side is finished and live** (v0.3.1). It offers a read-only key and an
  endpoint that returns every scan after the last one you saw. Don't change that project
  from here; if it needs something new, ask a mentor.
- **The Project-Tracker side is not built.** That's this job.
- Draft PR #4 (`badge-scan-moves-to-robotics-server`) removes the old in-app scanner
  (`BadgeKiosk.jsx`, `BadgeAssign.jsx`, `BadgeScanInput.jsx`, `lib/badgeScan.js`,
  `lib/badgeCode.js`) and links to the new site instead. Ask a mentor whether to merge it
  first. The sync doesn't depend on it, but don't build on those files.

## Read these first

1. **The guide to the other side.** It explains the key, the endpoints, what every field
   means and which scans count as attendance:
   https://github.com/Pleasant-Valley-Robotics/badge-scan/blob/main/docs/project-tracker.md
   (raw text: https://raw.githubusercontent.com/Pleasant-Valley-Robotics/badge-scan/main/docs/project-tracker.md)
2. **Sample answers** to build and test against before real scans exist:
   - https://raw.githubusercontent.com/Pleasant-Valley-Robotics/badge-scan/main/docs/samples/scans-since.json
   - https://raw.githubusercontent.com/Pleasant-Valley-Robotics/badge-scan/main/docs/samples/badges.json
   - https://raw.githubusercontent.com/Pleasant-Valley-Robotics/badge-scan/main/docs/samples/me.json

## How it fits together

```
kiosk scan ──▶ badge-scan database
                    ▲
                    │  GET /api/scans/since?after=<cursor>
                    │  Authorization: Bearer <BADGE_SCAN_KEY>
                    │
      Supabase edge function, on a schedule (server side only)
                    │
                    ▼
      attendance_records.badge_scan  (same "Tu10/27/2026|17:05" stamp format)
```

## What Project-Tracker already has

| Where | What |
|---|---|
| `supabase/badge_scanner.sql` | added `profiles.badge_id` (unique per badge + team) and `attendance_records.badge_scan` |
| `supabase/one_attendance_session_per_day.sql` | one attendance session per day (a unique index) |
| `project-tracker/src/lib/attendanceSession.js`, `attendanceRoster.js` | how sessions and records are made and read |
| `project-tracker/src/components/AttendanceManager.jsx` | already shows 🪪 and the `badge_scan` stamp on a record |
| `project-tracker/supabase/functions/process-scheduled/` | an existing edge function run on a schedule: a good pattern to copy |
| `project-tracker/EN_HELPER.md` | how functions here get deployed |

Check the live Supabase tables before relying on any of this: the SQL files show what was
meant to be run, not proof that it was.

## The key: rules

- A **mentor** makes the key on the attendance site (**Accounts → Data keys**, label
  `Project-Tracker`). It's shown once.
- It goes **straight into a Supabase secret**, typed by a person:
  `supabase secrets set BADGE_SCAN_KEY=…`. Claude should never ask for it in chat.
- Never put it in browser code, a `VITE_` variable, `.env.example`, a SQL file or git. Only
  an edge function reads it (`Deno.env.get("BADGE_SCAN_KEY")`).
- Check it with `GET https://attendance.firstpvrobotics.com/api/me` → `{"kind":"program",…}`.

## Decide with a mentor before building

1. **Teams.** Badge-scan says Radical is team `7196`; Project-Tracker stores Radical as
   `team_number = NULL`, and the sister team Beyond the Mean is `38350` in both
   (`supabase/sister_team.sql`). Mentors, coaches and
   advisors have `team: null` with a `role` there. Write down the mapping.
2. **Who is who.** Match a scan by badge number + team to `profiles.badge_id`, or copy badges
   in from `GET /api/badges` first? Badges are now handed out on the attendance site, so
   `profiles.badge_id` may be out of date.
3. **No session that day.** If a scan arrives for a day with no attendance session, does the
   sync create one, or wait?
4. **Already marked present by hand.** Leave the record as it is and only fill in
   `badge_scan`?
5. **Scans nobody matches.** Where are they shown so a mentor can fix the badge?

## A sensible order

1. SQL for a tiny state table (the last `next` cursor, and unmatched scans), run in the SQL
   editor like the other files.
2. An edge function (e.g. `badge-sync`) that pages through `/api/scans/since`, uses only
   scans with `recognised` and `firstOfDay` both true, and upserts so running twice is
   harmless. Test it on the sample JSON first.
3. Run it on a schedule (every few minutes is plenty) and/or behind a mentor's "Sync now"
   button.
4. Show the last sync time and any unmatched scans in the attendance screens.
