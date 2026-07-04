-- Feature 4: caregiver sharing model + RLS hardening.
--
-- Introduces public.caregiver_access (child_id, caregiver_user_id, role
-- IN ('editor','viewer')) and two helper functions, then rewrites RLS on
-- every table scoped to a child or a product so a caregiver with a grant
-- can read (viewer) or read+write (editor) that child's data, while a
-- user with no grant — and no ownership — still gets nothing, exactly as
-- before this migration.
--
-- SCOPE: covers every table with a direct child_id or product_id column
-- that holds data ABOUT a child (children, products, milestones, bottles,
-- child_measurements, growth_logs, first_foods, insight_dismissals,
-- completed_tips, product_alerts, product_recalls, emergency_info).
-- Deliberately UNCHANGED (stays owner-only, not extended to caregivers):
--   - emergency_share_links: creating a share link is a higher-trust
--     action than viewing/editing child data, so it stays scoped to the
--     child's actual owner even for editor-role caregivers.
--   - product_guidelines, lifecycle_alerts: internal/generated data
--     (prediction inputs, notification bookkeeping) that isn't
--     caregiver-facing; not part of this pass.
--   - profiles, subscriptions, home_profile, notification_settings,
--     checklist_completions, emergency_contacts, product_catalog, recalls:
--     account-level or global data, not child-scoped, so the caregiver
--     sharing model doesn't apply to them at all.
--
-- Role semantics: 'viewer' can read; 'editor' can read+write. Ownership
-- (children.user_id) is NOT stored as a caregiver_access row — it's
-- always implicit and always satisfies both roles. Only the owner can
-- create/modify/revoke caregiver_access grants; a caregiver can view
-- their own grant and remove themselves, but cannot change their own
-- role — this is what blocks a viewer from self-escalating to editor.

CREATE TABLE IF NOT EXISTS public.caregiver_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  caregiver_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('editor', 'viewer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (child_id, caregiver_user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.caregiver_access TO authenticated;
GRANT ALL ON public.caregiver_access TO service_role;
ALTER TABLE public.caregiver_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners and grantees can view a caregiver_access row"
  ON public.caregiver_access FOR SELECT TO authenticated
  USING (
    caregiver_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.children c WHERE c.id = child_id AND c.user_id = auth.uid())
  );

CREATE POLICY "Only the child's owner can grant caregiver_access"
  ON public.caregiver_access FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.children c WHERE c.id = child_id AND c.user_id = auth.uid())
  );

-- No policy allows a caregiver to update their own row — this is the
-- mechanism that blocks a viewer from escalating themselves to editor.
CREATE POLICY "Only the child's owner can change a grant's role"
  ON public.caregiver_access FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.children c WHERE c.id = child_id AND c.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.children c WHERE c.id = child_id AND c.user_id = auth.uid()));

CREATE POLICY "Owner can revoke, or a caregiver can remove themselves"
  ON public.caregiver_access FOR DELETE TO authenticated
  USING (
    caregiver_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.children c WHERE c.id = child_id AND c.user_id = auth.uid())
  );

-- SECURITY DEFINER so evaluating it doesn't recurse back through the
-- calling policies of children/caregiver_access (which would otherwise be
-- re-evaluated as the calling role and could loop). Only ever reads —
-- never a privilege-escalation surface itself.
CREATE OR REPLACE FUNCTION public.has_child_access(p_child_id uuid, p_min_role text DEFAULT 'viewer')
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    EXISTS (SELECT 1 FROM public.children c WHERE c.id = p_child_id AND c.user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.caregiver_access ca
      WHERE ca.child_id = p_child_id
        AND ca.caregiver_user_id = auth.uid()
        AND (p_min_role = 'viewer' OR ca.role = 'editor')
    );
