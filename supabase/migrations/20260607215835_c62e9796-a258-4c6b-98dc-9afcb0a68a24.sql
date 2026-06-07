
-- 1. Drop the auto-milestone trigger & function (CASCADE handles trg_seed_milestones)
DROP FUNCTION IF EXISTS public.on_child_inserted() CASCADE;
DROP FUNCTION IF EXISTS public.generate_milestones_for_child(uuid, date);

-- 2. Wipe seeded milestones
DELETE FROM public.milestones;

-- 3. Repurpose milestones as parent-logged moments
ALTER TABLE public.milestones
  ADD COLUMN IF NOT EXISTS logged_at date NOT NULL DEFAULT current_date,
  ADD COLUMN IF NOT EXISTS notes text,
  ALTER COLUMN completed SET DEFAULT true;

-- 4. Extend products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS brand text,
  ADD COLUMN IF NOT EXISTS model text,
  ADD COLUMN IF NOT EXISTS size text,
  ADD COLUMN IF NOT EXISTS replace_at date,
  ADD COLUMN IF NOT EXISTS next_size_at date,
  ADD COLUMN IF NOT EXISTS recalled boolean NOT NULL DEFAULT false;

-- 5. Recalls (global)
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
  UNIQUE (source, source_id)
);

GRANT SELECT ON public.recalls TO authenticated;
GRANT ALL ON public.recalls TO service_role;

ALTER TABLE public.recalls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read recalls"
  ON public.recalls FOR SELECT
  TO authenticated
  USING (true);

CREATE TRIGGER trg_recalls_updated_at
  BEFORE UPDATE ON public.recalls
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6. Per-user product↔recall matches
CREATE TABLE IF NOT EXISTS public.product_recalls (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  recall_id uuid NOT NULL REFERENCES public.recalls(id) ON DELETE CASCADE,
  acknowledged boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, recall_id)
);

GRANT SELECT, UPDATE ON public.product_recalls TO authenticated;
GRANT ALL ON public.product_recalls TO service_role;

ALTER TABLE public.product_recalls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own product recalls"
  ON public.product_recalls FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users acknowledge own product recalls"
  ON public.product_recalls FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_product_recalls_updated_at
  BEFORE UPDATE ON public.product_recalls
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 7. Unschedule old weekly milestone cron
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'weekly-milestone-check') THEN
    PERFORM cron.unschedule('weekly-milestone-check');
  END IF;
END $$;
