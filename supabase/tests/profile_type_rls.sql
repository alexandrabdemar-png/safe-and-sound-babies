-- Adversarial coverage for the profile-type/age-range onboarding feature
-- (20260719020000_profile_type_and_intro.sql): profiles.profile_type,
-- care_age_min_months, care_age_max_months, intro_seen_at.
--
-- These are plain columns on the existing public.profiles table, so the
-- existing "Users update own profile" RLS policy (auth.uid() = user_id)
-- should already cover them with no new policy needed — this file proves
-- that's actually true rather than assuming it, plus exercises the new
-- CHECK constraints adversarially.
\set ON_ERROR_STOP on

INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('a1111111-1111-1111-1111-111111111111', 'alice@example.com', '{"full_name": "Alice"}'::jsonb),
  ('b2222222-2222-2222-2222-222222222222', 'bob@example.com', '{"full_name": "Bob"}'::jsonb);

-- ── Owner can set their own profile_type and age range ──────────────────
SELECT test.login('authenticated', 'a1111111-1111-1111-1111-111111111111');
UPDATE public.profiles
  SET profile_type = 'daycare', care_age_min_months = 0, care_age_max_months = 24
  WHERE user_id = 'a1111111-1111-1111-1111-111111111111';
SELECT test.assert(
  (SELECT profile_type FROM public.profiles WHERE user_id = 'a1111111-1111-1111-1111-111111111111') = 'daycare',
  'owner can set their own profile_type'
);
SELECT test.assert(
  (SELECT care_age_max_months FROM public.profiles WHERE user_id = 'a1111111-1111-1111-1111-111111111111') = 24,
  'owner can set their own care_age_max_months'
);
SELECT test.logout();

-- ── A different authenticated user cannot overwrite it ──────────────────
SELECT test.login('authenticated', 'b2222222-2222-2222-2222-222222222222');
UPDATE public.profiles SET profile_type = 'caregiver', care_age_min_months = 999
  WHERE user_id = 'a1111111-1111-1111-1111-111111111111';
SELECT test.logout();

SELECT test.login('service_role');
SELECT test.assert(
  (SELECT profile_type FROM public.profiles WHERE user_id = 'a1111111-1111-1111-1111-111111111111') = 'daycare',
  'adversarial: user B''s update attempt on user A''s profile_type silently affected zero rows (RLS)'
);
SELECT test.assert(
  (SELECT care_age_min_months FROM public.profiles WHERE user_id = 'a1111111-1111-1111-1111-111111111111') = 0,
  'adversarial: user B''s update attempt on user A''s care_age_min_months silently affected zero rows (RLS)'
);
SELECT test.logout();

-- ── anon has no access to profiles at all ────────────────────────────────
SELECT test.login('anon');
SELECT test.assert_raises(
  $$UPDATE public.profiles SET profile_type = 'daycare' WHERE user_id = 'a1111111-1111-1111-1111-111111111111'$$,
  'anon cannot update any profile at all'
);
SELECT test.logout();

-- ── CHECK constraints: adversarial bad-data attempts ─────────────────────
SELECT test.login('authenticated', 'b2222222-2222-2222-2222-222222222222');

SELECT test.assert_raises(
  $$UPDATE public.profiles SET profile_type = 'hacker' WHERE user_id = 'b2222222-2222-2222-2222-222222222222'$$,
  'an unrecognized profile_type value is rejected by the CHECK constraint'
);

SELECT test.assert_raises(
  $$UPDATE public.profiles SET care_age_min_months = -1 WHERE user_id = 'b2222222-2222-2222-2222-222222222222'$$,
  'a negative care_age_min_months is rejected by the CHECK constraint'
);

SELECT test.assert_raises(
  $$UPDATE public.profiles SET care_age_max_months = -1 WHERE user_id = 'b2222222-2222-2222-2222-222222222222'$$,
  'a negative care_age_max_months is rejected by the CHECK constraint'
);

SELECT test.assert_raises(
  $$UPDATE public.profiles SET care_age_min_months = 24, care_age_max_months = 12
    WHERE user_id = 'b2222222-2222-2222-2222-222222222222'$$,
  'an age range with max < min is rejected by the CHECK constraint'
);

-- Sanity: a genuinely valid range on the same row succeeds (proves the
-- rejections above were the CHECK firing correctly, not RLS or some other
-- unrelated failure masking a false pass).
UPDATE public.profiles SET profile_type = 'pediatrician', care_age_min_months = 0, care_age_max_months = 216
  WHERE user_id = 'b2222222-2222-2222-2222-222222222222';
SELECT test.assert(
  (SELECT profile_type FROM public.profiles WHERE user_id = 'b2222222-2222-2222-2222-222222222222') = 'pediatrician',
  'sanity: a valid profile_type and in-order age range at the max bound succeeds'
);
SELECT test.logout();

-- ── intro_seen_at: owner can set it, another user cannot ────────────────
SELECT test.login('authenticated', 'a1111111-1111-1111-1111-111111111111');
UPDATE public.profiles SET intro_seen_at = now() WHERE user_id = 'a1111111-1111-1111-1111-111111111111';
SELECT test.assert(
  (SELECT intro_seen_at FROM public.profiles WHERE user_id = 'a1111111-1111-1111-1111-111111111111') IS NOT NULL,
  'owner can record having seen the intro modal'
);
SELECT test.logout();

-- Bob tries to stamp a deliberately distinctive, easily-distinguished
-- timestamp onto Alice's row — if RLS were broken, this exact value would
-- show up on Alice's row below.
SELECT test.login('authenticated', 'b2222222-2222-2222-2222-222222222222');
UPDATE public.profiles SET intro_seen_at = '2020-01-01T00:00:00Z'
  WHERE user_id = 'a1111111-1111-1111-1111-111111111111';
SELECT test.logout();

SELECT test.login('service_role');
SELECT test.assert(
  (SELECT intro_seen_at FROM public.profiles WHERE user_id = 'a1111111-1111-1111-1111-111111111111')
    <> '2020-01-01T00:00:00Z'::timestamptz,
  'adversarial: user B''s attempt to overwrite user A''s intro_seen_at with a distinctive value did not take effect'
);
SELECT test.logout();
