-- Tracks when a product's recall status was actually last checked against
-- CPSC/FDA/USDA/NHTSA/etc, so the product detail screen can show an honest
-- "data synced on [date]" note instead of implying real-time accuracy.
-- Stamped in two places: the immediate live check-recalls call at
-- add/scan time (products_.new.tsx, products_.scan.tsx), and the daily
-- scheduled-recall-check cron for every product it re-checks.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS recall_checked_at timestamptz;
