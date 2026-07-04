CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.product_catalog (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  barcode text NOT NULL,
  name text,
  brand text,
  category text,
  is_baby_product boolean NOT NULL DEFAULT false,
  image_url text,
  source text NOT NULL,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (barcode)
);

GRANT SELECT ON public.product_catalog TO authenticated;
GRANT ALL ON public.product_catalog TO service_role;

ALTER TABLE public.product_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read the product catalog"
  ON public.product_catalog FOR SELECT
  TO authenticated
  USING (true);

CREATE TRIGGER trg_product_catalog_updated_at
  BEFORE UPDATE ON public.product_catalog
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_product_catalog_name_trgm
  ON public.product_catalog USING gin (name extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_product_catalog_brand_trgm
  ON public.product_catalog USING gin (brand extensions.gin_trgm_ops);