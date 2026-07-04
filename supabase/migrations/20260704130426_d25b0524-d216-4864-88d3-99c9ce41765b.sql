
DROP POLICY IF EXISTS "Anyone can view product photos" ON storage.objects;
CREATE POLICY "Anyone can view product photos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'product-photos');

DROP POLICY IF EXISTS "Authenticated users can add product photos" ON storage.objects;
CREATE POLICY "Authenticated users can add product photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'product-photos');

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
