CREATE TABLE IF NOT EXISTS public.growth_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  weight_lbs numeric,
  height_inches numeric,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.growth_logs TO authenticated;
GRANT ALL ON public.growth_logs TO service_role;

ALTER TABLE public.growth_logs ENABLE ROW LEVEL SECURITY;

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

CREATE TABLE IF NOT EXISTS public.first_foods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  food_name text NOT NULL,
  date_introduced date NOT NULL DEFAULT CURRENT_DATE,
  is_allergen boolean NOT NULL DEFAULT false,
  reaction_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.first_foods TO authenticated;
GRANT ALL ON public.first_foods TO service_role;

ALTER TABLE public.first_foods ENABLE ROW LEVEL SECURITY;

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