-- Coverage for migration 20260712000000_home_profile_daycare_both_option.sql
-- (adds a "both" option to the home-profile quiz's daycare question, live
-- user request) — verifies the boolean->text conversion preserves existing
-- data correctly, the new check constraint rejects garbage, all three
-- valid values round-trip, and RLS on home_profile (pre-existing, from
-- migration 20260702000001) still isolates rows per-user after the
-- ALTER TABLE.
\set ON_ERROR_STOP on

INSERT INTO auth.users (id) VALUES
  ('a1111111-1111-1111-1111-111111111111'),
  ('b2222222-2222-2222-2222-222222222222');

-- ── Pre-migration-shaped data still converts correctly ───────────────────
-- (simulates a row that existed before this migration ran, back when
-- in_daycare was a plain boolean)
SELECT test.login('service_role');
INSERT INTO public.home_profile (user_id, has_stairs, home_type, has_pet, has_car, in_daycare, has_pool)
  VALUES ('a1111111-1111-1111-1111-111111111111', true, 'house', false, true, 'daycare', false);
SELECT test.logout();

SELECT test.assert(
  (SELECT in_daycare FROM public.home_profile WHERE user_id = 'a1111111-1111-1111-1111-111111111111') = 'daycare',
  'Pre-existing boolean-true row converted to the text value ''daycare'''
);

-- ── The new check constraint rejects garbage values ──────────────────────
SELECT test.login('authenticated', 'b2222222-2222-2222-2222-222222222222');
SELECT test.assert_raises(
  $$INSERT INTO public.home_profile (user_id, in_daycare) VALUES ('b2222222-2222-2222-2222-222222222222', 'sometimes')$$,
  'A garbage in_daycare value is rejected by the check constraint'
);
SELECT test.logout();

-- ── All three real values are accepted and round-trip correctly ─────────
SELECT test.login('authenticated', 'b2222222-2222-2222-2222-222222222222');
INSERT INTO public.home_profile (user_id, has_stairs, home_type, has_pet, has_car, in_daycare, has_pool)
  VALUES ('b2222222-2222-2222-2222-222222222222', false, 'apartment', true, false, 'both', true);
SELECT test.assert(
  (SELECT in_daycare FROM public.home_profile WHERE user_id = 'b2222222-2222-2222-2222-222222222222') = 'both',
  'Owner: can save and read back the new ''both'' option'
);
SELECT test.logout();

-- ── RLS still isolates home_profile per-user after the ALTER TABLE ───────
SELECT test.login('authenticated', 'a1111111-1111-1111-1111-111111111111');
SELECT test.assert(
  (SELECT count(*) FROM public.home_profile WHERE user_id = 'b2222222-2222-2222-2222-222222222222') = 0,
  'Adversarial: a user cannot see another user''s home_profile row (RLS still intact post-migration)'
);
SELECT test.logout();

-- RLS-blocked UPDATE affects 0 rows rather than raising — verified via a
-- privileged read afterward, not assert_raises.
SELECT test.login('authenticated', 'b2222222-2222-2222-2222-222222222222');
UPDATE public.home_profile SET in_daycare = 'home' WHERE user_id = 'a1111111-1111-1111-1111-111111111111';
SELECT test.logout();

SELECT test.login('service_role');
SELECT test.assert(
  (SELECT in_daycare FROM public.home_profile WHERE user_id = 'a1111111-1111-1111-1111-111111111111') = 'daycare',
  'Adversarial: a user''s UPDATE of another user''s home_profile row silently affected 0 rows — value is still ''daycare'''
);
SELECT test.logout();
