-- Tag calendar events with the role that owns them.
-- Run in the Supabase SQL Editor (project wqxjmykphkacbjfxmvzd). Safe to re-run.
--
-- NULL = a team-wide event (what leads create, and everything that already
-- exists). A role name means the event belongs to that role — Outreach members
-- can only create events tagged 'Outreach', which is the one thing the role
-- lets them add.
--
-- The dashboard calendar still shows every event regardless of tag; this
-- column governs what a role is allowed to create, not what anyone sees.

alter table calendar_events add column if not exists role text;

-- Handy for the per-role views that come later.
create index if not exists calendar_events_role_idx on calendar_events (role);
