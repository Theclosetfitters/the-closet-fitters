-- Phase 1 — Employee/staff portal (staff.theclosetfitters.com).
-- Run in the Supabase SQL editor (or via the Supabase CLI). Adds the staff
-- tables, RLS (authenticated-only), and the jobs updated_at trigger.

-- Staff profiles (extends Supabase auth.users)
CREATE TABLE staff_profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'staff',
    -- roles: 'admin', 'staff'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Jobs (one job per consultation submission)
CREATE TABLE jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  consultation_id UUID,
  customer_first_name TEXT,
  customer_last_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  customer_address TEXT,
  how_heard TEXT,
  closet_config JSONB,
    -- stores the full closet configuration from the cart
  status TEXT DEFAULT 'new',
    -- new | scheduled | invoiced | signed |
    -- in_production | assembled | delivered |
    -- installed | complete
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Job stage tracking
CREATE TABLE job_stages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  stage TEXT NOT NULL,
    -- deposit_received | cnc_sent | cut_edge_banded |
    -- assembled | delivered | installed
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES staff_profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Job photos (one or more per stage)
CREATE TABLE job_photos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  stage TEXT,
  photo_url TEXT NOT NULL,
  uploaded_by UUID REFERENCES staff_profiles(id),
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE staff_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_photos ENABLE ROW LEVEL SECURITY;

-- RLS: only authenticated users can read/write staff tables
CREATE POLICY "Staff access only" ON staff_profiles
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Staff access only" ON jobs
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Staff access only" ON job_stages
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Staff access only" ON job_photos
  FOR ALL USING (auth.role() = 'authenticated');

-- Auto-update updated_at on jobs
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER jobs_updated_at
  BEFORE UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
