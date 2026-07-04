-- Consolidates the recall-detection pipeline into a single Supabase Edge
-- Function (supabase/functions/scheduled-recall-check) instead of the two
-- separate TanStack Start hooks it replaces (check-recalls.ts,
-- check-extra-recalls.ts). This migration:
--   1. Extends product_recalls with delivery-tracking columns, so "has this
--      match already been notified" is a column check instead of the old
--      "query rows created in the last 7 days" heuristic used by
--      product-alerts-check.ts.
--   2. Unschedules the two old recall-sync cron jobs.
--   3. Adds a helper + cron job to invoke the new edge function directly.
--
-- Deliberately does NOT rename `recalls`/`product_recalls` — seven UI files
-- (alerts.tsx, home.tsx, recall-radar.tsx, products_.new.tsx,
-- products_.$id.tsx, route.tsx, profile.tsx) depend on those exact table
-- names, including inside untyped PostgREST embedded-resource select
-- strings (e.g. `.select("...,recalls(title)")`) that a table rename would
-- require updating correctly across every one of them with no way to verify
-- the result against a live PostgREST instance in this environment. The new
-- edge function reads/writes these same tables under their existing names.

ALTER TABLE public.product_recalls
  ADD COLUMN IF NOT EXISTS notified_at timestamptz,
  ADD COLUMN IF NOT EXISTS notification_channel text;

ALTER TABLE public.product_recalls
  DROP CONSTRAINT IF EXISTS product_recalls_notification_channel_check;
ALTER TABLE public.product_recalls
  ADD CONSTRAINT product_recalls_notification_channel_check
  CHECK (notification_channel IS NULL OR notification_channel IN ('push', 'email'));

-- Unschedule the two old recall-sync jobs — the new scheduled-recall-check
-- edge function (see cron job below) covers everything they did (CPSC, FDA,
-- critical recalls, USDA FSIS, NHTSA, Health Canada, EU Safety Gate).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-check-recalls') THEN
    PERFORM cron.unschedule('daily-check-recalls');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-check-extra-recalls') THEN
    PERFORM cron.unschedule('daily-check-extra-recalls');
  END IF;
END $$;

-- Invokes a Supabase Edge Function directly (as opposed to
-- private.call_recall_hook, which POSTs to this app's own
-- /api/public/hooks/* routes). Requires two Vault secrets, set once:
--
--   select vault.create_secret('https://<project-ref>.supabase.co/functions/v1', 'edge_functions_base_url');
--   select vault.create_secret('<service role key, from Project Settings > API>', 'edge_functions_service_key');
--
-- The service role key doubles as a valid JWT with role "service_role", so
-- it satisfies verify_jwt = true on the target function while also being
-- what the function needs internally to read across all users' data.
CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.call_edge_function(function_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  base_url text;
  service_key text;
BEGIN
  SELECT decrypted_secret INTO base_url FROM vault.decrypted_secrets WHERE name = 'edge_functions_base_url';
  SELECT decrypted_secret INTO service_key FROM vault.decrypted_secrets WHERE name = 'edge_functions_service_key';

  IF base_url IS NULL OR service_key IS NULL THEN
    RAISE NOTICE 'Skipping %: edge_functions_base_url / edge_functions_service_key not set in Vault yet', function_name;
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := base_url || '/' || function_name,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || service_key),
    body := '{}'::jsonb
  );
END;
$$;

SELECT cron.schedule(
  'daily-scheduled-recall-check',
  '0 3 * * *',
  $$SELECT private.call_edge_function('scheduled-recall-check');$$
);
