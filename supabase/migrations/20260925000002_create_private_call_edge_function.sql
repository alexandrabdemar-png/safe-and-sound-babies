-- Creates the `private` schema and private.call_edge_function() helper
-- from 20260705000000_recall_alerts_pipeline.sql — confirmed missing from
-- production (the daily-scheduled-expiration-check cron job already
-- references private.call_edge_function('scheduled-expiration-check'),
-- but since neither the schema nor the function actually existed, every
-- run of that job has been erroring outright with "schema \"private\"
-- does not exist" rather than silently no-op'ing as originally designed.
--
-- Invokes a Supabase Edge Function directly. Requires two Vault secrets,
-- set once (see 20260925000000_fix_recall_check_cron_stale_project.sql
-- for the exact commands) — without them this quietly no-ops (by design)
-- instead of erroring, which is the intended fallback once this function
-- actually exists.
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
