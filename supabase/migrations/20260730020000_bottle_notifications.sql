-- Bottles previously only got a countdown/toast/browser Notification while
-- the Bottles page happened to be open in a tab (bottles.tsx's client-side
-- setInterval) — nothing notified a parent who had closed the app.
-- scheduled-bottle-check (edge function) closes that gap with a real
-- push/email notification, running every 10 minutes since bottles are far
-- more time-sensitive than the daily product/recall checks (shortest
-- shelf life is 2 hours, shortest alert lead time offered is 15 minutes).
--
-- notified_at already existed on public.bottles (from its original
-- migration) but nothing ever wrote to it — this finishes wiring it up as
-- the one-shot idempotency marker for the new job, and adds
-- notification_channel alongside it (same pattern as product_recalls and
-- lifecycle_alerts) purely for auditing which channel actually delivered.
ALTER TABLE public.bottles
  ADD COLUMN IF NOT EXISTS notification_channel text
    CHECK (notification_channel IS NULL OR notification_channel IN ('push', 'email'));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'private' AND p.proname = 'call_edge_function'
  ) AND NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'bottle-expiration-check') THEN
    PERFORM cron.schedule(
      'bottle-expiration-check',
      '*/10 * * * *',
      $c$SELECT private.call_edge_function('scheduled-bottle-check');$c$
    );
  END IF;
END $$;
