
ALTER TABLE public.children
  ADD COLUMN IF NOT EXISTS height_cm numeric,
  ADD COLUMN IF NOT EXISTS weight_kg numeric,
  ADD COLUMN IF NOT EXISTS measurements_updated_at timestamptz;

CREATE TABLE IF NOT EXISTS public.insight_dismissals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  child_id uuid REFERENCES public.children(id) ON DELETE CASCADE,
  rule_id text NOT NULL,
  action text NOT NULL CHECK (action IN ('done','snoozed','dismissed')),
  until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, child_id, rule_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.insight_dismissals TO authenticated;
GRANT ALL ON public.insight_dismissals TO service_role;

ALTER TABLE public.insight_dismissals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own insight dismissals"
  ON public.insight_dismissals
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER set_insight_dismissals_updated_at
  BEFORE UPDATE ON public.insight_dismissals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
