-- Coverage for migration 20260717000000_category_watchlist_fix_onboarding_products.sql
-- Verifies: a user can record/read their own category_watchlist rows, RLS
-- hides one user's watchlist from another (adversarial), a user cannot
-- insert a watchlist row on someone else's behalf (adversarial), and the
-- backfill correctly migrates an onboarding placeholder product row out of
-- `products` while leaving a real, hand-entered product with the same
-- category untouched.
\set ON_ERROR_STOP on

INSERT INTO auth.users (id) VALUES
  ('a1111111-1111-1111-1111-111111111111'),
  ('b2222222-2222-2222-2222-222222222222');

-- ── A user can record their own watchlist entry and read it back ─────────
SELECT test.login('authenticated', 'a1111111-1111-1111-1111-111111111111');
INSERT INTO public.category_watchlist (user_id, category)
  VALUES ('a1111111-1111-1111-1111-111111111111', 'high_chair');
SELECT test.assert(
  (SELECT count(*) FROM public.category_watchlist
     WHERE user_id = 'a1111111-1111-1111-1111-111111111111' AND category = 'high_chair') = 1,
  'A user can record and read back their own category watchlist entry'
);
SELECT test.logout();

-- ── Adversarial: a user cannot insert a watchlist row for another user ───
SELECT test.login('authenticated', 'a1111111-1111-1111-1111-111111111111');
SELECT test.assert_raises(
  $$INSERT INTO public.category_watchlist (user_id, category)
    VALUES ('b2222222-2222-2222-2222-222222222222', 'bouncer')$$,
  'RLS WITH CHECK blocks a user from inserting a watchlist row for a different user_id'
);
SELECT test.logout();

-- ── Adversarial: RLS hides one user's watchlist from another ─────────────
SELECT test.login('authenticated', 'b2222222-2222-2222-2222-222222222222');
INSERT INTO public.category_watchlist (user_id, category)
  VALUES ('b2222222-2222-2222-2222-222222222222', 'sleep_sack');
SELECT test.assert(
  (SELECT count(*) FROM public.category_watchlist WHERE user_id = 'a1111111-1111-1111-1111-111111111111') = 0,
  'Adversarial: a stranger cannot see another user''s category watchlist'
);
SELECT test.logout();

-- ── Backfill heuristic: placeholder product rows are migrated & removed ──
-- (Simulates the pre-migration state: this INSERT mimics what the OLD
-- onboarding.tsx bug would have written directly into `products`, then we
-- re-run the same migration logic against it to confirm cleanup works.)
SELECT test.login('authenticated', 'a1111111-1111-1111-1111-111111111111');
INSERT INTO public.products (user_id, name, category)
  VALUES ('a1111111-1111-1111-1111-111111111111', 'Bouncers', 'bouncer');
-- A REAL, hand-entered product that happens to share a category — must survive.
INSERT INTO public.products (user_id, name, category, brand)
  VALUES ('a1111111-1111-1111-1111-111111111111', 'My favorite bouncer', 'bouncer', 'BabyBjorn');
SELECT test.logout();

-- Re-run (as postgres/superuser context outside RLS, matching how the
-- migration itself runs) the exact backfill + delete from the migration.
INSERT INTO public.category_watchlist (user_id, child_id, category, created_at)
SELECT user_id, child_id, category, created_at
FROM public.products
WHERE brand IS NULL AND model IS NULL AND size IS NULL AND barcode IS NULL
  AND notes IS NULL AND purchased_at IS NULL
  AND (name, category) IN (
    ('Car seats', 'car_seat'), ('Cribs', 'crib'), ('Bassinets', 'bassinet'),
    ('Strollers', 'stroller'), ('High chairs', 'high_chair'), ('Bouncers', 'bouncer'),
    ('Activity centers', 'activity_center'), ('Sleep sacks', 'sleep_sack'), ('Baby gates', 'baby_gate')
  )
  AND user_id = 'a1111111-1111-1111-1111-111111111111';

DELETE FROM public.products
WHERE brand IS NULL AND model IS NULL AND size IS NULL AND barcode IS NULL
  AND notes IS NULL AND purchased_at IS NULL
  AND (name, category) IN (
    ('Car seats', 'car_seat'), ('Cribs', 'crib'), ('Bassinets', 'bassinet'),
    ('Strollers', 'stroller'), ('High chairs', 'high_chair'), ('Bouncers', 'bouncer'),
    ('Activity centers', 'activity_center'), ('Sleep sacks', 'sleep_sack'), ('Baby gates', 'baby_gate')
  )
  AND user_id = 'a1111111-1111-1111-1111-111111111111';

SELECT test.login('authenticated', 'a1111111-1111-1111-1111-111111111111');
SELECT test.assert(
  (SELECT count(*) FROM public.products
     WHERE user_id = 'a1111111-1111-1111-1111-111111111111' AND name = 'Bouncers') = 0,
  'The onboarding placeholder "Bouncers" row is removed from products after backfill'
);
SELECT test.assert(
  (SELECT count(*) FROM public.category_watchlist
     WHERE user_id = 'a1111111-1111-1111-1111-111111111111' AND category = 'bouncer'
       AND created_at IS NOT NULL) >= 1,
  'The placeholder row''s intent is preserved in category_watchlist'
);
SELECT test.assert(
  (SELECT count(*) FROM public.products
     WHERE user_id = 'a1111111-1111-1111-1111-111111111111' AND name = 'My favorite bouncer') = 1,
  'A real, hand-entered product sharing the same category is NOT deleted by the backfill'
);
SELECT test.logout();
