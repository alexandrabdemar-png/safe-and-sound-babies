-- Moves the recall-check pipeline from once daily to hourly. CPSC/FDA don't
-- publish continuously (a few times a week, in batches), so "every few
-- minutes" was considered and rejected — it would mostly poll for nothing,
-- cost ~1000x the invocations for no real freshness gain, and risks
-- rate-limiting against CPSC's public API. Hourly meaningfully cuts the
-- worst-case staleness window from up to 24h down to under 1h without that
-- downside.
--
-- Unschedule-then-reschedule (rather than trusting cron.schedule() to
-- update an existing job by name in place) to match the established
-- pattern this codebase already uses for the exact same job in
-- 20260810185839_...sql, rather than assuming pg_cron version behavior.
--
-- Same job name ('daily-scheduled-recall-check') and same command as
-- before, on purpose — check_recall_pipeline_liveness() below (and
-- DataAsOf.tsx) both key off this exact job name. Renaming it would
-- silently break that join for no real benefit; the name being a slight
-- misnomer now is the smaller cost.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-scheduled-recall-check') THEN
    PERFORM cron.unschedule('daily-scheduled-recall-check');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'recall-pipeline-liveness') THEN
    PERFORM cron.unschedule('recall-pipeline-liveness');
  END IF;
END $$;

SELECT cron.schedule(
  'daily-scheduled-recall-check',
  '5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://vgafdyiaxzqwkeixcbcj.supabase.co/functions/v1/scheduled-recall-check',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZnYWZkeWlheHpxd2tlaXhjYmNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4NTg3NTQsImV4cCI6MjA5NjQzNDc1NH0.ksUym7vXTtybpmvCnECumCHZQc2mxCIvOLmyKqD8W20","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZnYWZkeWlheHpxd2tlaXhjYmNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4NTg3NTQsImV4cCI6MjA5NjQzNDc1NH0.ksUym7vXTtybpmvCnECumCHZQc2mxCIvOLmyKqD8W20"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);

-- Staleness threshold tightened from 26h to 3h to match — flagging the
-- pipeline as unhealthy after missing ~2-3 consecutive hourly runs, instead
-- of only after missing an entire day's worth of the old daily cadence.
-- Otherwise a genuinely broken hourly job could run silently for over a day
-- before this health check (or the DataAsOf.tsx banner it feeds) noticed.
CREATE OR REPLACE FUNCTION private.check_recall_pipeline_liveness()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron, extensions
AS $$
DECLARE
  last_success TIMESTAMPTZ;
  last_attempt TIMESTAMPTZ;
  last_status  TEXT;
BEGIN
  SELECT MAX(start_time) FILTER (WHERE status = 'succeeded'),
         MAX(start_time),
         (ARRAY_AGG(status ORDER BY start_time DESC))[1]
    INTO last_success, last_attempt, last_status
  FROM cron.job_run_details d
  JOIN cron.job j ON j.jobid = d.jobid
  WHERE j.jobname = 'daily-scheduled-recall-check'
    AND d.start_time > now() - INTERVAL '14 days';

  INSERT INTO public.recall_source_status (
    source, last_attempt_at, last_success_at, last_error,
    consecutive_failures, updated_at
  )
  VALUES (
    '__pipeline__',
    last_attempt,
    last_success,
    CASE WHEN last_success IS NULL OR last_success < now() - INTERVAL '3 hours'
         THEN 'Recall pipeline has not completed successfully in the last 3 hours'
         ELSE NULL END,
    CASE WHEN last_status = 'succeeded' THEN 0 ELSE 1 END,
    now()
  )
  ON CONFLICT (source) DO UPDATE
  SET last_attempt_at = EXCLUDED.last_attempt_at,
      last_success_at = EXCLUDED.last_success_at,
      last_error      = EXCLUDED.last_error,
      consecutive_failures = CASE
        WHEN EXCLUDED.last_error IS NULL THEN 0
        ELSE public.recall_source_status.consecutive_failures + 1
      END,
      updated_at = now();
END;
$$;

-- The health check itself only ran every 6h, which would blunt the new 3h
-- threshold above — a real outage could still go ~9h (3h threshold + up to
-- 6h until the next health-check sample) before surfacing. Tightened to
-- every 2h so it stays actionable against the new threshold.
SELECT cron.schedule(
  'recall-pipeline-liveness',
  '15 */2 * * *',
  $c$SELECT private.check_recall_pipeline_liveness();$c$
);
