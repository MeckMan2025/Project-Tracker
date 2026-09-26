-- The outreach log: one row per event, matching the columns the outreach sheet
-- already keeps. Run once in the Supabase SQL editor.
--
-- Individual Contribution is members x team hours on every row of that sheet
-- (5x3=15, 4x3=12, 5x4=20, 4x4=16, 2x3=6), so it is generated here rather than
-- asked for and stored. A derived number that is typed in by hand is a number
-- that eventually disagrees with the two it came from.

create table if not exists outreach_log (
  id          text primary key,
  -- Who logged it. The app knows the signed-in member, so the form doesn't ask.
  username    text not null,
  event_date  date not null,
  event_name  text not null,
  members     integer not null check (members > 0),
  -- Hours the event ran, per member.
  team_hours  numeric not null check (team_hours >= 0),
  individual_hours numeric generated always as (members * team_hours) stored,
  created_at  timestamptz not null default now()
);

-- Read back newest first, and per person on their own filings.
create index if not exists outreach_log_date_idx on outreach_log (event_date desc);
create index if not exists outreach_log_user_idx on outreach_log (username);
