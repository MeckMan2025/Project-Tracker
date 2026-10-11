-- Workshop completions: the "Completed" tab on Workshops.
--
-- WorkshopIdeas.jsx has always read and written this table, but it was never
-- created, so marking a workshop complete showed until the next reload and
-- then vanished. Created here with the same team rules as every other team
-- table (security_team_scope.sql): your team's rows, co-founders read all.
--
-- Needs security_team_scope_prep.sql. Safe to run twice.

create table if not exists public.workshop_completions (
  id             text primary key,
  workshop_id    text not null,
  workshop_title text,
  completed_by   text not null,
  photo_url      text,
  completed_at   timestamptz not null default now(),
  team_number    text
);
create index if not exists workshop_completions_team_idx on public.workshop_completions (team_number);
create index if not exists workshop_completions_by_idx on public.workshop_completions (completed_by);

alter table public.workshop_completions enable row level security;
grant select, insert, update, delete on public.workshop_completions to authenticated;

drop trigger if exists stamp_row_team on public.workshop_completions;
create trigger stamp_row_team before insert on public.workshop_completions
  for each row execute function public.stamp_row_team('team_number');

do $$
declare p record;
  write_rule text := 'coalesce(public.team_key(team_number), ''7196'') = any ((select public.my_teams())::text[])';
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'workshop_completions' loop
    execute format('drop policy %I on public.workshop_completions', p.policyname);
  end loop;
  execute format('create policy workshop_completions_team_read on public.workshop_completions for select to authenticated using ((select public.is_cofounder()) or %s)', write_rule);
  execute format('create policy workshop_completions_team_insert on public.workshop_completions for insert to authenticated with check (%s)', write_rule);
  execute format('create policy workshop_completions_team_update on public.workshop_completions for update to authenticated using (%s) with check (%s)', write_rule, write_rule);
  execute format('create policy workshop_completions_team_delete on public.workshop_completions for delete to authenticated using (%s)', write_rule);
end $$;
