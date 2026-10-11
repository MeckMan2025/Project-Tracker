-- Security, phase 4: within a team, who may change which row.
--
-- Phase 3 keeps each team's rows to that team, but inside a team any member
-- could still change or delete any row by calling the API directly: edit a
-- teammate's notebook entry, mark someone present, delete a task. Only the
-- app's hidden buttons stopped it. This puts the app's own rules in the
-- database:
--   * notebook entries: only the author edits one; the author or a lead
--     deletes it;
--   * attendance: leads only, except that a student may win back their own
--     notebook-rule absence by writing the entry (attendance_guard below);
--   * tasks: anyone on the team may move a task or claim an up-for-grabs one;
--     everything else about a task is for leads and team logins (tasks_guard);
--   * your own absence notices, expenses, outreach, photos and workshops;
--     requests filed as yourself; reviews by leads (and Finance for expenses);
--   * lead-only setup tables (projects, sessions, comp day, cleanup, ...).
-- Reading is unchanged (Phase 3). The service role is not affected.
--
-- When someone is renamed, their rows follow them (profiles_name_cascade), so
-- "my rows" keeps meaning the same rows.
--
-- Needs security_team_scope.sql (Phase 3) and workshop_completions.sql.
-- Undo with security_person_rules_rollback.sql. Safe to run twice.

-- ── Who is calling ─────────────────────────────────────────────────────────
-- The caller's name as their rows record it (profiles.display_name).
create or replace function public.my_name()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.display_name from public.profiles p where p.id = auth.uid()
$$;

create or replace function public.my_email()
returns text
language sql
stable
security definer
set search_path = public, auth
as $$
  select lower(u.email) from auth.users u where u.id = auth.uid()
$$;

create or replace function public.has_tag(t text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select t = any(coalesce(p.function_tags, '{}')) from public.profiles p where p.id = auth.uid()), false)
$$;

-- A shared team login (the Team tag, or a team<n>@teams.radical address).
create or replace function public.is_team_login()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select public.has_tag('Team')
      or coalesce(public.my_email(), '') ~* '^team[0-9]+@teams\.radical$'
$$;

-- The app's canEditContent: a lead, or a team login.
create or replace function public.can_edit_content()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_app_lead() or public.is_team_login()
$$;

grant execute on function public.my_name() to authenticated, anon;
grant execute on function public.my_email() to authenticated, anon;
grant execute on function public.has_tag(text) to authenticated, anon;
grant execute on function public.is_team_login() to authenticated, anon;
grant execute on function public.can_edit_content() to authenticated, anon;

-- ── Write policies ─────────────────────────────────────────────────────────
-- Each table keeps its Phase 3 read policy. Its insert, update and delete
-- policies are replaced by the same team rule AND a per-person rule. NULL
-- means "the team rule alone".
create or replace function pg_temp.person_policies(
  t text, team_col text, ins text, upd text, upd_check text, del text)
returns void
language plpgsql
as $$
declare
  team text := format('coalesce(public.team_key(%I), ''7196'') = any ((select public.my_teams())::text[])', team_col);
  both_ text;
begin
  foreach both_ in array array['_team_insert', '_team_update', '_team_delete',
                               '_person_insert', '_person_update', '_person_delete'] loop
    execute format('drop policy if exists %I on public.%I', t || both_, t);
  end loop;
  execute format('create policy %I on public.%I for insert to authenticated with check (%s and (%s))',
                 t || '_person_insert', t, team, coalesce(ins, 'true'));
  execute format('create policy %I on public.%I for update to authenticated using (%s and (%s)) with check (%s and (%s))',
                 t || '_person_update', t, team, coalesce(upd, 'true'), team, coalesce(upd_check, upd, 'true'));
  execute format('create policy %I on public.%I for delete to authenticated using (%s and (%s))',
                 t || '_person_delete', t, team, coalesce(del, 'true'));
end
$$;

do $$
declare
  lead  text := '(select public.is_app_lead())';
  edit  text := '(select public.can_edit_content())';
  me    text := '(select public.my_name())';
  r     record;
