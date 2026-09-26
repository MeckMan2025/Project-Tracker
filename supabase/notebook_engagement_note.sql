-- Why someone felt as engaged as they said. Run once in the Supabase SQL editor.
--
-- The engagement level on its own says a meeting went badly but not what went
-- wrong, which is the part worth acting on. This is that sentence.

alter table notebook_entries add column if not exists engagement_note text default '';
