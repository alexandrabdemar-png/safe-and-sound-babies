-- Regression coverage for products_.new.tsx's handleSubmit() insert —
-- written while investigating a user report: manually adding a product
-- fails with "Couldn't save".
--
-- Runs against _final_recalls_schema.sql (the FINAL intended schema,
-- reconstructed directly from every migration that touches these tables —
-- see that file for why it doesn't replay the full historical migration
-- chain). Verifies the EXACT insert payload handleSubmit() sends —
-- including lot_number, added by 20260719030000_recall_lot_matching.sql,
-- the same migration recall-radar's separate investigation flagged as the
-- likely not-yet-applied-live culprit for a different bug — succeeds for
-- an authenticated user against the intended schema, for both the
-- car_seat and "other" category paths (the two branches that set
-- different optional fields).
--
-- A clean pass here confirms the CODE and the INTENDED schema are correct
-- together — same as the recall-radar investigation, it can't see the
-- live database's actual migration state. If manual add-product is still
-- failing live after confirming this migration is applied, the next
-- suspect is RLS or a value the form sends that this fixture doesn't
-- reproduce (e.g. an invalid category label).
\set ON_ERROR_STOP on

INSERT INTO auth.users (id) VALUES ('11111111-1111-1111-1111-111111111111');
SELECT test.login('authenticated', '11111111-1111-1111-1111-111111111111');

INSERT INTO public.children (id, user_id, name)
VALUES ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Test Child');

-- ── 1. The "other" category path (no manufacture_date/expiration_date) ──
INSERT INTO public.products (
  user_id, child_id, name, brand, category, barcode, purchased_at, added_at,
  replace_at, size, product_type, manufacture_date, expiration_date,
  predicted_sizeup_date, notes, lot_number
) VALUES (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  'Tommee Tippee Ultra-Light Silicone Soother',
  'Tommee Tippee',
  'Pacifier',
  '123456789012',
  now(),
  now(),
  NULL,
  NULL,
  'other',
  NULL,
  NULL,
  (CURRENT_DATE + INTERVAL '60 days'),
  NULL,
  'LOT-A1'
);

SELECT test.assert(
  (SELECT count(*) FROM public.products WHERE name = 'Tommee Tippee Ultra-Light Silicone Soother') = 1,
  'the "other" category insert payload succeeds as authenticated on the fully-migrated schema'
);

-- ── 2. The car_seat category path (manufacture_date/expiration_date set) ─
INSERT INTO public.products (
  user_id, child_id, name, brand, category, barcode, purchased_at, added_at,
  replace_at, size, product_type, manufacture_date, expiration_date,
  predicted_sizeup_date, notes, lot_number
) VALUES (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  'Nuna Pipa RX Infant Car Seat',
  'Nuna',
  'Car seat',
  '987654321098',
  now(),
  now(),
  NULL,
  NULL,
  'car_seat',
  '2026-01-01',
  '2032-01-01',
  NULL,
  NULL,
  'LOT-B2'
);

SELECT test.assert(
  (SELECT count(*) FROM public.products WHERE name = 'Nuna Pipa RX Infant Car Seat') = 1,
  'the car_seat category insert payload succeeds as authenticated on the fully-migrated schema'
);

-- ── 3. Both required columns genuinely exist in the final schema ────────
SELECT test.assert(
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'lot_number'),
  'products.lot_number exists in the final schema'
);

-- ── 4. product_type CHECK constraint actually rejects an invalid value ──
SELECT test.assert_raises(
  $$INSERT INTO public.products (user_id, name, product_type) VALUES ('11111111-1111-1111-1111-111111111111', 'Bad Product', 'not_a_real_type')$$,
  'product_type CHECK constraint rejects a value outside car_seat/formula/medicine/other'
);

SELECT test.logout();

-- ── 5. Adversarial: a different authenticated user cannot insert a ──────
--       product under someone else's user_id (RLS WITH CHECK)
INSERT INTO auth.users (id) VALUES ('33333333-3333-3333-3333-333333333333');
SELECT test.login('authenticated', '33333333-3333-3333-3333-333333333333');
SELECT test.assert_raises(
  $$INSERT INTO public.products (user_id, name, product_type) VALUES ('11111111-1111-1111-1111-111111111111', 'Impersonated Product', 'other')$$,
  'an authenticated user cannot insert a product under a different user_id'
);
SELECT test.logout();

-- ── 6. Adversarial: anon cannot insert a product at all ──────────────────
SELECT test.login('anon');
SELECT test.assert_raises(
  $$INSERT INTO public.products (user_id, name, product_type) VALUES ('11111111-1111-1111-1111-111111111111', 'Anon Product', 'other')$$,
  'anon cannot insert into products at all'
);
SELECT test.logout();
