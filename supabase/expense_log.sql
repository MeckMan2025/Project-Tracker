-- The expense log: every team purchase, the way the Radical Expense Form asks
-- for it. Run once in the Supabase SQL editor.
--
-- The form's rule is that a receipt is required when reimbursement is needed,
-- so that pairing is the one thing worth enforcing here rather than leaving it
-- to the app alone — a reimbursement claim with no receipt is the row nobody
-- can act on later.

create table if not exists expense_log (
  id            text primary key,
  -- Who filed it. The app knows the signed-in member, so the form doesn't ask.
  username      text not null,
  purchase_date date not null,
  item          text not null,
  store         text not null,
  -- Programming | Business | Technical | Other
  team          text not null,
  -- What they typed when they picked Other.
  team_other    text,
  reimbursement boolean not null,
  receipt_url   text,
  created_at    timestamptz not null default now(),

  constraint expense_log_receipt_when_reimbursed
    check (not reimbursement or receipt_url is not null)
);

-- Read back newest first, and per person on their own filings.
create index if not exists expense_log_date_idx on expense_log (purchase_date desc);
create index if not exists expense_log_user_idx on expense_log (username);

-- ── Receipts ────────────────────────────────────────────────────────────────
-- A public bucket holding the receipt images, so a row stores a link rather
-- than the image itself. Paths are random, so a receipt is not reachable by
-- guessing — but it is readable by anyone holding its link, the same as
-- notebook photos. Worth knowing before photographing a receipt that shows
-- more than the purchase.

insert into storage.buckets (id, name, public)
values ('expense-receipts', 'expense-receipts', true)
on conflict (id) do update set public = true;

drop policy if exists "expense receipts are public" on storage.objects;
create policy "expense receipts are public"
  on storage.objects for select
  using (bucket_id = 'expense-receipts');

-- anon is included because the app talks to Supabase with the anon key.
drop policy if exists "anyone can add an expense receipt" on storage.objects;
create policy "anyone can add an expense receipt"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'expense-receipts');
