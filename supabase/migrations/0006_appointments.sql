-- Phase 2 — appointment scheduling (schema only; Google Calendar sync and
-- travel-time logic come in later prompts). Run in the Supabase SQL editor.

CREATE TABLE appointments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES staff_profiles(id),
  scheduled_start TIMESTAMPTZ NOT NULL,
  scheduled_end TIMESTAMPTZ NOT NULL,
  client_address TEXT,
  google_calendar_event_id TEXT,
    -- populated in the next prompt once Calendar sync is added
  status TEXT DEFAULT 'scheduled',
    -- scheduled | completed | cancelled | no_show
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff access only" ON appointments
  FOR ALL USING (auth.role() = 'authenticated');

CREATE TRIGGER appointments_updated_at
  BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- When an appointment is created, move the job to 'scheduled' — but only if it
-- is still 'new' (never roll a job in production back to scheduled).
CREATE OR REPLACE FUNCTION set_job_scheduled_on_appointment()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE jobs SET status = 'scheduled'
  WHERE id = NEW.job_id AND status = 'new';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER appointments_set_job_scheduled
  AFTER INSERT ON appointments
  FOR EACH ROW EXECUTE FUNCTION set_job_scheduled_on_appointment();

CREATE INDEX appointments_job_id_idx ON appointments(job_id);
CREATE INDEX appointments_scheduled_start_idx ON appointments(scheduled_start);
