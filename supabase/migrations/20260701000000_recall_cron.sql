-- Scheduled recall checking via pg_cron + pg_net
--
-- Prerequisites (enable once in Supabase Dashboard > Database > Extensions):
--   pg_cron  — scheduled jobs inside PostgreSQL
--   pg_net   — outbound HTTP from PostgreSQL functions
--
-- After enabling extensions, run this migration, then set two database config
-- variables so the cron jobs know where to call:
--
--   In Supabase SQL editor:
--   ALTER DATABASE postgres SET app.base_url TO 'https://your-app.workers.dev';
--   ALTER DATABASE postgres SET app.hook_secret TO 'your-HOOK_SECRET-value';
--
-- Or use Supabase Vault:
--   SELECT vault.create_secret('https://your-app.workers.dev', 'app_base_url');
--   SELECT vault.create_secret('your-hook-secret', 'app_hook_secret');
--   (Then reference as: SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='app_base_url')
--
-- Schedule summary:
--   Every hour        → recall-rss-sync   (CPSC + FDA RSS, ~2h latency)
--   Every 4 hours     → check-recalls     (CPSC + FDA REST API, thorough match)
--   Daily at 08:00 UTC → check-product-alerts  (in-app alert rows)
--   Daily at 09:00 UTC → product-alerts-check  (push + email notifications)

-- Enable extensions (idempotent)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Helper function that calls an app hook endpoint
CREATE OR REPLACE FUNCTION call_app_hook(path text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  base_url text := current_setting('app.base_url', true);
  hook_secret text := current_setting('app.hook_secret', true);
BEGIN
  IF base_url IS NULL OR hook_secret IS NULL THEN
    RAISE WARNING 'call_app_hook: app.base_url or app.hook_secret not configured — skipping %', path;
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := base_url || path,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || hook_secret
    ),
    body := '{}'::jsonb
  );
END;
$$;

-- Remove existing cron jobs with the same names (safe to re-run)
SELECT cron.unschedule(jobname)
FROM cron.job
WHERE jobname IN (
  'pom-recall-rss-sync',
  'pom-check-recalls',
  'pom-check-product-alerts',
  'pom-product-alerts-check'
);

-- Every hour: RSS feed sync (fastest recall detection, ~2h latency)
SELECT cron.schedule(
  'pom-recall-rss-sync',
  '0 * * * *',
  $$ SELECT call_app_hook('/api/public/hooks/recall-rss-sync'); $$
);

-- Every 4 hours: full CPSC + FDA REST API check (thorough fuzzy matching)
SELECT cron.schedule(
  'pom-check-recalls',
  '15 */4 * * *',
  $$ SELECT call_app_hook('/api/public/hooks/check-recalls'); $$
);

-- Daily at 08:00 UTC: generate in-app product_alerts rows
SELECT cron.schedule(
  'pom-check-product-alerts',
  '0 8 * * *',
  $$ SELECT call_app_hook('/api/public/hooks/check-product-alerts'); $$
);

-- Daily at 09:00 UTC: send push + email notifications for pending alerts
SELECT cron.schedule(
  'pom-product-alerts-check',
  '0 9 * * *',
  $$ SELECT call_app_hook('/api/public/hooks/product-alerts-check'); $$
);

-- View scheduled jobs
-- SELECT * FROM cron.job;
-- View recent job run history
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;
