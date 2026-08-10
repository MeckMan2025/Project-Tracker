-- Role dashboards: diagnostic + realtime fix
-- Run in the Supabase SQL Editor (project wqxjmykphkacbjfxmvzd).
-- Safe to re-run; nothing here drops or overwrites data.
--
-- The role dashboards themselves need NO migration — they live in the existing
-- scouting_schedule table under id = 'role_trackers'. This script only checks
-- the things that make an assigned role show up on someone's Home immediately.

-- ── 1. Is realtime on for the tables the feature depends on? ────────────────
-- profiles          -> pushes a role change to that person's open browser
-- scouting_schedule -> pushes tracker edits to everyone viewing a dashboard
-- Expect two rows. A missing row is why someone must re-login to see a change.
select 'realtime enabled' as check, tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
  and tablename in ('profiles', 'scouting_schedule')
order by tablename;

-- ── 2. Fix: add whichever is missing (no-op if already there) ───────────────
do $$
begin
  begin
    alter publication supabase_realtime add table profiles;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table scouting_schedule;
  exception when duplicate_object then null;
  end;
end $$;

-- Realtime UPDATE payloads need the full old/new row to compare against.
alter table profiles replica identity full;

-- ── 3. Who actually holds a dashboard role? ────────────────────────────────
-- MyDashboard renders nothing unless function_tags contains one of the eight
-- functional roles. 'Team' in the tags is the trap: those accounts get
-- TeamHomeView, which has no dashboard, so their Home cannot change.
-- NOTE: the live profiles.function_tags column is text[], even though
-- supabase_setup.sql:142 declares it jsonb. The setup file's
-- ADD COLUMN IF NOT EXISTS is a no-op against the existing column, so the two
-- have drifted. Query these tags with array operators (&&, = any), not jsonb
-- ones (?|, ?), or you get: operator does not exist: text[] ?| text[]
select
  display_name,
  function_tags,
  authority_tier,
  function_tags && array['Communications','Finance','Outreach','CAD',
                         'Assembly/Building','Wiring','Programming','Scouting']
    as has_dashboard_role,
  'Team' = any(function_tags) as is_team_account_no_dashboard
from profiles
order by has_dashboard_role desc nulls last, display_name;

-- ── 4. Has the tracker doc been written yet? ────────────────────────────────
-- No row  -> every dashboard falls back to the seed trackers (fine).
-- A row   -> seedVersion should be 2 or higher, otherwise the new Outreach
--            trackers (hours, organizations, next event) won't have merged in.
select
  id,
  data->>'seedVersion' as seed_version,
  jsonb_array_length(data->'trackers') as tracker_count,
  updated_at
from scouting_schedule
where id = 'role_trackers';
