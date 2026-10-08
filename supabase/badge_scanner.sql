-- Badge scanner: a USB scanner at the door as one more way to be present.
-- Run once in the Supabase SQL editor, before the app change goes live.
--
-- The scanner types a badge number and presses Enter, exactly like a keyboard.
-- Each person gets a badge number we assign; scanning it marks them present
-- for today and records when, in the form Th10/08/2026|17:17 (Central time).
-- The existing ways of being present are untouched — this sits beside them.

-- ── 1. Whose badge is this ──────────────────────────────────────────────────
alter table profiles add column if not exists badge_id text;

-- One badge, one person — per team. nulls not distinct keeps NULL (Radical)
-- counting as a team, the same rule as attendance_sessions_one_per_day.
create unique index if not exists profiles_badge_one_each
  on profiles (badge_id, team_number) nulls not distinct
  where badge_id is not null;

-- ── 2. Did they scan in ─────────────────────────────────────────────────────
-- Empty means not scanned. The first scan of the day wins; later scans leave
-- it alone.
alter table attendance_records add column if not exists badge_scan text;
