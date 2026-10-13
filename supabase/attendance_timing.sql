-- Late arrivals and early departures live on the attendance record itself.
--
-- Until now the minutes somebody missed were kept in one JSON document (the
-- 'attendance_partial' row of scouting_schedule), for the whole team, for every
-- meeting. Every lead's app loaded that one document on open and wrote the
-- whole thing back on every edit, so two leads editing the same evening
-- overwrote each other, a lead whose load had failed wrote back an empty one,
-- and a sister team's lead read nothing and wrote over ours. Each time, people
-- who had told us they were leaving early went back to 100%.
--
-- A record carries its own minutes now, the same as it carries its status, so
-- one edit changes one row and nothing else.

alter table attendance_records add column if not exists late_min      integer;
alter table attendance_records add column if not exists early_min     integer;
alter table attendance_records add column if not exists late_excused  boolean;
alter table attendance_records add column if not exists early_excused boolean;

-- A lead can say how long a meeting actually ran. Empty means the usual
-- length for that day of the week.
alter table attendance_sessions add column if not exists duration_min integer;

-- ── Standing notices ────────────────────────────────────────────────────────
-- "I leave at 6:30 every Thursday for gymnastics." A fixed commitment, filed
-- once, instead of a notice to file every single week and forget. Applied to
-- every session on that weekday the moment it is started, unless a notice for
-- that specific day says otherwise.
--
-- weekday is 0-6, Sunday first, the same as JavaScript's getDay().
create table if not exists standing_notices (
  id          text primary key,
  username    text not null,
  weekday     smallint not null check (weekday between 0 and 6),
  kind        text not null default 'partial',   -- 'partial' or 'out'
  arrive_at   text,                              -- HH:MM, partial only
  leave_at    text,                              -- HH:MM, partial only
  reason      text not null default '',
  team_number text,
  created_at  timestamptz not null default now()
);

create unique index if not exists standing_notices_one_each
  on standing_notices (username, weekday, team_number) nulls not distinct;
create index if not exists standing_notices_team_idx on standing_notices (team_number);

alter table standing_notices enable row level security;

-- The same rules as absence_notices: your own, or a lead's, inside your team.
drop policy if exists standing_notices_team_read on standing_notices;
create policy standing_notices_team_read on standing_notices for select to authenticated
  using ((select is_cofounder()) or coalesce(team_key(team_number), '7196') = any ((select my_teams())::text[]));

drop policy if exists standing_notices_person_insert on standing_notices;
create policy standing_notices_person_insert on standing_notices for insert to authenticated
  with check (coalesce(team_key(team_number), '7196') = any ((select my_teams())::text[])
              and (username = (select my_name()) or (select is_app_lead())));

drop policy if exists standing_notices_person_update on standing_notices;
create policy standing_notices_person_update on standing_notices for update to authenticated
  using (coalesce(team_key(team_number), '7196') = any ((select my_teams())::text[])
         and (username = (select my_name()) or (select is_app_lead())))
  with check (coalesce(team_key(team_number), '7196') = any ((select my_teams())::text[])
              and (username = (select my_name()) or (select is_app_lead())));

drop policy if exists standing_notices_person_delete on standing_notices;
create policy standing_notices_person_delete on standing_notices for delete to authenticated
  using (coalesce(team_key(team_number), '7196') = any ((select my_teams())::text[])
         and (username = (select my_name()) or (select is_app_lead())));

-- ── Carry the old document across ───────────────────────────────────────────
-- Keys are "sessionId|username". Only fills blanks, so running this twice
-- changes nothing.
with doc as (
  select data->'timing' as t from scouting_schedule where id = 'attendance_partial'
),
kv as (
  select key, value from doc, jsonb_each(doc.t)
)
update attendance_records r set
  late_min      = coalesce(r.late_min,      nullif(kv.value->>'lateMin', '')::integer),
  early_min     = coalesce(r.early_min,     nullif(kv.value->>'earlyMin', '')::integer),
  late_excused  = coalesce(r.late_excused,  nullif(kv.value->>'lateExcused', '')::boolean),
  early_excused = coalesce(r.early_excused, nullif(kv.value->>'earlyExcused', '')::boolean)
from kv
where r.session_id = split_part(kv.key, '|', 1)
  and r.username   = split_part(kv.key, '|', 2);

-- ── Notices that were filed but never turned into minutes ───────────────────
-- A partial notice only became minutes when a lead opened that session in the
-- manager after the fact. Many never did, so the person stayed at 100%. Apply
-- every one of them to the matching present record that nobody has touched,
-- with the rule the form states: told us in time, the minutes are excused.
update attendance_records r set
  late_min      = coalesce(n.late_min, 0),
  early_min     = coalesce(n.early_min, 0),
  late_excused  = n.on_time,
  early_excused = n.on_time
from absence_notices n
join attendance_sessions s
  on s.session_date = n.meeting_date::text
 and coalesce(team_key(s.team_number), '7196') = coalesce(team_key(n.team_number), '7196')
where r.session_id = s.id
  and r.username = n.username
  and r.status = 'present'
  and n.kind = 'partial'
  and (coalesce(n.late_min, 0) > 0 or coalesce(n.early_min, 0) > 0)
  and r.late_min is null and r.early_min is null
  and r.late_excused is null and r.early_excused is null;

-- ── Kayden leaves at 6:30 every Thursday for gymnastics ─────────────────────
-- Filed as a standing notice, and applied to every Thursday she was present
-- for that nobody had already filled in. Thursdays run 4-8, so 90 minutes.
insert into standing_notices (id, username, weekday, kind, arrive_at, leave_at, reason, team_number)
values ('standing-kayden-meckley-thu', 'Kayden Meckley', 4, 'partial', '16:00', '18:30', 'Gymnastics', null)
on conflict (username, weekday, team_number) do nothing;

update attendance_records r set
  late_min = coalesce(r.late_min, 0), early_min = 90,
  late_excused = coalesce(r.late_excused, true), early_excused = true
from attendance_sessions s
where s.id = r.session_id
  and r.username = 'Kayden Meckley'
  and r.status = 'present'
  and extract(dow from s.session_date::date) = 4
  and team_key(s.team_number) is null
  and r.early_min is null;

-- ── Same team stamp as every other table ────────────────────────────────────
-- security_team_scope_prep.sql puts stamp_row_team on each table so a row a
-- sister team's member files lands on their team even when the app forgot to
-- say. This table gets the same.
drop trigger if exists stamp_row_team on public.standing_notices;
create trigger stamp_row_team before insert on public.standing_notices
  for each row execute function public.stamp_row_team('team_number');
