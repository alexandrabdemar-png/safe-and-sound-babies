-- Feature 2: expiration & lifecycle tracking.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS manufacture_date date,
  ADD COLUMN IF NOT EXISTS expiration_date date,
  ADD COLUMN IF NOT EXISTS product_type text NOT NULL DEFAULT 'other';

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_product_type_check;
ALTER TABLE public.products
  ADD CONSTRAINT products_product_type_check
  CHECK (product_type IN ('car_seat', 'formula', 'medicine', 'other'));

CREATE OR REPLACE FUNCTION public.set_default_car_seat_expiration()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.product_type = 'car_seat' AND NEW.expiration_date IS NULL AND NEW.manufacture_date IS NOT NULL THEN
    NEW.expiration_date := NEW.manufacture_date + INTERVAL '6 years';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_default_car_seat_expiration ON public.products;
CREATE TRIGGER trg_products_default_car_seat_expiration
  BEFORE INSERT OR UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_default_car_seat_expiration();

CREATE TABLE IF NOT EXISTS public.lifecycle_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  urgency text NOT NULL CHECK (urgency IN ('expired', '7', '30', '90')),
  notified_at timestamptz,
  notification_channel text CHECK (notification_channel IS NULL OR notification_channel IN ('push', 'email')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, urgency)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lifecycle_alerts TO authenticated;
GRANT ALL ON public.lifecycle_alerts TO service_role;
ALTER TABLE public.lifecycle_alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own lifecycle_alerts" ON public.lifecycle_alerts;
CREATE POLICY "Users manage own lifecycle_alerts" ON public.lifecycle_alerts
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_lifecycle_alerts_user ON public.lifecycle_alerts(user_id, created_at DESC);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='private' AND p.proname='call_edge_function')
     AND NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-scheduled-expiration-check') THEN
    PERFORM cron.schedule('daily-scheduled-expiration-check', '0 4 * * *',
      $c$SELECT private.call_edge_function('scheduled-expiration-check');$c$);
  END IF;
END $$;

-- Feature 3: emergency info card + shareable link.
CREATE TABLE IF NOT EXISTS public.emergency_info (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  child_id uuid NOT NULL UNIQUE REFERENCES public.children(id) ON DELETE CASCADE,
  allergies text,
  medications text,
  blood_type text,
  pediatrician_name text,
  pediatrician_phone text,
  emergency_contact_name text,
  emergency_contact_phone text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.emergency_info TO authenticated;
GRANT ALL ON public.emergency_info TO service_role;
ALTER TABLE public.emergency_info ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_emergency_info_updated_at ON public.emergency_info;
CREATE TRIGGER trg_emergency_info_updated_at
  BEFORE UPDATE ON public.emergency_info
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.emergency_share_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  child_id uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.emergency_share_links TO authenticated;
GRANT ALL ON public.emergency_share_links TO service_role;
ALTER TABLE public.emergency_share_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own emergency_share_links" ON public.emergency_share_links;
CREATE POLICY "Users manage own emergency_share_links" ON public.emergency_share_links
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.children c WHERE c.id = child_id AND c.user_id = auth.uid())
  );
CREATE INDEX IF NOT EXISTS idx_emergency_share_links_child ON public.emergency_share_links(child_id, created_at DESC);

-- Feature 4: caregiver sharing model + RLS hardening.
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

DROP POLICY IF EXISTS "Owners and grantees can view a caregiver_access row" ON public.caregiver_access;
CREATE POLICY "Owners and grantees can view a caregiver_access row"
  ON public.caregiver_access FOR SELECT TO authenticated
  USING (
    caregiver_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.children c WHERE c.id = child_id AND c.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Only the child's owner can grant caregiver_access" ON public.caregiver_access;
CREATE POLICY "Only the child's owner can grant caregiver_access"
  ON public.caregiver_access FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.children c WHERE c.id = child_id AND c.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Only the child's owner can change a grant's role" ON public.caregiver_access;
CREATE POLICY "Only the child's owner can change a grant's role"
  ON public.caregiver_access FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.children c WHERE c.id = child_id AND c.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.children c WHERE c.id = child_id AND c.user_id = auth.uid()));

DROP POLICY IF EXISTS "Owner can revoke, or a caregiver can remove themselves" ON public.caregiver_access;
CREATE POLICY "Owner can revoke, or a caregiver can remove themselves"
  ON public.caregiver_access FOR DELETE TO authenticated
  USING (
    caregiver_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.children c WHERE c.id = child_id AND c.user_id = auth.uid())
  );

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

