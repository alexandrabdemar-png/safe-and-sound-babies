
ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_user_id_key;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS stripe_subscription_id text UNIQUE;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS product_id text;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS price_id text;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS current_period_start timestamptz;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS current_period_end timestamptz;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean DEFAULT false;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS environment text NOT NULL DEFAULT 'sandbox';
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
GRANT ALL ON public.subscriptions TO service_role;
