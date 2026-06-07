-- 1. Add push token column to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS expo_push_token text;

-- 2. Function: seed rule-based milestones for a child based on DOB
CREATE OR REPLACE FUNCTION public.generate_milestones_for_child(p_child_id uuid, p_dob date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_age_weeks integer;
  v_min_due date := current_date - INTERVAL '4 weeks';
BEGIN
  IF p_dob IS NULL THEN
    RETURN;
  END IF;

  v_age_weeks := GREATEST(0, ((current_date - p_dob) / 7)::int);

  -- Helper inserts (only future or recently-due items, dedupe by title+child)
  -- 0-3 months
  INSERT INTO public.milestones (child_id, title, category, due_date, completed)
  SELECT p_child_id, t.title, t.category, t.due, false FROM (VALUES
    ('Check car seat harness fit',            'carseat',   p_dob + INTERVAL '3 days'),
    ('Tummy time check-in',                   'crib',      p_dob + INTERVAL '2 weeks'),
    ('Tummy time check-in',                   'crib',      p_dob + INTERVAL '6 weeks'),
    ('Tummy time check-in',                   'crib',      p_dob + INTERVAL '10 weeks'),
    ('Replace pacifier',                      'pacifier',  p_dob + INTERVAL '6 weeks'),
    ('Replace pacifier',                      'pacifier',  p_dob + INTERVAL '12 weeks'),
    -- 4-6 months
    ('Lower crib mattress to middle',         'crib',      p_dob + INTERVAL '17 weeks'),
    ('Check swaddle size',                    'swaddle',   p_dob + INTERVAL '18 weeks'),
    -- 6-8 months
    ('Lower crib to lowest position',         'crib',      p_dob + INTERVAL '26 weeks'),
    ('Install baby gates',                    'gate',      p_dob + INTERVAL '27 weeks'),
    ('Check car seat weight limit',           'carseat',   p_dob + INTERVAL '28 weeks'),
    -- 9-12 months
    ('Transition off swaddle',                'swaddle',   p_dob + INTERVAL '39 weeks'),
    ('First toothbrush',                      'toothbrush',p_dob + INTERVAL '40 weeks'),
    -- 12+ months
    ('Car seat convertible check',            'carseat',   p_dob + INTERVAL '52 weeks')
  ) AS t(title, category, due)
  WHERE t.due::date >= v_min_due
    AND NOT EXISTS (
      SELECT 1 FROM public.milestones m
      WHERE m.child_id = p_child_id
        AND m.title = t.title
        AND m.due_date = t.due::date
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_milestones_for_child(uuid, date) TO authenticated, service_role;

-- 3. Trigger function + trigger: run on INSERT into children
CREATE OR REPLACE FUNCTION public.on_child_inserted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.generate_milestones_for_child(NEW.id, NEW.date_of_birth);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_milestones ON public.children;
CREATE TRIGGER trg_seed_milestones
  AFTER INSERT ON public.children
  FOR EACH ROW
  EXECUTE FUNCTION public.on_child_inserted();

-- 4. updated_at triggers (in case missing)
DROP TRIGGER IF EXISTS trg_children_updated_at ON public.children;
CREATE TRIGGER trg_children_updated_at
  BEFORE UPDATE ON public.children
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_milestones_updated_at ON public.milestones;
CREATE TRIGGER trg_milestones_updated_at
  BEFORE UPDATE ON public.milestones
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();