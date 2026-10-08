-- ETS: give every shared table a team, so no team sees another's work.
--
-- The notebook, attendance, boards and the logs already carry a team. These
-- did not, which meant one calendar, one set of testing charts, one timeline
-- and one workshop list for everybody — and a sister team with every tab
-- could read all of it. The audit that found this listed 32 such tables.
--
-- NULL means Radical, the same convention boards and the notebook already use.
-- So every existing row stays ours, which is true, and a read somebody forgets
-- to filter later fails towards our own data rather than somebody else's.
--
-- Three tables are deliberately NOT here: notifications, push_subscriptions
-- and apns_tokens key on a user id, so they are already per-person and a team
-- column would add nothing.
--
-- Safe to run twice. Nothing is deleted and no existing value changes.

alter table alliance_hubs add column if not exists team_number text;
create index if not exists alliance_hubs_team_idx on alliance_hubs (team_number);
alter table alliance_scouting add column if not exists team_number text;
create index if not exists alliance_scouting_team_idx on alliance_scouting (team_number);
alter table announcement_votes add column if not exists team_number text;
create index if not exists announcement_votes_team_idx on announcement_votes (team_number);
alter table announcements add column if not exists team_number text;
create index if not exists announcements_team_idx on announcements (team_number);
alter table approved_emails add column if not exists team_number text;
create index if not exists approved_emails_team_idx on approved_emails (team_number);
alter table calendar_birthday_reactions add column if not exists team_number text;
create index if not exists calendar_birthday_reactions_team_idx on calendar_birthday_reactions (team_number);
alter table calendar_events add column if not exists team_number text;
create index if not exists calendar_events_team_idx on calendar_events (team_number);
alter table cleanup_assignments add column if not exists team_number text;
create index if not exists cleanup_assignments_team_idx on cleanup_assignments (team_number);
alter table cleanup_exemptions add column if not exists team_number text;
create index if not exists cleanup_exemptions_team_idx on cleanup_exemptions (team_number);
alter table cleanup_jobs add column if not exists team_number text;
create index if not exists cleanup_jobs_team_idx on cleanup_jobs (team_number);
alter table cleanup_sessions add column if not exists team_number text;
create index if not exists cleanup_sessions_team_idx on cleanup_sessions (team_number);
alter table comp_day_assignments add column if not exists team_number text;
create index if not exists comp_day_assignments_team_idx on comp_day_assignments (team_number);
alter table comp_day_blocks add column if not exists team_number text;
create index if not exists comp_day_blocks_team_idx on comp_day_blocks (team_number);
alter table comp_day_sessions add column if not exists team_number text;
create index if not exists comp_day_sessions_team_idx on comp_day_sessions (team_number);
alter table daily_pulse add column if not exists team_number text;
create index if not exists daily_pulse_team_idx on daily_pulse (team_number);
alter table design_matrices add column if not exists team_number text;
create index if not exists design_matrices_team_idx on design_matrices (team_number);
alter table fun_quotes add column if not exists team_number text;
create index if not exists fun_quotes_team_idx on fun_quotes (team_number);
alter table interested_teams add column if not exists team_number text;
create index if not exists interested_teams_team_idx on interested_teams (team_number);
alter table messages add column if not exists team_number text;
create index if not exists messages_team_idx on messages (team_number);
alter table notebook_entry_participants add column if not exists team_number text;
create index if not exists notebook_entry_participants_team_idx on notebook_entry_participants (team_number);
alter table notebook_flash add column if not exists team_number text;
create index if not exists notebook_flash_team_idx on notebook_flash (team_number);
alter table past_members add column if not exists team_number text;
create index if not exists past_members_team_idx on past_members (team_number);
alter table request_reminders add column if not exists team_number text;
create index if not exists request_reminders_team_idx on request_reminders (team_number);
alter table requests add column if not exists team_number text;
create index if not exists requests_team_idx on requests (team_number);
alter table scouting_periods add column if not exists team_number text;
create index if not exists scouting_periods_team_idx on scouting_periods (team_number);
alter table scouting_schedule add column if not exists team_number text;
create index if not exists scouting_schedule_team_idx on scouting_schedule (team_number);
alter table season_photos add column if not exists team_number text;
create index if not exists season_photos_team_idx on season_photos (team_number);
alter table season_timeline add column if not exists team_number text;
create index if not exists season_timeline_team_idx on season_timeline (team_number);
alter table suggestions add column if not exists team_number text;
create index if not exists suggestions_team_idx on suggestions (team_number);
alter table testing_charts add column if not exists team_number text;
create index if not exists testing_charts_team_idx on testing_charts (team_number);
alter table testing_rows add column if not exists team_number text;
create index if not exists testing_rows_team_idx on testing_rows (team_number);
alter table testing_tables add column if not exists team_number text;
create index if not exists testing_tables_team_idx on testing_tables (team_number);
alter table timeline_cards add column if not exists team_number text;
create index if not exists timeline_cards_team_idx on timeline_cards (team_number);
alter table timeline_comments add column if not exists team_number text;
create index if not exists timeline_comments_team_idx on timeline_comments (team_number);
alter table workshop_gallery add column if not exists team_number text;
create index if not exists workshop_gallery_team_idx on workshop_gallery (team_number);
alter table workshop_ideas add column if not exists team_number text;
create index if not exists workshop_ideas_team_idx on workshop_ideas (team_number);
alter table workshops add column if not exists team_number text;
create index if not exists workshops_team_idx on workshops (team_number);

-- ── Proof ──────────────────────────────────────────────────────────────────
-- Every table that holds team content should now have the column. Anything
-- listed here still cannot tell one team from another.
select c.relname as table_name
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname not in ('notifications', 'push_subscriptions', 'apns_tokens',
                        'schema_migrations')
  and not exists (
    select 1 from pg_attribute a
    where a.attrelid = c.oid
      and a.attname in ('team_number', 'owner_team')
      and not a.attisdropped
  )
order by c.relname;
