-- ── 1. Remove the stale jobs that hit endpoints which no longer exist ──
-- These were returning 404 (routes were consolidated into the
-- scheduled-recall-check edge function) or silently no-op'ing.
DO $$
DECLARE
  dead_job text;
BEGIN
  FOREACH dead_job IN ARRAY ARRAY[
    'check-recalls-daily',
    'daily-check-recalls',
    'daily-check-extra-recalls',
    'cpsc-sync',
    'daily-scheduled-recall-check'
  ] LOOP
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = dead_job) THEN
      PERFORM cron.unschedule(dead_job);
    END IF;
  END LOOP;
END $$;

-- ── 2. Schedule the real pipeline ─────────────────────────────────────
-- The previous attempt used private.call_edge_function(), which reads a
-- service-role key out of Vault. Those Vault secrets were never populated,
-- so the helper hit its "not set yet" branch and returned without ever
-- calling the function. scheduled-recall-check runs with verify_jwt = false
-- (no per-function block in supabase/config.toml), so the anon key is a
-- sufficient credential here and needs no Vault setup.
SELECT cron.schedule(
  'daily-scheduled-recall-check',
  '5 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://vgafdyiaxzqwkeixcbcj.supabase.co/functions/v1/scheduled-recall-check',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZnYWZkeWlheHpxd2tlaXhjYmNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4NTg3NTQsImV4cCI6MjA5NjQzNDc1NH0.ksUym7vXTtybpmvCnECumCHZQc2mxCIvOLmyKqD8W20","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZnYWZkeWlheHpxd2tlaXhjYmNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4NTg3NTQsImV4cCI6MjA5NjQzNDc1NH0.ksUym7vXTtybpmvCnECumCHZQc2mxCIvOLmyKqD8W20"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);
