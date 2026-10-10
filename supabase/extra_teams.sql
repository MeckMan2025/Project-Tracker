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
