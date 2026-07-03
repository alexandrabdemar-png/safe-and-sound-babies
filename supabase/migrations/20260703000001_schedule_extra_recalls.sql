-- Schedule the USDA FSIS / NHTSA / Health Canada / EU Safety Gate sync
-- (check-extra-recalls.ts) alongside the existing CPSC/FDA job, reusing the
-- private.call_recall_hook() helper and Vault secrets set up in
-- 20260702000000_apns_push_and_cron.sql. Runs at 3:05am, between
-- daily-check-recalls (3:00) and daily-check-product-alerts (3:10), so the
-- in-app alert generation job sees these matches too.
SELECT cron.schedule(
  'daily-check-extra-recalls',
  '5 3 * * *',
  $$SELECT private.call_recall_hook('/api/public/hooks/check-extra-recalls');$$
);
