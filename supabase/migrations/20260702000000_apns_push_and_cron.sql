-- 1. Rename the push-token column: this app registers native APNs device
--    tokens via @capacitor/push-notifications, not Expo push tokens (there is
--    no Expo SDK in this project). The old name was misleading.
ALTER TABLE public.profiles RENAME COLUMN expo_push_token TO apns_device_token;

-- 2. Enable pg_cron so the daily recall-sync / alert-generation / push-send
--    jobs actually run on a schedule (previously these existed only as HTTP
--    endpoints with nothing calling them).
--    NOTE: if this fails with "permission denied to create extension", enable
--    pg_cron first via Supabase Dashboard → Database → Extensions, then re-run.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- pg_net (used to make the outbound HTTP calls from the cron jobs) is already
-- installed in the `extensions` schema per migration 20260612010302.

-- 3. Shared helper: looks up the deployed app URL + HOOK_SECRET from Supabase
--    Vault and POSTs to one of the /api/public/hooks/* endpoints.
--
--    Before these cron jobs will do anything, run the following once in the
--    Supabase SQL editor (values are secrets — do NOT commit them to git):
--
--      select vault.create_secret('https://<your-deployed-app-domain>', 'app_base_url');
--      select vault.create_secret('<same value as the HOOK_SECRET env var>', 'hook_secret');
--
--    The HOOK_SECRET env var must also be set on the deployed app (see
--    .lovable/plan.md — this was flagged as outstanding work).
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

-- 4. Schedule the three daily jobs, staggered so later jobs see the results
--    of earlier ones (recall matches -> in-app alerts -> push digest).
SELECT cron.schedule(
  'daily-check-recalls',
  '0 3 * * *',
  $$SELECT private.call_recall_hook('/api/public/hooks/check-recalls');$$
);

SELECT cron.schedule(
  'daily-check-product-alerts',
  '10 3 * * *',
  $$SELECT private.call_recall_hook('/api/public/hooks/check-product-alerts');$$
);

SELECT cron.schedule(
  'daily-product-alerts-push',
  '20 3 * * *',
  $$SELECT private.call_recall_hook('/api/public/hooks/product-alerts-check');$$
);
