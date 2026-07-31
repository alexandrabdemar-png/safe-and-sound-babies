-- The EU Safety Gate recall source was pulling from a third-party
-- (Opendatasoft) mirror of the EU's former RAPEX system, not an official
-- EU feed — the European Commission doesn't publish a direct Safety Gate
-- data feed. Given that provenance/freshness uncertainty, and that this
-- app's users and their products are US-based (a US-sold product's recall
-- already surfaces via CPSC/FDA/USDA FSIS/NHTSA), the fetch was removed
-- from supabase/functions/_shared/allRecallSources.ts.
--
-- This migration cleans up any rows already synced from that source by a
-- previous scheduled run. `product_recalls.recall_id` has
-- `ON DELETE CASCADE` back to `recalls`, so deleting the `recalls` rows
-- automatically removes any matching `product_recalls` rows too — no
-- orphaned per-user matches are left behind.
DELETE FROM public.recalls WHERE source = 'eu_safety_gate';
DELETE FROM public.recall_source_status WHERE source = 'eu_safety_gate';
