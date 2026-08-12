-- Tasks: who to ask for help. Run once in the Supabase SQL editor.
alter table tasks add column if not exists mentor text default '';
