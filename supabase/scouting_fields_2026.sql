-- Match scouting, as the scouts actually want to record it.
--
-- The old form asked "did they score?" — a yes or no. A team that attempts ten
-- and lands two is a different team from one that attempts two and lands two,
-- and that question could not tell them apart, which is the whole thing you
-- are trying to find out when choosing who to pick. So: shot and made, counted.
--
-- Nothing is dropped. The old columns stay with their old rows in them: a
-- season's scouting is a record, and deleting the columns would rewrite it.
-- They simply stop being asked for.
--
-- Safe to run twice.

alter table match_scouting add column if not exists auto_shot        integer;
alter table match_scouting add column if not exists auto_made        integer;
alter table match_scouting add column if not exists auto_leave       integer;
alter table match_scouting add column if not exists auto_park        integer;
alter table match_scouting add column if not exists auto_notes       text;

alter table match_scouting add column if not exists teleop_shot      integer;
alter table match_scouting add column if not exists teleop_made      integer;
alter table match_scouting add column if not exists teleop_tips      integer;
alter table match_scouting add column if not exists teleop_notes     text;

-- Tick-all answers, stored as the ticked labels joined by commas.
alter table match_scouting add column if not exists flowers_owned    text;
alter table match_scouting add column if not exists rp_points        text;

-- Counted rather than graded: "Major" told you the worst one and nothing about
-- how often, which is the half that decides anything.
alter table match_scouting add column if not exists minors           integer;
alter table match_scouting add column if not exists majors           integer;

-- auto_reliability and defense_resistance are percentages now rather than a
-- 0–3 and a 1–5. Old rows keep their small numbers; they will read as very low
-- percentages, which is why the season's rows are worth keeping separate from
-- the new ones in your head.
select count(*) as rows_so_far from match_scouting;
