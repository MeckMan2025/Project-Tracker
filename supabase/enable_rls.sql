-- Close the database to the public internet. Run once, top to bottom.
--
-- Supabase's advisor was right and it was not one table. Probed with the key
-- out of our own JavaScript bundle: all 43 tables readable, 41 of them
-- writable and deletable by anyone holding the project URL. That is every
-- student profile and email address, every notebook entry, every attendance
-- record, open to anyone who viewed source.
--
-- The key is public by design — it ships in the page. What was missing is Row
-- Level Security, which is what makes the database care WHO is asking rather
-- than only which project they are asking about.
--
-- This turns it on for every table and allows signed-in accounts through.
-- After this, somebody holding the public key and no account can do nothing
-- at all. It is authentication, not yet per-team authorisation: a signed-in
-- member could still craft a request for another team's rows. Every account
-- here is one you issued, so that is a far smaller problem than the open
-- internet, and it is the next step rather than this one.
--
-- The app was changed first so every request now carries the signed-in user's
-- own token. Without that commit deployed, this migration would lock the app
-- out of its own data.

-- ── 1. Signing up, without publishing the invite list ───────────────────────
-- Checking whether an email is approved happens before that person has an
-- account, so it cannot require being signed in. Reading the table directly
-- would mean leaving every invited address public, which is the sort of thing
-- this migration exists to stop.
--
-- A function instead: ask about one address, get back that address's role or
-- nothing. The list itself stays private. security definer lets it read the
-- table that the caller cannot.

create or replace function public.check_approved_email(p_email text)
returns text
language sql
security definer
set search_path = public
as $$
  select role
  from approved_emails
  where lower(email) = lower(trim(p_email))
  limit 1;
$$;

revoke all on function public.check_approved_email(text) from public;
grant execute on function public.check_approved_email(text) to anon, authenticated;

-- ── 2. The profile row a new account needs ─────────────────────────────────
-- Signing up creates the login, then the app writes the profile. Depending on
-- whether email confirmation is on, that write can happen before a session
-- exists — so it has to be allowed without one, or nobody can register.
--
-- Allowed, but only exactly that: a profile for a login that genuinely exists
-- and does not have one yet. Not a free hand to write rows.

create or replace function public.is_new_account(p_id uuid)
returns boolean
language sql
security definer
set search_path = public, auth
as $$
  select exists (select 1 from auth.users u where u.id = p_id)
     and not exists (select 1 from public.profiles p where p.id = p_id);
$$;

revoke all on function public.is_new_account(uuid) from public;
grant execute on function public.is_new_account(uuid) to anon, authenticated;

-- ── 3. Row Level Security on, signed-in accounts allowed ───────────────────
-- One policy per table. "to authenticated" is the whole point: the anon role
-- is simply not named, so a request carrying only the public key matches no
-- policy and gets nothing.

alter table absence_notices enable row level security;
drop policy if exists "absence_notices_authenticated" on absence_notices;
create policy "absence_notices_authenticated" on absence_notices
  for all to authenticated using (true) with check (true);
alter table alliance_hubs enable row level security;
drop policy if exists "alliance_hubs_authenticated" on alliance_hubs;
create policy "alliance_hubs_authenticated" on alliance_hubs
  for all to authenticated using (true) with check (true);
alter table announcement_votes enable row level security;
drop policy if exists "announcement_votes_authenticated" on announcement_votes;
create policy "announcement_votes_authenticated" on announcement_votes
  for all to authenticated using (true) with check (true);
alter table announcements enable row level security;
drop policy if exists "announcements_authenticated" on announcements;
create policy "announcements_authenticated" on announcements
  for all to authenticated using (true) with check (true);
alter table apns_tokens enable row level security;
drop policy if exists "apns_tokens_authenticated" on apns_tokens;
create policy "apns_tokens_authenticated" on apns_tokens
  for all to authenticated using (true) with check (true);
alter table approved_emails enable row level security;
drop policy if exists "approved_emails_authenticated" on approved_emails;
create policy "approved_emails_authenticated" on approved_emails
  for all to authenticated using (true) with check (true);
