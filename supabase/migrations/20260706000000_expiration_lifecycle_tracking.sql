-- Feature 2: expiration & lifecycle tracking.
--
-- Adds manufacture_date/expiration_date/product_type to products, a trigger
-- that fills in a default 6-year car-seat expiration when one isn't given,
-- and a lifecycle_alerts table + daily edge function (scheduled the same
-- way as scheduled-recall-check, reusing the private.call_edge_function
-- helper from 20260705000000_recall_alerts_pipeline.sql) that flags
-- products expiring within 90/30/7 days and reuses the shared notify.ts
-- push+email delivery module rather than duplicating it.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS manufacture_date date,
  ADD COLUMN IF NOT EXISTS expiration_date date,
  ADD COLUMN IF NOT EXISTS product_type text NOT NULL DEFAULT 'other';

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_product_type_check;
ALTER TABLE public.products
  ADD CONSTRAINT products_product_type_check
  CHECK (product_type IN ('car_seat', 'formula', 'medicine', 'other'));

-- Car seats default to a 6-year lifespan from manufacture date (CPSC
-- guidance) when no explicit expiration_date is set. Applied as a
-- trigger (not application code) so it fires no matter which client
-- writes the row.
CREATE OR REPLACE FUNCTION public.set_default_car_seat_expiration()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.product_type = 'car_seat' AND NEW.expiration_date IS NULL AND NEW.manufacture_date IS NOT NULL THEN
    NEW.expiration_date := NEW.manufacture_date + INTERVAL '6 years';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_default_car_seat_expiration ON public.products;
CREATE TRIGGER trg_products_default_car_seat_expiration
  BEFORE INSERT OR UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_default_car_seat_expiration();

-- One row per (product, urgency threshold) that's been raised, so the
-- unique index gives us the same "notify once per threshold" idempotency
-- the recall pipeline gets from UNIQUE(product_id, recall_id).
CREATE TABLE IF NOT EXISTS public.lifecycle_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  urgency text NOT NULL CHECK (urgency IN ('expired', '7', '30', '90')),
  notified_at timestamptz,
  notification_channel text CHECK (notification_channel IS NULL OR notification_channel IN ('push', 'email')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, urgency)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lifecycle_alerts TO authenticated;
GRANT ALL ON public.lifecycle_alerts TO service_role;
ALTER TABLE public.lifecycle_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own lifecycle_alerts" ON public.lifecycle_alerts
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_lifecycle_alerts_user ON public.lifecycle_alerts(user_id, created_at DESC);

-- Reuses private.call_edge_function(function_name) and the
-- edge_functions_base_url / edge_functions_service_key Vault secrets
-- already set up for scheduled-recall-check — nothing new to configure
-- there, just deploy the function itself.
SELECT cron.schedule(
  'daily-scheduled-expiration-check',
  '0 4 * * *',
  $$SELECT private.call_edge_function('scheduled-expiration-check');$$
);
