-- Standalone reconstruction of the FINAL `recalls`/`products` schema shape,
-- assembled directly from the CREATE TABLE + every ALTER TABLE across:
--   20260607215835 (create recalls, product_recalls, RLS)
--   20260703000000 (model, affected_date_start/end, official)
--   20260711170444 (content_hash, hazard_fingerprint, severity_tier)
--   20260719030000 (products.lot_number, recalls.lot_pattern)
-- Used instead of replaying the full historical migration chain because
-- several unrelated, pre-existing migrations in this repo do not replay
-- cleanly on a from-scratch database (duplicate table creation, a dropped
-- column referenced by a later migration, pg_net/pg_cron unavailable
-- locally) — none of which are related to the recalls table. This isolates
-- "does the final, intended schema support the app's actual queries" from
-- those unrelated replay issues.
CREATE TABLE IF NOT EXISTS public.products (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  brand text,
  category text,
  lot_number text
);

CREATE TABLE IF NOT EXISTS public.recalls (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source text NOT NULL DEFAULT 'manual',
  source_id text,
  title text NOT NULL,
  brand text,
  product_name text,
  category text,
  description text,
  hazard text,
  remedy text,
  url text,
  image_url text,
  recall_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  model text,
  affected_date_start date,
  affected_date_end date,
  official boolean NOT NULL DEFAULT true,
  content_hash text,
  hazard_fingerprint text,
  severity_tier text,
  lot_pattern text,
  UNIQUE (source, source_id)
);

GRANT SELECT ON public.recalls TO authenticated;
GRANT ALL ON public.recalls TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;

ALTER TABLE public.recalls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read recalls"
  ON public.recalls FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users manage own products"
  ON public.products FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
