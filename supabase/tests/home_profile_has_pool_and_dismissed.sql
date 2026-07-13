-- Coverage for two live user-reported home_profile fixes:
--   1. Question 6 "Do you have a pool?" wasn't saving — this test verifies
--      has_pool round-trips true/false through an authenticated upsert.
--   2. The "Help us personalize your reminders" popup kept reappearing —
--      migration 20260713230635 added a dismissed_at timestamptz column so
--      dismissal persists per-user across devices. This test verifies the
--      column exists, accepts a timestamp, is isolated by RLS from other
--      users, and survives an upsert without being wiped by a partial
--      update.
\set ON_ERROR_STOP on

INSERT INTO auth.users (id) VALUES
  ('c3333333-3333-3333-3333-333333333333'),
  ('d4444444-4444-4444-4444-444444444444');

-- ── has_pool round-trips true ────────────────────────────────────────────
SELECT test.login('authenticated', 'c3333333-3333-3333-3333-333333333333');
INSERT INTO public.home_profile (user_id, has_stairs, in_daycare, has_pool)
  VALUES ('c3333333-3333-3333-3333-333333333333', true, 'home', true);
SELECT test.assert(
  (SELECT has_pool FROM public.home_profile
    WHERE user_id = 'c3333333-3333-3333-3333-333333333333') = true,
  'has_pool=true saved and read back by the owner'
);

-- ── has_pool can be updated to false (Q6 toggle path) ────────────────────
UPDATE public.home_profile SET has_pool = false
  WHERE user_id = 'c3333333-3333-3333-3333-333333333333';
SELECT test.assert(
  (SELECT has_pool FROM public.home_profile
    WHERE user_id = 'c3333333-3333-3333-3333-333333333333') = false,
  'has_pool can be toggled false by the owner'
);
SELECT test.logout();

-- ── dismissed_at column exists and accepts a timestamptz ────────────────
SELECT test.login('authenticated', 'c3333333-3333-3333-3333-333333333333');
UPDATE public.home_profile SET dismissed_at = '2026-07-13T23:00:00Z'
  WHERE user_id = 'c3333333-3333-3333-3333-333333333333';
SELECT test.assert(
  (SELECT dismissed_at FROM public.home_profile
    WHERE user_id = 'c3333333-3333-3333-3333-333333333333')
      = '2026-07-13T23:00:00Z'::timestamptz,
  'dismissed_at column persists a timestamptz value'
);
SELECT test.logout();

-- ── Adversarial: another user CANNOT read our dismissed_at / has_pool ───
SELECT test.login('authenticated', 'd4444444-4444-4444-4444-444444444444');
SELECT test.assert(
  (SELECT count(*) FROM public.home_profile
    WHERE user_id = 'c3333333-3333-3333-3333-333333333333') = 0,
  'Adversarial: user D cannot see user C''s home_profile at all (RLS)'
);
-- ── Adversarial: another user cannot overwrite dismissed_at to force
--    the popup to reappear for user C
UPDATE public.home_profile SET dismissed_at = NULL
  WHERE user_id = 'c3333333-3333-3333-3333-333333333333';
SELECT test.logout();

SELECT test.login('service_role');
SELECT test.assert(
  (SELECT dismissed_at FROM public.home_profile
    WHERE user_id = 'c3333333-3333-3333-3333-333333333333') IS NOT NULL,
  'Adversarial: user D''s UPDATE affected 0 rows — user C''s dismissed_at survived'
);
SELECT test.logout();

-- ── Adversarial: user D cannot INSERT a row claiming user C's user_id ───
SELECT test.login('authenticated', 'd4444444-4444-4444-4444-444444444444');
SELECT test.assert_raises(
  $$INSERT INTO public.home_profile (user_id, has_pool)
     VALUES ('c3333333-3333-3333-3333-333333333333', true)$$,
  'Adversarial: user D''s INSERT with a spoofed user_id is blocked by RLS WITH CHECK'
);
SELECT test.logout();

-- ── ON CONFLICT upsert path (matches the actual app skip-handler code)
--    doesn't wipe existing has_pool/dismissed_at when it re-runs.
SELECT test.login('authenticated', 'c3333333-3333-3333-3333-333333333333');
INSERT INTO public.home_profile (user_id, dismissed_at)
  VALUES ('c3333333-3333-3333-3333-333333333333', now())
  ON CONFLICT (user_id) DO UPDATE SET dismissed_at = EXCLUDED.dismissed_at;
SELECT test.assert(
  (SELECT has_pool FROM public.home_profile
    WHERE user_id = 'c3333333-3333-3333-3333-333333333333') = false,
  'Upsert with only dismissed_at does NOT wipe has_pool (partial upsert semantics)'
);
SELECT test.assert(
  (SELECT dismissed_at FROM public.home_profile
    WHERE user_id = 'c3333333-3333-3333-3333-333333333333') IS NOT NULL,
  'Upsert applied dismissed_at'
);
SELECT test.logout();
