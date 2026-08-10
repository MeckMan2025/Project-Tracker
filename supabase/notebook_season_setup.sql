alter table notebook_entries add column if not exists season text default '2026-2027';

update notebook_entries set season = '2025-2026' where created_at < '2026-08-01';
