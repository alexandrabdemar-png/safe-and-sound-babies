ALTER TABLE public.home_profile
  ADD COLUMN IF NOT EXISTS dismissed_at timestamptz;