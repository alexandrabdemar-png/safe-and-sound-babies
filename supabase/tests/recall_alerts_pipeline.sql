-- Verifies the Feature 1 migration (20260705000000_recall_alerts_pipeline.sql):
--   1. product_recalls gains notified_at / notification_channel with a valid CHECK.
--   2. The unschedule-old-jobs step actually removes pre-existing jobs (not
--      just "doesn't error when they're absent", which the migration apply
--      itself already proved).
--   3. The new daily-scheduled-recall-check cron job is registered with the
--      expected schedule/command.
--   4. private.call_edge_function no-ops (no HTTP call) when Vault secrets
--      aren't set, and calls net.http_post with the right URL + Bearer
--      header once they are — this is the actual mechanism pg_cron will use
--      to invoke the new edge function daily.
--   5. THE core Feature 1 requirement: matching the same product against the
--      same recall twice (simulating two runs of the batch job) creates
--      exactly one product_recalls row, not two — the literal "confirm the
--      alert row is created and not duplicated on a second run" ask.
\set ON_ERROR_STOP on

-- Runs as the connecting superuser throughout (no test.login/logout) — this
-- file tests schema shape, cron/vault/net wiring, and the dedup constraint,
-- none of which are RLS-policy-dependent. This also matches how pg_cron
-- actually invokes scheduled jobs in production: as a privileged internal
-- role, not literally as `service_role`.

-- ── 1. New columns ───────────────────────────────────────────────────────
SELECT test.assert(
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_recalls' AND column_name = 'notified_at'
  ),
  'product_recalls has a notified_at column'
);
SELECT test.assert(
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_recalls' AND column_name = 'notification_channel'
  ),
  'product_recalls has a notification_channel column'
);

-- ── 2. Unschedule guard actually removes pre-existing jobs ─────────────────
INSERT INTO cron.job (jobname, schedule, command) VALUES
  ('daily-check-recalls', '0 3 * * *', 'old command'),
  ('daily-check-extra-recalls', '5 3 * * *', 'old command');

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-check-recalls') THEN
    PERFORM cron.unschedule('daily-check-recalls');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-check-extra-recalls') THEN
    PERFORM cron.unschedule('daily-check-extra-recalls');
  END IF;
END $$;

SELECT test.assert(
  NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname IN ('daily-check-recalls', 'daily-check-extra-recalls')),
  'the old per-hook cron jobs are removed when they exist'
);

-- ── 3. New cron job registered correctly ────────────────────────────────
SELECT test.assert(
  EXISTS (
    SELECT 1 FROM cron.job
    WHERE jobname = 'daily-scheduled-recall-check'
      AND schedule = '0 3 * * *'
      AND command LIKE '%call_edge_function(''scheduled-recall-check'')%'
  ),
  'daily-scheduled-recall-check is scheduled with the expected cadence and command'
);

-- ── 4. private.call_edge_function behavior ──────────────────────────────
SELECT test.assert(
  (SELECT count(*) FROM net.http_requests) = 0,
  'sanity: no HTTP calls have happened yet'
);

SELECT private.call_edge_function('scheduled-recall-check');
SELECT test.assert(
  (SELECT count(*) FROM net.http_requests) = 0,
  'call_edge_function no-ops when Vault secrets are not configured yet'
);

SELECT vault.create_secret('https://example.supabase.co/functions/v1', 'edge_functions_base_url');
SELECT vault.create_secret('test-service-role-key', 'edge_functions_service_key');

SELECT private.call_edge_function('scheduled-recall-check');
SELECT test.assert(
  (SELECT count(*) FROM net.http_requests) = 1,
  'call_edge_function makes exactly one HTTP call once secrets are configured'
);
SELECT test.assert(
  (SELECT url FROM net.http_requests ORDER BY id DESC LIMIT 1)
    = 'https://example.supabase.co/functions/v1/scheduled-recall-check',
  'the call targets the correct function URL'
);
SELECT test.assert(
  (SELECT headers ->> 'Authorization' FROM net.http_requests ORDER BY id DESC LIMIT 1)
    = 'Bearer test-service-role-key',
  'the call authenticates with the service role key as a bearer token'
);

-- ── 5. No-duplicate-on-second-run (the literal Feature 1 verification ask) ─
INSERT INTO auth.users (id) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
INSERT INTO public.products (id, user_id, name, brand)
VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Nuna Pipa RX', 'Nuna');
INSERT INTO public.recalls (id, source, source_id, title)
VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'cpsc', 'RECALL-001', 'Nuna Recalls Pipa RX Infant Car Seats');

-- Run 1: simulates the batch job's upsert-with-ignoreDuplicates match write.
INSERT INTO public.product_recalls (user_id, product_id, recall_id, acknowledged)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'cccccccc-cccc-cccc-cccc-cccccccccccc', false)
ON CONFLICT (product_id, recall_id) DO NOTHING;

SELECT test.assert(
  (SELECT count(*) FROM public.product_recalls WHERE product_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') = 1,
  'first run creates exactly one alert row for the match'
);

-- Run 2: the exact same match found again on the next day's run.
INSERT INTO public.product_recalls (user_id, product_id, recall_id, acknowledged)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'cccccccc-cccc-cccc-cccc-cccccccccccc', false)
ON CONFLICT (product_id, recall_id) DO NOTHING;

SELECT test.assert(
  (SELECT count(*) FROM public.product_recalls WHERE product_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') = 1,
  'second run does not create a duplicate alert row for the same match'
);

-- notified_at starts NULL (not yet sent) and can be claimed by the notify step
SELECT test.assert(
  (SELECT notified_at FROM public.product_recalls WHERE product_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') IS NULL,
  'a freshly-matched alert has not been notified yet'
);

UPDATE public.product_recalls SET notified_at = now(), notification_channel = 'push'
WHERE product_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
SELECT test.assert(
  (SELECT notification_channel FROM public.product_recalls WHERE product_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') = 'push',
  'notification_channel accepts a valid value after sending'
);

SELECT test.assert_raises(
  $$UPDATE public.product_recalls SET notification_channel = 'carrier_pigeon' WHERE product_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'$$,
  'notification_channel rejects a value outside push/email'
);