$$;
REVOKE ALL ON FUNCTION public.has_child_access(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_child_access(uuid, text) TO authenticated, service_role;

-- For product_id-scoped tables (product_recalls): a product not linked to
-- any child (child_id IS NULL) is plain single-owner data, since there's
-- no child relationship to share it through.
CREATE OR REPLACE FUNCTION public.has_product_access(p_product_id uuid, p_min_role text DEFAULT 'viewer')
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = p_product_id
      AND (
        p.user_id = auth.uid()
        OR (p.child_id IS NOT NULL AND public.has_child_access(p.child_id, p_min_role))
      )
  );
$$;
REVOKE ALL ON FUNCTION public.has_product_access(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_product_access(uuid, text) TO authenticated, service_role;

-- ── children ─────────────────────────────────────────────────────────────
-- INSERT/UPDATE/DELETE deliberately stay owner-only (not has_child_access):
-- an editor caregiver can manage a child's DATA but not rename/delete the
-- child record itself or affect who else has access to it. Also, INSERT's
-- WITH CHECK can't call has_child_access(id, ...) at all — the row being
-- inserted isn't visible to a subquery within the same statement, so that
-- would incorrectly evaluate false for every insert.
DROP POLICY IF EXISTS "Users manage own children" ON public.children;
CREATE POLICY "View own or shared children"
  ON public.children FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_child_access(id, 'viewer'));
CREATE POLICY "Insert own children"
  ON public.children FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Update own children"
  ON public.children FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Delete own children"
  ON public.children FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ── products (user_id + nullable child_id) ──────────────────────────────
DROP POLICY IF EXISTS "Users manage own products" ON public.products;
CREATE POLICY "View own or shared products"
  ON public.products FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR (child_id IS NOT NULL AND public.has_child_access(child_id, 'viewer')));
CREATE POLICY "Insert own products"
  ON public.products FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND (child_id IS NULL OR public.has_child_access(child_id, 'editor')));
CREATE POLICY "Update own or editor-shared products"
  ON public.products FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR (child_id IS NOT NULL AND public.has_child_access(child_id, 'editor')))
  WITH CHECK (auth.uid() = user_id OR (child_id IS NOT NULL AND public.has_child_access(child_id, 'editor')));
CREATE POLICY "Delete own or editor-shared products"
  ON public.products FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR (child_id IS NOT NULL AND public.has_child_access(child_id, 'editor')));

-- ── milestones (child_id NOT NULL, no user_id column) ───────────────────
DROP POLICY IF EXISTS "Users manage milestones of own children" ON public.milestones;
CREATE POLICY "View shared milestones"
  ON public.milestones FOR SELECT TO authenticated
  USING (public.has_child_access(child_id, 'viewer'));
CREATE POLICY "Insert editor-shared milestones"
  ON public.milestones FOR INSERT TO authenticated
  WITH CHECK (public.has_child_access(child_id, 'editor'));
CREATE POLICY "Update editor-shared milestones"
  ON public.milestones FOR UPDATE TO authenticated
  USING (public.has_child_access(child_id, 'editor'))
  WITH CHECK (public.has_child_access(child_id, 'editor'));
CREATE POLICY "Delete editor-shared milestones"
  ON public.milestones FOR DELETE TO authenticated
  USING (public.has_child_access(child_id, 'editor'));

-- ── bottles (user_id + nullable child_id) ───────────────────────────────
DROP POLICY IF EXISTS "Users manage own bottles" ON public.bottles;
CREATE POLICY "View own or shared bottles"
  ON public.bottles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR (child_id IS NOT NULL AND public.has_child_access(child_id, 'viewer')));
CREATE POLICY "Insert own bottles"
  ON public.bottles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND (child_id IS NULL OR public.has_child_access(child_id, 'editor')));
CREATE POLICY "Update own or editor-shared bottles"
  ON public.bottles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR (child_id IS NOT NULL AND public.has_child_access(child_id, 'editor')))
  WITH CHECK (auth.uid() = user_id OR (child_id IS NOT NULL AND public.has_child_access(child_id, 'editor')));
