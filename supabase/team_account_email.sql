-- A real email on a team account. Run once in the Supabase SQL editor.
--
-- Team accounts were created as team<number>@teams.radical, which is not a
-- real address. That meant the team could never be told what their login
-- was, could never reset their own password, and had nothing to put in the
-- email box at sign-in — a lead had to reset it for them every time.
--
-- New teams are created with a real address and sign in with it. Nullable, so
-- the teams added before this keep working: sign-in falls back to the team
-- number when the address doesn't match, which is exactly their case.

alter table team_accounts add column if not exists email text;
