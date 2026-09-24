-- The daily-scheduled-recall-check cron job (added in 20260810185839,
-- tightened to every 30 min in 20260814130000) calls a hardcoded URL on a
-- Supabase project this app no longer runs on:
--   https://vgafdyiaxzqwkeixcbcj.supabase.co/functions/v1/scheduled-recall-check
-- with an anon key baked in for that same dead project. Every invocation
-- has been hitting a project that isn't this one, so it has never
-- successfully written a real recall row — the job's own
-- cron.job_run_details always shows "succeeded" regardless, since that
-- only reflects net.http_post() queuing the request, not what (if
-- anything) answered it.
--
-- Fixed by switching to private.call_edge_function() (defined in
-- 20260705000000_recall_alerts_pipeline.sql) — the same mechanism
-- daily-scheduled-expiration-check already uses — which reads the current
-- project's URL and a service-role key from Supabase Vault at call time
-- instead of a value frozen into the migration. This is what keeps it
-- from going stale again the same way if the backing project ever
-- changes.
--
-- PREREQUISITE — run this once in the SQL Editor before this job will do
-- anything (cannot be committed to git; these are secrets):
--
--   select vault.create_secret(
--     'https://<your-current-project-ref>.supabase.co/functions/v1',
--     'edge_functions_base_url'
--   );
--   select vault.create_secret(
--     '<service role key, from Project Settings > API>',
--     'edge_functions_service_key'
--   );
--
-- (Skip this if those two secrets already exist from setting up
-- daily-scheduled-expiration-check — this job reads the same two names.)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-scheduled-recall-check') THEN
    PERFORM cron.unschedule('daily-scheduled-recall-check');
  END IF;
END $$;

SELECT cron.schedule(
  'daily-scheduled-recall-check',
  '*/30 * * * *',
  $$SELECT private.call_edge_function('scheduled-recall-check');$$
);
