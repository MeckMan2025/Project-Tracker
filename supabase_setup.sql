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

-- After leads sign up, run this to grant lead role:
-- UPDATE profiles SET role = 'lead' WHERE display_name IN ('Kayden', 'Yukti', 'Nick', 'Harshita', 'Lily');

-- 8. ENABLE REALTIME on all tables
-- (ignore errors if a table is already in the publication)
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['boards','tasks','messages','suggestions','calendar_events','scouting_records','profiles']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND tablename = tbl
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', tbl);
    END IF;
  END LOOP;
END $$;
