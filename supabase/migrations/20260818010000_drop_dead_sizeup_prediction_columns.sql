-- Follow-up to 20260818000000_purge_child_birthdate_and_measurements.sql:
-- that migration purged the child's own birthdate/height/weight, but left
-- two other columns that were *derived from* that same child data and are
-- now permanently dead — nothing in the app computes or reads them
-- anymore (the growth-tracking / size-up-prediction feature was removed
-- entirely, see src/lib/predictions.ts and src/lib/insights.ts).

-- products.next_size_at (legacy manual field) and predicted_sizeup_date
-- (AI/growth-model-computed) both held a size-up date computed from the
-- child's height/weight/age — the same data we no longer store, so these
-- would only ever hold stale values from before this change.
ALTER TABLE public.products
  DROP COLUMN IF EXISTS next_size_at,
  DROP COLUMN IF EXISTS predicted_sizeup_date;

-- user_notification_settings.size_up_enabled toggled push/in-app alerts
-- for the same removed feature.
ALTER TABLE public.user_notification_settings
  DROP COLUMN IF EXISTS size_up_enabled;
