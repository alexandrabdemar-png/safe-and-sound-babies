-- Restores a fix that Lovable's own migration squash
-- ("Applied emergency tables migration", commit fb174c4, which
-- consolidated 20260706000000/20260707000000/20260708000000 into
-- 20260706223921_15873d73-8815-43b9-b20c-da60b710de52.sql) silently
-- dropped: growth_logs and first_foods had RLS enabled and a policy,
-- but NO GRANT to `authenticated` was ever issued on either table —
-- meaning every "Log growth" / "First foods" read or write for a
-- normal user fails outright, independent of RLS. The squash also
-- reverted both tables' policies to owner-only, silently dropping
-- caregiver_access sharing support that the rest of the schema has.
--
-- Confirmed by diffing the squashed migration against the original
-- (now-deleted) 20260708000000_caregiver_access_rls_hardening.sql via
-- git history — this migration re-applies exactly what that one did
-- for these two tables.

-- growth_logs (child_id NOT NULL, no user_id column)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.growth_logs TO authenticated;
GRANT ALL ON public.growth_logs TO service_role;
DROP POLICY IF EXISTS "Users manage own growth logs" ON public.growth_logs;
DROP POLICY IF EXISTS "View shared growth_logs" ON public.growth_logs;
DROP POLICY IF EXISTS "Insert editor-shared growth_logs" ON public.growth_logs;
DROP POLICY IF EXISTS "Update editor-shared growth_logs" ON public.growth_logs;
DROP POLICY IF EXISTS "Delete editor-shared growth_logs" ON public.growth_logs;
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

-- first_foods (child_id NOT NULL, no user_id column)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.first_foods TO authenticated;
GRANT ALL ON public.first_foods TO service_role;
DROP POLICY IF EXISTS "Users manage own first foods" ON public.first_foods;
DROP POLICY IF EXISTS "View shared first_foods" ON public.first_foods;
DROP POLICY IF EXISTS "Insert editor-shared first_foods" ON public.first_foods;
DROP POLICY IF EXISTS "Update editor-shared first_foods" ON public.first_foods;
DROP POLICY IF EXISTS "Delete editor-shared first_foods" ON public.first_foods;
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
