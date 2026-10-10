-- Security, phase 3 (part 1 of 2): groundwork for team boundaries.
--
-- Nothing in this file changes who can see what. It adds:
--   * functions that answer "which teams is the caller on" from the database,
--   * a trigger that stamps a new row with the caller's team when the app
--     forgot to (and tidies the three spellings of Radical: NULL, '7196', ''),
--   * an owner column for the two scouting tables, whose team_number is the
--     robot being scouted rather than the team that scouted it.
-- security_team_scope.sql (part 2) then uses these in the policies.
-- Run after security_privilege_guard.sql. Safe to run twice.

-- ── Radical has three spellings ────────────────────────────────────────────
-- NULL is the canonical one. '7196' and '' both mean Radical too.
create or replace function public.team_key(t text)
returns text
language sql
immutable
as $$
  select nullif(nullif(btrim(t), ''), '7196')
$$;

-- ── Which teams is the caller on ───────────────────────────────────────────
-- Radical is written '7196' in the result so it can sit in an array.
--   * their profile's team (NULL = Radical),
--   * extra_teams (mentors who coach a sister team too),
--   * the team whose account they run (team_accounts.user_id).
-- A team login (the 'Team' tag, or an address like team123@teams.radical)
-- with no team on its profile is NOT treated as Radical: a missing number
-- must never grant Radical's data. No profile at all: no teams.
create or replace function public.my_teams()
returns text[]
language sql
stable
security definer
set search_path = public, auth
as $$
  with me as (
    select p.team_number, p.extra_teams,
           ('Team' = any(coalesce(p.function_tags, '{}'))
             or coalesce(u.email, '') ~* '^team[0-9]+@teams\.radical$') as team_login
      from public.profiles p
      left join auth.users u on u.id = p.id
     where p.id = auth.uid()
  )
  select coalesce(array_agg(distinct t) filter (where t is not null), '{}')
    from (
      select case when public.team_key(m.team_number) is not null then public.team_key(m.team_number)
                  when m.team_login then null
                  else '7196' end as t
        from me m
      union all
      select coalesce(public.team_key(x), '7196') from me m, unnest(coalesce(m.extra_teams, '{}')) x
      union all
      select coalesce(public.team_key(ta.team_number), '7196')
        from public.team_accounts ta where ta.user_id = auth.uid()
    ) s
$$;

-- A Radical co-founder: may READ every team (oversight). Must be on Radical,
-- so a sister team can't hand itself global reach with a tag.
create or replace function public.is_cofounder()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select '7196' = any(public.my_teams())
     and (coalesce((select p.function_tags from public.profiles p where p.id = auth.uid()), '{}') && array['Co-Founder']
          or lower(coalesce((select u.email from auth.users u where u.id = auth.uid()), ''))
               in ('deshpandeyukti@pleasval.org', 'meckleykayden@pleasval.org'))
$$;

-- A Radical lead: runs the platform (team accounts, the interest form, the
-- survey answers other teams send in).
create or replace function public.is_radical_lead()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select '7196' = any(public.my_teams()) and public.is_core_lead()
$$;

grant execute on function public.team_key(text) to authenticated, anon;
grant execute on function public.my_teams() to authenticated, anon;
grant execute on function public.is_cofounder() to authenticated, anon;
grant execute on function public.is_radical_lead() to authenticated, anon;

-- ── Pre-flight: every team login knows its team ────────────────────────────
-- Two test logins (ETSTesting for 123456, and team12345@teams.radical) had no
-- team on their profile. Fill it from the account they run, or the address.
update public.profiles p
   set team_number = coalesce(
         (select ta.team_number from public.team_accounts ta where ta.user_id = p.id limit 1),
         (select substring(u.email from '^team([0-9]+)@teams\.radical$') from auth.users u where u.id = p.id))
 where public.team_key(p.team_number) is null
   and ('Team' = any(coalesce(p.function_tags, '{}'))
        or exists (select 1 from auth.users u where u.id = p.id and u.email ~* '^team[0-9]+@teams\.radical$'))
   and coalesce(
         (select ta.team_number from public.team_accounts ta where ta.user_id = p.id limit 1),
         (select substring(u.email from '^team([0-9]+)@teams\.radical$') from auth.users u where u.id = p.id)) is not null;

