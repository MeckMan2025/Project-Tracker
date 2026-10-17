-- Hive tips in auto, counted like the teleop ones.
-- Run once in the Supabase SQL editor. Safe to run twice.
alter table match_scouting add column if not exists auto_tips integer;
