-- Coverage for migration 20260713000000_milestones_icon_column.sql (adds a
-- dedicated `icon` column to milestones for the hand-drawn icon picker:
-- bear/feet/waving/star/smiley/heart/target). Verifies the check
-- constraint, that all 7 valid values round-trip, that old-style inserts
-- (no icon) still work with icon defaulting to NULL, and that RLS on
-- milestones (child_id-scoped via has_child_access, from
-- 20260708000000_caregiver_access_rls_hardening.sql) still isolates rows
-- per-child after the ALTER TABLE.
\set ON_ERROR_STOP on

INSERT INTO auth.users (id) VALUES
  ('a1111111-1111-1111-1111-111111111111'),
  ('b2222222-2222-2222-2222-222222222222');

SELECT test.login('service_role');
INSERT INTO public.children (id, user_id, name, date_of_birth) VALUES
  ('c1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 'Baby A', '2026-01-01'),
  ('c2222222-2222-2222-2222-222222222222', 'b2222222-2222-2222-2222-222222222222', 'Baby B', '2026-01-01');
SELECT test.logout();

-- ── Old-style insert (no icon) still works, icon defaults to NULL ────────
SELECT test.login('authenticated', 'a1111111-1111-1111-1111-111111111111');
INSERT INTO public.milestones (child_id, title, logged_at, notes, completed)
  VALUES ('c1111111-1111-1111-1111-111111111111', 'Pre-migration moment', '2026-07-08', '[First] legacy row', true);
SELECT test.assert(
  (SELECT icon FROM public.milestones WHERE child_id = 'c1111111-1111-1111-1111-111111111111' AND title = 'Pre-migration moment') IS NULL,
  'A moment inserted without an icon defaults icon to NULL (backward compatible with pre-migration rows)'
);
SELECT test.logout();

-- ── The check constraint rejects garbage icon values ─────────────────────
SELECT test.login('authenticated', 'a1111111-1111-1111-1111-111111111111');
SELECT test.assert_raises(
  $$INSERT INTO public.milestones (child_id, title, logged_at, icon, completed)
    VALUES ('c1111111-1111-1111-1111-111111111111', 'Bad icon', '2026-07-08', 'dinosaur', true)$$,
  'A garbage icon value is rejected by the check constraint'
);
SELECT test.logout();

-- ── All 7 valid icon values are accepted and round-trip correctly ────────
SELECT test.login('authenticated', 'a1111111-1111-1111-1111-111111111111');
INSERT INTO public.milestones (child_id, title, logged_at, icon, completed) VALUES
  ('c1111111-1111-1111-1111-111111111111', 'Bear moment', '2026-07-08', 'bear', true),
  ('c1111111-1111-1111-1111-111111111111', 'Feet moment', '2026-07-08', 'feet', true),
  ('c1111111-1111-1111-1111-111111111111', 'Waving moment', '2026-07-08', 'waving', true),
  ('c1111111-1111-1111-1111-111111111111', 'Star moment', '2026-07-08', 'star', true),
  ('c1111111-1111-1111-1111-111111111111', 'Smiley moment', '2026-07-08', 'smiley', true),
  ('c1111111-1111-1111-1111-111111111111', 'Heart moment', '2026-07-08', 'heart', true),
  ('c1111111-1111-1111-1111-111111111111', 'Target moment', '2026-07-08', 'target', true);
SELECT test.assert(
  (SELECT count(*) FROM public.milestones
     WHERE child_id = 'c1111111-1111-1111-1111-111111111111'
       AND icon IN ('bear','feet','waving','star','smiley','heart','target')) = 7,
  'All 7 valid icon keys are accepted and readable back'
);
SELECT test.logout();

-- ── RLS still isolates milestones per-child after the ALTER TABLE ────────
SELECT test.login('authenticated', 'b2222222-2222-2222-2222-222222222222');
INSERT INTO public.milestones (child_id, title, logged_at, icon, completed)
  VALUES ('c2222222-2222-2222-2222-222222222222', 'Baby B moment', '2026-07-08', 'heart', true);
SELECT test.assert(
  (SELECT count(*) FROM public.milestones WHERE child_id = 'c1111111-1111-1111-1111-111111111111') = 0,
  'Adversarial: a stranger cannot see Baby A''s milestones (including the new icon column) via a child_id scan'
);
SELECT test.logout();

-- Adversarial: RLS-blocked UPDATE of another child's milestone icon
-- silently affects 0 rows rather than raising — verified via a privileged
-- read afterward, not assert_raises.
SELECT test.login('authenticated', 'b2222222-2222-2222-2222-222222222222');
UPDATE public.milestones SET icon = 'target'
  WHERE child_id = 'c1111111-1111-1111-1111-111111111111' AND title = 'Bear moment';
SELECT test.logout();

SELECT test.login('service_role');
SELECT test.assert(
  (SELECT icon FROM public.milestones WHERE child_id = 'c1111111-1111-1111-1111-111111111111' AND title = 'Bear moment') = 'bear',
  'Adversarial: a stranger''s UPDATE of another child''s milestone icon silently affected 0 rows — value is still ''bear'''
);
SELECT test.logout();
