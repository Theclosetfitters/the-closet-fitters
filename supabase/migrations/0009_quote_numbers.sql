-- Sequential quote numbers on the jobs row (TCF-0001, TCF-0002, …).
-- Assigned in /api/consultation AFTER the jobs row inserts successfully, so a
-- failed insert never consumes a number. Existing rows are NOT backfilled.
-- Run in the Supabase SQL editor.

CREATE SEQUENCE IF NOT EXISTS quote_number_seq START 1;

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS quote_number TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS jobs_quote_number_idx ON jobs (quote_number);

-- Returns the next formatted quote number. Called explicitly after a successful
-- insert (not a column DEFAULT), so a rolled-back insert doesn't burn a number.
CREATE OR REPLACE FUNCTION next_quote_number() RETURNS TEXT AS $$
  SELECT 'TCF-' || lpad(nextval('quote_number_seq')::text, 4, '0');
$$ LANGUAGE sql;
