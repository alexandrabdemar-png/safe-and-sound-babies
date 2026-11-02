ALTER TABLE public.product_recalls
  ADD COLUMN IF NOT EXISTS notified_at timestamptz,
  ADD COLUMN IF NOT EXISTS notification_channel text;
ALTER TABLE public.product_recalls
  DROP CONSTRAINT IF EXISTS product_recalls_notification_channel_check;
ALTER TABLE public.product_recalls
  ADD CONSTRAINT product_recalls_notification_channel_check
  CHECK (notification_channel IS NULL OR notification_channel IN ('push', 'email'));
NOTIFY pgrst, 'reload schema';