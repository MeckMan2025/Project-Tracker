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

-- ── When you'll actually be there ───────────────────────────────────────────
-- Added after the table. Run this part too.
--
-- People say it as times — "I'll get there at 5 and leave at 7" — not as
-- minutes missed. So that is what's stored, and the minutes are worked out
-- from the meeting's own start and length, because minutes is what attendance
-- records as lateMin and earlyMin.
--
-- kind is 'out' for the whole meeting, or 'partial' when they'll be there for
-- some of it. arrive_at / leave_at are HH:MM and only apply to 'partial'.

alter table absence_notices add column if not exists kind      text not null default 'out';
alter table absence_notices add column if not exists arrive_at text;
alter table absence_notices add column if not exists leave_at  text;
alter table absence_notices add column if not exists late_min  integer;
alter table absence_notices add column if not exists early_min integer;
