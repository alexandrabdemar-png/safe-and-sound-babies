-- Apple purchase saves use ON CONFLICT (apple_original_transaction_id).
-- A partial unique index cannot be matched by that clause (error 42P10),
-- so every Apple purchase verification failed. A plain unique constraint
-- still allows many NULLs (Stripe rows) and can be matched.
DROP INDEX IF EXISTS public.subscriptions_apple_original_transaction_id_idx;
ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_apple_original_transaction_id_key UNIQUE (apple_original_transaction_id);