do $$
begin
  if exists (
    select 1 from public.profiles p
     where public.team_key(p.team_number) is null
       and ('Team' = any(coalesce(p.function_tags, '{}'))
            or exists (select 1 from auth.users u where u.id = p.id and u.email ~* '^team[0-9]+@teams\.radical$'))
  ) then
    raise exception 'A team login still has no team on its profile; fix it before part 2.';
  end if;
end $$;

-- ── Scouting gets an owner ─────────────────────────────────────────────────
-- In these two, team_number is the robot being scouted. Who did the scouting
-- goes in owner_team (NULL = Radical), the same column boards and tasks use.
alter table public.match_scouting   add column if not exists owner_team text;
alter table public.considered_teams add column if not exists owner_team text;
create index if not exists match_scouting_owner_idx   on public.match_scouting (owner_team);
create index if not exists considered_teams_owner_idx on public.considered_teams (owner_team);
-- A shortlist per team: two teams may both consider the same robot. The old
-- key was team_number alone. It needs a primary key all the same (the table
-- sends live updates, and Postgres refuses updates and deletes on a published
-- table without one), and owner_team can be NULL, so the key is a new id.
alter table public.considered_teams add column if not exists id uuid not null default gen_random_uuid();
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'considered_teams_pkey'
              and pg_get_constraintdef(oid) <> 'PRIMARY KEY (id)') then
    alter table public.considered_teams drop constraint considered_teams_pkey;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'considered_teams_pkey') then
    alter table public.considered_teams add constraint considered_teams_pkey primary key (id);
  end if;
end $$;
create unique index if not exists considered_teams_owner_team_key
  on public.considered_teams (owner_team, team_number) nulls not distinct;

-- ── Stamp the team on new rows ─────────────────────────────────────────────
-- The app stamps rows itself (stampTeam in src/lib/teamScope.js), but some
-- paths forgot, which filed a sister team's rows under Radical. If a row comes
-- in with no team and the caller is on exactly one team that isn't Radical,
-- it belongs to that team. A caller on Radical (or on several teams) keeps
-- NULL, which means Radical and is theirs to write. The server is untouched.
create or replace function public.stamp_row_team()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  col    text := coalesce(tg_argv[0], 'team_number');
  raw    text;
  teams  text[];
  others text[];
begin
  if public.is_server_caller() then return new; end if;
  raw := to_jsonb(new) ->> col;
  if public.team_key(raw) is not null then return new; end if;
  -- '' and '7196' become NULL, the one spelling of Radical.
  if raw is not null then
    new := jsonb_populate_record(new, jsonb_build_object(col, null));
  end if;
  teams  := public.my_teams();
  others := array(select x from unnest(teams) x where x <> '7196');
  if '7196' = any(teams) or cardinality(others) <> 1 then return new; end if;
  return jsonb_populate_record(new, jsonb_build_object(col, others[1]));
end
$$;

do $$
declare
  t text;
  team_tables text[] := array[
    'absence_notices', 'alliance_hubs', 'alliance_scouting', 'announcement_votes', 'announcements',
    'attendance_records', 'attendance_sessions', 'calendar_birthday_reactions', 'calendar_events',
    'cleanup_assignments', 'cleanup_exemptions', 'cleanup_jobs', 'cleanup_sessions',
    'comp_day_assignments', 'comp_day_blocks', 'comp_day_sessions', 'daily_pulse', 'design_matrices',
    'expense_log', 'fun_quotes', 'messages', 'notebook_entries', 'notebook_entry_participants',
    'notebook_flash', 'notebook_projects', 'outreach_log', 'past_members', 'request_reminders',
    'requests', 'scouting_periods', 'scouting_schedule', 'season_photos', 'season_timeline',
    'suggestions', 'team_survey_responses', 'testing_charts', 'testing_rows', 'testing_tables',
    'timeline_cards', 'timeline_comments', 'workshop_gallery', 'workshop_ideas', 'workshops'];
  owner_tables text[] := array['boards', 'tasks', 'scouting_records', 'match_scouting', 'considered_teams'];
begin
  foreach t in array team_tables loop
    execute format('drop trigger if exists stamp_row_team on public.%I', t);
    execute format('create trigger stamp_row_team before insert on public.%I for each row execute function public.stamp_row_team(%L)', t, 'team_number');
  end loop;
  foreach t in array owner_tables loop
    execute format('drop trigger if exists stamp_row_team on public.%I', t);
    execute format('create trigger stamp_row_team before insert on public.%I for each row execute function public.stamp_row_team(%L)', t, 'owner_team');
  end loop;
end $$;