begin
  -- Author's own rows (by name), with a lead's override where the app has one.
  perform pg_temp.person_policies('notebook_entries', 'team_number',
    format('username = %s', me),
    format('username = %s', me), null,
    format('username = %s or %s', me, lead));
  perform pg_temp.person_policies('absence_notices', 'team_number',
    format('username = %s or %s', me, lead),
    format('username = %s or %s', me, lead), null,
    format('username = %s or %s', me, lead));
  perform pg_temp.person_policies('expense_log', 'team_number',
    format('username = %s or %s', me, lead),
    format('%s or (select public.has_tag(''Finance''))', lead), null,
    format('username = %s or %s', me, lead));
  for r in select * from (values
      ('outreach_log', 'username'),
      ('workshop_gallery', 'submitted_by'),
      ('season_photos', 'uploaded_by'),
      ('workshop_completions', 'completed_by')) v(t, col) loop
    perform pg_temp.person_policies(r.t, 'team_number',
      format('%I = %s or %s', r.col, me, lead),
      format('%I = %s or %s', r.col, me, lead), null,
      format('%I = %s or %s', r.col, me, lead));
  end loop;
  -- Anyone on the team proposes a workshop; its creator (name, or address
  -- when they had no name) or a lead edits and removes it.
  perform pg_temp.person_policies('workshops', 'team_number', null,
    format('creator_name = %s or lower(creator_name) = (select public.my_email()) or %s', me, lead), null,
    format('creator_name = %s or lower(creator_name) = (select public.my_email()) or %s', me, lead));

  -- Rows that belong to an account id.
  for r in select * from (values ('daily_pulse'), ('calendar_birthday_reactions'), ('announcement_votes')) v(t) loop
    perform pg_temp.person_policies(r.t, 'team_number',
      'user_id = auth.uid()', 'user_id = auth.uid()', null, 'user_id = auth.uid()');
  end loop;

  -- Requests: filed as yourself; reviewed by a lead, or by Finance for
  -- expense requests; removed by a lead.
  perform pg_temp.person_policies('requests', 'team_number',
    format('requested_by_user_id = auth.uid() or %s', lead),
    format('%s or ((select public.has_tag(''Finance'')) and type = ''expense'')', lead), null,
    lead);
  perform pg_temp.person_policies('request_reminders', 'team_number',
    format('reminded_by_user_id = auth.uid() or %s', lead), lead, null, lead);

  -- Attendance: leads. A student's one allowed change, winning back their own
  -- notebook-rule absence, is checked in full by attendance_guard below.
  perform pg_temp.person_policies('attendance_records', 'team_number',
    lead, format('username = %s or %s', me, lead), null, lead);

  -- Tasks: anyone on the team adds (import) and moves; tasks_guard limits
  -- what a non-lead may change. Deleting is for leads and team logins.
  perform pg_temp.person_policies('tasks', 'owner_team', null, null, null, edit);
  perform pg_temp.person_policies('boards', 'owner_team', edit, edit, null, edit);

  -- Anyone submits; leads approve, edit and remove.
  perform pg_temp.person_policies('fun_quotes', 'team_number', null, lead, null, lead);
  perform pg_temp.person_policies('suggestions', 'team_number', null, lead, null, lead);
  perform pg_temp.person_policies('match_scouting', 'owner_team', null, lead, null, lead);

  -- Calendar: leads, team logins, Outreach and Finance add events; leads and
  -- team logins edit and remove them.
  perform pg_temp.person_policies('calendar_events', 'team_number',
    format('%s or (select public.has_tag(''Outreach'')) or (select public.has_tag(''Finance''))', edit),
    edit, null, edit);

  -- Setup that only leads touch.
  for r in select * from (values
      ('notebook_projects', 'team_number'), ('notebook_flash', 'team_number'),
      ('notebook_entry_participants', 'team_number'), ('attendance_sessions', 'team_number'),
      ('scouting_periods', 'team_number'), ('comp_day_assignments', 'team_number'),
      ('comp_day_blocks', 'team_number'), ('comp_day_sessions', 'team_number'),
      ('cleanup_assignments', 'team_number'), ('cleanup_exemptions', 'team_number'),
      ('cleanup_jobs', 'team_number'), ('cleanup_sessions', 'team_number'),
      ('announcements', 'team_number'), ('considered_teams', 'owner_team')) v(t, col) loop
    perform pg_temp.person_policies(r.t, r.col, lead, lead, null, lead);
  end loop;
end $$;

-- ── Attendance: a student's one change ─────────────────────────────────────
-- src/lib/notebookAttendance.js: writing the notebook entry turns your own
-- notebook-rule absence into present. Nothing else about the record changes.
create or replace function public.attendance_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.is_server_caller() or public.is_app_lead()
     or current_setting('scrum.name_cascade', true) = 'on' then
    return new;
  end if;
  if old.username = public.my_name()
     and old.status = 'absent' and old.marked_by = 'notebook-rule'
     and new.status = 'present' and new.marked_by = public.my_name()
     and (to_jsonb(new) - 'status' - 'marked_by') = (to_jsonb(old) - 'status' - 'marked_by') then
    return new;
  end if;
  raise exception 'Only a team lead can change attendance.' using errcode = '42501';
