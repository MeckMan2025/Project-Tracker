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
