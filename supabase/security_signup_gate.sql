-- Security, phase 1: only approved people can get an account.
--
-- The app's sign-up screen checks approved_emails before calling sign-up, but
-- that check ran only in the browser. Supabase's sign-up endpoint itself was
-- open: anyone with the public key (it ships in the website) could create an
-- account directly, skip the list, and be signed in at once (no email
-- confirmation, which PV students can't receive). Signed in, they could read
-- and change every table.
--
-- This hook runs inside Supabase Auth before any account is created, so
-- nothing can go around it. Allowed:
--   * an address on approved_emails (the self sign-up flow), and
--   * accounts a lead creates with the admin-create-user function, which puts
--     the address on approved_emails first.
-- Everything else is refused with a plain message.
--
-- Turned on in Supabase: Authentication -> Hooks -> Before User Created ->
-- Postgres function public.hook_before_user_created (done via the
-- management API on 2026-10-10).

create or replace function public.hook_before_user_created(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  addr text := lower(trim(coalesce(event->'user'->>'email', '')));
begin
  if addr <> '' and exists (select 1 from public.approved_emails where lower(trim(email)) = addr) then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object('error', jsonb_build_object(
    'http_code', 403,
    'message', 'This email isn''t approved for Everything That''s Scrum. Ask a team lead to add you.'));
end
$$;

-- Only Supabase Auth may call it.
grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;
revoke execute on function public.hook_before_user_created(jsonb) from authenticated, anon, public;
