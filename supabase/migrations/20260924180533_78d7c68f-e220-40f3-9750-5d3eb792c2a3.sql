DROP TRIGGER IF EXISTS children_validate_due_date_trg ON public.children;
DROP FUNCTION IF EXISTS public.children_validate_due_date();
ALTER TABLE public.children
  DROP COLUMN IF EXISTS date_of_birth,
  DROP COLUMN IF EXISTS due_date,
  DROP COLUMN IF EXISTS birth_week,
  DROP COLUMN IF EXISTS height_inches,
  DROP COLUMN IF EXISTS weight_lbs,
  DROP COLUMN IF EXISTS measurements_updated_at;
DROP TABLE IF EXISTS public.child_measurements;
DROP TABLE IF EXISTS public.growth_logs;
ALTER TABLE public.products
  DROP COLUMN IF EXISTS next_size_at,
  DROP COLUMN IF EXISTS predicted_sizeup_date;
ALTER TABLE IF EXISTS public.user_notification_settings
  DROP COLUMN IF EXISTS size_up_enabled;