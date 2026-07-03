-- Adversarial RLS tests for public.product_catalog.
-- Run via: npm run test:rls   (spins up a scratch Postgres DB, applies the
-- migration, runs this file, tears the DB down — see run_rls_tests.sh)
\set ON_ERROR_STOP on

-- ── Seed one row as service_role (the role the edge functions run as) ──────
SELECT test.login('service_role');
INSERT INTO public.product_catalog (barcode, name, brand, category, is_baby_product, source)
VALUES ('012345678905', 'Gentle Formula Tub', 'Bobbie', 'formula', true, 'openfoodfacts');
SELECT test.assert(
  (SELECT count(*) FROM public.product_catalog) = 1,
  'service_role can seed the catalog (sanity check the legitimate write path still works)'
);
SELECT test.logout();

-- ── Happy path: authenticated users can read the shared catalog ────────────
SELECT test.login('authenticated', '11111111-1111-1111-1111-111111111111');
SELECT test.assert(
  (SELECT count(*) FROM public.product_catalog WHERE barcode = '012345678905') = 1,
  'authenticated user can read a cached catalog entry'
);
SELECT test.logout();

-- A second, unrelated authenticated user should see the exact same shared
-- row (this is a global cache, not a per-user table) — confirms the SELECT
-- policy is genuinely "true", not accidentally scoped to a user_id that
-- doesn't exist on this table.
SELECT test.login('authenticated', '22222222-2222-2222-2222-222222222222');
SELECT test.assert(
  (SELECT count(*) FROM public.product_catalog WHERE barcode = '012345678905') = 1,
  'a different authenticated user also sees the shared catalog entry'
);
SELECT test.logout();

-- ── Adversarial: anon cannot read the catalog at all ────────────────────────
SELECT test.login('anon');
SELECT test.assert_raises(
  $$SELECT * FROM public.product_catalog$$,
  'anon cannot read the catalog (no SELECT grant for anon)'
);
SELECT test.logout();

-- ── Adversarial: authenticated cannot poison the cache with a fake entry ───
SELECT test.login('authenticated', '11111111-1111-1111-1111-111111111111');
SELECT test.assert_raises(
  $$INSERT INTO public.product_catalog (barcode, name, brand, source)
    VALUES ('999999999999', 'Fake Product', 'Not Real', 'manual')$$,
  'authenticated user cannot insert into the catalog (writes are service_role-only)'
);
SELECT test.logout();

-- ── Adversarial: authenticated cannot tamper with an existing cached entry ─
-- e.g. rewriting a real product's name/brand, or flipping is_baby_product,
-- or relabeling its `source` to make manually-entered data look official.
SELECT test.login('authenticated', '33333333-3333-3333-3333-333333333333');
SELECT test.assert_raises(
  $$UPDATE public.product_catalog SET name = 'Hacked Name' WHERE barcode = '012345678905'$$,
  'authenticated user cannot update an existing catalog entry'
);
SELECT test.assert_raises(
  $$UPDATE public.product_catalog SET source = 'openfoodfacts' WHERE barcode = '999999999999'$$,
  'authenticated user cannot relabel a row''s source to impersonate an official lookup source'
);
SELECT test.logout();

-- ── Adversarial: authenticated cannot delete cache entries ─────────────────
SELECT test.login('authenticated', '11111111-1111-1111-1111-111111111111');
SELECT test.assert_raises(
  $$DELETE FROM public.product_catalog WHERE barcode = '012345678905'$$,
  'authenticated user cannot delete a catalog entry'
);
SELECT test.logout();

-- ── Confirm the row survived every attack attempt, untouched ───────────────
SELECT test.login('service_role');
SELECT test.assert(
  (SELECT name FROM public.product_catalog WHERE barcode = '012345678905') = 'Gentle Formula Tub',
  'the seeded row is unmodified after every adversarial attempt above'
);
SELECT test.assert(
  (SELECT count(*) FROM public.product_catalog WHERE barcode = '999999999999') = 0,
  'no fake row was ever inserted by the adversarial attempts above'
);
SELECT test.logout();

-- ── Legitimate path: service_role (the edge functions) can update + upsert ─
SELECT test.login('service_role');
INSERT INTO public.product_catalog (barcode, name, brand, source)
VALUES ('012345678905', 'Gentle Formula Tub (updated)', 'Bobbie', 'openfoodfacts')
ON CONFLICT (barcode) DO UPDATE SET name = EXCLUDED.name;
SELECT test.assert(
  (SELECT name FROM public.product_catalog WHERE barcode = '012345678905') = 'Gentle Formula Tub (updated)',
  'service_role can upsert (re-cache) an existing barcode'
);
SELECT test.assert_raises(
  $$INSERT INTO public.product_catalog (barcode, name, brand, source)
    VALUES ('012345678905', 'Duplicate', 'X', 'manual')$$,
  'UNIQUE(barcode) constraint rejects a duplicate barcode even for service_role'
);
SELECT test.logout();
