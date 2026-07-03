-- Adversarial RLS tests for the "product-photos" storage bucket.
\set ON_ERROR_STOP on

-- ── Seed: user A uploads a photo for a barcode ──────────────────────────────
SELECT test.login('authenticated', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
INSERT INTO storage.objects (bucket_id, name, owner)
VALUES ('product-photos', '012345678905/photo1.jpg', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
SELECT test.assert(
  (SELECT count(*) FROM storage.objects WHERE bucket_id = 'product-photos') = 1,
  'authenticated user can upload a product photo'
);
SELECT test.logout();

-- ── Anyone (including anon) can view product photos — it's a public catalog
SELECT test.login('anon');
SELECT test.assert(
  (SELECT count(*) FROM storage.objects WHERE bucket_id = 'product-photos' AND name = '012345678905/photo1.jpg') = 1,
  'anon can view a product photo (public, shared catalog)'
);
SELECT test.logout();

-- ── A different authenticated user can also see it ─────────────────────────
SELECT test.login('authenticated', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
SELECT test.assert(
  (SELECT count(*) FROM storage.objects WHERE bucket_id = 'product-photos' AND name = '012345678905/photo1.jpg') = 1,
  'a different authenticated user can also view the photo'
);

-- ── Adversarial: user B cannot overwrite user A's photo ─────────────────────
-- NB: storage.objects grants broad UPDATE/DELETE privileges to `authenticated`
-- (this matches Supabase's real setup — RLS is the only gate, not table
-- GRANTs). An UPDATE/DELETE whose USING clause excludes every row doesn't
-- raise an error, it just matches zero rows — so the correct adversarial
-- assertion is "0 rows affected", not "statement raised an exception".
UPDATE storage.objects SET name = 'hacked.jpg' WHERE owner = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
SELECT test.assert(
  (SELECT count(*) FROM storage.objects WHERE name = 'hacked.jpg') = 0,
  'user B''s update to user A''s photo affected zero rows (blocked by RLS USING clause)'
);

-- ── Adversarial: user B cannot delete user A's photo ────────────────────────
DELETE FROM storage.objects WHERE owner = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
SELECT test.assert(
  (SELECT count(*) FROM storage.objects WHERE owner = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') = 1,
  'user B''s delete of user A''s photo affected zero rows (blocked by RLS USING clause)'
);

-- ── User B *can* upload their own photo (collaborative, not blocked) ───────
INSERT INTO storage.objects (bucket_id, name, owner)
VALUES ('product-photos', '012345678905/photo2.jpg', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
SELECT test.assert(
  (SELECT count(*) FROM storage.objects WHERE bucket_id = 'product-photos') = 2,
  'a different authenticated user can contribute their own photo for the same barcode'
);
SELECT test.logout();

-- ── User A's original photo is untouched by user B's attempts ──────────────
SELECT test.login('service_role');
SELECT test.assert(
  (SELECT name FROM storage.objects WHERE owner = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') = '012345678905/photo1.jpg',
  'user A''s photo name is unchanged after user B''s attack attempts'
);
SELECT test.logout();

-- ── User A CAN update/delete their own photo ────────────────────────────────
SELECT test.login('authenticated', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
UPDATE storage.objects SET name = '012345678905/photo1-retake.jpg' WHERE owner = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
SELECT test.assert(
  (SELECT count(*) FROM storage.objects WHERE name = '012345678905/photo1-retake.jpg') = 1,
  'owner can update (replace) their own photo'
);
DELETE FROM storage.objects WHERE owner = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
SELECT test.assert(
  (SELECT count(*) FROM storage.objects WHERE bucket_id = 'product-photos') = 1,
  'owner can delete their own photo'
);
SELECT test.logout();
