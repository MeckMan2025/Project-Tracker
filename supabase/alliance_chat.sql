-- Alliance chat: strategy between the two teams on one alliance in one match.
--
-- The one place two teams share anything, so the wall is drawn tightly:
-- a message belongs to exactly one alliance (date + match + the two team
-- numbers), and only those two teams can read it or write to it. Opponents,
-- and every other team, see nothing. Radical is '7196' here, as my_teams()
-- spells it.
create table if not exists public.alliance_chat (
  id          uuid primary key default gen_random_uuid(),
  event_date  date not null,
  match       text not null,
  team_a      text not null,          -- the lower team number of the pair
  team_b      text not null,          -- the higher
  from_team   text not null,
  author      text not null default '',
  body        text not null check (char_length(body) between 1 and 500),
  created_at  timestamptz not null default now(),
  check (team_a < team_b),
  check (from_team in (team_a, team_b))
);
create index if not exists alliance_chat_pair on public.alliance_chat (event_date, match, team_a, team_b, created_at);

alter table public.alliance_chat enable row level security;

drop policy if exists alliance_chat_read on public.alliance_chat;
create policy alliance_chat_read on public.alliance_chat for select to authenticated
  using (team_a = any ((select public.my_teams())::text[]) or team_b = any ((select public.my_teams())::text[]));

drop policy if exists alliance_chat_write on public.alliance_chat;
create policy alliance_chat_write on public.alliance_chat for insert to authenticated
  with check (from_team = any ((select public.my_teams())::text[])
              and author = coalesce((select public.my_name()), ''));

-- A team takes back its own messages only.
drop policy if exists alliance_chat_delete on public.alliance_chat;
create policy alliance_chat_delete on public.alliance_chat for delete to authenticated
  using (from_team = any ((select public.my_teams())::text[]) and author = coalesce((select public.my_name()), ''));

-- Whether a team number is on ETS at all, so the chat can say "they can't see
-- this yet" instead of leaving a partner silently out. Says yes or no, nothing
-- more about the team.
create or replace function public.team_on_ets(t text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.team_key(t), '7196') = '7196'
      or exists (select 1 from public.profiles p where public.team_key(p.team_number) = public.team_key(t))
      or exists (select 1 from public.team_accounts a where public.team_key(a.team_number) = public.team_key(t))
$$;
revoke all on function public.team_on_ets(text) from public;
grant execute on function public.team_on_ets(text) to authenticated;
