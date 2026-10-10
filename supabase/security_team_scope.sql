-- Security, phase 3 (part 2 of 2): the database keeps each team's rows to
-- that team.
--
-- Until now every table said "any signed-in user may read and write every
-- row", and team separation was only the app's own query filters. Now:
--   * you read your team's rows (both teams, for a mentor on two teams);
--   * Radical co-founders read every team's rows (oversight), but write only
--     to their own;
--   * you write only to your own team(s);
--   * per-person tables (notifications, push subscriptions) are yours alone.
-- The service role (admin-*, notebook-voice, send-push, process-scheduled)
-- is not affected.
--
-- Needs security_privilege_guard.sql and security_team_scope_prep.sql first.
-- Undo with security_team_scope_rollback.sql. Safe to run twice.
-- WARNING: enable_rls_step3.sql drops every policy; re-running it undoes this.

do $$
declare
  t text;
  p record;
  -- Tables whose owner is team_number (NULL = Radical).
  team_tables text[] := array[
    'absence_notices', 'alliance_hubs', 'alliance_scouting', 'announcement_votes', 'announcements',
    'attendance_records', 'attendance_sessions', 'calendar_birthday_reactions', 'calendar_events',
    'cleanup_assignments', 'cleanup_exemptions', 'cleanup_jobs', 'cleanup_sessions',
    'comp_day_assignments', 'comp_day_blocks', 'comp_day_sessions', 'daily_pulse', 'design_matrices',
    'expense_log', 'fun_quotes', 'messages', 'notebook_entries', 'notebook_entry_participants',
    'notebook_flash', 'notebook_projects', 'outreach_log', 'past_members', 'request_reminders',
    'requests', 'scouting_periods', 'scouting_schedule', 'season_photos', 'season_timeline',
    'suggestions', 'testing_charts', 'testing_rows', 'testing_tables',
    'timeline_cards', 'timeline_comments', 'workshop_gallery', 'workshop_ideas', 'workshops'];
  -- Tables whose owner is owner_team.
  owner_tables text[] := array['boards', 'tasks', 'scouting_records', 'match_scouting', 'considered_teams'];
  col text;
  read_rule text;
  write_rule text;
begin
  foreach t in array team_tables || owner_tables loop
    col := case when t = any(owner_tables) then 'owner_team' else 'team_number' end;
    -- Helpers are wrapped in (select ...) so Postgres works them out once per
    -- query, not once per row.
    write_rule := format('coalesce(public.team_key(%I), ''7196'') = any ((select public.my_teams())::text[])', col);
    read_rule  := format('(select public.is_cofounder()) or %s', write_rule);

    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using (%s)', t || '_team_read', t, read_rule);
    execute format('create policy %I on public.%I for insert to authenticated with check (%s)', t || '_team_insert', t, write_rule);
    execute format('create policy %I on public.%I for update to authenticated using (%s) with check (%s)', t || '_team_update', t, write_rule, write_rule);
    execute format('create policy %I on public.%I for delete to authenticated using (%s)', t || '_team_delete', t, write_rule);
  end loop;
end $$;

-- ── profiles ───────────────────────────────────────────────────────────────
-- Read: yourself, and your team(s). Change: yourself (ordinary fields; the
-- profiles_guard trigger still decides which), or a lead within their own
-- team(s): a sister team's coach can no longer edit Radical's people.
drop policy if exists profiles_read on public.profiles;
drop policy if exists profiles_insert_own on public.profiles;
drop policy if exists profiles_update_own_or_lead on public.profiles;
drop policy if exists profiles_delete_lead on public.profiles;
create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid()
         or (select public.is_cofounder())
         or coalesce(public.team_key(team_number), '7196') = any ((select public.my_teams())::text[]));
create policy profiles_insert_own on public.profiles for insert to authenticated
  with check (id = auth.uid()
              or (public.is_app_lead() and coalesce(public.team_key(team_number), '7196') = any ((select public.my_teams())::text[])));
create policy profiles_update_own_or_lead on public.profiles for update to authenticated
  using (id = auth.uid()
         or (public.is_app_lead() and coalesce(public.team_key(team_number), '7196') = any ((select public.my_teams())::text[])))
  with check (id = auth.uid()
         or (public.is_app_lead() and coalesce(public.team_key(team_number), '7196') = any ((select public.my_teams())::text[])));
