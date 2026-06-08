CREATE TABLE public.bottles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  child_id uuid REFERENCES public.children(id) ON DELETE SET NULL,
  bottle_type text NOT NULL CHECK (bottle_type IN ('breastmilk_fresh','breastmilk_thawed','formula_prepared','formula_opened')),
  storage text NOT NULL CHECK (storage IN ('room','fridge','freezer')),
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  alert_minutes_before integer NOT NULL DEFAULT 60,
  ounces numeric(4,1),
  notes text,
  finished_at timestamptz,
  notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bottles TO authenticated;
GRANT ALL ON public.bottles TO service_role;

ALTER TABLE public.bottles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own bottles" ON public.bottles
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_bottles_user_active ON public.bottles(user_id, expires_at) WHERE finished_at IS NULL;

CREATE TRIGGER trg_bottles_updated
  BEFORE UPDATE ON public.bottles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();