end
$$;
drop trigger if exists attendance_guard on public.attendance_records;
create trigger attendance_guard before update on public.attendance_records
  for each row execute function public.attendance_guard();

-- ── Tasks: what a non-lead may change ──────────────────────────────────────
-- Moving a task (status, and completed_at with it), or claiming one that is
-- up for grabs for yourself. Title, description, assignees, due date and the
-- rest are for leads and team logins.
create or replace function public.tasks_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.is_server_caller() or public.can_edit_content()
     or current_setting('scrum.name_cascade', true) = 'on' then
    return new;
  end if;
  if (to_jsonb(new) - 'status' - 'completed_at' - 'assignee')
     is distinct from (to_jsonb(old) - 'status' - 'completed_at' - 'assignee') then
    raise exception 'Only a team lead can edit a task.' using errcode = '42501';
  end if;
  if new.assignee is distinct from old.assignee
     and not (old.assignee = '__up_for_grabs__' and new.assignee = public.my_name()) then
    raise exception 'Only a team lead can reassign a task.' using errcode = '42501';
  end if;
  return new;
end
$$;
drop trigger if exists tasks_guard on public.tasks;
create trigger tasks_guard before update on public.tasks
  for each row execute function public.tasks_guard();

-- ── A rename takes your rows with you ──────────────────────────────────────
-- Rows record their author by name, so without this a renamed student could
-- no longer edit their own entries. Limited to the person's own team(s), so
-- a namesake on another team keeps theirs. Runs as the owner (the rows may
-- be outside what the renamer can write) and tells the guards above it is
-- the cascade, not the caller, making the change.
create or replace function public.profiles_name_cascade()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_name text := old.display_name;
  new_name text := new.display_name;
  teams text[];
  r record;
begin
  if coalesce(btrim(old_name), '') = '' or coalesce(btrim(new_name), '') = '' or old_name = new_name then
    return new;
  end if;
  teams := array(select distinct coalesce(public.team_key(x), '7196')
                   from unnest(array[new.team_number] || coalesce(new.extra_teams, '{}')) x);
  perform set_config('scrum.name_cascade', 'on', true);
  for r in select * from (values
      ('notebook_entries', 'username', 'team_number'), ('notebook_entry_participants', 'username', 'team_number'),
      ('notebook_projects', 'created_by', 'team_number'), ('attendance_records', 'username', 'team_number'),
      ('attendance_records', 'marked_by', 'team_number'), ('absence_notices', 'username', 'team_number'),
      ('expense_log', 'username', 'team_number'), ('outreach_log', 'username', 'team_number'),
      ('workshops', 'creator_name', 'team_number'), ('workshop_gallery', 'submitted_by', 'team_number'),
      ('workshop_completions', 'completed_by', 'team_number'), ('season_photos', 'uploaded_by', 'team_number'),
      ('fun_quotes', 'submitted_by', 'team_number'), ('calendar_events', 'added_by', 'team_number'),
      ('comp_day_assignments', 'username', 'team_number'), ('cleanup_assignments', 'assigned_username', 'team_number'),
      ('cleanup_exemptions', 'username', 'team_number'), ('requests', 'requested_by', 'team_number'),
      ('suggestions', 'author', 'team_number'), ('suggestions', 'username', 'team_number'),
      ('timeline_comments', 'author', 'team_number'), ('announcement_votes', 'username', 'team_number'),
      ('calendar_birthday_reactions', 'username', 'team_number'),
      ('match_scouting', 'scout', 'owner_team'), ('tasks', 'assignee', 'owner_team'),
      ('tasks', 'assigned_by', 'owner_team')) v(t, col, team_col) loop
    execute format('update public.%I set %I = $1 where %I = $2 and coalesce(public.team_key(%I), ''7196'') = any ($3)',
                   r.t, r.col, r.col, r.team_col)
      using new_name, old_name, teams;
  end loop;
  update public.tasks set assignees = array_replace(assignees, old_name, new_name)
   where old_name = any(assignees) and coalesce(public.team_key(owner_team), '7196') = any (teams);
  perform set_config('scrum.name_cascade', 'off', true);
  return new;
end
$$;
revoke execute on function public.profiles_name_cascade() from public, anon, authenticated;
drop trigger if exists profiles_name_cascade on public.profiles;
create trigger profiles_name_cascade after update of display_name on public.profiles
  for each row execute function public.profiles_name_cascade();
