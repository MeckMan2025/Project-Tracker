-- Security, phase 2: nobody can give themselves power.
--
-- Before this, every table's rule was "any signed-in user may do anything".
-- The app decides who is a lead from profiles.function_tags (and the legacy
-- profiles.role = 'lead', which the deployed admin functions still read), so
-- any signed-in user could edit their own profile into a co-founder, or edit
-- approved_emails to invite anyone, or team_accounts to give a team full
-- access. This puts the decision in the database.
--
-- Unchanged on purpose:
--   * everyone signed in can still READ profiles, approved_emails and
--     team_accounts (team-by-team reading is phase 3);
--   * students still edit their own ordinary profile fields (name, bio,
--     skills, status, notification settings, ...);
--   * leads still edit anyone's profile from the app (approving roles,
--     badges, password resets, team accounts);
--   * the admin-* and notebook-voice functions use the service role and are
--     not affected at all.
--
-- WARNING: supabase/enable_rls_step3.sql drops every policy and puts back
-- "authenticated may do anything". Re-running it undoes this file. Run this
-- file again afterwards if that ever happens.

-- ── Who is a lead ───────────────────────────────────────────────────────────
-- Mirrors the app (src/hooks/usePermissions.js): a lead-level tag, the two
-- co-founder admin emails (UserContext ADMIN_EMAILS), the legacy role 'lead',
-- or the authority-admin flag. Read from the database, never from anything
-- the caller sends. Display names are deliberately NOT trusted (the app's
-- "name contains yukti/kayden" rule would let anyone rename into it); both
-- co-founders already carry the Co-Founder tag and an admin email.
create or replace function public.is_core_lead()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce((
    select p.role = 'lead'
        or coalesce(p.is_authority_admin, false)
        or coalesce(p.function_tags, '{}') && array[
             'Co-Founder', 'Mentor', 'Coach', 'Project Manager', 'Team Lead',
             'Business Lead', 'Technical Lead', 'Programming Lead',
             'Co-Project Manager', 'Co-Business Lead', 'Co-Technical Lead', 'Co-Programming Lead']::text[]
    from public.profiles p where p.id = auth.uid()), false)
  or lower(coalesce((select u.email from auth.users u where u.id = auth.uid()), ''))
       in ('deshpandeyukti@pleasval.org', 'meckleykayden@pleasval.org')
$$;

-- A lead, or the account that runs a team (a sister team's coach manages
-- their own roster). Used for profiles and invitations; team_accounts itself
-- needs a core lead, so a team can't grant itself full access.
create or replace function public.is_app_lead()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_core_lead()
      or exists (select 1 from public.team_accounts t where t.user_id = auth.uid())
$$;

