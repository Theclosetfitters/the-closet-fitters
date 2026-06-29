-- Storage RLS for the private 'job-photos' bucket (Phase 1B — job photos).
-- The bucket itself is created in the Supabase dashboard (Storage -> New bucket,
-- name 'job-photos', public OFF). These policies let signed-in staff upload and
-- read photos; the files are served to the UI via short-lived signed URLs.
-- Run in the Supabase SQL editor.

CREATE POLICY "Staff upload job photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'job-photos');

CREATE POLICY "Staff read job photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'job-photos');
