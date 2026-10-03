-- Evidence signals on notebook entries. Run once in the Supabase SQL editor.
--
-- Three additive columns, all nullable. Entries written before this have NULL
-- in all three and keep working exactly as they did — nothing is backfilled,
-- because an older entry genuinely has no answer to these questions and
-- inventing one would be worse than leaving it empty.
--
--   signals      which of the eight things happened, e.g. {tested,help}
--   signal_data  the follow-up answers, keyed by signal:
--                  {"tested": {"what": "...", "outcome": "It partly worked"}}
--   next_step    what should happen next meeting
--
-- signals is a text[] rather than a column per signal so a ninth signal needs
-- no migration, and signal_data is jsonb for the same reason: the shape of the
-- questions is defined in the app (src/data/notebookSignals.js), which is the
-- one place that has to change when the questions change.

alter table notebook_entries add column if not exists signals     text[];
alter table notebook_entries add column if not exists signal_data jsonb;
alter table notebook_entries add column if not exists next_step   text;

-- "How many testing moments this season" is a containment query, which is what
-- GIN indexes are for. Worth having before the dashboard starts asking.
create index if not exists notebook_entries_signals_idx
  on notebook_entries using gin (signals);
