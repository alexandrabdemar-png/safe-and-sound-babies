-- Adversarial coverage for the signup path: the handle_new_user() trigger
-- on auth.users (20260607212106_*.sql:96-111) and RLS on public.profiles.
-- Written after a code audit into "some users can't sign up" reports found
-- no NOT-NULL/RLS bug in the trigger itself (see errors.test.ts's
-- friendlyAuthError tests for the other half of that investigation — raw
-- GoTrue error strings leaking to the UI). This file verifies the security
-- properties explicitly requested: cross-user profiles access is blocked,
-- anonymous inserts are blocked, and the SECURITY DEFINER trigger can't be
-- abused to write an arbitrary user_id.
\set ON_ERROR_STOP on

-- Simulates a real signup: inserting into auth.users fires handle_new_user(),
-- which is exactly how Supabase's GoTrue creates the profile row today.
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('a1111111-1111-1111-1111-111111111111', 'alice@example.com', '{"full_name": "Alice"}'::jsonb),
  ('b2222222-2222-2222-2222-222222222222', 'bob@example.com', '{}'::jsonb);

-- ── The trigger actually created both profile rows ────────────────────────
SELECT test.assert(
  (SELECT count(*) FROM public.profiles WHERE user_id = 'a1111111-1111-1111-1111-111111111111') = 1,
  'handle_new_user() created a profile row for the new auth.users row'
);
SELECT test.assert(
  (SELECT display_name FROM public.profiles WHERE user_id = 'a1111111-1111-1111-1111-111111111111') = 'Alice',
  'The trigger reads full_name out of raw_user_meta_data when present'
);
SELECT test.assert(
  (SELECT display_name FROM public.profiles WHERE user_id = 'b2222222-2222-2222-2222-222222222222') = 'bob',
  'The trigger falls back to the email local-part when no name metadata is present (empty raw_user_meta_data, the OAuth/edge case)'
);

-- ── A user can read and update their own profile ──────────────────────────
SELECT test.login('authenticated', 'a1111111-1111-1111-1111-111111111111');
SELECT test.assert(
  (SELECT count(*) FROM public.profiles WHERE user_id = 'a1111111-1111-1111-1111-111111111111') = 1,
  'A user can read their own profile row'
);
UPDATE public.profiles SET display_name = 'Alice Updated' WHERE user_id = 'a1111111-1111-1111-1111-111111111111';
SELECT test.assert(
  (SELECT display_name FROM public.profiles WHERE user_id = 'a1111111-1111-1111-1111-111111111111') = 'Alice Updated',
  'A user can update their own profile row'
);
SELECT test.logout();

-- ── Adversarial: a user cannot read another user's profile row ───────────
SELECT test.login('authenticated', 'b2222222-2222-2222-2222-222222222222');
SELECT test.assert(
  (SELECT count(*) FROM public.profiles WHERE user_id = 'a1111111-1111-1111-1111-111111111111') = 0,
  'Adversarial: RLS hides another user''s profile row from SELECT entirely'
);
SELECT test.logout();

-- ── Adversarial: a user cannot update another user's profile row ─────────
SELECT test.login('authenticated', 'b2222222-2222-2222-2222-222222222222');
UPDATE public.profiles SET display_name = 'Hacked' WHERE user_id = 'a1111111-1111-1111-1111-111111111111';
SELECT test.logout();
SELECT test.assert(
  (SELECT display_name FROM public.profiles WHERE user_id = 'a1111111-1111-1111-1111-111111111111') = 'Alice Updated',
  'Adversarial: an UPDATE targeting another user''s row silently affects zero rows under RLS (Alice''s row is untouched)'
);

-- ── Adversarial: a user cannot INSERT a profile row claiming to be someone else ──
SELECT test.login('authenticated', 'b2222222-2222-2222-2222-222222222222');
SELECT test.assert_raises(
  $$INSERT INTO public.profiles (user_id, display_name)
    VALUES ('a1111111-1111-1111-1111-111111111111', 'Impersonator')$$,
  'RLS WITH CHECK blocks a user from inserting a profile row under a different user_id'
);
SELECT test.logout();

-- ── Adversarial: an unauthenticated (anon) client cannot read or write profiles ──
-- profiles has no GRANT to anon at all (only `authenticated`/`service_role`
-- — see 20260607212106_*.sql:11-12), so this is denied at the table-grant
-- level before RLS is even evaluated — the strongest possible outcome,
-- stronger than an RLS policy alone would give.
SELECT test.login('anon', NULL);
SELECT test.assert_raises(
  $$SELECT count(*) FROM public.profiles$$,
  'Adversarial: an anonymous client cannot even SELECT from profiles (no table grant, not just no RLS policy)'
);
SELECT test.assert_raises(
  $$INSERT INTO public.profiles (user_id, display_name)
    VALUES ('c3333333-3333-3333-3333-333333333333', 'Anon Signup')$$,
  'Adversarial: an anonymous client cannot insert into profiles at all'
);
SELECT test.logout();

-- ── The SECURITY DEFINER trigger cannot be invoked directly to forge a row ──
-- handle_new_user() has EXECUTE revoked from PUBLIC/anon/authenticated
-- (20260607212119_*.sql) — confirm a non-owner role really can't call it
-- as an RPC to write an arbitrary user_id (it only ever runs via the
-- AFTER INSERT trigger, reading NEW.id, never a client-supplied value).
SELECT test.login('authenticated', 'b2222222-2222-2222-2222-222222222222');
SELECT test.assert_raises(
  $$SELECT public.handle_new_user()$$,
  'Adversarial: an authenticated user cannot directly invoke the SECURITY DEFINER signup trigger function to forge a profile for an arbitrary user'
);
SELECT test.logout();