alter table attendance_records enable row level security;
drop policy if exists "attendance_records_authenticated" on attendance_records;
create policy "attendance_records_authenticated" on attendance_records
  for all to authenticated using (true) with check (true);
alter table attendance_sessions enable row level security;
drop policy if exists "attendance_sessions_authenticated" on attendance_sessions;
create policy "attendance_sessions_authenticated" on attendance_sessions
  for all to authenticated using (true) with check (true);
alter table boards enable row level security;
drop policy if exists "boards_authenticated" on boards;
create policy "boards_authenticated" on boards
  for all to authenticated using (true) with check (true);
alter table calendar_birthday_reactions enable row level security;
drop policy if exists "calendar_birthday_reactions_authenticated" on calendar_birthday_reactions;
create policy "calendar_birthday_reactions_authenticated" on calendar_birthday_reactions
  for all to authenticated using (true) with check (true);
alter table calendar_events enable row level security;
drop policy if exists "calendar_events_authenticated" on calendar_events;
create policy "calendar_events_authenticated" on calendar_events
  for all to authenticated using (true) with check (true);
alter table cleanup_assignments enable row level security;
drop policy if exists "cleanup_assignments_authenticated" on cleanup_assignments;
create policy "cleanup_assignments_authenticated" on cleanup_assignments
  for all to authenticated using (true) with check (true);
alter table comp_day_assignments enable row level security;
drop policy if exists "comp_day_assignments_authenticated" on comp_day_assignments;
create policy "comp_day_assignments_authenticated" on comp_day_assignments
  for all to authenticated using (true) with check (true);
alter table comp_day_blocks enable row level security;
drop policy if exists "comp_day_blocks_authenticated" on comp_day_blocks;
create policy "comp_day_blocks_authenticated" on comp_day_blocks
  for all to authenticated using (true) with check (true);
alter table comp_day_sessions enable row level security;
drop policy if exists "comp_day_sessions_authenticated" on comp_day_sessions;
create policy "comp_day_sessions_authenticated" on comp_day_sessions
  for all to authenticated using (true) with check (true);
alter table daily_pulse enable row level security;
drop policy if exists "daily_pulse_authenticated" on daily_pulse;
create policy "daily_pulse_authenticated" on daily_pulse
  for all to authenticated using (true) with check (true);
alter table design_matrices enable row level security;
drop policy if exists "design_matrices_authenticated" on design_matrices;
create policy "design_matrices_authenticated" on design_matrices
  for all to authenticated using (true) with check (true);
alter table expense_log enable row level security;
drop policy if exists "expense_log_authenticated" on expense_log;
create policy "expense_log_authenticated" on expense_log
  for all to authenticated using (true) with check (true);
alter table fun_quotes enable row level security;
drop policy if exists "fun_quotes_authenticated" on fun_quotes;
create policy "fun_quotes_authenticated" on fun_quotes
  for all to authenticated using (true) with check (true);
alter table interested_teams enable row level security;
drop policy if exists "interested_teams_authenticated" on interested_teams;
create policy "interested_teams_authenticated" on interested_teams
  for all to authenticated using (true) with check (true);
alter table match_scouting enable row level security;
drop policy if exists "match_scouting_authenticated" on match_scouting;
create policy "match_scouting_authenticated" on match_scouting
  for all to authenticated using (true) with check (true);
alter table messages enable row level security;
drop policy if exists "messages_authenticated" on messages;
create policy "messages_authenticated" on messages
  for all to authenticated using (true) with check (true);
alter table notebook_entries enable row level security;
drop policy if exists "notebook_entries_authenticated" on notebook_entries;
create policy "notebook_entries_authenticated" on notebook_entries
  for all to authenticated using (true) with check (true);
alter table notebook_projects enable row level security;
drop policy if exists "notebook_projects_authenticated" on notebook_projects;
create policy "notebook_projects_authenticated" on notebook_projects
  for all to authenticated using (true) with check (true);
alter table notifications enable row level security;
drop policy if exists "notifications_authenticated" on notifications;
create policy "notifications_authenticated" on notifications
  for all to authenticated using (true) with check (true);
