-- Tasks: who created/assigned the task. Run once in the Supabase SQL editor.
alter table tasks add column if not exists assigned_by text default '';
