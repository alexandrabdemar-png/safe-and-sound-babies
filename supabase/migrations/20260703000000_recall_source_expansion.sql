-- Support four new recall sources (USDA FSIS, NHTSA, Health Canada,
-- EU Safety Gate) alongside the existing CPSC/FDA/critical sources, and
-- structured identifiers where a source actually provides them (model
-- number, affected manufacture-date range) instead of only free-text.
--
-- Note: no source ever reliably provides a UPC/barcode for recalled units —
-- recalls track manufacture date/lot/serial ranges, not retail barcodes —
-- so this does not add a upc/barcode column to `recalls`.
ALTER TABLE public.recalls
  ADD COLUMN IF NOT EXISTS model text,
  ADD COLUMN IF NOT EXISTS affected_date_start date,
  ADD COLUMN IF NOT EXISTS affected_date_end date,
  ADD COLUMN IF NOT EXISTS official boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.recalls.official IS
  'false for recalls sourced from an unofficial third-party mirror (e.g. the EU Safety Gate feed, which has no official EC API) — surfaced in the UI so users know not to treat a miss here as authoritative.';
