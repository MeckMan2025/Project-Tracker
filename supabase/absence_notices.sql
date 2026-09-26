-- Telling the team you'll be out before a meeting. Run once in the Supabase
-- SQL editor.
--
-- The rule is 24 hours: file at least that far ahead and a lead can excuse you,
-- file later and it counts absent regardless. on_time is worked out when the
-- notice is filed and stored, not recomputed later — the rule is about when you
-- told people, measured against the meeting as it was scheduled at the time. If
-- the meeting later moves, that shouldn't retroactively make someone late.
--
-- Nothing here marks attendance by itself. Leads see who filed when they take
-- attendance and decide; this table is the record of what was said and when.

create table if not exists absence_notices (
  id           text primary key,
  username     text not null,
  meeting_date date not null,
  -- The meeting's actual start, so "24 hours before" means something precise.
  -- Falls back to a default start time when the day isn't on the calendar.
  meeting_at   timestamptz,
  event_id     text,
  event_name   text,
  reason       text not null default '',
  hours_before numeric,
  on_time      boolean not null default false,
  created_at   timestamptz not null default now()
);

-- Looked up per meeting when a lead takes attendance, and per person on their
-- own page.
create index if not exists absence_notices_meeting_idx on absence_notices (meeting_date);
create index if not exists absence_notices_user_idx    on absence_notices (username);

-- One notice per person per meeting. Filing again should correct the first,
-- not stack up a second — and the app upserts on this.
create unique index if not exists absence_notices_one_each
  on absence_notices (username, meeting_date);
