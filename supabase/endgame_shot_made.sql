-- Endgame shot and made, counted like auto and teleop.
-- Run once in the Supabase SQL editor. Safe to run twice.
alter table match_scouting add column if not exists endgame_shot integer;
alter table match_scouting add column if not exists endgame_made integer;
