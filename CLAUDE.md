# Project-Tracker (Everything That's Scrum)

- **The app is in `project-tracker/`.** That folder is what deploys (`.github/workflows/deploy.yml`
  on every push to `main`). The top-level `src/` and `supabase/*.sql` are older copies; read
  them for history, but change `project-tracker/`.
- Supabase SQL is run by hand in the Supabase SQL editor; edge functions are in
  `project-tracker/supabase/functions/`.

## Attendance from badge scans

Badges are scanned on a separate site, **PV Robotics Badge Attendance**
(https://attendance.firstpvrobotics.com, code at
https://github.com/Pleasant-Valley-Robotics/badge-scan). When asked to connect, sync or
import badge-scan or attendance data, **read `project-tracker/BADGE-ATTENDANCE.md` first**.
It says what is ready on the other side, what exists here already, and which decisions to
check with a mentor before building.
