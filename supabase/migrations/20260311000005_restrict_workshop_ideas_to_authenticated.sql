-- Drop the overly permissive anon access policy
DROP POLICY IF EXISTS "Allow all access with anon key" ON public.workshop_ideas;

-- Allow full access only for authenticated users
CREATE POLICY "Allow authenticated users full access"
  ON public.workshop_ideas
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
