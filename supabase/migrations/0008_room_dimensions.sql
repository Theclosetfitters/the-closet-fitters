-- Room dimensions + closet name captured at consultation time (from the first
-- closet in the cart). Full per-closet data also lives in jobs.closet_config.
-- Run in the Supabase SQL editor.

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS closet_name TEXT,
  ADD COLUMN IF NOT EXISTS room_width NUMERIC,
  ADD COLUMN IF NOT EXISTS room_depth NUMERIC,
  ADD COLUMN IF NOT EXISTS room_height NUMERIC,
  ADD COLUMN IF NOT EXISTS room_width_display TEXT,
  ADD COLUMN IF NOT EXISTS room_depth_display TEXT,
  ADD COLUMN IF NOT EXISTS room_height_display TEXT;
