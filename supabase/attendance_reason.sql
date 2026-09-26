-- Why someone was gone. Run once in the Supabase SQL editor.
--
-- An absence with no reason attached is a number nobody can do anything with,
-- and the reason ends up in somebody's memory or a text message. When a notice
-- was filed the reason comes from there; this column is for the rest, so a lead
-- can write down what they were told.

alter table attendance_records add column if not exists reason text default '';
