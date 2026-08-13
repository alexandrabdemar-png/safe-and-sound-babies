CREATE TABLE public.recall_radar_dismissals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recall_id text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, recall_id)
);

GRANT SELECT, INSERT, DELETE ON public.recall_radar_dismissals TO authenticated;
GRANT ALL ON public.recall_radar_dismissals TO service_role;

ALTER TABLE public.recall_radar_dismissals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own recall dismissals"
  ON public.recall_radar_dismissals FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own recall dismissals"
  ON public.recall_radar_dismissals FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own recall dismissals"
  ON public.recall_radar_dismissals FOR DELETE TO authenticated
  USING (auth.uid() = user_id);