-- Undo security_person_rules.sql in one paste, if a per-person rule ever
-- blocks something real and it can't wait for a fix.
--
-- Puts back the Phase 3 write rules (any member may write their own team's
-- rows) and removes the attendance and task guards. Keeps the helper
-- functions and the rename cascade: they only make data more correct.

do $$
declare
  r record;
  team text;
  s text;
begin
  for r in select * from (values
      ('notebook_entries', 'team_number'), ('absence_notices', 'team_number'), ('expense_log', 'team_number'),
      ('outreach_log', 'team_number'), ('workshop_gallery', 'team_number'), ('season_photos', 'team_number'),
      ('workshop_completions', 'team_number'), ('workshops', 'team_number'), ('daily_pulse', 'team_number'),
      ('calendar_birthday_reactions', 'team_number'), ('announcement_votes', 'team_number'),
      ('requests', 'team_number'), ('request_reminders', 'team_number'), ('attendance_records', 'team_number'),
      ('tasks', 'owner_team'), ('boards', 'owner_team'), ('fun_quotes', 'team_number'),
      ('suggestions', 'team_number'), ('match_scouting', 'owner_team'), ('calendar_events', 'team_number'),
      ('notebook_projects', 'team_number'), ('notebook_flash', 'team_number'),
      ('notebook_entry_participants', 'team_number'), ('attendance_sessions', 'team_number'),
      ('scouting_periods', 'team_number'), ('comp_day_assignments', 'team_number'),
      ('comp_day_blocks', 'team_number'), ('comp_day_sessions', 'team_number'),
      ('cleanup_assignments', 'team_number'), ('cleanup_exemptions', 'team_number'),
      ('cleanup_jobs', 'team_number'), ('cleanup_sessions', 'team_number'),
      ('announcements', 'team_number'), ('considered_teams', 'owner_team')) v(t, col) loop
    foreach s in array array['_person_insert', '_person_update', '_person_delete',
                             '_team_insert', '_team_update', '_team_delete'] loop
      execute format('drop policy if exists %I on public.%I', r.t || s, r.t);
    end loop;
    team := format('coalesce(public.team_key(%I), ''7196'') = any ((select public.my_teams())::text[])', r.col);
    execute format('create policy %I on public.%I for insert to authenticated with check (%s)', r.t || '_team_insert', r.t, team);
    execute format('create policy %I on public.%I for update to authenticated using (%s) with check (%s)', r.t || '_team_update', r.t, team, team);
    execute format('create policy %I on public.%I for delete to authenticated using (%s)', r.t || '_team_delete', r.t, team);
  end loop;
end $$;

drop trigger if exists attendance_guard on public.attendance_records;
drop trigger if exists tasks_guard on public.tasks;