create policy profiles_delete_lead on public.profiles for delete to authenticated
  using (public.is_app_lead() and coalesce(public.team_key(team_number), '7196') = any ((select public.my_teams())::text[]));

-- ── approved_emails: a team's own invitations ──────────────────────────────
drop policy if exists approved_emails_read on public.approved_emails;
drop policy if exists approved_emails_write_lead on public.approved_emails;
create policy approved_emails_read on public.approved_emails for select to authenticated
  using ((select public.is_cofounder())
         or coalesce(public.team_key(team_number), '7196') = any ((select public.my_teams())::text[]));
create policy approved_emails_write_lead on public.approved_emails for all to authenticated
  using (public.is_app_lead() and coalesce(public.team_key(team_number), '7196') = any ((select public.my_teams())::text[]))
  with check (public.is_app_lead() and coalesce(public.team_key(team_number), '7196') = any ((select public.my_teams())::text[]));

-- ── team_accounts: Radical's leads run the platform ────────────────────────
-- A team reads its own account (that's how the app learns full access). Only
-- a Radical lead creates or changes team accounts; a sister team's coach
-- can't grant their own team, or any other, full access.
drop policy if exists team_accounts_read on public.team_accounts;
drop policy if exists team_accounts_write_core_lead on public.team_accounts;
drop policy if exists team_accounts_write_radical_lead on public.team_accounts;
create policy team_accounts_read on public.team_accounts for select to authenticated
  using (user_id = auth.uid()
         or (select public.is_cofounder())
         or (select public.is_radical_lead())
         or coalesce(public.team_key(team_number), '7196') = any ((select public.my_teams())::text[]));
create policy team_accounts_write_radical_lead on public.team_accounts for all to authenticated
  using ((select public.is_radical_lead())) with check ((select public.is_radical_lead()));

-- ── Per person ─────────────────────────────────────────────────────────────
-- Yours alone. Anyone signed in may create a notification for someone else
-- (that's how assigning a task tells the assignee), but not read theirs.
do $$
declare t text; p record;
begin
  foreach t in array array['notifications', 'push_subscriptions', 'apns_tokens'] loop
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;
    execute format('create policy %I on public.%I for select to authenticated using (user_id = auth.uid())', t || '_own_read', t);
    execute format('create policy %I on public.%I for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t || '_own_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (user_id = auth.uid())', t || '_own_delete', t);
    if t = 'notifications' then
      execute format('create policy %I on public.%I for insert to authenticated with check (true)', t || '_any_insert', t);
    else
      execute format('create policy %I on public.%I for insert to authenticated with check (user_id = auth.uid())', t || '_own_insert', t);
    end if;
  end loop;
end $$;

-- ── Platform intake ────────────────────────────────────────────────────────
-- The public "interested in Scrum" form (Radical Rundown, before sign-in)
-- may send; only Radical's leads read the answers.
do $$ declare p record; begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'interested_teams' loop
    execute format('drop policy %I on public.interested_teams', p.policyname);
  end loop;
end $$;
create policy interested_teams_send on public.interested_teams for insert to anon, authenticated with check (true);
create policy interested_teams_read on public.interested_teams for select to authenticated
  using ((select public.is_radical_lead()) or (select public.is_cofounder()));
create policy interested_teams_manage on public.interested_teams for update to authenticated
  using ((select public.is_radical_lead())) with check ((select public.is_radical_lead()));
create policy interested_teams_remove on public.interested_teams for delete to authenticated
  using ((select public.is_radical_lead()));

-- Survey answers: each team its own; Radical's leads read every team's.
do $$ declare p record; begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'team_survey_responses' loop
    execute format('drop policy %I on public.team_survey_responses', p.policyname);
  end loop;
end $$;
create policy team_survey_responses_read on public.team_survey_responses for select to authenticated
  using ((select public.is_radical_lead()) or (select public.is_cofounder())
         or coalesce(public.team_key(team_number), '7196') = any ((select public.my_teams())::text[]));
create policy team_survey_responses_write on public.team_survey_responses for all to authenticated
  using (coalesce(public.team_key(team_number), '7196') = any ((select public.my_teams())::text[]))
  with check (coalesce(public.team_key(team_number), '7196') = any ((select public.my_teams())::text[]));