CREATE POLICY "Delete own or editor-shared bottles"
  ON public.bottles FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR (child_id IS NOT NULL AND public.has_child_access(child_id, 'editor')));

-- ── child_measurements (user_id + child_id NOT NULL) ────────────────────
DROP POLICY IF EXISTS "Users manage own child_measurements" ON public.child_measurements;
CREATE POLICY "View own or shared child_measurements"
  ON public.child_measurements FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_child_access(child_id, 'viewer'));
CREATE POLICY "Insert own child_measurements"
  ON public.child_measurements FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.has_child_access(child_id, 'editor'));
CREATE POLICY "Update own or editor-shared child_measurements"
  ON public.child_measurements FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.has_child_access(child_id, 'editor'))
  WITH CHECK (auth.uid() = user_id OR public.has_child_access(child_id, 'editor'));
CREATE POLICY "Delete own or editor-shared child_measurements"
  ON public.child_measurements FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_child_access(child_id, 'editor'));

-- ── growth_logs (child_id NOT NULL, no user_id) ─────────────────────────
-- Also fixes a real, pre-existing bug found while auditing this table:
-- it had RLS policies but NO GRANT to `authenticated` at all, meaning
-- authenticated users have never actually been able to read or write it
-- (permission denied regardless of RLS) — the growth-log feature this
-- backs has been silently broken since it was introduced.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.growth_logs TO authenticated;
GRANT ALL ON public.growth_logs TO service_role;
DROP POLICY IF EXISTS "Users manage own growth logs" ON public.growth_logs;
CREATE POLICY "View shared growth_logs"
  ON public.growth_logs FOR SELECT TO authenticated
  USING (public.has_child_access(child_id, 'viewer'));
CREATE POLICY "Insert editor-shared growth_logs"
  ON public.growth_logs FOR INSERT TO authenticated
  WITH CHECK (public.has_child_access(child_id, 'editor'));
CREATE POLICY "Update editor-shared growth_logs"
  ON public.growth_logs FOR UPDATE TO authenticated
  USING (public.has_child_access(child_id, 'editor'))
  WITH CHECK (public.has_child_access(child_id, 'editor'));
CREATE POLICY "Delete editor-shared growth_logs"
  ON public.growth_logs FOR DELETE TO authenticated
  USING (public.has_child_access(child_id, 'editor'));

-- ── first_foods (child_id NOT NULL, no user_id) ─────────────────────────
-- Same missing-GRANT bug as growth_logs, fixed the same way.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.first_foods TO authenticated;
GRANT ALL ON public.first_foods TO service_role;
DROP POLICY IF EXISTS "Users manage own first foods" ON public.first_foods;
CREATE POLICY "View shared first_foods"
  ON public.first_foods FOR SELECT TO authenticated
  USING (public.has_child_access(child_id, 'viewer'));
CREATE POLICY "Insert editor-shared first_foods"
  ON public.first_foods FOR INSERT TO authenticated
  WITH CHECK (public.has_child_access(child_id, 'editor'));
CREATE POLICY "Update editor-shared first_foods"
  ON public.first_foods FOR UPDATE TO authenticated
  USING (public.has_child_access(child_id, 'editor'))
  WITH CHECK (public.has_child_access(child_id, 'editor'));
CREATE POLICY "Delete editor-shared first_foods"
  ON public.first_foods FOR DELETE TO authenticated
  USING (public.has_child_access(child_id, 'editor'));

-- ── insight_dismissals (user_id + child_id NOT NULL) ────────────────────
DROP POLICY IF EXISTS "own dismissals" ON public.insight_dismissals;
CREATE POLICY "View own or shared insight_dismissals"
  ON public.insight_dismissals FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_child_access(child_id, 'viewer'));
CREATE POLICY "Insert own insight_dismissals"
  ON public.insight_dismissals FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.has_child_access(child_id, 'editor'));
