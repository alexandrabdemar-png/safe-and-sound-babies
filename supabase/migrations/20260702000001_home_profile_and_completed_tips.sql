-- Both tables are already read/written by src/routes/_authenticated/home.tsx but were
-- never created by a migration, so every insert/upsert against them fails silently
-- (caught by an empty catch block) — this is why "Done" on the weekly safety tip and
-- the home-profile personalization prompt never actually stick.

CREATE TABLE IF NOT EXISTS public.home_profile (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  has_stairs BOOLEAN,
  home_type TEXT,
  has_pet BOOLEAN,
  has_car BOOLEAN,
  in_daycare BOOLEAN,
  has_pool BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id)
);
ALTER TABLE public.home_profile ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own home profile" ON public.home_profile
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.home_profile TO authenticated;
GRANT ALL ON public.home_profile TO service_role;

CREATE TABLE IF NOT EXISTS public.completed_tips (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  child_id UUID REFERENCES public.children(id) ON DELETE CASCADE,
  tip_id TEXT NOT NULL,
  week_key TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, week_key)
);
ALTER TABLE public.completed_tips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own completed tips" ON public.completed_tips
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.completed_tips TO authenticated;
GRANT ALL ON public.completed_tips TO service_role;
