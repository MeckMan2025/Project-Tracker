-- Competition Day modes: what the Pit, Drive Team and Media screens share
-- during a day. One row per thing said: a robot status, a pit issue, a shot
-- taken, a drive note, a match marked played. Read and written by any
-- signed-in member, like the other comp_day tables.
create table if not exists public.comp_day_notes (
  id          uuid primary key default gen_random_uuid(),
  session_id  text not null,
  kind        text not null,          -- status / issue / shot / drive / played
  match       text,
  body        text,
  data        jsonb not null default '{}'::jsonb,
  author      text,
  team_number text,
  created_at  timestamptz not null default now()
);
create index if not exists comp_day_notes_session on public.comp_day_notes (session_id, created_at desc);
alter table public.comp_day_notes enable row level security;
drop policy if exists "comp_day_notes_authenticated" on public.comp_day_notes;
create policy "comp_day_notes_authenticated" on public.comp_day_notes for all to authenticated using (true) with check (true);
