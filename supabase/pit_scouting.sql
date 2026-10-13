-- Pit scouting: one row per team, per visit.
--
-- Match scouting is a stopwatch; this is a conversation. Almost every column
-- is a choice or a sentence, because there is nothing here to average and
-- putting numbers on an opinion would make it look measured.
--
-- Only the team and the scout are required. You get one pass at a pit and the
-- robot might be in pieces on the bench — a sheet that will not save without an
-- answer about endgame just means somebody invents one.
--
-- team_number is the team being scouted. The team doing the scouting is the
-- team_number column at the bottom, same as every other table: NULL means
-- Radical, and a team only ever sees its own rows.
--
-- Safe to run twice.

create table if not exists pit_scouting (
  id            text primary key,
  team_number   text not null,
  team_name     text,
  scout_name    text,
  visited_at    text,

  drive_train   text,
  main_scoring  text,
  auto_scores   text,
  teleop_scores text,
  endgame_tasks text,

  strengths     text,
  weaknesses    text,

  auto_what         text,
  auto_consistency  text,

  preferred_role       text,
  cycle_speed          text,
  works_around_robots  text,

  reliability     text,
  known_problems  text,

  drive_confidence        text,
  communicated_strategy   text,

  alliance_pick  text,
  alliance_why   text,

  final_notes       text,
  photo_url         text,
  scout_confidence  text,

  scout       text,
  created_at  timestamptz not null default now()
);

-- Whose row this is. The same convention as everywhere else: NULL is Radical.
alter table pit_scouting add column if not exists team_number_owner text;
create index if not exists pit_scouting_owner_idx on pit_scouting (team_number_owner);

-- Looked up by the team being scouted, constantly.
create index if not exists pit_scouting_team_idx on pit_scouting (team_number);

-- Closed to the public internet, like every other table.
alter table pit_scouting enable row level security;
drop policy if exists "pit_scouting_authenticated" on pit_scouting;
create policy "pit_scouting_authenticated" on pit_scouting
  for all to authenticated using (true) with check (true);

select count(*) as rows_so_far from pit_scouting;
