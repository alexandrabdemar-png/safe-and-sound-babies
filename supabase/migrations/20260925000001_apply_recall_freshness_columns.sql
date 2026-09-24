-- Applies the parts of 20260711170444_9b2dae24-0f37-441c-9244-bc3cc41f448d.sql
-- that were never actually run against production (confirmed missing:
-- public.recall_source_status, recalls.severity_tier/content_hash/
-- hazard_fingerprint), while skipping that migration's Section 1
-- (children.due_date/birth_week + the cross-column validation trigger) —
-- those columns and that trigger were deliberately dropped by the later
-- 20260818000000_purge_child_birthdate_and_measurements.sql, which DID
-- apply, so re-adding/commenting on them here would fail against the
-- current schema. Sections 2-5 don't touch `children` at all and are
-- otherwise identical to the original.

-- ── Per-source sync status (freshness + dead-man's-switch) ─────────────
CREATE TABLE IF NOT EXISTS public.recall_source_status (
  source TEXT PRIMARY KEY,
  last_attempt_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_error TEXT,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  records_last_run INTEGER,
  matches_last_run INTEGER,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.recall_source_status TO authenticated;
GRANT SELECT ON public.recall_source_status TO anon;
GRANT ALL ON public.recall_source_status TO service_role;
ALTER TABLE public.recall_source_status ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read recall source freshness" ON public.recall_source_status;
CREATE POLICY "Anyone can read recall source freshness"
  ON public.recall_source_status FOR SELECT
  TO anon, authenticated
  USING (true);

COMMENT ON TABLE public.recall_source_status IS
  'Per-source last-checked / last-success timestamps. Read by the UI to render "Data as of {timestamp}" and to drive the dead-man''s-switch that alerts when a source has been failing for >26h.';

-- ── Recall content hash for update re-notification ─────────────────────
ALTER TABLE public.recalls
  ADD COLUMN IF NOT EXISTS content_hash TEXT,
  ADD COLUMN IF NOT EXISTS hazard_fingerprint TEXT,
  ADD COLUMN IF NOT EXISTS severity_tier TEXT;

COMMENT ON COLUMN public.recalls.content_hash IS
  'Stable hash of the notice-material fields (title, hazard, remedy, description). When this changes between syncs, affected users get a re-notification with an "Updated recall" title.';
COMMENT ON COLUMN public.recalls.hazard_fingerprint IS
  'Lowercased normalized title used to dedup the same physical recall appearing in multiple upstream feeds (e.g. CPSC + Health Canada).';
COMMENT ON COLUMN public.recalls.severity_tier IS
  'life_threatening | injury | non_injury — derived at ingest from hazard/remedy text. Drives UI severity styling.';

ALTER TABLE public.recalls
  DROP CONSTRAINT IF EXISTS recalls_severity_tier_check;
ALTER TABLE public.recalls
  ADD CONSTRAINT recalls_severity_tier_check
  CHECK (severity_tier IS NULL OR severity_tier IN ('life_threatening', 'injury', 'non_injury'));

CREATE INDEX IF NOT EXISTS recalls_hazard_fingerprint_idx
  ON public.recalls (hazard_fingerprint);

ALTER TABLE public.product_recalls
  ADD COLUMN IF NOT EXISTS notified_content_hash TEXT;

COMMENT ON COLUMN public.product_recalls.notified_content_hash IS
  'content_hash of the recall version the user was last notified about. If the current recalls.content_hash differs, the batch job re-notifies with an "Updated recall" push.';

-- ── Per-brand recall-coverage view (internal health dashboard) ─────────
CREATE OR REPLACE VIEW public.recall_brand_coverage
WITH (security_invoker = on) AS
SELECT
  COALESCE(NULLIF(TRIM(LOWER(brand)), ''), '(unknown)') AS brand_lower,
  COUNT(*)                          AS total_recalls,
  MAX(recall_date)::date            AS latest_recall_date,
  MIN(recall_date)::date            AS earliest_recall_date,
  COUNT(DISTINCT source)            AS sources_seen
FROM public.recalls
GROUP BY 1;

GRANT SELECT ON public.recall_brand_coverage TO authenticated;

COMMENT ON VIEW public.recall_brand_coverage IS
  'Aggregate view of recall counts per (lowercased) brand across all sources. Used by the internal /admin coverage check to spot brands whose integration may have silently gone dark.';

-- ── Dead-man's-switch: flag if the batch hasn't succeeded in >26h ──────
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
    CASE WHEN last_success IS NULL OR last_success < now() - INTERVAL '26 hours'
         THEN 'Recall pipeline has not completed successfully in the last 26 hours'
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

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'recall-pipeline-liveness') THEN
    PERFORM cron.schedule(
      'recall-pipeline-liveness',
      '15 */6 * * *',
      $c$SELECT private.check_recall_pipeline_liveness();$c$
    );
  END IF;
END $$;
