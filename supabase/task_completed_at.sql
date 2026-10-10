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
