-- Bug: onboarding's "What are you tracking?" step (src/routes/onboarding.tsx)
-- was inserting a literal row into public.products for every category a
-- user selected (e.g. name="High chairs", category="high_chair", every
-- other field left null). These are indistinguishable from real,
-- hand-entered gear in the Products list, which is what users are
-- reporting as "products I never added" showing up alongside their real
-- items. Category-interest tracking gets its own table; existing
-- placeholder rows are migrated into it and removed from products.

CREATE TABLE IF NOT EXISTS public.category_watchlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  child_id uuid REFERENCES public.children(id) ON DELETE SET NULL,
  category text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.category_watchlist TO authenticated;
GRANT ALL ON public.category_watchlist TO service_role;
ALTER TABLE public.category_watchlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own category watchlist" ON public.category_watchlist
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Tight heuristic for "this row is an onboarding placeholder, not a real
-- product a user filled out": the name is an exact, unmodified category
-- label AND every descriptive field a real add-product form could set is
-- still empty. The add-product form's name field has no default value
-- (placeholder text only, e.g. "e.g. Nuna Pipa Lite"), so a genuine
-- hand-entered product coincidentally named e.g. "High chairs" with zero
-- other fields filled in is not a realistic false positive.
INSERT INTO public.category_watchlist (user_id, child_id, category, created_at)
SELECT user_id, child_id, category, created_at
FROM public.products
WHERE brand IS NULL AND model IS NULL AND size IS NULL AND barcode IS NULL
  AND notes IS NULL AND purchased_at IS NULL
  AND (name, category) IN (
    ('Car seats', 'car_seat'), ('Cribs', 'crib'), ('Bassinets', 'bassinet'),
    ('Strollers', 'stroller'), ('High chairs', 'high_chair'), ('Bouncers', 'bouncer'),
    ('Activity centers', 'activity_center'), ('Sleep sacks', 'sleep_sack'), ('Baby gates', 'baby_gate')
  );

DELETE FROM public.products
WHERE brand IS NULL AND model IS NULL AND size IS NULL AND barcode IS NULL
  AND notes IS NULL AND purchased_at IS NULL
  AND (name, category) IN (
    ('Car seats', 'car_seat'), ('Cribs', 'crib'), ('Bassinets', 'bassinet'),
    ('Strollers', 'stroller'), ('High chairs', 'high_chair'), ('Bouncers', 'bouncer'),
    ('Activity centers', 'activity_center'), ('Sleep sacks', 'sleep_sack'), ('Baby gates', 'baby_gate')
  );
