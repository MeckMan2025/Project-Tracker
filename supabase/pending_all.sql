-- ETS — four pending migrations, in one go. Run top to bottom.
--
-- All four only ADD things: new columns, new indexes, and one backfill that
-- fills in blanks. Nothing is dropped, nothing is deleted, and no value that
-- already exists is overwritten. Safe to run twice.
--
-- Each section ends with a small check, so you should get four result tables
-- back — one per migration.
--
-- Supabase will warn about "destructive operations" because the text contains
-- ALTER. There is no delete, no drop and no truncate anywhere in this file.


-- ==========================================================================
-- Expense log: has this row reached the finance spreadsheet?
--   (supabase/expense_spreadsheet.sql)
-- ==========================================================================

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


-- ==========================================================================
-- Mentors and coaches: one login, more than one team
--   (supabase/extra_teams.sql)
-- ==========================================================================

-- One login, more than one team.
--
-- Signing in checks the team number typed against the team on your profile,
-- which is what stops somebody taken off a roster carrying on as if they were
-- still on it. That rule assumes one person belongs to one team.
--
-- Mentors and coaches do not. The same adults help Radical and Prime Suspects,
-- and they should not need a second account and a second password to do it.
--
-- So: the teams a person may ALSO sign in to. Their profile still names their
-- own team; this is the list of others they are allowed to enter, and signing
-- in with one of those numbers puts them on that team for the session. Empty
-- or null for everybody else, which leaves the one-person-one-team rule exactly
-- as it was for students.
--
-- Safe to run twice. Nothing is deleted and no existing value changes.

alter table profiles add column if not exists extra_teams text[];

-- Asked on every sign-in.
create index if not exists profiles_extra_teams_idx on profiles using gin (extra_teams);

-- Radical's mentors and coaches can also work on Prime Suspects (38350).
-- By tag, so this stays right as people come and go rather than naming names.
update profiles
set extra_teams = array['38350']
where team_number is null
  and function_tags && array['Mentor', 'Coach']
  and not (function_tags @> array['Team']);

-- Who this just gave a second team to.
select display_name, function_tags, extra_teams
from profiles
where extra_teams is not null and array_length(extra_teams, 1) > 0
order by display_name;


-- ==========================================================================
-- Tasks: when was it finished?
--   (supabase/task_completed_at.sql)
-- ==========================================================================

-- When a task was finished.
--
-- status told you a task was done but never when, so "what did we get through
-- in October" had no answer and a task completed in September looked the same
-- as one completed this morning.
--
-- Nullable on purpose. Existing completed tasks get NULL rather than a guess:
-- we genuinely do not know when they were finished, and inventing a date would
-- make the record look precise when it is not.
--
-- Safe to run twice. Nothing is deleted and no existing value changes.

alter table tasks add column if not exists completed_at timestamptz;

-- Asked for by date range whenever anyone looks at what got done.
create index if not exists tasks_completed_at_idx on tasks (completed_at);

-- What this changed: every existing task keeps its status; none gets a date.
select status, count(*) as tasks, count(completed_at) as with_a_date
from tasks
group by status
order by count(*) desc;


-- ==========================================================================
-- Tasks: whose task is this?
--   (supabase/task_owner_team.sql)
-- ==========================================================================

-- Tasks need to know whose they are. Run once in the Supabase SQL editor.
--
-- Boards have carried owner_team for a while; tasks never did. That meant the
-- only way to know whether a task belonged to a visiting team was to look up
-- its board, which the app could do when FETCHING but not when subscribing to
-- live changes — so every task change was broadcast to every browser, and the
-- screen simply declined to draw the ones it did not recognise.
--
-- With the column here, both the fetch and the subscription can be filtered on
-- the server, and a team's tasks never leave the server for anyone else's
-- browser.
--
-- NULL means Radical, matching how boards already read: every task written
-- before this is ours, which is true.

alter table tasks add column if not exists owner_team text;

-- Backfill from the board each task sits on, so existing visiting-team tasks
-- are labelled correctly rather than reading as ours.
update tasks t
set owner_team = b.owner_team
from boards b
where t.board_id = b.id
  and b.owner_team is not null
  and t.owner_team is null;

create index if not exists tasks_owner_team_idx on tasks (owner_team);
