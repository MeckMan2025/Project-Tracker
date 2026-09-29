-- Quantity and cost on the expense log. Run once in the Supabase SQL editor.
--
-- cost is per item; total_cost is generated from the two so a row's total can
-- never disagree with the numbers it came from.
--
-- Both are nullable on purpose: rows filed before this existed have no cost,
-- and a NOT NULL would refuse to add the column while they're there. The app
-- requires both going forward, and treats a missing total as nothing rather
-- than breaking the sum.

alter table expense_log add column if not exists quantity integer;
alter table expense_log add column if not exists cost     numeric;

alter table expense_log
  add column if not exists total_cost numeric
  generated always as (quantity * cost) stored;
