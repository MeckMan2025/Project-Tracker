-- ETS: finish closing the database. Run after enable_rls.sql.
--
-- enable_rls.sql got 12 of 41 tables and the other 29 kept handing data to the
-- public key. The reason: those tables already had policies, written without a
-- TO clause. A policy with no TO applies to PUBLIC, and PUBLIC includes the
-- anonymous role — so turning RLS on changed nothing, because an existing
-- policy was still waving everyone through. Adding a second policy cannot
-- help: policies are OR'd together, so the most permissive one wins.
--
-- So this clears every policy off these tables and leaves exactly one, naming
-- authenticated. Removing a policy cannot expose anything: with RLS on, fewer
-- policies means less access, and the one being created covers every
-- signed-in account the app has.
--
-- No data is touched. Policies are access rules, not rows.

do $do$
declare
  t text;
  pol record;
  tables text[] := array[
    'absence_notices','alliance_hubs','announcement_votes','announcements',
    'apns_tokens','approved_emails','attendance_records','attendance_sessions',
    'boards','calendar_birthday_reactions','calendar_events','cleanup_assignments',
    'comp_day_assignments','comp_day_blocks','comp_day_sessions','daily_pulse',
    'design_matrices','expense_log','fun_quotes','interested_teams',
    'match_scouting','messages','notebook_entries','notebook_projects',
    'notifications','outreach_log','past_members','profiles','push_subscriptions',
    'requests','scheduled_notifications','scouting_periods','scouting_records',
    'scouting_schedule','season_photos','suggestions','tasks',
    'team_survey_responses','workshop_gallery','workshop_ideas','workshops'
  ];
begin
  foreach t in array tables loop
    -- Belt and braces: on, whatever it was before.
    execute format('alter table public.%I enable row level security', t);

    -- Every policy currently on the table, whoever wrote it and whenever.
    for pol in
      select p.polname
      from pg_policy p
      join pg_class c on c.oid = p.polrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = t
    loop
      execute format('drop policy %I on public.%I', pol.polname, t);
    end loop;

    -- The one that replaces them.
    execute format(
      'create policy %I on public.%I for all to authenticated using (true) with check (true)',
      t || '_authenticated', t);
  end loop;
end
$do$;

-- Sign-up still has to work for someone with no account yet.
drop policy if exists "profiles_new_account_insert" on profiles;
create policy "profiles_new_account_insert" on profiles
  for insert to anon with check (public.is_new_account(id));

-- ── Proof ──────────────────────────────────────────────────────────────────
-- Every row must read rls = true, policies = 1, and anon_allowed = false.
-- (profiles is the exception: 2 policies, the second being sign-up.)
select c.relname as table_name,
       c.relrowsecurity as rls,
       count(p.polname) as policies,
       bool_or(p.polroles = '{0}'::oid[]
               or 'anon' = any (select r.rolname
                                from pg_roles r
                                where r.oid = any (p.polroles))) as anon_allowed
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_policy p on p.polrelid = c.oid
where n.nspname = 'public' and c.relkind = 'r'
group by c.relname, c.relrowsecurity
order by anon_allowed desc nulls last, c.relname;
