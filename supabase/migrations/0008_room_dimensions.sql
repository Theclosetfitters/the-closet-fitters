-- Room dimensions + closet name captured at consultation time (from the first
-- closet in the cart). Full per-closet data also lives in jobs.closet_config.
-- Idempotent: renames a legacy room_depth column to room_length if present,
-- then ensures every column exists. Run in the Supabase SQL editor.

-- Legacy rename (only fires if an earlier version created room_depth).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'room_depth'
  ) THEN
    ALTER TABLE jobs RENAME COLUMN room_depth TO room_length;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'room_depth_display'
  ) THEN
    ALTER TABLE jobs RENAME COLUMN room_depth_display TO room_length_display;
  END IF;
END $$;

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS closet_name TEXT,
  ADD COLUMN IF NOT EXISTS room_width NUMERIC,
  ADD COLUMN IF NOT EXISTS room_length NUMERIC,
  ADD COLUMN IF NOT EXISTS room_height NUMERIC,
  ADD COLUMN IF NOT EXISTS room_width_display TEXT,
  ADD COLUMN IF NOT EXISTS room_length_display TEXT,
  ADD COLUMN IF NOT EXISTS room_height_display TEXT;
