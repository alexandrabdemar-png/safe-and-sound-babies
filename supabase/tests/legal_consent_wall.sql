-- Coverage for migration 20260716000000_legal_consent_wall.sql (adds
-- user_agreements, the clickwrap acceptance audit trail behind the
-- /legal-consent gate in _authenticated/route.tsx) plus
-- 20260813000000_user_agreements_age_verification.sql (adds the
-- is_18_or_older column backing the separate age-confirmation checkbox).
-- Verifies: a user can record and read their own acceptance, the
-- (user_id, terms_version) uniqueness constraint prevents duplicate rows
-- for a re-submitted checkbox, a user cannot record an agreement on
-- another user's behalf, RLS hides one user's agreements from another
-- (adversarial), is_18_or_older defaults to false when omitted (so a row
-- can never accidentally read as "confirmed" without the app explicitly
-- setting it), and a true value round-trips correctly.
--
-- Run with both migrations applied, in order:
--   supabase/tests/run_rls_tests.sh \
--     -m supabase/migrations/20260716000000_legal_consent_wall.sql \
--     -m supabase/migrations/20260813000000_user_agreements_age_verification.sql \
--     supabase/tests/legal_consent_wall.sql
\set ON_ERROR_STOP on

INSERT INTO auth.users (id) VALUES
  ('a1111111-1111-1111-1111-111111111111'),
  ('b2222222-2222-2222-2222-222222222222');

-- ── A user can record their own acceptance and read it back ──────────────
SELECT test.login('authenticated', 'a1111111-1111-1111-1111-111111111111');
INSERT INTO public.user_agreements (user_id, terms_version)
  VALUES ('a1111111-1111-1111-1111-111111111111', '2026-07-16');
SELECT test.assert(
  (SELECT count(*) FROM public.user_agreements
     WHERE user_id = 'a1111111-1111-1111-1111-111111111111' AND terms_version = '2026-07-16') = 1,
  'A user can record and read back their own agreement'
);
SELECT test.logout();

-- ── Adversarial: a user cannot record an agreement on someone else's behalf ──
SELECT test.login('authenticated', 'a1111111-1111-1111-1111-111111111111');
SELECT test.assert_raises(
  $$INSERT INTO public.user_agreements (user_id, terms_version)
    VALUES ('b2222222-2222-2222-2222-222222222222', '2026-07-16')$$,
  'RLS WITH CHECK blocks a user from inserting an agreement row for a different user_id'
);
SELECT test.logout();

-- ── The (user_id, terms_version) unique constraint rejects a duplicate ───
SELECT test.login('authenticated', 'a1111111-1111-1111-1111-111111111111');
SELECT test.assert_raises(
  $$INSERT INTO public.user_agreements (user_id, terms_version)
    VALUES ('a1111111-1111-1111-1111-111111111111', '2026-07-16')$$,
  'A duplicate (user_id, terms_version) row is rejected — one acceptance per version, per user'
);
SELECT test.logout();

-- ── Adversarial: RLS hides one user's agreements from another ────────────
SELECT test.login('authenticated', 'b2222222-2222-2222-2222-222222222222');
INSERT INTO public.user_agreements (user_id, terms_version)
  VALUES ('b2222222-2222-2222-2222-222222222222', '2026-07-16');
SELECT test.assert(
  (SELECT count(*) FROM public.user_agreements WHERE user_id = 'a1111111-1111-1111-1111-111111111111') = 0,
  'Adversarial: a stranger cannot see another user''s recorded agreements'
);
SELECT test.logout();

-- ── A user can accept a NEW terms version without conflicting with an old one ──
SELECT test.login('authenticated', 'a1111111-1111-1111-1111-111111111111');
INSERT INTO public.user_agreements (user_id, terms_version)
  VALUES ('a1111111-1111-1111-1111-111111111111', '2026-08-01');
SELECT test.assert(
  (SELECT count(*) FROM public.user_agreements WHERE user_id = 'a1111111-1111-1111-1111-111111111111') = 2,
  'A new terms_version is a new row, not an overwrite — the audit trail keeps every accepted version'
);
SELECT test.logout();

-- ── is_18_or_older defaults to false when the app doesn't explicitly set it ──
SELECT test.assert(
  (SELECT is_18_or_older FROM public.user_agreements
     WHERE user_id = 'a1111111-1111-1111-1111-111111111111' AND terms_version = '2026-08-01') = false,
  'is_18_or_older defaults to false — a row can never accidentally read as age-confirmed'
);

-- ── The age-confirmation checkbox value round-trips correctly ────────────
SELECT test.login('authenticated', 'a1111111-1111-1111-1111-111111111111');
INSERT INTO public.user_agreements (user_id, terms_version, is_18_or_older)
  VALUES ('a1111111-1111-1111-1111-111111111111', '2026-08-13', true);
SELECT test.assert(
  (SELECT is_18_or_older FROM public.user_agreements
     WHERE user_id = 'a1111111-1111-1111-1111-111111111111' AND terms_version = '2026-08-13') = true,
  'is_18_or_older is recorded as true when the app explicitly sets it, exactly what /legal-consent does on submit'
);
SELECT test.logout();
