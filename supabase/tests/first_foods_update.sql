-- Regression/adversarial test for first-foods.tsx's new edit capability
-- (openEdit/handleSave's UPDATE path). No migration is needed for this
-- feature — 20260710000000_restore_growth_logs_first_foods_sharing.sql
-- already grants UPDATE and adds an editor-scoped policy — but the new
-- client code relies entirely on that policy (no ownership check of its
-- own: it just runs `.update({...}).eq("id", editingId)`), so this proves
-- the policy actually holds: an owner and an editor-shared caregiver can
-- update an entry, while a viewer-only caregiver and a total stranger
-- cannot, even when they know the row's id.
\set ON_ERROR_STOP on

INSERT INTO auth.users (id) VALUES
  ('a1111111-1111-1111-1111-111111111111'), -- owner
  ('b2222222-2222-2222-2222-222222222222'), -- editor caregiver
  ('c3333333-3333-3333-3333-333333333333'), -- viewer caregiver
  ('d4444444-4444-4444-4444-444444444444'); -- stranger

SELECT test.login('service_role');
INSERT INTO public.children (id, user_id, name) VALUES
  ('ccccc222-cccc-cccc-cccc-cccccccccccc', 'a1111111-1111-1111-1111-111111111111', 'Baby');
INSERT INTO public.caregiver_access (child_id, caregiver_user_id, role) VALUES
  ('ccccc222-cccc-cccc-cccc-cccccccccccc', 'b2222222-2222-2222-2222-222222222222', 'editor'),
  ('ccccc222-cccc-cccc-cccc-cccccccccccc', 'c3333333-3333-3333-3333-333333333333', 'viewer');
INSERT INTO public.first_foods (id, child_id, food_name, is_allergen) VALUES
  ('9f000001-0000-0000-0000-000000000001', 'ccccc222-cccc-cccc-cccc-cccccccccccc', 'Peanut butter', false);
SELECT test.logout();

-- ── Owner: can fix the forgotten allergen flag (the reported bug) ────────
SELECT test.login('authenticated', 'a1111111-1111-1111-1111-111111111111');
UPDATE public.first_foods
  SET food_name = 'Peanut butter (Peanuts)', is_allergen = true
  WHERE id = '9f000001-0000-0000-0000-000000000001';
SELECT test.assert(
  (SELECT is_allergen FROM public.first_foods WHERE id = '9f000001-0000-0000-0000-000000000001') = true,
  'Owner can edit their own first_foods row to correct a forgotten allergen flag'
);
SELECT test.logout();

-- ── Viewer caregiver: read-only, edit attempt silently does not go through ─
SELECT test.login('authenticated', 'c3333333-3333-3333-3333-333333333333');
SELECT test.assert(
  (SELECT count(*) FROM public.first_foods WHERE id = '9f000001-0000-0000-0000-000000000001') = 1,
  'Viewer caregiver can read the entry'
);
UPDATE public.first_foods SET food_name = 'Hacked by viewer' WHERE id = '9f000001-0000-0000-0000-000000000001';
SELECT test.logout();

SELECT test.login('service_role');
SELECT test.assert(
  (SELECT food_name FROM public.first_foods WHERE id = '9f000001-0000-0000-0000-000000000001') = 'Peanut butter (Peanuts)',
  'Viewer caregiver''s update attempt did not go through'
);
SELECT test.logout();

-- ── Editor caregiver: can also edit the shared child's entries ───────────
SELECT test.login('authenticated', 'b2222222-2222-2222-2222-222222222222');
UPDATE public.first_foods
  SET reaction_notes = 'Mild rash, resolved same day'
  WHERE id = '9f000001-0000-0000-0000-000000000001';
SELECT test.assert(
  (SELECT reaction_notes FROM public.first_foods WHERE id = '9f000001-0000-0000-0000-000000000001') = 'Mild rash, resolved same day',
  'Editor caregiver can edit an entry for a child shared with them'
);
SELECT test.logout();

-- ── Stranger: knows the row id but has no access at all ──────────────────
SELECT test.login('authenticated', 'd4444444-4444-4444-4444-444444444444');
SELECT test.assert(
  (SELECT count(*) FROM public.first_foods WHERE id = '9f000001-0000-0000-0000-000000000001') = 0,
  'Stranger cannot even see the entry exists'
);
UPDATE public.first_foods SET food_name = 'Hacked by stranger', is_allergen = false
  WHERE id = '9f000001-0000-0000-0000-000000000001';
SELECT test.logout();

SELECT test.login('service_role');
SELECT test.assert(
  (SELECT food_name FROM public.first_foods WHERE id = '9f000001-0000-0000-0000-000000000001') = 'Peanut butter (Peanuts)'
  AND (SELECT is_allergen FROM public.first_foods WHERE id = '9f000001-0000-0000-0000-000000000001') = true,
  'Stranger''s update attempt (with a guessed/known row id) did not go through, and did not flip is_allergen back to false'
);
SELECT test.logout();