-- children
DROP POLICY IF EXISTS "Users manage own children" ON public.children;
DROP POLICY IF EXISTS "View own or shared children" ON public.children;
DROP POLICY IF EXISTS "Insert own children" ON public.children;
DROP POLICY IF EXISTS "Update own children" ON public.children;
DROP POLICY IF EXISTS "Delete own children" ON public.children;
CREATE POLICY "View own or shared children" ON public.children FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_child_access(id, 'viewer'));
CREATE POLICY "Insert own children" ON public.children FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Update own children" ON public.children FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Delete own children" ON public.children FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- products
DROP POLICY IF EXISTS "Users manage own products" ON public.products;
DROP POLICY IF EXISTS "View own or shared products" ON public.products;
DROP POLICY IF EXISTS "Insert own products" ON public.products;
DROP POLICY IF EXISTS "Update own or editor-shared products" ON public.products;
DROP POLICY IF EXISTS "Delete own or editor-shared products" ON public.products;
CREATE POLICY "View own or shared products" ON public.products FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR (child_id IS NOT NULL AND public.has_child_access(child_id, 'viewer')));
CREATE POLICY "Insert own products" ON public.products FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND (child_id IS NULL OR public.has_child_access(child_id, 'editor')));
CREATE POLICY "Update own or editor-shared products" ON public.products FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR (child_id IS NOT NULL AND public.has_child_access(child_id, 'editor')))
  WITH CHECK (auth.uid() = user_id OR (child_id IS NOT NULL AND public.has_child_access(child_id, 'editor')));
CREATE POLICY "Delete own or editor-shared products" ON public.products FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR (child_id IS NOT NULL AND public.has_child_access(child_id, 'editor')));

-- milestones
DROP POLICY IF EXISTS "Users manage milestones of own children" ON public.milestones;
DROP POLICY IF EXISTS "View shared milestones" ON public.milestones;
DROP POLICY IF EXISTS "Insert editor-shared milestones" ON public.milestones;
DROP POLICY IF EXISTS "Update editor-shared milestones" ON public.milestones;
DROP POLICY IF EXISTS "Delete editor-shared milestones" ON public.milestones;
CREATE POLICY "View shared milestones" ON public.milestones FOR SELECT TO authenticated
  USING (public.has_child_access(child_id, 'viewer'));
CREATE POLICY "Insert editor-shared milestones" ON public.milestones FOR INSERT TO authenticated
  WITH CHECK (public.has_child_access(child_id, 'editor'));
CREATE POLICY "Update editor-shared milestones" ON public.milestones FOR UPDATE TO authenticated
  USING (public.has_child_access(child_id, 'editor')) WITH CHECK (public.has_child_access(child_id, 'editor'));
CREATE POLICY "Delete editor-shared milestones" ON public.milestones FOR DELETE TO authenticated
  USING (public.has_child_access(child_id, 'editor'));

-- bottles
DROP POLICY IF EXISTS "Users manage own bottles" ON public.bottles;
DROP POLICY IF EXISTS "View own or shared bottles" ON public.bottles;
DROP POLICY IF EXISTS "Insert own bottles" ON public.bottles;
DROP POLICY IF EXISTS "Update own or editor-shared bottles" ON public.bottles;
DROP POLICY IF EXISTS "Delete own or editor-shared bottles" ON public.bottles;
CREATE POLICY "View own or shared bottles" ON public.bottles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR (child_id IS NOT NULL AND public.has_child_access(child_id, 'viewer')));
CREATE POLICY "Insert own bottles" ON public.bottles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND (child_id IS NULL OR public.has_child_access(child_id, 'editor')));
CREATE POLICY "Update own or editor-shared bottles" ON public.bottles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR (child_id IS NOT NULL AND public.has_child_access(child_id, 'editor')))
  WITH CHECK (auth.uid() = user_id OR (child_id IS NOT NULL AND public.has_child_access(child_id, 'editor')));
CREATE POLICY "Delete own or editor-shared bottles" ON public.bottles FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR (child_id IS NOT NULL AND public.has_child_access(child_id, 'editor')));

-- child_measurements
DROP POLICY IF EXISTS "Users manage own child_measurements" ON public.child_measurements;
DROP POLICY IF EXISTS "View own or shared child_measurements" ON public.child_measurements;
DROP POLICY IF EXISTS "Insert own child_measurements" ON public.child_measurements;
DROP POLICY IF EXISTS "Update own or editor-shared child_measurements" ON public.child_measurements;
DROP POLICY IF EXISTS "Delete own or editor-shared child_measurements" ON public.child_measurements;
CREATE POLICY "View own or shared child_measurements" ON public.child_measurements FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_child_access(child_id, 'viewer'));
CREATE POLICY "Insert own child_measurements" ON public.child_measurements FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.has_child_access(child_id, 'editor'));
CREATE POLICY "Update own or editor-shared child_measurements" ON public.child_measurements FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.has_child_access(child_id, 'editor'))
  WITH CHECK (auth.uid() = user_id OR public.has_child_access(child_id, 'editor'));
CREATE POLICY "Delete own or editor-shared child_measurements" ON public.child_measurements FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_child_access(child_id, 'editor'));

-- insight_dismissals
DROP POLICY IF EXISTS "own dismissals" ON public.insight_dismissals;
DROP POLICY IF EXISTS "View own or shared insight_dismissals" ON public.insight_dismissals;
DROP POLICY IF EXISTS "Insert own insight_dismissals" ON public.insight_dismissals;
DROP POLICY IF EXISTS "Update own or editor-shared insight_dismissals" ON public.insight_dismissals;
DROP POLICY IF EXISTS "Delete own or editor-shared insight_dismissals" ON public.insight_dismissals;
CREATE POLICY "View own or shared insight_dismissals" ON public.insight_dismissals FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_child_access(child_id, 'viewer'));
CREATE POLICY "Insert own insight_dismissals" ON public.insight_dismissals FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.has_child_access(child_id, 'editor'));
CREATE POLICY "Update own or editor-shared insight_dismissals" ON public.insight_dismissals FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.has_child_access(child_id, 'editor'))
  WITH CHECK (auth.uid() = user_id OR public.has_child_access(child_id, 'editor'));
