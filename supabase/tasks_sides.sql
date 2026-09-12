-- Tasks: giving one task to several people and to several sides of the team.
-- Run once in the Supabase SQL editor.
--
-- sides: which sides the task was given to — 'business', 'hardware', 'software'.
--   Empty means it was not given to a side, and it stays on the one board it was
--   made on (board_id) exactly as before. When sides are set, the task shows on
--   each of those sides' boards — one row, so moving it from 25% to 50% moves it
--   on every one of them at the same time.
--
--   This is deliberately separate from board_id: "sits on a board" and "was given
--   to that side" are different things, and only the second should put a task in
--   someone's My Tasks.
--
-- assignees: everyone the task is on. assignee is kept as the first of them so
--   the older screens and queries that read a single name still work.

alter table tasks add column if not exists sides text[] default '{}';
alter table tasks add column if not exists assignees text[] default '{}';

-- Everything that exists today is on exactly the one person it already had.
update tasks
   set assignees = array[assignee]
 where (assignees is null or assignees = '{}')
   and assignee is not null
   and assignee <> '';
