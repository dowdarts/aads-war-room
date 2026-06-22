-- Public storage bucket for tool/app icons (cue light, players portal,
-- shirt catalog, ticket pass, etc.) so each tool's home-screen icon and
-- favicon can be swapped later by re-uploading to this bucket, no code
-- deploy required. Same permissive-RLS pattern already used everywhere
-- else in this project (anon key, no real auth) -- these are static
-- branding images, not sensitive data, so a public read/write bucket
-- carries the same low-stakes trust model as e.g. player_portal_accounts.

INSERT INTO storage.buckets (id, name, public)
VALUES ('branding', 'branding', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "anon read branding" ON storage.objects;
CREATE POLICY "anon read branding" ON storage.objects
  FOR SELECT TO anon USING (bucket_id = 'branding');

DROP POLICY IF EXISTS "anon write branding" ON storage.objects;
CREATE POLICY "anon write branding" ON storage.objects
  FOR INSERT TO anon WITH CHECK (bucket_id = 'branding');

DROP POLICY IF EXISTS "anon update branding" ON storage.objects;
CREATE POLICY "anon update branding" ON storage.objects
  FOR UPDATE TO anon USING (bucket_id = 'branding') WITH CHECK (bucket_id = 'branding');
