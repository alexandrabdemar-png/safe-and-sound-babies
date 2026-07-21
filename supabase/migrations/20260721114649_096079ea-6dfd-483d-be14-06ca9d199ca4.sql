DROP POLICY IF EXISTS "Anyone can read recall source freshness" ON public.recall_source_status;
CREATE POLICY "Authenticated users can read recall source freshness"
  ON public.recall_source_status FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.recall_source_status FROM anon;