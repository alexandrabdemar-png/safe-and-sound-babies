-- Tightens the recall-check cadence from hourly (20260813210000) to every
-- 30 minutes, per explicit product decision — CPSC/FDA/etc. still only
-- publish a few times a week, but this halves the worst-case staleness
-- window from under 1h to under 30min at negligible added cost (a request
-- every 30min against 6 free public APIs, same as the existing hourly job
-- just twice as often).
--
-- Unschedule-then-reschedule to match the established pattern this
-- codebase already uses for the exact same job (see 20260813210000's own
-- comment on why, and 20260810185839 before it).
--
-- Same job name ('daily-scheduled-recall-check') and same command as
-- before — check_recall_pipeline_liveness() and DataAsOf.tsx both key off
-- this exact job name, and its 3h staleness threshold stays valid (if
-- anything more conservative) at the new cadence, so it's left as-is.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-scheduled-recall-check') THEN
    PERFORM cron.unschedule('daily-scheduled-recall-check');
  END IF;
END $$;

SELECT cron.schedule(
  'daily-scheduled-recall-check',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://vgafdyiaxzqwkeixcbcj.supabase.co/functions/v1/scheduled-recall-check',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZnYWZkeWlheHpxd2tlaXhjYmNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4NTg3NTQsImV4cCI6MjA5NjQzNDc1NH0.ksUym7vXTtybpmvCnECumCHZQc2mxCIvOLmyKqD8W20","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZnYWZkeWlheHpxd2tlaXhjYmNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4NTg3NTQsImV4cCI6MjA5NjQzNDc1NH0.ksUym7vXTtybpmvCnECumCHZQc2mxCIvOLmyKqD8W20"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);
