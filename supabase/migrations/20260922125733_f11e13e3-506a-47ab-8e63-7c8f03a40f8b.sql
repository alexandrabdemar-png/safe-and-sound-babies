-- lovable-cron-fallback-reviewed: child-safety recall alerts; 30-min cadence is the product's stated max staleness window (48 runs/day, 6 free public feeds); cost trade-off explained to the user
CREATE TABLE IF NOT EXISTS public.recall_scan_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  duration_ms integer,
  status text NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'success', 'partial', 'failed')),
  products_checked integer,
  records_fetched integer,
  new_recalls integer,
  total_matches integer,
  notified integer,
  source_stats jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS recall_scan_runs_started_at_idx
  ON public.recall_scan_runs (started_at DESC);

GRANT ALL ON public.recall_scan_runs TO service_role;
GRANT SELECT ON public.recall_scan_runs TO authenticated;

ALTER TABLE public.recall_scan_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read recall scan runs" ON public.recall_scan_runs;
CREATE POLICY "Admins can read recall scan runs"
  ON public.recall_scan_runs
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DO $$
DECLARE
  v_cmd text;
BEGIN
  SELECT command INTO v_cmd FROM cron.job WHERE jobname = 'daily-scheduled-recall-check';
  IF v_cmd IS NOT NULL THEN
    PERFORM cron.unschedule('daily-scheduled-recall-check');
    PERFORM cron.schedule('daily-scheduled-recall-check', '*/30 * * * *', v_cmd);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'check-product-alerts-daily') THEN
    PERFORM cron.unschedule('check-product-alerts-daily');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'product-alerts-check') THEN
    PERFORM cron.unschedule('product-alerts-check');
  END IF;
END $$;