-- Season Timeline shared state
-- Run this once in the Supabase SQL Editor (project wqxjmykphkacbjfxmvzd) to enable
-- team-wide syncing of the season timeline. Until it's run, the timeline saves
-- locally in each browser only.

create table if not exists season_timeline (
  id            text primary key default 'default',
  current_stage integer not null default 0,
  checked       jsonb   not null default '{}'::jsonb,
  updated_at    timestamptz default now(),
  updated_by    text
);

-- Seed the single shared row
insert into season_timeline (id, current_stage, checked)
values ('default', 0, '{}'::jsonb)
on conflict (id) do nothing;

-- Row Level Security: allow the app (anon key) to read + write, matching the
-- rest of this project's tables.
alter table season_timeline enable row level security;

drop policy if exists "season_timeline_all" on season_timeline;
create policy "season_timeline_all" on season_timeline
  for all using (true) with check (true);

-- Optional: enable realtime so every device updates live when a stage advances
-- or an item is checked. (Safe to run even if already added.)
do $$
begin
  begin
    alter publication supabase_realtime add table season_timeline;
  exception when others then
    null;
  end;
end $$;
