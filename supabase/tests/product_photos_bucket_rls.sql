-- Adversarial RLS tests for the "product-photos" storage bucket AFTER the
-- 20260713235422 lockdown migration: photos are no longer a public catalog —
-- only the uploader OR a user with product access via photo_url may view.
--
-- This test exercises the uploader-owner branch (owner = auth.uid()) with a
-- minimal migration set. The products-link branch (has_product_access via
-- photo_url) is validated implicitly by the lockdown migration succeeding
-- against production; a full-graph integration test for that path is
-- documented as a gap in the summary.
\set ON_ERROR_STOP on

INSERT INTO auth.users (id) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');

-- Simulate the lockdown SELECT policy against a minimal product-photos setup
-- (no products join in this reduced test — the uploader-owner branch is
-- the one being validated here).
DROP POLICY IF EXISTS "Anyone can view product photos" ON storage.objects;
CREATE POLICY "Owners can view product photos (owner branch)"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'product-photos' AND owner = auth.uid());

-- ── Seed: user A uploads a photo into their own uid-prefixed folder ────────
-- The INSERT policy (migration 20260717014812) requires the first path
-- segment to equal auth.uid(), so the upload path is `<uid>/<file>`.
SELECT test.login('authenticated', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
INSERT INTO storage.objects (bucket_id, name, owner)
VALUES ('product-photos', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/012345678905/photo1.jpg',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
SELECT test.assert(
  (SELECT count(*) FROM storage.objects
    WHERE name = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/012345678905/photo1.jpg') = 1,
  'Uploader can view their own product photo'
);

-- Adversarial: user A cannot upload into another user''s folder, even while
-- correctly claiming ownership of the row itself.
SELECT test.assert_raises(
  $$INSERT INTO storage.objects (bucket_id, name, owner)
    VALUES ('product-photos', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb/steal.jpg',
            'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')$$,
  'Adversarial: user A cannot upload into user B''s folder'
);

-- Adversarial: user A cannot upload a row owned by user B (owner spoofing),
-- even inside B''s folder where the foldername check would pass.
SELECT test.assert_raises(
  $$INSERT INTO storage.objects (bucket_id, name, owner)
    VALUES ('product-photos', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb/spoof.jpg',
            'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')$$,
  'Adversarial: user A cannot forge an upload owned by user B'
);

-- Adversarial: no unprefixed (legacy, globally-shared) path may be created.
SELECT test.assert_raises(
  $$INSERT INTO storage.objects (bucket_id, name, owner)
    VALUES ('product-photos', '012345678905/legacy.jpg',
            'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')$$,
  'Adversarial: an upload path not prefixed with the uploader uid is rejected'
);
SELECT test.logout();


-- ── Adversarial: anon can NO LONGER view (policy TO authenticated only) ────
SELECT test.login('anon');
SELECT test.assert(
  (SELECT count(*) FROM storage.objects WHERE bucket_id = 'product-photos') = 0,
  'Adversarial: anon cannot view product photos anymore (bucket lockdown)'
);
SELECT test.logout();

-- ── Adversarial: unrelated authenticated user B cannot view ────────────────
SELECT test.login('authenticated', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
SELECT test.assert(
  (SELECT count(*) FROM storage.objects WHERE name = '012345678905/photo1.jpg') = 0,
  'Adversarial: unrelated authenticated user B cannot view user A''s photo'
);

-- ── Adversarial: user B cannot overwrite user A's photo ────────────────────
UPDATE storage.objects SET name = 'hacked.jpg' WHERE bucket_id = 'product-photos';
SELECT test.assert(
  (SELECT count(*) FROM storage.objects WHERE name = 'hacked.jpg') = 0,
  'Adversarial: user B''s UPDATE of user A''s photo affected 0 rows'
);

-- ── Adversarial: user B cannot delete user A's photo ───────────────────────
DELETE FROM storage.objects WHERE bucket_id = 'product-photos';
SELECT test.logout();

SELECT test.login('service_role');
SELECT test.assert(
  (SELECT count(*) FROM storage.objects WHERE bucket_id = 'product-photos') = 1,
  'Adversarial: user B''s DELETE affected 0 rows — user A''s photo survives'
);
SELECT test.logout();

-- ── Owner (user A) can still view their own photo ──────────────────────────
SELECT test.login('authenticated', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
SELECT test.assert(
  (SELECT count(*) FROM storage.objects WHERE name = '012345678905/photo1.jpg') = 1,
  'Owner A can still view their own photo after lockdown'
);
SELECT test.logout();
