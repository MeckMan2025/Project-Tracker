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

-- 14. ENABLE REALTIME on all tables
-- (ignore errors if a table is already in the publication)
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['boards','tasks','messages','suggestions','calendar_events','scouting_records','profiles','approved_emails','requests','notebook_entries','notebook_projects','fun_quotes','scouting_schedule']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND tablename = tbl
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', tbl);
    END IF;
  END LOOP;
END $$;
