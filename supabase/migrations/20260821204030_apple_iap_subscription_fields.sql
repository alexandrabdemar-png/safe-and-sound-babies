-- Adds Apple In-App Purchase fields to subscriptions alongside the existing
-- Stripe ones, so a Pro subscription purchased through Apple on iOS (real
-- StoreKit, not the Stripe web checkout) can be recorded in the exact same
-- table/shape that computeIsPro()/useSubscription() already read — no
-- change needed to the entitlement-reading code path, only to what writes
-- into it. See src/lib/isPro.ts and src/hooks/useSubscription.ts.
--
-- payment_provider distinguishes which system owns a row. The two Apple
-- identifiers mirror stripe_subscription_id/stripe_customer_id:
--   apple_original_transaction_id — Apple's stable per-subscription id,
--     unchanged across renewals (the upsert conflict target, like
--     stripe_subscription_id).
--   apple_transaction_id — the most recent individual transaction id
--     (changes every renewal), kept for support/debugging/refund lookups.
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS payment_provider text NOT NULL DEFAULT 'stripe',
  ADD COLUMN IF NOT EXISTS apple_original_transaction_id text,
  ADD COLUMN IF NOT EXISTS apple_transaction_id text;

-- Existing rows are all Stripe-originated; nothing to backfill beyond the
-- DEFAULT already applied above.

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_payment_provider_check
  CHECK (payment_provider IN ('stripe', 'apple'));

-- Upsert conflict target for Apple-originated rows (mirrors the implicit
-- uniqueness stripe_subscription_id relies on via ON CONFLICT in the
-- Stripe webhook handler). Partial + unique so multiple Stripe-only rows
-- (apple_original_transaction_id IS NULL) are never compared against each
-- other by this index.
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_apple_original_transaction_id_idx
  ON public.subscriptions (apple_original_transaction_id)
  WHERE apple_original_transaction_id IS NOT NULL;
