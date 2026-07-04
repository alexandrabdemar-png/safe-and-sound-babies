-- 20260702000000_apns_push_and_cron.sql
ALTER TABLE public.profiles RENAME COLUMN expo_push_token TO apns_device_token;

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.call_recall_hook(hook_path text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  base_url text;
  secret text;
BEGIN
  SELECT decrypted_secret INTO base_url FROM vault.decrypted_secrets WHERE name = 'app_base_url';
  SELECT decrypted_secret INTO secret FROM vault.decrypted_secrets WHERE name = 'hook_secret';

  IF base_url IS NULL OR secret IS NULL THEN
    RAISE NOTICE 'Skipping %: app_base_url / hook_secret not set in Vault yet', hook_path;
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := base_url || hook_path,
    headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', secret),
    body := '{}'::jsonb
  );
END;
$$;

SELECT cron.schedule('daily-check-recalls', '0 3 * * *',
  $$SELECT private.call_recall_hook('/api/public/hooks/check-recalls');$$);
SELECT cron.schedule('daily-check-product-alerts', '10 3 * * *',
  $$SELECT private.call_recall_hook('/api/public/hooks/check-product-alerts');$$);
SELECT cron.schedule('daily-product-alerts-push', '20 3 * * *',
  $$SELECT private.call_recall_hook('/api/public/hooks/product-alerts-check');$$);

-- 20260702000001_home_profile_and_completed_tips.sql
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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.home_profile TO authenticated;
GRANT ALL ON public.home_profile TO service_role;
ALTER TABLE public.home_profile ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own home profile" ON public.home_profile
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.completed_tips (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  child_id UUID REFERENCES public.children(id) ON DELETE CASCADE,
  tip_id TEXT NOT NULL,
  week_key TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, week_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.completed_tips TO authenticated;
GRANT ALL ON public.completed_tips TO service_role;
ALTER TABLE public.completed_tips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own completed tips" ON public.completed_tips
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 20260703000000_recall_source_expansion.sql
ALTER TABLE public.recalls
  ADD COLUMN IF NOT EXISTS model text,
  ADD COLUMN IF NOT EXISTS affected_date_start date,
  ADD COLUMN IF NOT EXISTS affected_date_end date,
  ADD COLUMN IF NOT EXISTS official boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.recalls.official IS
  'false for recalls sourced from an unofficial third-party mirror (e.g. the EU Safety Gate feed, which has no official EC API) — surfaced in the UI so users know not to treat a miss here as authoritative.';

-- 20260703000001_schedule_extra_recalls.sql
SELECT cron.schedule('daily-check-extra-recalls', '5 3 * * *',
  $$SELECT private.call_recall_hook('/api/public/hooks/check-extra-recalls');$$);