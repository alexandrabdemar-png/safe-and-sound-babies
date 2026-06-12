-- Defense-in-depth: add ownership guard inside generate_milestones_for_child
-- so that even if EXECUTE is granted to authenticated in future, a user cannot
-- inject milestones into another user's child profile.
CREATE OR REPLACE FUNCTION public.generate_milestones_for_child(p_child_id uuid, p_dob date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Ownership check: only the owner of the child (or service_role, which has
  -- auth.uid() = NULL but is excluded from EXECUTE-by-authenticated) can run.
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.children
    WHERE id = p_child_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  INSERT INTO public.milestones (child_id, user_id, title, category, age_months, status)
  SELECT
    p_child_id,
    c.user_id,
    m.title,
    m.category,
    m.age_months,
    'pending'
  FROM public.children c
  CROSS JOIN (VALUES
    ('Lifts head during tummy time', 'motor', 2),
    ('Smiles socially', 'social', 2),
    ('Rolls from tummy to back', 'motor', 4),
    ('Sits without support', 'motor', 6),
    ('Crawls', 'motor', 8),
    ('Pulls to stand', 'motor', 9),
    ('Walks independently', 'motor', 12),
    ('Says first words', 'language', 12),
    ('Combines two words', 'language', 18)
  ) AS m(title, category, age_months)
  WHERE c.id = p_child_id
  ON CONFLICT DO NOTHING;
END;
$$;

-- Remove product_recalls from the realtime publication. The app does not
-- subscribe to realtime channels for this table, and exposing it via
-- realtime risks cross-user broadcast since realtime.messages has no RLS.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'product_recalls'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.product_recalls;
  END IF;
END $$;