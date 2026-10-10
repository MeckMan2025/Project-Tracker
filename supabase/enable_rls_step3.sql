-- WARNING (2026-10-10): this replaces every policy with "authenticated may
-- do anything". That undoes supabase/security_privilege_guard.sql (who may
-- change roles, invite people, or edit team accounts). If you ever run this
-- again, run security_privilege_guard.sql right after it.
--
-- ETS: close the last of it. Run after enable_rls_step2.sql.
--
-- Step 2 worked on a list of tables I had typed out, and the list was wrong.
-- I built it by searching the app for rest/v1/<table> URLs, which missed every
-- table reached through the Supabase client instead — cleanup_jobs,
-- timeline_cards, testing_rows, team_accounts, season_timeline and nine more.
-- They were never in the list, so they were never protected.
--
-- So this one does not take a list. It asks the database which tables exist in
-- public and covers all of them, which also means any table added later gets
-- picked up by a re-run rather than quietly sitting open.
--
-- Same rule as before: clear every policy off the table, leave exactly one
-- naming authenticated. No data is touched — policies are access rules, not
-- rows — and with RLS on, fewer policies can only mean less access.

do $do$
declare
  tbl record;
  pol record;
begin
  for tbl in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'          -- ordinary tables; not views or sequences
  loop
    execute format('alter table public.%I enable row level security', tbl.relname);

    for pol in
      select p.polname
      from pg_policy p
      join pg_class c2 on c2.oid = p.polrelid
      join pg_namespace n2 on n2.oid = c2.relnamespace
      where n2.nspname = 'public' and c2.relname = tbl.relname
    loop
      execute format('drop policy %I on public.%I', pol.polname, tbl.relname);
    end loop;

    execute format(
      'create policy %I on public.%I for all to authenticated using (true) with check (true)',
      tbl.relname || '_authenticated', tbl.relname);
  end loop;
end
$do$;

-- The one deliberate hole, recreated after the sweep above removed it: a
-- brand-new account writing its own profile row before it has a session.
-- Insert only — it cannot read anybody.
drop policy if exists "profiles_new_account_insert" on profiles;
create policy "profiles_new_account_insert" on profiles
  for insert to anon with check (public.is_new_account(id));

-- ── Proof ──────────────────────────────────────────────────────────────────
-- Expect exactly one row back: profiles, 2 policies, anon_allowed true — the
-- sign-up exception, which is insert-only. Any other row is still open.
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
having bool_or(p.polroles = '{0}'::oid[]
               or 'anon' = any (select r.rolname
                                from pg_roles r
                                where r.oid = any (p.polroles))) is not false
    or c.relrowsecurity = false
order by c.relname;
