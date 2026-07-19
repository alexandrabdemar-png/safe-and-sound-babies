-- Batch/lot-level recall support.
--
-- Product-name matching alone can miss a recall that only affects specific
-- production batches/lots of an otherwise-fine product line, and can also
-- false-positive across unaffected variants of the same product. Adding an
-- optional lot/batch code on both sides lets the app surface a recall's
-- affected batch/lot info (when the source data has it) so a parent can
-- self-verify against their own product's sticker, and lets a matching
-- lot/batch code raise confidence beyond name-only matching.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS lot_number text;

ALTER TABLE public.recalls
  ADD COLUMN IF NOT EXISTS lot_pattern text;
