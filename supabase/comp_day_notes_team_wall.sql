-- comp_day_notes was open to every signed-in user of every team (one policy,
-- USING true). Wall it to the writer's own team like every other table, and
-- stamp the team on the way in so a note can never land unowned.
drop policy if exists comp_day_notes_authenticated on public.comp_day_notes;

create policy comp_day_notes_team_read on public.comp_day_notes for select to authenticated
  using ((select public.is_cofounder()) or coalesce(public.team_key(team_number), '7196') = any ((select public.my_teams())::text[]));
create policy comp_day_notes_team_insert on public.comp_day_notes for insert to authenticated
  with check (coalesce(public.team_key(team_number), '7196') = any ((select public.my_teams())::text[]));
create policy comp_day_notes_team_update on public.comp_day_notes for update to authenticated
  using (coalesce(public.team_key(team_number), '7196') = any ((select public.my_teams())::text[]))
  with check (coalesce(public.team_key(team_number), '7196') = any ((select public.my_teams())::text[]));
create policy comp_day_notes_team_delete on public.comp_day_notes for delete to authenticated
  using (coalesce(public.team_key(team_number), '7196') = any ((select public.my_teams())::text[]));

drop trigger if exists stamp_row_team on public.comp_day_notes;
create trigger stamp_row_team before insert on public.comp_day_notes
  for each row execute function public.stamp_row_team('team_number');
