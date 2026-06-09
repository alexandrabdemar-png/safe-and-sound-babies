
-- 1. Convert children measurements to imperial
ALTER TABLE public.children
  ADD COLUMN IF NOT EXISTS height_inches numeric,
  ADD COLUMN IF NOT EXISTS weight_lbs numeric;

UPDATE public.children
SET height_inches = ROUND((height_cm * 0.393700787)::numeric, 2)
WHERE height_cm IS NOT NULL AND height_inches IS NULL;

UPDATE public.children
SET weight_lbs = ROUND((weight_kg * 2.2046226218)::numeric, 2)
WHERE weight_kg IS NOT NULL AND weight_lbs IS NULL;

ALTER TABLE public.children DROP COLUMN IF EXISTS height_cm;
ALTER TABLE public.children DROP COLUMN IF EXISTS weight_kg;

-- 2. New product columns
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS added_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS predicted_sizeup_date date,
  ADD COLUMN IF NOT EXISTS predicted_replacement_date date;

UPDATE public.products SET added_at = COALESCE(purchased_at, created_at) WHERE added_at IS NULL;

-- 3. product_guidelines (one per product)
CREATE TABLE IF NOT EXISTS public.product_guidelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL UNIQUE REFERENCES public.products(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text,
  min_weight_lbs numeric,
  max_weight_lbs numeric,
  min_height_inches numeric,
  max_height_inches numeric,
  average_use_months numeric,
  replacement_interval_months numeric,
  size_up_trigger text,
  replacement_trigger text,
  recall_check_needed boolean NOT NULL DEFAULT true,
  source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_guidelines TO authenticated;
GRANT ALL ON public.product_guidelines TO service_role;
ALTER TABLE public.product_guidelines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own product_guidelines" ON public.product_guidelines
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_product_guidelines_updated_at
  BEFORE UPDATE ON public.product_guidelines
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. child_measurements (history of measurements)
CREATE TABLE IF NOT EXISTS public.child_measurements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  child_id uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  weight_lbs numeric,
  height_inches numeric,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.child_measurements TO authenticated;
GRANT ALL ON public.child_measurements TO service_role;
ALTER TABLE public.child_measurements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own child_measurements" ON public.child_measurements
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_child_measurements_child_recorded
  ON public.child_measurements(child_id, recorded_at DESC);

-- 5. product_alerts (audit log; one row per alert sent so we don't repeat)
CREATE TABLE IF NOT EXISTS public.product_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  child_id uuid REFERENCES public.children(id) ON DELETE SET NULL,
  alert_type text NOT NULL,
  title text NOT NULL,
  body text,
  read_at timestamptz,
  sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_alerts TO authenticated;
GRANT ALL ON public.product_alerts TO service_role;
ALTER TABLE public.product_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own product_alerts" ON public.product_alerts
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_alerts_dedup
  ON public.product_alerts(product_id, alert_type);
CREATE INDEX IF NOT EXISTS idx_product_alerts_user_sent
  ON public.product_alerts(user_id, sent_at DESC);
