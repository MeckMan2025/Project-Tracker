-- pit_scouting had no owner and one open policy (USING true): every team's
-- pit visits were readable and writable by every other team. Give it an
-- owner column like match_scouting (team_number is the team that was visited,
-- not whose row it is), stamp it on the way in, and wall it to the owner.
--
-- Every existing row (4 on 2026-11-06) was written by a Radical scout, so they
-- keep owner_team NULL, which is Radical.
alter table public.pit_scouting add column if not exists owner_team text;

do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'pit_scouting' loop
    execute format('drop policy %I on public.pit_scouting', p.policyname);
  end loop;
end $$;

alter table public.pit_scouting enable row level security;

create policy pit_scouting_team_read on public.pit_scouting for select to authenticated
  using ((select public.is_cofounder()) or coalesce(public.team_key(owner_team), '7196') = any ((select public.my_teams())::text[]));
create policy pit_scouting_team_insert on public.pit_scouting for insert to authenticated
  with check (coalesce(public.team_key(owner_team), '7196') = any ((select public.my_teams())::text[]));
create policy pit_scouting_team_update on public.pit_scouting for update to authenticated
  using (coalesce(public.team_key(owner_team), '7196') = any ((select public.my_teams())::text[]))
  with check (coalesce(public.team_key(owner_team), '7196') = any ((select public.my_teams())::text[]));
create policy pit_scouting_team_delete on public.pit_scouting for delete to authenticated
  using (coalesce(public.team_key(owner_team), '7196') = any ((select public.my_teams())::text[]));

drop trigger if exists stamp_row_team on public.pit_scouting;
create trigger stamp_row_team before insert on public.pit_scouting
  for each row execute function public.stamp_row_team('owner_team');
