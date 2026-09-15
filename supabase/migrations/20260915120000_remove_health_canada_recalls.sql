-- Health Canada recalls are no longer synced for the US-only launch (see
-- fetchAllExtraRecallSources in supabase/functions/_shared/allRecallSources.ts
-- and writeSourceStatus in supabase/functions/scheduled-recall-check/index.ts).
-- None of the app's tracked baby brands are Canada-exclusive, so these rows
-- were mostly duplicate or not-applicable-to-US-parents notices that made
-- Recall Radar/History confusing. This purges what was already ingested.

-- Remember which products had a health_canada-sourced match before deleting
-- it, so we know whose `recalled` flag needs re-evaluating afterward.
CREATE TEMP TABLE _hc_affected_products AS
SELECT DISTINCT pr.product_id
FROM public.product_recalls pr
JOIN public.recalls r ON r.id = pr.recall_id
WHERE r.source = 'health_canada';

-- Deleting the catalog rows cascades to product_recalls (ON DELETE CASCADE).
DELETE FROM public.recalls WHERE source = 'health_canada';

-- Clear `recalled` on any affected product left with no remaining match.
UPDATE public.products p
SET recalled = false
WHERE p.id IN (SELECT product_id FROM _hc_affected_products)
  AND NOT EXISTS (
    SELECT 1 FROM public.product_recalls pr WHERE pr.product_id = p.id
  );

DROP TABLE _hc_affected_products;

-- Drop the source-status row too — it's no longer written by the pipeline
-- and would otherwise sit around looking permanently stale/failed.
DELETE FROM public.recall_source_status WHERE source = 'health_canada';