CREATE POLICY "Update own or editor-shared insight_dismissals"
  ON public.insight_dismissals FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.has_child_access(child_id, 'editor'))
  WITH CHECK (auth.uid() = user_id OR public.has_child_access(child_id, 'editor'));
CREATE POLICY "Delete own or editor-shared insight_dismissals"
  ON public.insight_dismissals FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_child_access(child_id, 'editor'));

-- ── completed_tips (user_id + nullable child_id) ────────────────────────
DROP POLICY IF EXISTS "own completed tips" ON public.completed_tips;
CREATE POLICY "View own or shared completed_tips"
  ON public.completed_tips FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR (child_id IS NOT NULL AND public.has_child_access(child_id, 'viewer')));
CREATE POLICY "Insert own completed_tips"
  ON public.completed_tips FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND (child_id IS NULL OR public.has_child_access(child_id, 'editor')));
CREATE POLICY "Update own or editor-shared completed_tips"
  ON public.completed_tips FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR (child_id IS NOT NULL AND public.has_child_access(child_id, 'editor')))
  WITH CHECK (auth.uid() = user_id OR (child_id IS NOT NULL AND public.has_child_access(child_id, 'editor')));
CREATE POLICY "Delete own or editor-shared completed_tips"
  ON public.completed_tips FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR (child_id IS NOT NULL AND public.has_child_access(child_id, 'editor')));

-- ── product_alerts (user_id + nullable child_id) ────────────────────────
DROP POLICY IF EXISTS "Users manage own product_alerts" ON public.product_alerts;
CREATE POLICY "View own or shared product_alerts"
  ON public.product_alerts FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR (child_id IS NOT NULL AND public.has_child_access(child_id, 'viewer')));
CREATE POLICY "Insert own product_alerts"
  ON public.product_alerts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND (child_id IS NULL OR public.has_child_access(child_id, 'editor')));
CREATE POLICY "Update own or editor-shared product_alerts"
  ON public.product_alerts FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR (child_id IS NOT NULL AND public.has_child_access(child_id, 'editor')))
  WITH CHECK (auth.uid() = user_id OR (child_id IS NOT NULL AND public.has_child_access(child_id, 'editor')));
CREATE POLICY "Delete own or editor-shared product_alerts"
  ON public.product_alerts FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR (child_id IS NOT NULL AND public.has_child_access(child_id, 'editor')));

-- ── product_recalls (user_id, no child_id — reached via product_id) ────
-- INSERT/DELETE stay service_role-only (unchanged) — this table has never
-- granted authenticated INSERT/DELETE; only the SELECT and UPDATE
-- (acknowledge) policies are being extended to caregivers here.
DROP POLICY IF EXISTS "Users view own product recalls" ON public.product_recalls;
DROP POLICY IF EXISTS "Users acknowledge own product recalls" ON public.product_recalls;
CREATE POLICY "View own or shared product_recalls"
  ON public.product_recalls FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_product_access(product_id, 'viewer'));
CREATE POLICY "Acknowledge own or editor-shared product_recalls"
  ON public.product_recalls FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.has_product_access(product_id, 'editor'))
  WITH CHECK (auth.uid() = user_id OR public.has_product_access(product_id, 'editor'));

-- ── emergency_info: extend Feature 3's owner-only policy to caregivers ──
DROP POLICY IF EXISTS "Users manage own emergency_info" ON public.emergency_info;
CREATE POLICY "View own or shared emergency_info"
  ON public.emergency_info FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_child_access(child_id, 'viewer'));
CREATE POLICY "Insert own or editor-shared emergency_info"
  ON public.emergency_info FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.has_child_access(child_id, 'editor'));
CREATE POLICY "Update own or editor-shared emergency_info"
  ON public.emergency_info FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.has_child_access(child_id, 'editor'))
  WITH CHECK (auth.uid() = user_id OR public.has_child_access(child_id, 'editor'));
CREATE POLICY "Delete own or editor-shared emergency_info"
  ON public.emergency_info FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_child_access(child_id, 'editor'));
