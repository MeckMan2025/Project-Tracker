-- Who Team Chat lists: Radical, and every team that has signed up for an
-- account — never a testing account. A team that signs up appears on its own.
--
-- is_test marks the accounts used to try ETS out (123456 on 2026-11-06); they
-- are left off the list and can neither send nor receive team messages.
alter table public.team_accounts add column if not exists is_test boolean not null default false;
update public.team_accounts set is_test = true where team_number in ('123456');

-- Numbers and names only, so any signed-in person can see who they can talk to.
create or replace function public.chat_teams()
returns table (team_number text, team_name text)
language sql
stable
security definer
set search_path = public
as $$
  -- Radical first, then teams in the order they signed up.
  select team_number, team_name from (
    select '7196'::text as team_number, 'Everything That''s Radical'::text as team_name, '-infinity'::timestamptz as joined
    union all
    (select distinct on (public.team_key(ta.team_number)) public.team_key(ta.team_number), coalesce(nullif(ta.team_name, ''), ''), ta.created_at
       from public.team_accounts ta
      where not ta.is_test and public.team_key(ta.team_number) is not null
      order by public.team_key(ta.team_number), ta.created_at)
  ) t
  order by joined
$$;
revoke all on function public.chat_teams() from public;
grant execute on function public.chat_teams() to authenticated;

-- Team messages only between teams on that list.
drop policy if exists team_messages_send on public.team_messages;
create policy team_messages_send on public.team_messages for insert to authenticated
  with check (from_team = any ((select public.my_teams())::text[])
              and from_team in (select c.team_number from public.chat_teams() c)
              and to_team in (select c.team_number from public.chat_teams() c));
