-- Admin access policy
-- =============================================================================
-- POLICY STATEMENT
-- Admins (human operators) may only access AGGREGATE statistics.
-- No policy, role, or query should allow an admin to SELECT individual rows
-- from children, profiles, products, child_measurements, milestones,
-- product_guidelines, product_alerts, or any other user-data table.
--
-- System automation (service_role / supabaseAdmin) is permitted to access
-- individual rows ONLY for the following trusted, server-side operations:
--   1. CPSC recall sync — match recalls against products to flag users
--   2. Product-alert fan-out — read products to generate expiry/size alerts
--   3. Stripe webhook — write subscription rows on payment events
--
-- Anything else must use a user-scoped JWT (RLS enforced).
-- =============================================================================

-- ────────────────────────────────────────────────────────────
-- 1. Create a dedicated `reporting` role for analytics queries.
--    This role does NOT bypass RLS — it only has access to the
--    aggregate view defined below.
-- ────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'reporting') THEN
    CREATE ROLE reporting NOLOGIN;
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 2. Aggregate-only stats view.
--    Returns counts and averages only — no user IDs, names, dates,
--    barcodes, or any other value that could identify an individual.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.admin_stats
  WITH (security_invoker = true)   -- runs as the caller, respects RLS
AS
SELECT
  (SELECT COUNT(*) FROM public.profiles)            AS total_users,
  (SELECT COUNT(*) FROM public.children)            AS total_children,
  (SELECT COUNT(*) FROM public.products)            AS total_products,
  (SELECT COUNT(*) FROM public.products
     WHERE recalled = true)                         AS recalled_products,
  (SELECT COUNT(*) FROM public.subscriptions
     WHERE status IN ('active','trialing'))         AS active_subscriptions,
  (SELECT COUNT(*) FROM public.bottles)             AS total_bottle_logs,
  (SELECT COUNT(*) FROM public.product_alerts)      AS total_product_alerts,
  (SELECT COUNT(*) FROM public.recalls)             AS total_cpsc_recalls;

-- Revoke public access; grant only to reporting role
REVOKE ALL ON public.admin_stats FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.admin_stats TO reporting;

-- ────────────────────────────────────────────────────────────
-- 3. Explicitly deny the `reporting` role from reading any
--    individual-row tables that contain user data.
-- ────────────────────────────────────────────────────────────
REVOKE ALL ON public.profiles            FROM reporting;
REVOKE ALL ON public.children            FROM reporting;
REVOKE ALL ON public.products            FROM reporting;
REVOKE ALL ON public.child_measurements  FROM reporting;
REVOKE ALL ON public.milestones          FROM reporting;
REVOKE ALL ON public.product_guidelines  FROM reporting;
REVOKE ALL ON public.product_alerts      FROM reporting;
REVOKE ALL ON public.subscriptions       FROM reporting;
REVOKE ALL ON public.bottles             FROM reporting;
REVOKE ALL ON public.product_recalls     FROM reporting;
REVOKE ALL ON public.insight_dismissals  FROM reporting;

-- ────────────────────────────────────────────────────────────
-- 4. Policy-level comments on every user-data table.
--    These are database-level documentation that any future migration
--    author or DB inspector will see via \d+ or pg_description.
-- ────────────────────────────────────────────────────────────
COMMENT ON TABLE public.profiles IS
  'ADMIN ACCESS: aggregate counts via admin_stats view only. '
  'No admin or reporting role may SELECT individual rows.';

COMMENT ON TABLE public.children IS
  'ADMIN ACCESS: aggregate counts via admin_stats view only. '
  'Individual rows are user-private; RLS policy: user_id = auth.uid().';

COMMENT ON TABLE public.products IS
  'ADMIN ACCESS: aggregate counts via admin_stats view only. '
  'Individual rows are user-private; RLS policy: user_id = auth.uid().';

COMMENT ON TABLE public.child_measurements IS
  'ADMIN ACCESS: aggregate counts via admin_stats view only. '
  'Individual rows are user-private; RLS policy: user_id = auth.uid().';

COMMENT ON TABLE public.milestones IS
  'ADMIN ACCESS: aggregate counts via admin_stats view only. '
  'Individual rows are scoped to the owning child (child_id → children.user_id).';

COMMENT ON TABLE public.product_guidelines IS
  'ADMIN ACCESS: aggregate counts via admin_stats view only. '
  'Individual rows are user-private; RLS policy: user_id = auth.uid().';

COMMENT ON TABLE public.product_alerts IS
  'ADMIN ACCESS: aggregate counts via admin_stats view only. '
  'Individual rows are user-private; RLS policy: user_id = auth.uid().';

COMMENT ON TABLE public.subscriptions IS
  'ADMIN ACCESS: aggregate counts via admin_stats view only. '
  'Individual rows are user-private; writes are service_role (Stripe webhook) only.';

COMMENT ON TABLE public.bottles IS
  'ADMIN ACCESS: aggregate counts via admin_stats view only. '
  'Individual rows are user-private; RLS policy: user_id = auth.uid().';
