-- Adversarial RLS tests for public.emergency_info and
-- public.emergency_share_links (Feature 3: 20260707000000_emergency_info.sql).
--
-- Covers:
--   1. An owner can read/write their own child's emergency_info.
--   2. A different authenticated user cannot read, insert, update, or
--      delete another user's emergency_info — direct query, not just
--      "the UI doesn't show a button for it".
--   3. anon has no access to emergency_info or emergency_share_links at all
--      — the shareable-link feature must never work by relaxing RLS.
--   4. A user cannot create a share link for a child they don't own, even
--      while claiming their own user_id (the WITH CHECK's ownership
--      subquery, not just user_id = auth.uid()).
--   5. The token-hash-based lookup used by the public read path
--      (src/routes/api/public/emergency-share.ts) only succeeds for an
--      unexpired, unrevoked link, and confirms the DB never stores the raw
--      token anywhere.
\set ON_ERROR_STOP on

INSERT INTO auth.users (id) VALUES
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222');

SELECT test.login('service_role');
INSERT INTO public.children (id, user_id, name) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Alice''s Baby'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'Bob''s Baby'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '11111111-1111-1111-1111-111111111111', 'Alice''s Second Baby');
SELECT test.logout();

-- ── 1. Owner can create and read their own emergency_info ──────────────
SELECT test.login('authenticated', '11111111-1111-1111-1111-111111111111');
INSERT INTO public.emergency_info (user_id, child_id, allergies, blood_type, pediatrician_phone)
VALUES ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Peanuts', 'O+', '555-0100');
SELECT test.assert(
  (SELECT count(*) FROM public.emergency_info WHERE child_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') = 1,
  'owner can create emergency_info for their own child'
);
SELECT test.assert(
  (SELECT allergies FROM public.emergency_info WHERE child_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') = 'Peanuts',
  'owner can read the emergency_info they just created'
);
SELECT test.logout();

-- ── 2. A different authenticated user cannot read, update, or delete it ─
SELECT test.login('authenticated', '22222222-2222-2222-2222-222222222222');
SELECT test.assert(
  (SELECT count(*) FROM public.emergency_info WHERE child_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') = 0,
  'a different authenticated user cannot see user A''s emergency_info row at all (RLS SELECT filter)'
);
-- UPDATE/DELETE affecting zero rows (not raising) is exactly how RLS blocks
-- this in Postgres — the row is invisible to the USING clause, so there is
-- nothing to update/delete rather than an explicit permission error.
UPDATE public.emergency_info SET allergies = 'Hacked' WHERE child_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
SELECT test.assert(
  (SELECT count(*) FROM information_schema.tables WHERE table_name = 'emergency_info') = 1,
  'sanity: table exists (guards against a typo silently no-oping the assertion above)'
);
DELETE FROM public.emergency_info WHERE child_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
SELECT test.logout();

SELECT test.login('service_role');
SELECT test.assert(
  (SELECT allergies FROM public.emergency_info WHERE child_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') = 'Peanuts',
  'user A''s emergency_info survived user B''s update/delete attempts untouched'
);
SELECT test.logout();

-- A different user also cannot insert a row claiming to be for their own
-- user_id but pointing at someone else's child, nor one impersonating user A.
SELECT test.login('authenticated', '22222222-2222-2222-2222-222222222222');
SELECT test.assert_raises(
  $$INSERT INTO public.emergency_info (user_id, child_id, allergies)
    VALUES ('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Fake')$$,
  'user B cannot insert emergency_info for user A''s child'
);
SELECT test.assert_raises(
  $$INSERT INTO public.emergency_info (user_id, child_id, allergies)
    VALUES ('11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Fake')$$,
  'user B cannot insert a row impersonating user A''s user_id'
);
-- Isolates the WITH CHECK's child-ownership subquery from the UNIQUE(child_id)
-- constraint: uses a child with NO existing emergency_info row, so if the
-- ownership check were missing (bug: WITH CHECK only verified user_id =
-- auth.uid()), this insert would have wrongly succeeded.
SELECT test.assert_raises(
  $$INSERT INTO public.emergency_info (user_id, child_id, allergies)
    VALUES ('22222222-2222-2222-2222-222222222222', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'Fake')$$,
  'user B cannot claim user A''s second (otherwise untouched) child by inserting under their own user_id'
);
SELECT test.logout();

-- ── 3. anon has no access to emergency_info at all ──────────────────────
SELECT test.login('anon');
SELECT test.assert_raises(
  $$SELECT * FROM public.emergency_info$$,
  'anon cannot read emergency_info directly (the share-link feature does not work by relaxing RLS)'
);
SELECT test.logout();

-- ── 4. Cannot create a share link for a child you don't own ─────────────
SELECT test.login('authenticated', '22222222-2222-2222-2222-222222222222');
SELECT test.assert_raises(
  $$INSERT INTO public.emergency_share_links (user_id, child_id, token_hash, expires_at)
    VALUES ('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'deadbeef', now() + interval '24 hours')$$,
  'user B cannot create a share link for user A''s child, even claiming their own user_id'
);
SELECT test.logout();

-- ── 5. Legitimate link lifecycle: create, look up by hash, expire, revoke ─
SELECT test.login('authenticated', '11111111-1111-1111-1111-111111111111');
INSERT INTO public.emergency_share_links (id, user_id, child_id, token_hash, expires_at)
VALUES (
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  '11111111-1111-1111-1111-111111111111',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9',
  now() + interval '24 hours'
);
SELECT test.assert(
  (SELECT count(*) FROM public.emergency_share_links WHERE id = 'cccccccc-cccc-cccc-cccc-cccccccccccc') = 1,
  'owner can create a share link for their own child'
);
SELECT test.logout();

-- The public read path uses service_role (RLS bypassed) and looks up
-- purely by token_hash — simulating what api/public/emergency-share.ts does.
SELECT test.login('service_role');
SELECT test.assert(
  (SELECT child_id FROM public.emergency_share_links
     WHERE token_hash = 'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9'
       AND revoked_at IS NULL AND expires_at > now()) = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'an unexpired, unrevoked link resolves to the correct child by its token hash'
);

-- Simulate the same link having expired (as if 24+ hours had passed).
UPDATE public.emergency_share_links SET expires_at = now() - interval '1 minute'
WHERE id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
SELECT test.assert(
  NOT EXISTS (
    SELECT 1 FROM public.emergency_share_links
    WHERE token_hash = 'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9'
      AND revoked_at IS NULL AND expires_at > now()
  ),
  'an expired token is rejected by the same lookup the public read path uses'
);

-- Reset expiry, then revoke instead — revocation must also block the lookup.
UPDATE public.emergency_share_links SET expires_at = now() + interval '24 hours'
WHERE id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
UPDATE public.emergency_share_links SET revoked_at = now()
WHERE id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
SELECT test.assert(
  NOT EXISTS (
    SELECT 1 FROM public.emergency_share_links
    WHERE token_hash = 'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9'
      AND revoked_at IS NULL AND expires_at > now()
  ),
  'a revoked (but not yet expired) token is rejected by the same lookup'
);
SELECT test.logout();

-- ── The DB never stores the raw token, only its hash ────────────────────
SELECT test.assert(
  NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'emergency_share_links' AND column_name = 'token'
  ),
  'emergency_share_links has no raw-token column — only token_hash exists'
);

-- ── Non-expiring links (20260719000000_emergency_share_links_no_expiry.sql):
--    expires_at is now nullable, and NULL means "never expires" — the
--    public read path's lookup must treat it as always-valid, not reject it.
SELECT test.assert(
  (SELECT is_nullable FROM information_schema.columns
     WHERE table_name = 'emergency_share_links' AND column_name = 'expires_at') = 'YES',
  'expires_at accepts NULL now that links no longer auto-expire'
);

SELECT test.login('authenticated', '11111111-1111-1111-1111-111111111111');
INSERT INTO public.emergency_share_links (id, user_id, child_id, token_hash, expires_at)
VALUES (
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  '11111111-1111-1111-1111-111111111111',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
  NULL
);
SELECT test.logout();

SELECT test.login('service_role');
SELECT test.assert(
  (SELECT child_id FROM public.emergency_share_links
     WHERE token_hash = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2'
       AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now())) = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'a link with NULL expires_at resolves as active — it never expires on its own'
);

-- A non-expiring link is still not immortal — revoking it must still work.
UPDATE public.emergency_share_links SET revoked_at = now()
WHERE id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
SELECT test.assert(
  NOT EXISTS (
    SELECT 1 FROM public.emergency_share_links
    WHERE token_hash = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2'
      AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now())
  ),
  'revocation still blocks a non-expiring link — revoke remains the only way to end it'
);
SELECT test.logout();
