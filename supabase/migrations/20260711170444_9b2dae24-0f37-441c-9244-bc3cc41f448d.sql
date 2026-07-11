-- Audit remediation Phase A: schema for adjusted-age, per-source freshness
-- tracking, recall-update re-notification, cross-source dedup, per-brand
-- coverage view, and a dead-man's-switch for the recall pipeline.

-- ── 1. Adjusted age: original due date on children ──────────────────────
ALTER TABLE public.children
  ADD COLUMN IF NOT EXISTS due_date DATE;

COMMENT ON COLUMN public.children.due_date IS
  'Original expected date of delivery. Used to compute adjusted (corrected) age for babies born prematurely — safety/developmental milestones per AAP guidance are typically tied to adjusted age until ~24 months chronological.';

COMMENT ON COLUMN public.children.birth_week IS
  'Gestational age in completed weeks at birth (e.g. 32 = 32-weeker). Optional secondary input to due_date; either can drive adjusted-age math.';

-- Sanity guard: due_date shouldn''t be more than ~45 weeks before or after DOB.
-- Enforced via trigger (CHECK cannot reference other columns portably across
-- restore, and the project standard is trigger-based cross-column rules).
CREATE OR REPLACE FUNCTION public.children_validate_due_date()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.due_date IS NOT NULL AND NEW.date_of_birth IS NOT NULL THEN
    IF NEW.due_date < NEW.date_of_birth - INTERVAL '120 days'
       OR NEW.due_date > NEW.date_of_birth + INTERVAL '120 days' THEN
      RAISE EXCEPTION 'due_date must be within ~4 months of date_of_birth';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS children_validate_due_date_trg ON public.children;
CREATE TRIGGER children_validate_due_date_trg
  BEFORE INSERT OR UPDATE OF due_date, date_of_birth ON public.children
  FOR EACH ROW EXECUTE FUNCTION public.children_validate_due_date();

-- ── 2. Per-source sync status (freshness + dead-man''s-switch) ───────────
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
CREATE POLICY "Anyone can read recall source freshness"
  ON public.recall_source_status FOR SELECT
  TO anon, authenticated
  USING (true);

COMMENT ON TABLE public.recall_source_status IS
  'Per-source last-checked / last-success timestamps. Read by the UI to render "Data as of {timestamp}" and to drive the dead-man''s-switch that alerts when a source has been failing for >26h.';

-- ── 3. Recall content hash for update re-notification ──────────────────
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

-- ── 4. Per-brand recall-coverage view (internal health dashboard) ───────
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

-- ── 5. Dead-man''s-switch: flag if the batch hasn''t succeeded in >26h ──
-- We schedule a *second* cron that inspects cron.job_run_details and writes
-- a row into recall_source_status(source='__pipeline__') with the health of
-- the batch itself, so the UI (and the same alerts.tsx surface) can show
-- "Recall checks have been failing since X" without any external monitoring.
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

-- Every 6h — cheap health check, independent of the daily batch itself.
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