-- Restrict SELECT on the product-photos storage bucket to ownership paths
-- only, per user decision on the "Any authenticated user can view all
-- product photos" scanner finding. Prior behavior: any signed-in user (and
-- anon, since the bucket is public) could fetch any product photo.
--
-- New rule: a photo in the product-photos bucket is only readable by
--   • the uploader of the storage object (owner = auth.uid()), OR
--   • any user who owns a product row whose photo_url references this
--     object (via has_product_access, which also honors caregiver shares).
--
-- Note: storage.objects.name is the path within the bucket (e.g.
-- "012345678905/photo1.jpg"). products.photo_url stores the full public
-- URL, so we match by "URL ends with /<bucket>/<name>".

DROP POLICY IF EXISTS "Anyone can view product photos" ON storage.objects;

CREATE POLICY "Owners and product-holders can view product photos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'product-photos'
    AND (
      owner = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.products p
        WHERE p.photo_url LIKE '%/product-photos/' || storage.objects.name
          AND public.has_product_access(p.id, 'viewer')
      )
    )
  );