-- Server-side callers (admin-* functions, notebook-voice, the SQL editor)
-- are never limited by these rules.
create or replace function public.is_server_caller()
returns boolean
language sql
stable
as $$
  -- The service role (admin-* and notebook-voice functions), or a direct
  -- database session with no request behind it at all (the SQL editor,
  -- migrations, Auth's own triggers). Not "current_user is postgres": a
  -- SECURITY DEFINER function runs as postgres even when anon called it, and
  -- that is exactly how update_member_roles slipped past this guard.
  select coalesce(auth.role(), '') = 'service_role'
      or (nullif(current_setting('request.jwt.claims', true), '') is null
          and nullif(current_setting('request.jwt.claim.role', true), '') is null
          and current_user in ('postgres', 'supabase_admin'))
$$;

-- The profiles guard runs as the caller, so callers must be able to run
-- these. They only ever answer about the caller.
grant execute on function public.is_core_lead() to authenticated, anon;
grant execute on function public.is_app_lead() to authenticated, anon;
grant execute on function public.is_server_caller() to authenticated, anon;

-- What a lead pre-assigned to this account's address on approved_emails
-- (comma-separated roles), or null. Privileged because it reads auth.users.
create or replace function public.approved_role_for(p_id uuid)
returns text
language sql
stable
security definer
set search_path = public, auth
as $$
  select a.role
    from public.approved_emails a
    join auth.users u on lower(trim(a.email)) = lower(trim(u.email))
   where u.id = p_id
   limit 1
$$;
-- And the team it was invited to (null = Radical).
create or replace function public.approved_team_for(p_id uuid)
returns text
language sql
stable
security definer
set search_path = public, auth
as $$
  select a.team_number
    from public.approved_emails a
    join auth.users u on lower(trim(a.email)) = lower(trim(u.email))
   where u.id = p_id
   limit 1
$$;
revoke execute on function public.approved_team_for(uuid) from public;
grant execute on function public.approved_team_for(uuid) to authenticated, anon;
revoke execute on function public.approved_role_for(uuid) from public;
grant execute on function public.approved_role_for(uuid) to authenticated, anon;

-- ── profiles: the power fields ─────────────────────────────────────────────
-- Runs as the caller (not security definer): is_server_caller() has to see
-- who is really calling, and inside a definer function everyone looks like
-- the owner.
create or replace function public.profiles_guard()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  approved text;
  allowed text[];
begin
  if public.is_server_caller() then return new; end if;

  if tg_op = 'INSERT' then
    -- A new account creating its own profile at sign-up. It may only take
    -- what a lead pre-assigned to its address on approved_emails.
    if public.is_app_lead() then return new; end if;
    approved := public.approved_role_for(new.id);
    allowed := array(select btrim(r) from unnest(string_to_array(coalesce(approved, ''), ',')) r
                     where btrim(r) <> '' and lower(btrim(r)) <> 'member');
    new.function_tags      := array(select t from unnest(coalesce(new.function_tags, '{}')) t where t = any(allowed));
    new.authority_tier     := case when cardinality(new.function_tags) > 0 then 'teammate' else 'guest' end;
    new.role               := 'member';
    new.secondary_roles    := null;
    new.is_authority_admin := false;
    new.badge_id           := null;
    new.extra_teams        := null;
    new.team_number        := public.approved_team_for(new.id);
    return new;
  end if;

  -- UPDATE. Leads may change anything (approving roles, badges, resets).
  if public.is_app_lead() then return new; end if;

  if new.role               is distinct from old.role
  or new.secondary_roles    is distinct from old.secondary_roles
  or new.function_tags      is distinct from old.function_tags
  or new.authority_tier     is distinct from old.authority_tier
  or new.is_authority_admin is distinct from old.is_authority_admin
  or new.primary_role_label is distinct from old.primary_role_label
  or new.permissions        is distinct from old.permissions
  or new.team_number        is distinct from old.team_number
  or new.extra_teams        is distinct from old.extra_teams
  or new.badge_id           is distinct from old.badge_id
  then
    raise exception 'Only a team lead can change roles, tags, team or badge.' using errcode = '42501';
  end if;

  -- The temporary-password flag: a student may clear their own (that's how
  -- the forced password change finishes), but never set it.
  if new.must_change_password is distinct from old.must_change_password
     and coalesce(new.must_change_password, false) then
    raise exception 'Only a team lead can require a password change.' using errcode = '42501';
  end if;

  -- The app treats a name containing a co-founder's name as a co-founder.
  -- Nobody else may rename into that.
  if new.display_name is distinct from old.display_name
     and lower(coalesce(new.display_name, '')) ~ '(yukti|kayden)'
     and lower(coalesce(old.display_name, '')) !~ '(yukti|kayden)' then
    raise exception 'That name is reserved.' using errcode = '42501';
  end if;

  return new;
end
$$;

drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard
  before insert or update on public.profiles
  for each row execute function public.profiles_guard();

-- ── profiles: who may touch which rows ─────────────────────────────────────
drop policy if exists profiles_authenticated on public.profiles;
drop policy if exists profiles_read on public.profiles;
drop policy if exists profiles_insert_own on public.profiles;
drop policy if exists profiles_update_own_or_lead on public.profiles;
drop policy if exists profiles_delete_lead on public.profiles;

create policy profiles_read on public.profiles
  for select to authenticated using (true);
create policy profiles_insert_own on public.profiles
  for insert to authenticated with check (id = auth.uid() or public.is_app_lead());
create policy profiles_update_own_or_lead on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_app_lead())
  with check (id = auth.uid() or public.is_app_lead());
create policy profiles_delete_lead on public.profiles
  for delete to authenticated using (public.is_app_lead());
-- profiles_new_account_insert (anon, is_new_account) is left as it was; the
-- trigger above limits what it can write.

-- ── approved_emails: only leads invite ─────────────────────────────────────
drop policy if exists approved_emails_authenticated on public.approved_emails;
drop policy if exists approved_emails_read on public.approved_emails;
drop policy if exists approved_emails_write_lead on public.approved_emails;
create policy approved_emails_read on public.approved_emails
  for select to authenticated using (true);
create policy approved_emails_write_lead on public.approved_emails
  for all to authenticated using (public.is_app_lead()) with check (public.is_app_lead());

-- ── team_accounts: only a core lead ────────────────────────────────────────
drop policy if exists team_accounts_authenticated on public.team_accounts;
drop policy if exists team_accounts_read on public.team_accounts;
drop policy if exists team_accounts_write_core_lead on public.team_accounts;
create policy team_accounts_read on public.team_accounts
  for select to authenticated using (true);
create policy team_accounts_write_core_lead on public.team_accounts
  for all to authenticated using (public.is_core_lead()) with check (public.is_core_lead());

-- ── Old privileged helpers (2026-10-10, Phase 3 step 0) ────────────────────
-- update_member_roles / update_member_tier set anyone's tags or tier, and
-- get_approved_emails / get_profiles_simple list every invited address and
-- every person's tags. All four are SECURITY DEFINER and were executable by
-- anon. The app calls none of them; only the server may now.
revoke execute on function public.update_member_roles(uuid, text[]) from anon, authenticated, public;
revoke execute on function public.update_member_tier(uuid, text) from anon, authenticated, public;
revoke execute on function public.get_approved_emails() from anon, authenticated, public;
revoke execute on function public.get_profiles_simple() from anon, authenticated, public;
grant execute on function public.update_member_roles(uuid, text[]) to service_role;
grant execute on function public.update_member_tier(uuid, text) to service_role;
grant execute on function public.get_approved_emails() to service_role;
grant execute on function public.get_profiles_simple() to service_role;
