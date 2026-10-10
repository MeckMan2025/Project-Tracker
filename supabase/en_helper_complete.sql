-- EN Helper, part 2: a voice entry must answer every question.
-- Run once in the Supabase SQL editor, after en_helper.sql. Safe to run twice.
--
--   complete     false while a voice entry still has unanswered questions.
--                Every existing row, and every typed entry, is complete: the
--                typed form can't save until it is. An incomplete entry is
--                left out of the notebook attendance rule, so it only wins
--                the meeting back once it's finished.
--   voice_state  which questions the student answered themselves where the
--                column alone can't tell: {"confirmed": ["mentor", ...]}
alter table notebook_entries add column if not exists complete    boolean not null default true;
alter table notebook_entries add column if not exists voice_state jsonb;

create index if not exists notebook_entries_incomplete_idx
  on notebook_entries (username) where complete = false;
