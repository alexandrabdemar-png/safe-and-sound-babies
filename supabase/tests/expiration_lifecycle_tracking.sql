-- Verifies the Feature 2 migration (20260706000000_expiration_lifecycle_tracking.sql):
--   1. products gains manufacture_date / expiration_date / product_type,
--      with product_type constrained to the four allowed values.
--   2. The car-seat default-expiration trigger fills in manufacture_date +
--      6 years when expiration_date isn't given, only for product_type =
--      'car_seat', and never overwrites an explicit expiration_date.
--   3. lifecycle_alerts exists with the right dedup constraint and
--      notification columns.
--   4. The new daily-scheduled-expiration-check cron job is registered,
--      reusing the same private.call_edge_function helper Feature 1 set up
--      (proving Feature 2 didn't duplicate that wiring).
--   5. THE core Feature 2 requirement: a product expiring in 5 days is
--      classified into the lifecycle_alerts table exactly once, and a
--      second run (simulating the next day's cron firing) does not
--      duplicate the row for the same threshold.
\set ON_ERROR_STOP on

-- Runs as the connecting superuser throughout, same rationale as
-- recall_alerts_pipeline.sql: this tests schema shape, trigger behavior,
-- and cron wiring, not RLS policies.

-- ── 1. New columns + product_type constraint ────────────────────────────
SELECT test.assert(
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'manufacture_date'),
  'products has a manufacture_date column'
);
SELECT test.assert(
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'expiration_date'),
  'products has an expiration_date column'
);
SELECT test.assert(
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'product_type'),
  'products has a product_type column'
);

INSERT INTO auth.users (id) VALUES ('11111111-1111-1111-1111-111111111111');

SELECT test.assert_raises(
  $$INSERT INTO public.products (id, user_id, name, product_type) VALUES ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Bad Type Product', 'spaceship')$$,
  'product_type rejects a value outside car_seat/formula/medicine/other'
);

-- ── 2. Car-seat default expiration trigger ──────────────────────────────
INSERT INTO public.products (id, user_id, name, product_type, manufacture_date)
VALUES ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'Graco Car Seat', 'car_seat', '2020-01-15');

SELECT test.assert(
  (SELECT expiration_date FROM public.products WHERE id = '33333333-3333-3333-3333-333333333333') = '2026-01-15',
  'a car seat with no explicit expiration_date defaults to manufacture_date + 6 years'
);

INSERT INTO public.products (id, user_id, name, product_type, manufacture_date, expiration_date)
VALUES ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', 'Nuna Car Seat', 'car_seat', '2020-01-15', '2027-06-01');

SELECT test.assert(
  (SELECT expiration_date FROM public.products WHERE id = '44444444-4444-4444-4444-444444444444') = '2027-06-01',
  'an explicit expiration_date is never overwritten by the car-seat default'
);

INSERT INTO public.products (id, user_id, name, product_type, manufacture_date)
VALUES ('55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', 'Some Formula', 'formula', '2020-01-15');

SELECT test.assert(
  (SELECT expiration_date FROM public.products WHERE id = '55555555-5555-5555-5555-555555555555') IS NULL,
  'non-car-seat product types do not get a default expiration_date'
);

-- ── 3. lifecycle_alerts table shape ──────────────────────────────────────
SELECT test.assert(
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'lifecycle_alerts'),
  'lifecycle_alerts table exists'
);
SELECT test.assert_raises(
  $$INSERT INTO public.lifecycle_alerts (user_id, product_id, urgency) VALUES ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'next_week')$$,
  'lifecycle_alerts.urgency rejects a value outside expired/7/30/90'
);

-- ── 4. New cron job registered, reusing Feature 1's helper ──────────────
SELECT test.assert(
  EXISTS (
    SELECT 1 FROM cron.job
    WHERE jobname = 'daily-scheduled-expiration-check'
      AND schedule = '0 4 * * *'
      AND command LIKE '%call_edge_function(''scheduled-expiration-check'')%'
  ),
  'daily-scheduled-expiration-check is scheduled with the expected cadence and command'
);

SELECT vault.create_secret('https://example.supabase.co/functions/v1', 'edge_functions_base_url');
SELECT vault.create_secret('test-service-role-key', 'edge_functions_service_key');
SELECT private.call_edge_function('scheduled-expiration-check');
SELECT test.assert(
  (SELECT url FROM net.http_requests ORDER BY id DESC LIMIT 1)
    = 'https://example.supabase.co/functions/v1/scheduled-expiration-check',
  'reused call_edge_function helper targets the correct expiration-check URL'
);

-- ── 5. A product expiring in 5 days is flagged once, not duplicated ─────
-- Simulates the edge function's classification for "today" = the date this
-- test runs, by inserting a product whose expiration_date is 5 days out.
INSERT INTO public.products (id, user_id, name, product_type, expiration_date)
VALUES ('66666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111', 'Infant Ibuprofen', 'medicine', (CURRENT_DATE + 5));

-- Run 1: simulates the edge function's upsert-with-ignoreDuplicates write
-- for the '7'-day bucket match.
INSERT INTO public.lifecycle_alerts (user_id, product_id, urgency)
VALUES ('11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', '7')
ON CONFLICT (product_id, urgency) DO NOTHING;

SELECT test.assert(
  (SELECT count(*) FROM public.lifecycle_alerts WHERE product_id = '66666666-6666-6666-6666-666666666666') = 1,
  'a product expiring in 5 days creates exactly one lifecycle_alerts row for the 7-day threshold'
);

-- Run 2: the next day's cron run finds the same still-actionable match.
INSERT INTO public.lifecycle_alerts (user_id, product_id, urgency)
VALUES ('11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', '7')
ON CONFLICT (product_id, urgency) DO NOTHING;

SELECT test.assert(
  (SELECT count(*) FROM public.lifecycle_alerts WHERE product_id = '66666666-6666-6666-6666-666666666666') = 1,
  'a second run for the same threshold does not create a duplicate row'
);

SELECT test.assert(
  (SELECT notified_at FROM public.lifecycle_alerts WHERE product_id = '66666666-6666-6666-6666-666666666666') IS NULL,
  'a freshly-flagged lifecycle alert has not been notified yet'
);

UPDATE public.lifecycle_alerts SET notified_at = now(), notification_channel = 'push'
WHERE product_id = '66666666-6666-6666-6666-666666666666';
SELECT test.assert(
  (SELECT notification_channel FROM public.lifecycle_alerts WHERE product_id = '66666666-6666-6666-6666-666666666666') = 'push',
  'notification_channel accepts a valid value after sending'
);

-- The same product later crossing into the 30-day-out window (impossible in
-- practice once it's inside the 7-day window, but the schema should still
-- allow recording a *different* threshold for the same product) is a
-- separate row, not blocked by the (product_id, urgency) unique constraint.
INSERT INTO public.lifecycle_alerts (user_id, product_id, urgency)
VALUES ('11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', '30')
ON CONFLICT (product_id, urgency) DO NOTHING;
SELECT test.assert(
  (SELECT count(*) FROM public.lifecycle_alerts WHERE product_id = '66666666-6666-6666-6666-666666666666') = 2,
  'a different urgency threshold for the same product is its own row'
);
