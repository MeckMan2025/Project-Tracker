-- Undo security_team_scope.sql in one paste, if team boundaries ever break
-- something and it can't wait for a fix.
--
-- Puts back what was there before part 2: "any signed-in user may read and
-- write" on the team tables, and the phase 2 rules on profiles,
-- approved_emails and team_accounts. Keeps everything else: the sign-up gate,
-- the profile guard, the locked-down old functions, and the team-stamping
-- trigger and helpers from security_team_scope_prep.sql (they only make data
-- more correct).

do $$
declare
  t text;
  p record;
  tables text[] := array[
    'absence_notices', 'alliance_hubs', 'alliance_scouting', 'announcement_votes', 'announcements',
    'attendance_records', 'attendance_sessions', 'calendar_birthday_reactions', 'calendar_events',
    'cleanup_assignments', 'cleanup_exemptions', 'cleanup_jobs', 'cleanup_sessions',
    'comp_day_assignments', 'comp_day_blocks', 'comp_day_sessions', 'daily_pulse', 'design_matrices',
    'expense_log', 'fun_quotes', 'messages', 'notebook_entries', 'notebook_entry_participants',
    'notebook_flash', 'notebook_projects', 'outreach_log', 'past_members', 'request_reminders',
    'requests', 'scouting_periods', 'scouting_schedule', 'season_photos', 'season_timeline',
    'suggestions', 'testing_charts', 'testing_rows', 'testing_tables',
    'timeline_cards', 'timeline_comments', 'workshop_gallery', 'workshop_ideas', 'workshops',
    'boards', 'tasks', 'scouting_records', 'match_scouting', 'considered_teams',
    'notifications', 'push_subscriptions', 'apns_tokens', 'interested_teams', 'team_survey_responses'];
begin
  foreach t in array tables loop
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;
    execute format('create policy %I on public.%I for all to authenticated using (true) with check (true)', t || '_authenticated', t);
  end loop;
end $$;

-- Phase 2 rules on the three power tables, as security_privilege_guard.sql
-- left them.
drop policy if exists profiles_read on public.profiles;
drop policy if exists profiles_insert_own on public.profiles;
drop policy if exists profiles_update_own_or_lead on public.profiles;
drop policy if exists profiles_delete_lead on public.profiles;
create policy profiles_read on public.profiles for select to authenticated using (true);
create policy profiles_insert_own on public.profiles for insert to authenticated with check (id = auth.uid() or public.is_app_lead());
create policy profiles_update_own_or_lead on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_app_lead()) with check (id = auth.uid() or public.is_app_lead());
create policy profiles_delete_lead on public.profiles for delete to authenticated using (public.is_app_lead());

drop policy if exists approved_emails_read on public.approved_emails;
drop policy if exists approved_emails_write_lead on public.approved_emails;
create policy approved_emails_read on public.approved_emails for select to authenticated using (true);
create policy approved_emails_write_lead on public.approved_emails for all to authenticated
  using (public.is_app_lead()) with check (public.is_app_lead());

drop policy if exists team_accounts_read on public.team_accounts;
drop policy if exists team_accounts_write_radical_lead on public.team_accounts;
drop policy if exists team_accounts_write_core_lead on public.team_accounts;
create policy team_accounts_read on public.team_accounts for select to authenticated using (true);
create policy team_accounts_write_core_lead on public.team_accounts for all to authenticated
  using (public.is_core_lead()) with check (public.is_core_lead());
