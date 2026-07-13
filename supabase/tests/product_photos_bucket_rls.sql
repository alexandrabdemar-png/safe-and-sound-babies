-- Adversarial RLS tests for the "product-photos" storage bucket AFTER the
-- 20260713235422 lockdown migration: photos are no longer a public catalog —
-- only the uploader OR a user who owns/has caregiver access to a products
-- row whose photo_url references the object may view it.
\set ON_ERROR_STOP on

-- Seed users + a child owned by user A
INSERT INTO auth.users (id) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');

INSERT INTO public.children (id, user_id, name, date_of_birth)
  VALUES ('11111111-1111-1111-1111-111111111111',
          'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          'Baby A', '2025-01-01');

-- ── Seed: user A uploads a photo for a barcode and links it to a product ──
SELECT test.login('authenticated', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
INSERT INTO storage.objects (bucket_id, name, owner)
VALUES ('product-photos', '012345678905/photo1.jpg', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
INSERT INTO public.products (user_id, child_id, name, product_type, photo_url)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        '11111111-1111-1111-1111-111111111111',
        'Test Seat', 'car_seat',
        'https://example.supabase.co/storage/v1/object/public/product-photos/012345678905/photo1.jpg');
SELECT test.assert(
  (SELECT count(*) FROM storage.objects WHERE bucket_id = 'product-photos') = 1,
  'authenticated uploader can upload a product photo'
);
SELECT test.assert(
  (SELECT count(*) FROM storage.objects WHERE name = '012345678905/photo1.jpg') = 1,
  'uploader can view their own photo (owner match)'
);
SELECT test.logout();

-- ── Adversarial: anon can NO LONGER view (bucket lockdown) ─────────────────
SELECT test.login('anon');
SELECT test.assert(
  (SELECT count(*) FROM storage.objects WHERE bucket_id = 'product-photos') = 0,
  'Adversarial: anon cannot view product photos anymore (bucket lockdown)'
);
SELECT test.logout();

-- ── Adversarial: user B, who owns no product referencing this photo, ─────
--    cannot view it — even though authenticated.
SELECT test.login('authenticated', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
SELECT test.assert(
  (SELECT count(*) FROM storage.objects WHERE name = '012345678905/photo1.jpg') = 0,
  'Adversarial: unrelated authenticated user B cannot view user A''s product photo'
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
