-- Engineering notebook photos: a public bucket, so a row stores a link instead
-- of the whole image. Run once in the Supabase SQL editor.
--
-- Before this, every photo was squashed to 480px at JPEG quality 0.5 and kept
-- inline as a data: URL. That is why they looked bad and why the notebook was
-- slow to load. Entries made that way still render — nothing needs migrating.

insert into storage.buckets (id, name, public)
values ('notebook-photos', 'notebook-photos', true)
on conflict (id) do update set public = true;

-- Anyone can view a photo (the bucket is public, and the notebook is read by
-- the whole team plus judges).
drop policy if exists "notebook photos are public" on storage.objects;
create policy "notebook photos are public"
  on storage.objects for select
  using (bucket_id = 'notebook-photos');

-- Signed-in members add photos. anon is included because the app talks to
-- Supabase with the anon key.
drop policy if exists "anyone can add a notebook photo" on storage.objects;
create policy "anyone can add a notebook photo"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'notebook-photos');
