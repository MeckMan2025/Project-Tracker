-- Team chat: one team talking to another, as the team. There is no person on
-- a message at all — only which team sent it and which team it is for — so a
-- message is never anyone's but the team's.
--
-- A conversation is between exactly two teams. Only those two can read it,
-- only a team can send as itself, and only to a team that is on ETS.
-- Radical is '7196', as my_teams() spells it.
create table if not exists public.team_messages (
  id          uuid primary key default gen_random_uuid(),
  from_team   text not null,
  to_team     text not null,
  body        text not null check (char_length(body) between 1 and 1000),
  created_at  timestamptz not null default now(),
  check (from_team <> to_team)
);
create index if not exists team_messages_pair on public.team_messages (least(from_team, to_team), greatest(from_team, to_team), created_at);

alter table public.team_messages enable row level security;

drop policy if exists team_messages_read on public.team_messages;
create policy team_messages_read on public.team_messages for select to authenticated
  using (from_team = any ((select public.my_teams())::text[]) or to_team = any ((select public.my_teams())::text[]));

drop policy if exists team_messages_send on public.team_messages;
create policy team_messages_send on public.team_messages for insert to authenticated
  with check (from_team = any ((select public.my_teams())::text[]) and public.team_on_ets(to_team));

-- A team can take back what it sent.
drop policy if exists team_messages_unsend on public.team_messages;
create policy team_messages_unsend on public.team_messages for delete to authenticated
  using (from_team = any ((select public.my_teams())::text[]));

-- Alliance chat speaks for the team too: no names on it either.
update public.alliance_chat set author = '' where author <> '';
drop policy if exists alliance_chat_write on public.alliance_chat;
create policy alliance_chat_write on public.alliance_chat for insert to authenticated
  with check (from_team = any ((select public.my_teams())::text[]) and author = '');
drop policy if exists alliance_chat_delete on public.alliance_chat;
create policy alliance_chat_delete on public.alliance_chat for delete to authenticated
  using (from_team = any ((select public.my_teams())::text[]));
