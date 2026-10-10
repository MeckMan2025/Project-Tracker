-- Has this expense been copied into the spreadsheet yet?
--
-- The log and the finance spreadsheet are kept separately, so somebody has to
-- carry each row across — and with nothing recording that, the only way to
-- know what had been done was to remember, or to check every line against the
-- sheet. Two people doing it ends in double entries; nobody doing it ends in a
-- missing one.
--
-- Who and when as well as whether: "it says it was added" is worth less than
-- "Lily added it on Tuesday" when the sheet and the log disagree.
--
-- Safe to run twice. Nothing is deleted, and every existing row starts as not
-- yet added, which is the honest answer for rows nobody has marked.

alter table expense_log add column if not exists in_spreadsheet boolean not null default false;
alter table expense_log add column if not exists spreadsheet_by text;
alter table expense_log add column if not exists spreadsheet_at timestamptz;

-- The log is read in date order and filtered on this, so it earns an index.
create index if not exists expense_log_in_spreadsheet_idx on expense_log (in_spreadsheet);

-- What this changed: every row present, none marked.
select in_spreadsheet, count(*) from expense_log group by in_spreadsheet;
