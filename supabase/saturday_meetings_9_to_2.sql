-- Saturday meetings run 9–2.
--
-- The app's defaults are fixed in code, so new events land on 9–2 and the
-- attendance maths measures against 300 minutes. This file is for the Saturday
-- meetings ALREADY on the calendar, whose times are stored on the row and
-- can't be changed by shipping code.
--
-- Run STEP 1 to see what would change, then STEP 2 to change it.
--
-- date_key is a text column, so every row has to be screened before it is cast
-- to a date: one row holding an empty string or anything else unparseable
-- makes the cast throw, and in a multi-statement script that aborts everything
-- after it. The regex guard is what keeps a single bad row from taking the
-- rest of a migration down with it.

-- ── STEP 1: which Saturday meetings are not 9–2? ───────────────────────────
select date_key, name, start_time, end_time
from calendar_events
where date_key ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'   -- see note below
  and extract(dow from date_key::date) = 6        -- 6 = Saturday
  and category = 'meeting'
  and (start_time is distinct from '09:00' or end_time is distinct from '14:00')
order by date_key;

-- ── STEP 2: set them to 9–2 ────────────────────────────────────────────────
-- Only Saturdays, and only meetings: a Saturday competition or outreach event
-- has its own real hours and must not be flattened to 9–2.
update calendar_events
set start_time = '09:00',
    end_time   = '14:00'
where date_key ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
  and extract(dow from date_key::date) = 6
  and category = 'meeting';
