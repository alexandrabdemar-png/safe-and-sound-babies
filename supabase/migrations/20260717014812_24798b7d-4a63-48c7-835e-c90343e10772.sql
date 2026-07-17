DROP POLICY IF EXISTS "Authenticated users can add product photos" ON storage.objects;

CREATE POLICY "Users can upload product photos under their own folder"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'product-photos'
    AND owner = auth.uid()
    AND (storage.foldername(name))[1] = auth.uid()::text
  );