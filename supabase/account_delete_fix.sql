-- Deleting an account works.
--
-- admin-delete-user removes the login first and the profile second (so a
-- failure can't leave a login with no profile). But profiles.id referenced
-- the login with no cascade, so removing the login while its profile existed
-- always failed: "Database error deleting user". A few tables that only
-- record who created something (an announcement, an invitation, a calendar
-- reminder) blocked it the same way for anyone who had made one.
--
-- Now the profile goes with its login, and those records keep their content
-- and simply forget who made it. Safe to run twice.

alter table public.profiles drop constraint if exists profiles_id_fkey;
alter table public.profiles add constraint profiles_id_fkey
  foreign key (id) references auth.users (id) on delete cascade;

alter table public.announcements drop constraint if exists announcements_author_id_fkey;
alter table public.announcements add constraint announcements_author_id_fkey
  foreign key (author_id) references auth.users (id) on delete set null;

alter table public.approved_emails drop constraint if exists approved_emails_added_by_fkey;
alter table public.approved_emails add constraint approved_emails_added_by_fkey
  foreign key (added_by) references auth.users (id) on delete set null;

alter table public.scheduled_notifications alter column created_by_user_id drop not null;
alter table public.scheduled_notifications drop constraint if exists scheduled_notifications_created_by_user_id_fkey;
alter table public.scheduled_notifications add constraint scheduled_notifications_created_by_user_id_fkey
  foreign key (created_by_user_id) references auth.users (id) on delete set null;
