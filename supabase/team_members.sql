-- Visiting teams get their own members and one person who runs them.
-- Run once in the Supabase SQL editor.
--
-- WHO BELONGS TO WHICH TEAM
-- profiles.team_number says which team a person is on. NULL or '7196' is
-- Radical; anything else is a visiting team. Plain text rather than a foreign
-- key, because a team row can be deleted and a profile should not vanish with
-- it — an orphaned member is something to look at, not something to lose.
--
-- WHO RUNS A TEAM
-- team_accounts.user_id is the controller: the account created when a lead
-- adds the team. They can add and remove members of their own team and nobody
-- else's. Exactly one per team, which is why it lives on the team row rather
-- than as a tag on a profile.
--
-- DELIBERATELY NOT HERE
-- No team column on notebook_entries, attendance, or tasks yet. Visiting teams
-- do not get those features, and adding a column that nothing filters on is
-- how a leak gets built in advance.

alter table profiles      add column if not exists team_number text;
alter table team_accounts add column if not exists email       text;

-- "Everyone on team X" is the query this exists to answer.
create index if not exists profiles_team_idx on profiles (team_number);

-- Everything that exists now is Radical's and stays NULL, which already means
-- "ours" everywhere in the app. Stamping 37 profiles with 7196 to say the same
-- thing is a migration that can only go wrong.
