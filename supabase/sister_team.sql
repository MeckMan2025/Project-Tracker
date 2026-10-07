-- A sister team: Beyond the Mean (38350) runs the whole app, not just boards.
-- Run once in the Supabase SQL editor.
--
-- Visiting teams get boards and a calendar. A sister team gets everything
-- Radical has, which means every table behind those features has to know whose
-- row it is. NULL means Radical, exactly as it already does on boards and
-- tasks — so every row written before today stays ours, and a filter somebody
-- forgets fails towards our own data rather than somebody else's.

-- ── 1. Whose row is this ────────────────────────────────────────────────────
alter table notebook_entries    add column if not exists team_number text;
alter table notebook_projects   add column if not exists team_number text;
alter table attendance_sessions add column if not exists team_number text;
alter table attendance_records  add column if not exists team_number text;
alter table absence_notices     add column if not exists team_number text;
alter table match_scouting      add column if not exists team_number text;
alter table outreach_log        add column if not exists team_number text;
alter table expense_log         add column if not exists team_number text;

create index if not exists notebook_entries_team_idx    on notebook_entries (team_number);
create index if not exists notebook_projects_team_idx   on notebook_projects (team_number);
create index if not exists attendance_sessions_team_idx on attendance_sessions (team_number);
create index if not exists attendance_records_team_idx  on attendance_records (team_number);
create index if not exists absence_notices_team_idx     on absence_notices (team_number);
create index if not exists match_scouting_team_idx      on match_scouting (team_number);
create index if not exists outreach_log_team_idx        on outreach_log (team_number);
create index if not exists expense_log_team_idx         on expense_log (team_number);

-- ── 2. Which teams run the full app ─────────────────────────────────────────
-- A plain flag, because there are exactly two kinds of team and a hierarchy
-- for that would be inventing work.
alter table team_accounts add column if not exists full_access boolean not null default false;
update team_accounts set full_access = true where team_number = '38350';

-- ── 2b. Uniqueness is per team, not global ──────────────────────────────────
-- Two indexes predate teams and so are team-blind: one notice per person per
-- meeting, one attendance session per day. Both now have to mean "per team" —
-- otherwise Beyond the Mean cannot hold a meeting on a day Radical already met,
-- and copying their notices across collides with the originals.
--
-- nulls not distinct keeps NULL (Radical) counting as a value, so the original
-- one-per-person-per-meeting guarantee still holds for us rather than silently
-- allowing duplicate Radical rows.

drop index if exists absence_notices_one_each;
drop index if exists attendance_sessions_one_per_day;

create unique index absence_notices_one_each
  on absence_notices (username, meeting_date, team_number) nulls not distinct;

create unique index attendance_sessions_one_per_day
  on attendance_sessions (session_date, team_number) nulls not distinct;

-- ── 3. Copy their history across ────────────────────────────────────────────
-- Radical KEEPS everything: that work happened on Radical and its season has
-- to stay whole for judging. Beyond the Mean gets a copy so the thirteen can
-- still open what they wrote.
--
-- Copied ids are the original with '-btm' appended, which makes every copy
-- traceable to its source and the whole thing reversible with one delete.
--
-- to_jsonb/jsonb_populate_recordset rather than naming every column: these
-- tables have thirty-odd between them and a list would be wrong the next time
-- one is added.

create temp table btm_people(name text);
insert into btm_people(name)
select unnest(array[
  'Daegus Peters',
  'Sahana Dinakaran',
  'Nishanth Rana',
  'Laasya Muppaneni',
  'Sudeeksha Mukiri',
  'Susritha Gadamsetty',
  'Thanuja Lakshmanan',
  'Sadhana Dinakaran',
  'Joshika Banavasi',
  'Suhaas Pallamreddy',
  'Weston Schroeder',
  'Saiesha Pradhan',
  'Anant Bhugra'
]);

insert into notebook_entries
select * from jsonb_populate_recordset(null::notebook_entries, (
  select coalesce(jsonb_agg(to_jsonb(e) || jsonb_build_object('id', e.id || '-btm', 'team_number', '38350')), '[]'::jsonb)
  from notebook_entries e
  where e.username in (select name from btm_people)
    and e.team_number is null
    and not exists (select 1 from notebook_entries x where x.id = e.id || '-btm')
));

insert into attendance_records
select * from jsonb_populate_recordset(null::attendance_records, (
  select coalesce(jsonb_agg(to_jsonb(r) || jsonb_build_object('id', r.id || '-btm', 'team_number', '38350')), '[]'::jsonb)
  from attendance_records r
  where r.username in (select name from btm_people)
    and r.team_number is null
    and not exists (select 1 from attendance_records x where x.id = r.id || '-btm')
));

insert into absence_notices
select * from jsonb_populate_recordset(null::absence_notices, (
  select coalesce(jsonb_agg(to_jsonb(n) || jsonb_build_object('id', n.id || '-btm', 'team_number', '38350')), '[]'::jsonb)
  from absence_notices n
  where n.username in (select name from btm_people)
    and n.team_number is null
    and not exists (select 1 from absence_notices x where x.id = n.id || '-btm')
));

-- An attendance record is meaningless without the session it belongs to, so
-- the sessions those records point at come across as well.
insert into attendance_sessions
select * from jsonb_populate_recordset(null::attendance_sessions, (
  select coalesce(jsonb_agg(to_jsonb(s) || jsonb_build_object('id', s.id || '-btm', 'team_number', '38350')), '[]'::jsonb)
  from attendance_sessions s
  where s.team_number is null
    and exists (
      select 1 from attendance_records r
      where r.session_id = s.id and r.username in (select name from btm_people))
    and not exists (select 1 from attendance_sessions x where x.id = s.id || '-btm')
));

-- Point the copied records at the copied sessions, so Beyond the Mean's
-- attendance hangs together on its own rather than reaching into ours.
update attendance_records r
set session_id = r.session_id || '-btm'
where r.team_number = '38350'
  and exists (select 1 from attendance_sessions s where s.id = r.session_id || '-btm');

-- What landed.
select 'notebook_entries' as table, count(*) from notebook_entries where team_number = '38350'
union all select 'attendance_records', count(*) from attendance_records where team_number = '38350'
union all select 'attendance_sessions', count(*) from attendance_sessions where team_number = '38350'
union all select 'absence_notices', count(*) from absence_notices where team_number = '38350';
