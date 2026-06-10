-- RLS audit & fix migration
-- Confirms RLS is enabled on every user-data table and fills in missing policies.
-- Safe to run on an already-correct database (all DDL uses IF NOT EXISTS / DROP IF EXISTS).

-- ────────────────────────────────────────────────────────────
-- 1. CHILDREN  (already correct – idempotent re-apply)
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.children ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own children" ON public.children;
CREATE POLICY "Users manage own children"
  ON public.children FOR ALL TO authenticated
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────
-- 2. PRODUCTS  (already correct – idempotent re-apply)
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own products" ON public.products;
CREATE POLICY "Users manage own products"
  ON public.products FOR ALL TO authenticated
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────
-- 3. PRODUCT_GUIDELINES  (already correct – idempotent re-apply)
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.product_guidelines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own product_guidelines" ON public.product_guidelines;
CREATE POLICY "Users manage own product_guidelines"
  ON public.product_guidelines FOR ALL TO authenticated
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────
-- 4. CHILD_MEASUREMENTS  (already correct – idempotent re-apply)
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.child_measurements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own child_measurements" ON public.child_measurements;
CREATE POLICY "Users manage own child_measurements"
  ON public.child_measurements FOR ALL TO authenticated
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────
-- 5. MILESTONES  (already correct – idempotent re-apply)
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage milestones of own children" ON public.milestones;
CREATE POLICY "Users manage milestones of own children"
  ON public.milestones FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.children c
      WHERE c.id = milestones.child_id AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.children c
      WHERE c.id = milestones.child_id AND c.user_id = auth.uid()
    )
  );

-- ────────────────────────────────────────────────────────────
-- 6. PRODUCT_ALERTS  (already correct – idempotent re-apply)
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.product_alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own product_alerts" ON public.product_alerts;
CREATE POLICY "Users manage own product_alerts"
  ON public.product_alerts FOR ALL TO authenticated
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────
-- 7. PUSH TOKENS
-- There is no separate push_tokens table; push tokens are stored as
-- expo_push_token column on public.profiles, which already has full
-- per-user RLS policies. No additional action required.
-- ────────────────────────────────────────────────────────────

-- ────────────────────────────────────────────────────────────
-- 8. SUBSCRIPTIONS
-- GAP: previous migration only added a SELECT policy for authenticated.
-- The Stripe webhook runs as service_role (bypasses RLS by default), but
-- add explicit policies for clarity and to prevent authenticated users
-- from writing their own subscription rows.
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Remove any overly-permissive write policies left by earlier migrations
DROP POLICY IF EXISTS "Users can insert subscriptions"        ON public.subscriptions;
DROP POLICY IF EXISTS "Users can update subscriptions"        ON public.subscriptions;
DROP POLICY IF EXISTS "Users view own subscription"           ON public.subscriptions;
DROP POLICY IF EXISTS "Users can view own subscription"       ON public.subscriptions;
DROP POLICY IF EXISTS "Service role manages subscriptions"    ON public.subscriptions;

-- Authenticated users: read their own row only
CREATE POLICY "Users read own subscription"
  ON public.subscriptions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- service_role (Stripe webhook): full access
CREATE POLICY "Service role manages subscriptions"
  ON public.subscriptions FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- ────────────────────────────────────────────────────────────
-- 9. Additional tables – ensure RLS is on (defensive)
-- ────────────────────────────────────────────────────────────

-- profiles (already has per-column policies; keep enabled)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- bottles
ALTER TABLE public.bottles ENABLE ROW LEVEL SECURITY;

-- recalls (global lookup table – all authenticated users may read)
ALTER TABLE public.recalls ENABLE ROW LEVEL SECURITY;

-- product_recalls (per-user join table)
ALTER TABLE public.product_recalls ENABLE ROW LEVEL SECURITY;

-- insight_dismissals
ALTER TABLE public.insight_dismissals ENABLE ROW LEVEL SECURITY;
