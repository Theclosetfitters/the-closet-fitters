-- Replace the single "FOR ALL" appointments policy with explicit per-command
-- policies. A "FOR ALL" policy without WITH CHECK can leave INSERT under-specified
-- and silently reject writes; splitting it makes each command's rule explicit.
-- Run in the Supabase SQL editor.

DROP POLICY IF EXISTS "Staff access only" ON appointments;

CREATE POLICY "Staff can read appointments"
  ON appointments FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Staff can insert appointments"
  ON appointments FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Staff can update appointments"
  ON appointments FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Staff can delete appointments"
  ON appointments FOR DELETE
  USING (auth.role() = 'authenticated');
