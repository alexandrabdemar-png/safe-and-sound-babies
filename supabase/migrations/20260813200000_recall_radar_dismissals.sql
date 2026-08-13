-- Per-user "mark as done" for Recall Radar (the general industry-wide
-- recall feed at /recall-radar), distinct from insight_dismissals which is
-- always scoped to a specific child_id and doesn't fit here — a Recall
-- Radar entry isn't about any one child, it's a general recall listing a
-- parent has reviewed and wants off their radar. recall_id is the stable,
-- deterministically-derived id from recallRadarMerge.ts (e.g.
-- "cpsc-12345", "critical-rocknplay", "usda_fsis-<uuid>") rather than a
-- foreign key, since CPSC/FDA results are live API data with no row in
-- our own database to reference.
CREATE TABLE IF NOT EXISTS public.recall_radar_dismissals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recall_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, recall_id)
);

ALTER TABLE public.recall_radar_dismissals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own recall radar dismissals" ON public.recall_radar_dismissals
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recall_radar_dismissals TO authenticated;
GRANT ALL ON public.recall_radar_dismissals TO service_role;

CREATE INDEX IF NOT EXISTS idx_recall_radar_dismissals_user ON public.recall_radar_dismissals(user_id);
