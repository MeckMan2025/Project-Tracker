-- One attendance session per day, enforced by the database.
--
-- The app checks twice before starting a session — against what it has loaded,
-- then against the server — but two leads tapping at the same moment can both
-- pass those checks and both insert. Only a unique index actually stops that;
-- the app already handles the 409 it produces by opening the existing session
-- instead.
--
-- Run STEP 1 first. If it returns any rows, those days already have duplicates
-- and STEP 2 will fail until they're merged — send me what it returns and I'll
-- work out which to keep.

-- ── STEP 1: are there already duplicates? ───────────────────────────────────
select session_date, count(*) as sessions
from attendance_sessions
group by session_date
having count(*) > 1
order by session_date;

-- ── STEP 2: only if STEP 1 returned nothing ─────────────────────────────────
create unique index if not exists attendance_sessions_one_per_day
  on attendance_sessions (session_date);
