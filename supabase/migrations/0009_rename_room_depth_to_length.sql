-- Rename room_depth -> room_length (the room dimension is a length, not a depth).
-- 0008 now creates room_length directly, so this only fires for databases that
-- already applied the earlier version of 0008 (which created room_depth).
-- Idempotent + safe to run regardless. Run in the Supabase SQL editor.

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
