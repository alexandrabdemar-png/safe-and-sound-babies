-- Storage bucket audit & policy migration
--
-- The app uses one bucket: "attachments"
-- Upload paths are always: {user_id}/{prefix}-{timestamp}.{ext}
-- Files are accessed via createSignedUrl only (never getPublicUrl) -- this
-- migration ensures the bucket itself is also marked private and that
-- storage RLS locks each user to their own folder.

-- ────────────────────────────────────────────────────────────
-- 1. Create the bucket if it doesn't exist, ensure it is private
-- ────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'attachments',
  'attachments',
  false,                               -- private: no anonymous/public read
  10485760,                            -- 10 MB per file
  ARRAY['image/jpeg','image/png','image/webp','image/gif','image/heic']
)
ON CONFLICT (id) DO UPDATE
  SET public             = false,
      file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ────────────────────────────────────────────────────────────
-- 2. Storage RLS policies on storage.objects
--
-- Upload path convention: {auth.uid()}/{prefix}-{timestamp}.{ext}
-- So the first path segment is always the owner's user ID.
-- We use (storage.foldername(name))[1] to extract it.
-- ────────────────────────────────────────────────────────────

-- SELECT: users can only read their own files
DROP POLICY IF EXISTS "Users read own attachments"   ON storage.objects;
CREATE POLICY "Users read own attachments"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- INSERT: users can only upload into their own folder
DROP POLICY IF EXISTS "Users upload own attachments" ON storage.objects;
CREATE POLICY "Users upload own attachments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- UPDATE: users can only overwrite their own files
DROP POLICY IF EXISTS "Users update own attachments" ON storage.objects;
CREATE POLICY "Users update own attachments"
  ON storage.objects FOR UPDATE TO authenticated
  USING     (bucket_id = 'attachments' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'attachments' AND (storage.foldername(name))[1] = auth.uid()::text);

-- DELETE: users can only delete their own files
DROP POLICY IF EXISTS "Users delete own attachments" ON storage.objects;
CREATE POLICY "Users delete own attachments"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
