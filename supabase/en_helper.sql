-- EN Helper: voice notebook entries. Run once in the Supabase SQL editor.
-- Safe to run twice. Nothing is deleted and no existing value changes.
--
-- Until this runs, the EN Helper shows "not switched on yet" and the main app
-- hides its install card, so merging the app code first is harmless.
--
-- Full setup, in order, is in project-tracker/EN_HELPER.md. This file is
-- step 1. Step 4 (the 15 minute schedule) is the block at the bottom, run
-- separately once the function is deployed.

-- ── 1. Voice entries live in notebook_entries like every other entry ──────
-- A voice entry is an ordinary row, so the list, the book, the dashboards and
-- the notebook attendance rule all see it with no change. These columns hold
-- what only a voice entry has.
--
--   source         'typed' or 'voice'. Every existing row is typed.
--   transcript     what the student said, word for word (Whisper)
--   polished       the AI's notebook-ready version of it
--   ai_status      pending -> working -> done | failed | empty
--   ai_attempts    how many times processing has been tried (gives up at 5)
--   ai_error       the last failure, for whoever is debugging
--   ai_updated_at  when ai_status last changed, so a stuck 'working' is noticed
--   audio_path     where the clip waits in storage. Cleared once it is
--                  transcribed, because the clip is deleted then.
alter table notebook_entries add column if not exists source        text default 'typed';
alter table notebook_entries add column if not exists transcript    text;
alter table notebook_entries add column if not exists polished      text;
alter table notebook_entries add column if not exists ai_status     text;
alter table notebook_entries add column if not exists ai_attempts   int  default 0;
alter table notebook_entries add column if not exists ai_error      text;
alter table notebook_entries add column if not exists ai_updated_at timestamptz;
alter table notebook_entries add column if not exists audio_path    text;

-- The retry job looks for unfinished voice entries every 15 minutes.
create index if not exists notebook_entries_ai_status_idx
  on notebook_entries (ai_status)
  where ai_status is not null and ai_status not in ('done', 'empty');

-- ── 2. Where clips wait to be transcribed ─────────────────────────────────
-- Private: a recording is a student's voice, so nobody reads it back through
-- the API. Only the notebook-voice function (service role) downloads it, and
-- it deletes the clip as soon as the transcript is saved.
insert into storage.buckets (id, name, public)
values ('notebook-audio', 'notebook-audio', false)
on conflict (id) do update set public = false;

drop policy if exists "signed-in members add a notebook clip" on storage.objects;
create policy "signed-in members add a notebook clip"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'notebook-audio');

-- ── 3. One reminder per student per meeting ───────────────────────────────
-- The function writes a row here before it sends, and the unique key is what
-- stops a second push for the same meeting, however often the job runs.
-- RLS on with no policy: only the function (service role) touches it.
create table if not exists notebook_reminders (
  id           bigserial primary key,
  session_id   text not null,
  username     text not null,
  meeting_date text not null,
  team_number  text,
  sent_at      timestamptz default now(),
  unique (session_id, username)
);
alter table notebook_reminders enable row level security;

-- ── 4. Which home-screen app a push subscription belongs to ───────────────
-- On a phone, EN Helper and the main app are two apps with two
-- subscriptions. Reminders go to EN Helper's when there is one; everything
-- else (tasks, chat, calendar) goes only to the main app's, so EN Helper never
-- buzzes about anything but the notebook. Existing rows are the main app.
alter table push_subscriptions add column if not exists app text default 'main';


-- ══════════════════════════════════════════════════════════════════════════
-- STEP 4, run separately AFTER the notebook-voice function is deployed and
-- its CRON_SECRET is set (see EN_HELPER.md). Replace the one placeholder with
-- that same secret. Every 15 minutes this sends end-of-meeting reminders and
-- retries any voice entry the AI hasn't finished.
-- ══════════════════════════════════════════════════════════════════════════
--
-- create extension if not exists pg_cron;
-- create extension if not exists pg_net;
--
-- select cron.unschedule('en-helper-tick')
-- where exists (select 1 from cron.job where jobname = 'en-helper-tick');
--
-- select cron.schedule(
--   'en-helper-tick',
--   '*/15 * * * *',
--   $$
--   select net.http_post(
--     url     := 'https://wqxjmykphkacbjfxmvzd.supabase.co/functions/v1/notebook-voice',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'x-cron-secret', 'PASTE_CRON_SECRET_HERE'
--     ),
--     body    := '{"action":"tick"}'::jsonb
--   );
--   $$
-- );
