-- ════════════════════════════════════════════════════════════════════════════
-- LOGS SETUP — run this once, all at once, in the Supabase SQL editor.
-- Sets up the Outreach log and the Expenses log.
-- The Mentor log needs nothing: it reads notebook entries that already exist.
-- Safe to run twice; every statement is "if not exists" or overwrites itself.
-- ════════════════════════════════════════════════════════════════════════════


-- ── 1. Outreach log ─────────────────────────────────────────────────────────
-- One row per event, matching the columns the outreach sheet already keeps.
-- Individual Contribution is members x team hours on every row of that sheet
-- (5x3=15, 4x3=12, 5x4=20, 4x4=16, 2x3=6), so it is generated here rather than
-- asked for. A derived number typed by hand eventually disagrees with the two
-- it came from.

create table if not exists outreach_log (
  id          text primary key,
  username    text not null,
  event_date  date not null,
  event_name  text not null,
  members     integer not null check (members > 0),
  team_hours  numeric not null check (team_hours >= 0),
  individual_hours numeric generated always as (members * team_hours) stored,
  created_at  timestamptz not null default now()
);

create index if not exists outreach_log_date_idx on outreach_log (event_date desc);
create index if not exists outreach_log_user_idx on outreach_log (username);


-- ── 2. Expense log ──────────────────────────────────────────────────────────
-- The Radical Expense Form. The form's rule — a receipt is required when
-- reimbursement is needed — is a constraint here as well as in the app,
-- because a claim with no receipt is the row nobody can act on later.

create table if not exists expense_log (
  id            text primary key,
  username      text not null,
  purchase_date date not null,
  item          text not null,
  store         text not null,
  team          text not null,   -- Programming | Business | Technical | Other
  team_other    text,
  reimbursement boolean not null,
  receipt_url   text,
  created_at    timestamptz not null default now(),

  constraint expense_log_receipt_when_reimbursed
    check (not reimbursement or receipt_url is not null)
);

create index if not exists expense_log_date_idx on expense_log (purchase_date desc);
create index if not exists expense_log_user_idx on expense_log (username);


-- ── 3. Receipt images ───────────────────────────────────────────────────────
-- A public bucket, so a row stores a link rather than the image itself. Paths
-- are random, so a receipt isn't reachable by guessing — but it is readable by
-- anyone holding its link, same as notebook photos. Worth knowing before
-- photographing a receipt that shows more than the purchase.

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


-- ── 4. The outreach already on the sheet ────────────────────────────────────
-- The five events that have happened, carried over so the log doesn't start
-- empty. Individual Contribution isn't inserted — it's generated, and the
-- sheet's own numbers agree with it on every row.
--
-- The ids are fixed and spelled out, so running this file again updates
-- nothing and duplicates nothing.
--
-- 09/27 "Flourish and Bots FLL Team Volunteering" is deliberately not here:
-- the sheet has no members or hours for it because it hasn't happened yet.
-- Log it through the form once it has.

insert into outreach_log (id, username, event_date, event_name, members, team_hours) values
  ('sheet-20260913-flourish',  'Outreach sheet', '2026-09-13', 'Flourish and Bots FLL Team Volunteering',   5, 3),
  ('sheet-20260917-homecoming','Outreach sheet', '2026-09-17', 'Homecoming Carnival',                        4, 3),
  ('sheet-20260919-spike',     'Outreach sheet', '2026-09-19', 'FLL Kickoff Spike Programming Presentation', 5, 4),
  ('sheet-20260919-team',      'Outreach sheet', '2026-09-19', 'FLL Kickoff Team Presentation',              4, 4),
  ('sheet-20260920-flourish',  'Outreach sheet', '2026-09-20', 'Flourish and Bots FLL Team Volunteering',    2, 3)
on conflict (id) do nothing;
