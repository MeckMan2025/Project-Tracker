-- ============================================================
-- Run this ENTIRE script in your Supabase SQL Editor:
-- https://supabase.com/dashboard → your project → SQL Editor
-- ============================================================

-- 1. BOARDS TABLE
CREATE TABLE IF NOT EXISTS boards (
  id text PRIMARY KEY,
  name text NOT NULL,
  permanent boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE boards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to boards" ON boards;
CREATE POLICY "Allow all access to boards" ON boards
  FOR ALL USING (true) WITH CHECK (true);

-- Seed default boards
INSERT INTO boards (id, name, permanent) VALUES
  ('business', 'Business', true),
  ('technical', 'Technical', true),
  ('programming', 'Programming', true)
ON CONFLICT (id) DO NOTHING;

-- 2. TASKS TABLE
CREATE TABLE IF NOT EXISTS tasks (
  id text PRIMARY KEY,
  board_id text NOT NULL,
  title text NOT NULL,
  description text DEFAULT '',
  assignee text DEFAULT '',
  due_date text DEFAULT '',
  status text DEFAULT 'todo',
  skills jsonb DEFAULT '[]',
  created_at text DEFAULT ''
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to tasks" ON tasks;
CREATE POLICY "Allow all access to tasks" ON tasks
  FOR ALL USING (true) WITH CHECK (true);

-- 3. MESSAGES TABLE
CREATE TABLE IF NOT EXISTS messages (
  id text PRIMARY KEY,
  sender text NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  seen_by jsonb DEFAULT '[]'
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to messages" ON messages;
CREATE POLICY "Allow all access to messages" ON messages
  FOR ALL USING (true) WITH CHECK (true);

-- 4. SUGGESTIONS TABLE (new)
CREATE TABLE IF NOT EXISTS suggestions (
  id text PRIMARY KEY,
  username text NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE suggestions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to suggestions" ON suggestions;
CREATE POLICY "Allow all access to suggestions" ON suggestions
  FOR ALL USING (true) WITH CHECK (true);

-- 5. CALENDAR EVENTS TABLE (new)
CREATE TABLE IF NOT EXISTS calendar_events (
  id text PRIMARY KEY,
  date_key text NOT NULL,
  name text NOT NULL,
  description text DEFAULT '',
  added_by text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to calendar_events" ON calendar_events;
CREATE POLICY "Allow all access to calendar_events" ON calendar_events
  FOR ALL USING (true) WITH CHECK (true);

-- 5b. EVENT TYPE COLUMN
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS event_type text DEFAULT 'other';

-- 6. SCOUTING RECORDS TABLE (new)
CREATE TABLE IF NOT EXISTS scouting_records (
  id text PRIMARY KEY,
  data jsonb NOT NULL,
  submitted_by text DEFAULT '',
  submitted_at timestamptz DEFAULT now()
);

ALTER TABLE scouting_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to scouting_records" ON scouting_records;
CREATE POLICY "Allow all access to scouting_records" ON scouting_records
  FOR ALL USING (true) WITH CHECK (true);

-- 7. PROFILES TABLE (for Supabase Auth)
CREATE TABLE IF NOT EXISTS profiles (
  id uuid REFERENCES auth.users(id) PRIMARY KEY,
  display_name text NOT NULL,
  role text DEFAULT 'member',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on profiles" ON profiles;
CREATE POLICY "Allow all on profiles" ON profiles
  FOR ALL USING (true) WITH CHECK (true);

-- Profile extended fields (run after initial profiles table exists)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS discipline text DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS timezone text DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS status text DEFAULT 'available';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS sprint_capacity integer DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS systems_owned jsonb DEFAULT '[]';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS review_responsibilities jsonb DEFAULT '[]';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS skills jsonb DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tools jsonb DEFAULT '[]';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS safety_certs jsonb DEFAULT '[]';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS permissions jsonb DEFAULT '[]';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS comm_style text DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS comm_notes text DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS nickname text DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS use_nickname boolean DEFAULT false;

-- Authority & role system columns
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS secondary_roles jsonb DEFAULT '[]';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS authority_tier text DEFAULT 'teammate';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_authority_admin boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS primary_role_label text DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS function_tags jsonb DEFAULT '[]';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS short_bio text DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS must_change_password boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

-- After leads sign up, run this to grant lead role:
-- UPDATE profiles SET role = 'lead' WHERE display_name IN ('Kayden', 'Yukti', 'Nick', 'Harshita', 'Lily');

-- 8. APPROVED EMAILS TABLE (whitelist for signup)
CREATE TABLE IF NOT EXISTS approved_emails (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email text UNIQUE NOT NULL,
  role text DEFAULT 'member',
  added_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE approved_emails ENABLE ROW LEVEL SECURITY;

-- Anyone can read the whitelist (anon key needs this for pre-signup check)
DROP POLICY IF EXISTS "Allow read access to approved_emails" ON approved_emails;
CREATE POLICY "Allow read access to approved_emails" ON approved_emails
  FOR SELECT USING (true);

-- Only leads can add/edit/remove whitelist entries
DROP POLICY IF EXISTS "Leads can manage approved_emails" ON approved_emails;
CREATE POLICY "Leads can manage approved_emails" ON approved_emails
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'lead'
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'lead'
    )
  );

-- 9. REQUESTS TABLE (non-leads request tasks/events for lead approval)
CREATE TABLE IF NOT EXISTS requests (
  id text PRIMARY KEY,
  type text NOT NULL,  -- 'task' or 'calendar_event'
  data jsonb NOT NULL,
  requested_by text NOT NULL,
  status text DEFAULT 'pending',  -- 'pending', 'approved', 'denied'
  reviewed_by text,
  board_id text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on requests" ON requests;
CREATE POLICY "Allow all on requests" ON requests
  FOR ALL USING (true) WITH CHECK (true);

-- 10. NOTEBOOK ENTRIES TABLE (Engineering Notebook student logs)
CREATE TABLE IF NOT EXISTS notebook_entries (
  id text PRIMARY KEY,
  username text NOT NULL,
  meeting_date text NOT NULL,
  category text NOT NULL DEFAULT 'Technical',
  custom_category text DEFAULT '',
  what_did text NOT NULL,
  why_option text NOT NULL,
  why_note text DEFAULT '',
  engagement text NOT NULL DEFAULT 'Somewhat',
  project_id text DEFAULT '',
  photo_url text DEFAULT '',
  project_link text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notebook_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to notebook_entries" ON notebook_entries;
CREATE POLICY "Allow all access to notebook_entries" ON notebook_entries
  FOR ALL USING (true) WITH CHECK (true);

-- 11. NOTEBOOK PROJECTS TABLE (lead-only project grouping)
CREATE TABLE IF NOT EXISTS notebook_projects (
  id text PRIMARY KEY,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'Technical',
  goal text DEFAULT '',
  reason text DEFAULT '',
  status text DEFAULT 'Active',
  created_by text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notebook_projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to notebook_projects" ON notebook_projects;
CREATE POLICY "Allow all access to notebook_projects" ON notebook_projects
  FOR ALL USING (true) WITH CHECK (true);

-- 12. FUN QUOTES TABLE (team culture)
CREATE TABLE IF NOT EXISTS fun_quotes (
  id text PRIMARY KEY,
  content text NOT NULL,
  submitted_by text NOT NULL,
  approved boolean DEFAULT false,
  approved_by text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE fun_quotes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to fun_quotes" ON fun_quotes;
CREATE POLICY "Allow all access to fun_quotes" ON fun_quotes
  FOR ALL USING (true) WITH CHECK (true);

-- 13. SCOUTING SCHEDULE TABLE (match assignments & groups)
CREATE TABLE IF NOT EXISTS scouting_schedule (
  id text PRIMARY KEY,
  data jsonb NOT NULL,
  updated_by text DEFAULT '',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE scouting_schedule ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to scouting_schedule" ON scouting_schedule;
CREATE POLICY "Allow all access to scouting_schedule" ON scouting_schedule
  FOR ALL USING (true) WITH CHECK (true);

-- 14. SCOUTING PERIODS TABLE (accountability tracking during competitions)
CREATE TABLE IF NOT EXISTS scouting_periods (
  id text PRIMARY KEY,
  name text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_by text NOT NULL,
  expected_scouts jsonb DEFAULT '[]'
);

ALTER TABLE scouting_periods ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to scouting_periods" ON scouting_periods;
CREATE POLICY "Allow all access to scouting_periods" ON scouting_periods
  FOR ALL USING (true) WITH CHECK (true);

-- 15. ADD scouting_period_id TO scouting_records
ALTER TABLE scouting_records ADD COLUMN IF NOT EXISTS scouting_period_id text DEFAULT '';

-- 16. NOTIFICATIONS TABLE (in-app notification feed)
CREATE TABLE IF NOT EXISTS notifications (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  type text NOT NULL,
  title text NOT NULL,
  body text DEFAULT '',
  read boolean DEFAULT false,
  force boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to notifications" ON notifications;
CREATE POLICY "Allow all access to notifications" ON notifications
  FOR ALL USING (true) WITH CHECK (true);

-- 17. PUSH SUBSCRIPTIONS TABLE (web push endpoints per user/device)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to push_subscriptions" ON push_subscriptions;
CREATE POLICY "Allow all access to push_subscriptions" ON push_subscriptions
  FOR ALL USING (true) WITH CHECK (true);

-- 18. REQUEST REMINDERS TABLE (cooldown tracking for request nudges)
CREATE TABLE IF NOT EXISTS request_reminders (
  id text PRIMARY KEY,
  request_id text NOT NULL,
  reminded_by_user_id uuid NOT NULL REFERENCES auth.users(id),
  reminded_at timestamptz DEFAULT now()
);

ALTER TABLE request_reminders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to request_reminders" ON request_reminders;
CREATE POLICY "Allow all access to request_reminders" ON request_reminders
  FOR ALL USING (true) WITH CHECK (true);

-- 19. ADD notification_prefs COLUMN to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notification_prefs jsonb DEFAULT '{"enabled": true, "calendar": true, "chat": true}';

-- 20. ENABLE REALTIME on all tables
-- (ignore errors if a table is already in the publication)
-- CONSIDERED TEAMS TABLE (alliance partner candidates)
CREATE TABLE IF NOT EXISTS considered_teams (
  team_number text PRIMARY KEY,
  team_name text,
  rank integer,
  added_by text,
  added_at timestamptz DEFAULT now()
);

ALTER TABLE considered_teams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to considered_teams" ON considered_teams;
CREATE POLICY "Allow all access to considered_teams" ON considered_teams
  FOR ALL USING (true) WITH CHECK (true);

-- Seed with current considered teams
INSERT INTO considered_teams (team_number) VALUES ('6603'), ('20097'), ('22479')
ON CONFLICT (team_number) DO NOTHING;

-- 21. ATTENDANCE SESSIONS TABLE (one row per meeting)
CREATE TABLE IF NOT EXISTS attendance_sessions (
  id text PRIMARY KEY,
  session_date text NOT NULL,
  created_by text NOT NULL,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE attendance_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to attendance_sessions" ON attendance_sessions;
CREATE POLICY "Allow all access to attendance_sessions" ON attendance_sessions
  FOR ALL USING (true) WITH CHECK (true);

-- 22. ATTENDANCE RECORDS TABLE (one row per person per session)
CREATE TABLE IF NOT EXISTS attendance_records (
  id text PRIMARY KEY,
  session_id text NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
  username text NOT NULL,
  status text NOT NULL DEFAULT 'absent',
  marked_by text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to attendance_records" ON attendance_records;
CREATE POLICY "Allow all access to attendance_records" ON attendance_records
  FOR ALL USING (true) WITH CHECK (true);

-- 23. NOTEBOOK FLASH TABLE (forced notebook entry sessions)
CREATE TABLE IF NOT EXISTS notebook_flash (
  id text PRIMARY KEY,
  session_id text NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
  started_by text NOT NULL,
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  exempt_users jsonb DEFAULT '[]'
);

ALTER TABLE notebook_flash ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to notebook_flash" ON notebook_flash;
CREATE POLICY "Allow all access to notebook_flash" ON notebook_flash
  FOR ALL USING (true) WITH CHECK (true);

-- 24. NOTEBOOK ENTRY PARTICIPANTS TABLE (group entries for flash)
CREATE TABLE IF NOT EXISTS notebook_entry_participants (
  id text PRIMARY KEY,
  entry_id text NOT NULL REFERENCES notebook_entries(id) ON DELETE CASCADE,
  username text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nep_username ON notebook_entry_participants(username);
CREATE INDEX IF NOT EXISTS idx_nep_entry_id ON notebook_entry_participants(entry_id);

ALTER TABLE notebook_entry_participants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to notebook_entry_participants" ON notebook_entry_participants;
CREATE POLICY "Allow all access to notebook_entry_participants" ON notebook_entry_participants
  FOR ALL USING (true) WITH CHECK (true);

-- 25. ADD flash_id COLUMN to notebook_entries
ALTER TABLE notebook_entries ADD COLUMN IF NOT EXISTS flash_id text DEFAULT '';

-- 26. CLEANUP JOBS TABLE (list of cleanup tasks)
CREATE TABLE IF NOT EXISTS cleanup_jobs (
  id text PRIMARY KEY,
  name text NOT NULL,
  active boolean DEFAULT true
);

ALTER TABLE cleanup_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to cleanup_jobs" ON cleanup_jobs;
CREATE POLICY "Allow all access to cleanup_jobs" ON cleanup_jobs
  FOR ALL USING (true) WITH CHECK (true);

-- Seed default cleanup jobs
INSERT INTO cleanup_jobs (id, name, active) VALUES
  ('sweep-floor', 'Sweep Floor', true),
  ('wipe-tables', 'Wipe Tables', true),
  ('empty-trash', 'Empty Trash', true),
  ('organize-tools', 'Organize Tools', true),
  ('clean-whiteboard', 'Clean Whiteboard', true),
  ('tidy-parts', 'Tidy Parts Station', true),
  ('vacuum', 'Vacuum', true)
ON CONFLICT (id) DO NOTHING;

-- 27. CLEANUP SESSIONS TABLE (one per meeting cleanup round)
CREATE TABLE IF NOT EXISTS cleanup_sessions (
  id text PRIMARY KEY,
  attendance_session_id text REFERENCES attendance_sessions(id) ON DELETE CASCADE,
  generated_by text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE cleanup_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to cleanup_sessions" ON cleanup_sessions;
CREATE POLICY "Allow all access to cleanup_sessions" ON cleanup_sessions
  FOR ALL USING (true) WITH CHECK (true);

-- 28. CLEANUP ASSIGNMENTS TABLE (who does what)
CREATE TABLE IF NOT EXISTS cleanup_assignments (
  id text PRIMARY KEY,
  cleanup_session_id text NOT NULL REFERENCES cleanup_sessions(id) ON DELETE CASCADE,
  job_id text NOT NULL REFERENCES cleanup_jobs(id),
  assigned_username text NOT NULL,
  status text NOT NULL DEFAULT 'assigned',
  confirmed_by text,
  confirmed_at timestamptz,
  points_awarded integer DEFAULT 0
);

ALTER TABLE cleanup_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to cleanup_assignments" ON cleanup_assignments;
CREATE POLICY "Allow all access to cleanup_assignments" ON cleanup_assignments
  FOR ALL USING (true) WITH CHECK (true);

-- 29. CLEANUP EXEMPTIONS TABLE (users exempt from cleanup)
CREATE TABLE IF NOT EXISTS cleanup_exemptions (
  id text PRIMARY KEY,
  cleanup_session_id text NOT NULL REFERENCES cleanup_sessions(id) ON DELETE CASCADE,
  username text NOT NULL,
  exempted_by text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE cleanup_exemptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to cleanup_exemptions" ON cleanup_exemptions;
CREATE POLICY "Allow all access to cleanup_exemptions" ON cleanup_exemptions
  FOR ALL USING (true) WITH CHECK (true);

-- 30. SCHEDULED NOTIFICATIONS TABLE (deferred calendar event notifications)
CREATE TABLE IF NOT EXISTS scheduled_notifications (
  id text PRIMARY KEY,
  event_id text NOT NULL,
  send_at timestamptz NOT NULL,
  title text NOT NULL,
  body text DEFAULT '',
  type text NOT NULL DEFAULT 'calendar_event',
  force boolean DEFAULT false,
  created_by text NOT NULL,
  created_by_user_id uuid NOT NULL REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'pending',
  sent_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_notif_pending
  ON scheduled_notifications (send_at)
  WHERE status = 'pending';

ALTER TABLE scheduled_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to scheduled_notifications" ON scheduled_notifications;
CREATE POLICY "Allow all access to scheduled_notifications" ON scheduled_notifications
  FOR ALL USING (true) WITH CHECK (true);

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['boards','tasks','messages','suggestions','calendar_events','scouting_records','profiles','approved_emails','requests','notebook_entries','notebook_projects','fun_quotes','scouting_schedule','scouting_periods','notifications','push_subscriptions','request_reminders','considered_teams','attendance_sessions','attendance_records','notebook_flash','notebook_entry_participants','cleanup_jobs','cleanup_sessions','cleanup_assignments','cleanup_exemptions','scheduled_notifications']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND tablename = tbl
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', tbl);
    END IF;
  END LOOP;
END $$;
