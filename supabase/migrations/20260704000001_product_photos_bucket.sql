-- Public storage bucket for photos attached to manual product-catalog
-- entries (feature: barcode scan → no match found → manual entry form with
-- photo upload). Unlike the "attachments" bucket (private, per-user,
-- signed-URL-only), this bucket is deliberately public and shared: a photo
-- contributed by one user for a barcode should be visible to every future
-- scan of that same barcode by anyone.
--
-- Upload path convention: {barcode}/{timestamp}-{random}.{ext}
-- (first path segment is the barcode, not a user id — this is a shared,
-- collaborative catalog, not per-user storage).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-photos',
  'product-photos',
  true,                                 -- public: served via CDN, readable by anyone
  5242880,                              -- 5 MB per file
  ARRAY['image/jpeg','image/png','image/webp','image/heic']
)
ON CONFLICT (id) DO UPDATE
  SET public             = true,
      file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- SELECT: anyone can view product photos (it's a public, shared catalog)
DROP POLICY IF EXISTS "Anyone can view product photos" ON storage.objects;
CREATE POLICY "Anyone can view product photos"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'product-photos');

-- INSERT: any authenticated user can contribute a photo for any barcode
-- (collaborative catalog — not scoped to a folder they "own")
DROP POLICY IF EXISTS "Authenticated users can add product photos" ON storage.objects;
CREATE POLICY "Authenticated users can add product photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'product-photos');

-- UPDATE/DELETE: only the uploader can replace or remove their own photo —
-- one user contributing a bad photo can't be griefed by another user
-- silently overwriting/deleting it, but they can fix their own mistake.
DROP POLICY IF EXISTS "Uploader can update own product photo" ON storage.objects;
CREATE POLICY "Uploader can update own product photo"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING     (bucket_id = 'product-photos' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'product-photos' AND owner = auth.uid());

DROP POLICY IF EXISTS "Uploader can delete own product photo" ON storage.objects;
CREATE POLICY "Uploader can delete own product photo"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'product-photos' AND owner = auth.uid());