alter table outreach_log enable row level security;
drop policy if exists "outreach_log_authenticated" on outreach_log;
create policy "outreach_log_authenticated" on outreach_log
  for all to authenticated using (true) with check (true);
alter table past_members enable row level security;
drop policy if exists "past_members_authenticated" on past_members;
create policy "past_members_authenticated" on past_members
  for all to authenticated using (true) with check (true);
alter table profiles enable row level security;
drop policy if exists "profiles_authenticated" on profiles;
create policy "profiles_authenticated" on profiles
  for all to authenticated using (true) with check (true);
alter table push_subscriptions enable row level security;
drop policy if exists "push_subscriptions_authenticated" on push_subscriptions;
create policy "push_subscriptions_authenticated" on push_subscriptions
  for all to authenticated using (true) with check (true);
alter table requests enable row level security;
drop policy if exists "requests_authenticated" on requests;
create policy "requests_authenticated" on requests
  for all to authenticated using (true) with check (true);
alter table scheduled_notifications enable row level security;
drop policy if exists "scheduled_notifications_authenticated" on scheduled_notifications;
create policy "scheduled_notifications_authenticated" on scheduled_notifications
  for all to authenticated using (true) with check (true);
alter table scouting_periods enable row level security;
drop policy if exists "scouting_periods_authenticated" on scouting_periods;
create policy "scouting_periods_authenticated" on scouting_periods
  for all to authenticated using (true) with check (true);
alter table scouting_records enable row level security;
drop policy if exists "scouting_records_authenticated" on scouting_records;
create policy "scouting_records_authenticated" on scouting_records
  for all to authenticated using (true) with check (true);
alter table scouting_schedule enable row level security;
drop policy if exists "scouting_schedule_authenticated" on scouting_schedule;
create policy "scouting_schedule_authenticated" on scouting_schedule
  for all to authenticated using (true) with check (true);
alter table season_photos enable row level security;
drop policy if exists "season_photos_authenticated" on season_photos;
create policy "season_photos_authenticated" on season_photos
  for all to authenticated using (true) with check (true);
alter table suggestions enable row level security;
drop policy if exists "suggestions_authenticated" on suggestions;
create policy "suggestions_authenticated" on suggestions
  for all to authenticated using (true) with check (true);
alter table tasks enable row level security;
drop policy if exists "tasks_authenticated" on tasks;
create policy "tasks_authenticated" on tasks
  for all to authenticated using (true) with check (true);
alter table team_survey_responses enable row level security;
drop policy if exists "team_survey_responses_authenticated" on team_survey_responses;
create policy "team_survey_responses_authenticated" on team_survey_responses
  for all to authenticated using (true) with check (true);
alter table workshop_gallery enable row level security;
drop policy if exists "workshop_gallery_authenticated" on workshop_gallery;
create policy "workshop_gallery_authenticated" on workshop_gallery
  for all to authenticated using (true) with check (true);
alter table workshop_ideas enable row level security;
drop policy if exists "workshop_ideas_authenticated" on workshop_ideas;
create policy "workshop_ideas_authenticated" on workshop_ideas
  for all to authenticated using (true) with check (true);
alter table workshops enable row level security;
drop policy if exists "workshops_authenticated" on workshops;
create policy "workshops_authenticated" on workshops
  for all to authenticated using (true) with check (true);

-- The one exception, as narrow as it goes: a brand-new account writing its own
-- profile row before it has a session.
drop policy if exists "profiles_new_account_insert" on profiles;
create policy "profiles_new_account_insert" on profiles
  for insert to anon with check (public.is_new_account(id));

-- ── 4. What this changed ───────────────────────────────────────────────────
-- Every table should come back with rls = true. Anything false is a table
-- still open to the internet.
select c.relname as table,
       c.relrowsecurity as rls,
       count(p.polname) as policies
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_policy p on p.polrelid = c.oid
where n.nspname = 'public' and c.relkind = 'r'
group by c.relname, c.relrowsecurity
order by c.relrowsecurity, c.relname;
