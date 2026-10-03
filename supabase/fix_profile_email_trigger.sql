-- "Database error creating new user" when adding a member or a team.
--
-- Supabase reports that when the INSERT into auth.users itself fails, which
-- happens when a trigger on that table raises. sync_profile_email runs on
-- every new account, so if it can fail, no account can be created — the whole
-- signup path is held hostage by a convenience that copies an address.
--
-- This replaces the function with one that cannot take the account down with
-- it: it only ever UPDATEs (an update matching no row is a no-op, never an
-- error), and anything unexpected is swallowed rather than raised. The worst
-- case becomes "profiles.email is briefly out of step", which is a cosmetic
-- problem, instead of "nobody can be added", which is not.
--
-- Run once in the Supabase SQL editor.

create or replace function public.sync_profile_email()
returns trigger
language plpgsql
security definer
-- Pinned, because a security definer function without it can be pointed at a
-- different schema by whoever calls it.
set search_path = public
as $$
begin
  begin
    update public.profiles set email = new.email where id = new.id;
  exception when others then
    -- Never block account creation for this.
    null;
  end;
  return new;
end
$$;

-- Recreate the trigger so it points at the replaced function. Dropped first
-- because CREATE TRIGGER has no "or replace".
drop trigger if exists sync_profile_email_trigger on auth.users;
create trigger sync_profile_email_trigger
  after insert or update of email on auth.users
  for each row execute function public.sync_profile_email();
