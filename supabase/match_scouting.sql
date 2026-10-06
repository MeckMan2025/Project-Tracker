-- Match scouting. Run once in the Supabase SQL editor.
--
-- One row per team per match. Everything is nullable except the two columns
-- that identify the row: a scout who did not see something leaves it blank,
-- and a blank is skipped when averaging rather than counted as zero — a guess
-- is worse than a gap, and a zero drags a team's average down for no reason.
--
-- The columns mirror src/data/scoutingFields.js, which draws the form, the
-- tables and the CSV. Adding a field means adding it there and adding one
-- column here.

create table if not exists match_scouting (
  id                  text primary key,
  scout               text,

  -- Match
  team_number         text not null,
  match_number        text not null,
  start_position      text,          -- Left / Middle / Right / Other

  -- Autonomous
  auto_scored         numeric,
  auto_missed         numeric,
  auto_reliability    integer,       -- 0-3

  -- Teleop
  teleop_scored       numeric,
  teleop_missed       numeric,
  cycle_count         numeric,
  avg_cycle_sec       numeric,

  -- Defense
  defense             text,          -- None / Some / Strong
  defense_resistance  integer,       -- 1-5

  -- Endgame
  endgame             text,          -- Not attempted / Attempted / Successful / Failed

  -- Ratings, 1-5
  robot_speed         integer,
  driver_skill        integer,
  consistency         integer,

  -- Problems
  penalties           numeric,
  penalty_severity    text,          -- None / Minor / Major
  breakdowns          text,          -- None / Minor / Major

  comments            text,
  created_at          timestamptz not null default now()
);

-- "Everything for team X" and "everything in match Y" are the two questions
-- this table exists to answer.
create index if not exists match_scouting_team_idx  on match_scouting (team_number);
create index if not exists match_scouting_match_idx on match_scouting (match_number);
