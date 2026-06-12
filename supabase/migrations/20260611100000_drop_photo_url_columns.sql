-- Remove photo_url from products and milestones.
-- The column was never used in the application and is not referenced in any query.
-- IF NOT EXISTS guards make this safe to run on databases that never had the column.
ALTER TABLE public.products   DROP COLUMN IF EXISTS photo_url;
ALTER TABLE public.milestones DROP COLUMN IF EXISTS photo_url;
