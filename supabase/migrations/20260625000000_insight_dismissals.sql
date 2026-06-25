CREATE TABLE IF NOT EXISTS public.insight_dismissals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  child_id UUID NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  rule_id TEXT NOT NULL,
  action TEXT NOT NULL DEFAULT 'dismissed',
  until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(child_id, rule_id)
);
ALTER TABLE public.insight_dismissals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own dismissals" ON public.insight_dismissals
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.insight_dismissals TO authenticated;
GRANT ALL ON public.insight_dismissals TO service_role;
