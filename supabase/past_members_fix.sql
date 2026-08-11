-- Fix Past Members archiving.
-- Run in the Supabase SQL Editor (project wqxjmykphkacbjfxmvzd). Safe to re-run.
--
-- WHY: the past_members table exists but its row-level security had no policy
-- allowing inserts, so every archive attempt failed with 42501. The delete flow
-- swallowed that error and removed the account anyway — which is how 20 former
-- members were deleted with no record kept. Deletion now REFUSES to proceed
-- unless the archive row is written, so this must be run for deletion to work
-- at all.

create table if not exists past_members (
  id uuid primary key default gen_random_uuid(),
  original_id uuid,
  display_name text not null,
  function_tags text[] default '{}',
  avatar_url text default '',
  removed_by text,
  removed_at timestamptz default now()
);

alter table past_members enable row level security;

-- Match the permissive policy the rest of this project's tables use.
drop policy if exists "Allow all access to past_members" on past_members;
create policy "Allow all access to past_members" on past_members
  for all using (true) with check (true);

-- Verify: should insert, return the row, then clean itself up.
insert into past_members (display_name, removed_by) values ('__probe__', 'setup');
delete from past_members where display_name = '__probe__';

select 'past_members is writable' as status;