CREATE POLICY "Delete own or editor-shared insight_dismissals" ON public.insight_dismissals FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_child_access(child_id, 'editor'));

-- completed_tips
DROP POLICY IF EXISTS "own completed tips" ON public.completed_tips;
DROP POLICY IF EXISTS "View own or shared completed_tips" ON public.completed_tips;
DROP POLICY IF EXISTS "Insert own completed_tips" ON public.completed_tips;
DROP POLICY IF EXISTS "Update own or editor-shared completed_tips" ON public.completed_tips;
DROP POLICY IF EXISTS "Delete own or editor-shared completed_tips" ON public.completed_tips;
CREATE POLICY "View own or shared completed_tips" ON public.completed_tips FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR (child_id IS NOT NULL AND public.has_child_access(child_id, 'viewer')));
CREATE POLICY "Insert own completed_tips" ON public.completed_tips FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND (child_id IS NULL OR public.has_child_access(child_id, 'editor')));
CREATE POLICY "Update own or editor-shared completed_tips" ON public.completed_tips FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR (child_id IS NOT NULL AND public.has_child_access(child_id, 'editor')))
  WITH CHECK (auth.uid() = user_id OR (child_id IS NOT NULL AND public.has_child_access(child_id, 'editor')));
CREATE POLICY "Delete own or editor-shared completed_tips" ON public.completed_tips FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR (child_id IS NOT NULL AND public.has_child_access(child_id, 'editor')));

-- product_alerts
DROP POLICY IF EXISTS "Users manage own product_alerts" ON public.product_alerts;
DROP POLICY IF EXISTS "View own or shared product_alerts" ON public.product_alerts;
DROP POLICY IF EXISTS "Insert own product_alerts" ON public.product_alerts;
DROP POLICY IF EXISTS "Update own or editor-shared product_alerts" ON public.product_alerts;
DROP POLICY IF EXISTS "Delete own or editor-shared product_alerts" ON public.product_alerts;
CREATE POLICY "View own or shared product_alerts" ON public.product_alerts FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR (child_id IS NOT NULL AND public.has_child_access(child_id, 'viewer')));
CREATE POLICY "Insert own product_alerts" ON public.product_alerts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND (child_id IS NULL OR public.has_child_access(child_id, 'editor')));
CREATE POLICY "Update own or editor-shared product_alerts" ON public.product_alerts FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR (child_id IS NOT NULL AND public.has_child_access(child_id, 'editor')))
  WITH CHECK (auth.uid() = user_id OR (child_id IS NOT NULL AND public.has_child_access(child_id, 'editor')));
CREATE POLICY "Delete own or editor-shared product_alerts" ON public.product_alerts FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR (child_id IS NOT NULL AND public.has_child_access(child_id, 'editor')));

-- product_recalls
DROP POLICY IF EXISTS "Users view own product recalls" ON public.product_recalls;
DROP POLICY IF EXISTS "Users acknowledge own product recalls" ON public.product_recalls;
DROP POLICY IF EXISTS "View own or shared product_recalls" ON public.product_recalls;
DROP POLICY IF EXISTS "Acknowledge own or editor-shared product_recalls" ON public.product_recalls;
CREATE POLICY "View own or shared product_recalls" ON public.product_recalls FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_product_access(product_id, 'viewer'));
CREATE POLICY "Acknowledge own or editor-shared product_recalls" ON public.product_recalls FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.has_product_access(product_id, 'editor'))
  WITH CHECK (auth.uid() = user_id OR public.has_product_access(product_id, 'editor'));

-- emergency_info
DROP POLICY IF EXISTS "Users manage own emergency_info" ON public.emergency_info;
DROP POLICY IF EXISTS "View own or shared emergency_info" ON public.emergency_info;
DROP POLICY IF EXISTS "Insert own or editor-shared emergency_info" ON public.emergency_info;
DROP POLICY IF EXISTS "Update own or editor-shared emergency_info" ON public.emergency_info;
DROP POLICY IF EXISTS "Delete own or editor-shared emergency_info" ON public.emergency_info;
CREATE POLICY "View own or shared emergency_info" ON public.emergency_info FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_child_access(child_id, 'viewer'));
CREATE POLICY "Insert own or editor-shared emergency_info" ON public.emergency_info FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.has_child_access(child_id, 'editor'));
CREATE POLICY "Update own or editor-shared emergency_info" ON public.emergency_info FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.has_child_access(child_id, 'editor'))
  WITH CHECK (auth.uid() = user_id OR public.has_child_access(child_id, 'editor'));
CREATE POLICY "Delete own or editor-shared emergency_info" ON public.emergency_info FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_child_access(child_id, 'editor'));
