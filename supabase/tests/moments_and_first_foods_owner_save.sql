-- Direct regression check for a live bug report: "foods and moments I've
-- logged don't seem to be saving" — reproduces the EXACT insert shape the
-- app sends (src/routes/_authenticated/moments_.new.tsx and
-- src/routes/_authenticated/first-foods.tsx) as a plain owner with no
-- caregiver_access involved at all (the most common real-world case),
-- against the full current migration chain including
-- 20260711000000_caregiver_invites.sql, to rule out that migration or
-- anything since 20260708000000's RLS rewrite having broken the base case.
\set ON_ERROR_STOP on

INSERT INTO auth.users (id) VALUES ('a1111111-1111-1111-1111-111111111111');

SELECT test.login('service_role');
INSERT INTO public.children (id, user_id, name, date_of_birth) VALUES
  ('c1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 'Baby', '2026-01-01');
SELECT test.logout();

-- ── Moments (milestones table) — exact insert shape from moments_.new.tsx ──
SELECT test.login('authenticated', 'a1111111-1111-1111-1111-111111111111');
INSERT INTO public.milestones (child_id, title, logged_at, notes, completed)
  VALUES ('c1111111-1111-1111-1111-111111111111', 'First smile', '2026-07-08', '[First] So sweet', true);
SELECT test.assert(
  (SELECT count(*) FROM public.milestones WHERE child_id = 'c1111111-1111-1111-1111-111111111111' AND title = 'First smile') = 1,
  'Owner (no caregiver involved): can insert a moment and it is immediately readable back'
);
SELECT test.logout();

-- ── First foods — exact insert shape from first-foods.tsx ───────────────
SELECT test.login('authenticated', 'a1111111-1111-1111-1111-111111111111');
INSERT INTO public.first_foods (child_id, food_name, date_introduced, is_allergen, reaction_notes)
  VALUES ('c1111111-1111-1111-1111-111111111111', 'Banana', '2026-07-08', false, null);
SELECT test.assert(
  (SELECT count(*) FROM public.first_foods WHERE child_id = 'c1111111-1111-1111-1111-111111111111' AND food_name = 'Banana') = 1,
  'Owner (no caregiver involved): can insert a first food and it is immediately readable back'
);
SELECT test.logout();

-- ── Owner can read both back via the exact SELECT shape the pages use ────
SELECT test.login('authenticated', 'a1111111-1111-1111-1111-111111111111');
SELECT test.assert(
  (SELECT count(*) FROM public.milestones WHERE child_id = 'c1111111-1111-1111-1111-111111111111') = 1,
  'Owner: moments.tsx-style read sees the logged moment'
);
SELECT test.assert(
  (SELECT count(*) FROM public.first_foods WHERE child_id = 'c1111111-1111-1111-1111-111111111111') = 1,
  'Owner: first-foods.tsx-style read sees the logged food'
);
SELECT test.logout();
