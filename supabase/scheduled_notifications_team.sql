-- Calendar reminders belong to a team.
--
-- scheduled_notifications had no team column, and process-scheduled sent
-- every due reminder to every profile in the app, so a sister team's practice
-- reminder reached Radical's phones (and the other way round). Its policy was
-- also still "any signed-in user may do anything", so one team could cancel
-- another's reminders. Now each reminder carries its team, the function sends
-- it only to that team's people, and the Phase 3 team rules apply.
--
-- Needs security_team_scope_prep.sql (team_key, my_teams, stamp_row_team).
-- Safe to run twice.

alter table public.scheduled_notifications add column if not exists team_number text;
create index if not exists scheduled_notifications_team_idx on public.scheduled_notifications (team_number);

-- Existing rows: the team of the event they remind about, or failing that,
-- the team of whoever scheduled them. NULL stays Radical.
update public.scheduled_notifications s
   set team_number = coalesce(
         (select public.team_key(e.team_number) from public.calendar_events e where e.id = s.event_id),
         (select public.team_key(p.team_number) from public.profiles p where p.id = s.created_by_user_id))
 where public.team_key(s.team_number) is null;

drop trigger if exists stamp_row_team on public.scheduled_notifications;
create trigger stamp_row_team before insert on public.scheduled_notifications
  for each row execute function public.stamp_row_team('team_number');

do $$
declare p record;
  write_rule text := 'coalesce(public.team_key(team_number), ''7196'') = any ((select public.my_teams())::text[])';
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'scheduled_notifications' loop
    execute format('drop policy %I on public.scheduled_notifications', p.policyname);
  end loop;
  execute format('create policy scheduled_notifications_team_read on public.scheduled_notifications for select to authenticated using ((select public.is_cofounder()) or %s)', write_rule);
  execute format('create policy scheduled_notifications_team_insert on public.scheduled_notifications for insert to authenticated with check (%s)', write_rule);
  execute format('create policy scheduled_notifications_team_update on public.scheduled_notifications for update to authenticated using (%s) with check (%s)', write_rule, write_rule);
  execute format('create policy scheduled_notifications_team_delete on public.scheduled_notifications for delete to authenticated using (%s)', write_rule);
end $$;
