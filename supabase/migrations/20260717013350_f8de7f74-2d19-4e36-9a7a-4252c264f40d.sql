-- No-op: ensure category_watchlist exists and emergency_share_links.expires_at is nullable so generated types include them.
CREATE TABLE IF NOT EXISTS public.category_watchlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  child_id uuid REFERENCES public.children(id) ON DELETE SET NULL,
  category text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.category_watchlist TO authenticated;
GRANT ALL ON public.category_watchlist TO service_role;
ALTER TABLE public.category_watchlist ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users manage own category watchlist" ON public.category_watchlist
    FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.emergency_share_links ALTER COLUMN expires_at DROP NOT NULL;