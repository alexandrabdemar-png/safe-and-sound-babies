-- Food Log: logging the same packaged food again (the "Log again" button,
-- or a daily pouch) must reuse ONE mirrored product so it is recall-checked
-- once and doesn't flood the Products list — and editing/deleting one entry
-- must never rename or delete the product out from under the others.
\set ON_ERROR_STOP on

INSERT INTO auth.users (id) VALUES ('a1111111-1111-1111-1111-111111111111');

SELECT test.login('service_role');
INSERT INTO public.children (id, user_id, name) VALUES
  ('ccccc333-cccc-cccc-cccc-cccccccccccc', 'a1111111-1111-1111-1111-111111111111', 'Baby');
SELECT test.logout();

SELECT test.login('authenticated', 'a1111111-1111-1111-1111-111111111111');
INSERT INTO public.first_foods (id, child_id, food_name, date_introduced, is_packaged, brand, barcode) VALUES
  ('9f000003-0000-0000-0000-000000000001', 'ccccc333-cccc-cccc-cccc-cccccccccccc',
   'Tractor Wheels (Wheat)', '2026-10-30', true, 'Once Upon a Farm', '0850000000001'),
  ('9f000003-0000-0000-0000-000000000002', 'ccccc333-cccc-cccc-cccc-cccccccccccc',
   'Tractor Wheels (Wheat)', '2026-10-31', true, 'Once Upon a Farm', '0850000000001'),
  ('9f000003-0000-0000-0000-000000000003', 'ccccc333-cccc-cccc-cccc-cccccccccccc',
   'Tractor Wheels (Wheat)', '2026-11-01', true, 'Once Upon a Farm', '0850000000001');
SELECT test.logout();

SELECT test.login('service_role');
SELECT test.assert(
  (SELECT count(*) FROM public.products WHERE product_type = 'food') = 1,
  'three logs of the same pouch share one recall-tracked product');
SELECT test.assert(
  (SELECT count(DISTINCT product_id) FROM public.first_foods WHERE product_id IS NOT NULL) = 1
  AND (SELECT count(*) FROM public.first_foods WHERE product_id IS NULL) = 0,
  'every log entry points at that product');
SELECT test.assert(
  (SELECT name FROM public.products WHERE product_type = 'food') = 'Tractor Wheels',
  'mirrored name drops the allergen tag');
SELECT test.logout();

-- Editing just the notes/date of one entry keeps it on the shared product.
SELECT test.login('authenticated', 'a1111111-1111-1111-1111-111111111111');
UPDATE public.first_foods SET reaction_notes = 'loved it', date_introduced = '2026-11-02'
  WHERE id = '9f000003-0000-0000-0000-000000000003';
SELECT test.logout();
SELECT test.login('service_role');
SELECT test.assert(
  (SELECT count(*) FROM public.products WHERE product_type = 'food') = 1,
  'notes/date edit does not create a product');
SELECT test.logout();

-- Renaming ONE entry moves only that entry; the others keep the original.
SELECT test.login('authenticated', 'a1111111-1111-1111-1111-111111111111');
UPDATE public.first_foods SET food_name = 'Mango Pouch'
  WHERE id = '9f000003-0000-0000-0000-000000000003';
SELECT test.logout();
SELECT test.login('service_role');
SELECT test.assert(
  (SELECT count(*) FROM public.products WHERE product_type = 'food') = 2,
  'renamed entry gets its own product');
SELECT test.assert(
  (SELECT p.name FROM public.first_foods f JOIN public.products p ON p.id = f.product_id
     WHERE f.id = '9f000003-0000-0000-0000-000000000001') = 'Tractor Wheels',
  'other entries were not renamed');
SELECT test.assert(
  (SELECT p.name FROM public.first_foods f JOIN public.products p ON p.id = f.product_id
     WHERE f.id = '9f000003-0000-0000-0000-000000000003') = 'Mango Pouch',
  'edited entry tracks its new name');
SELECT test.logout();

-- Renaming it back rejoins the shared product and cleans up the extra one.
SELECT test.login('authenticated', 'a1111111-1111-1111-1111-111111111111');
UPDATE public.first_foods SET food_name = 'Tractor Wheels (Wheat)'
  WHERE id = '9f000003-0000-0000-0000-000000000003';
SELECT test.logout();
SELECT test.login('service_role');
SELECT test.assert(
  (SELECT count(*) FROM public.products WHERE product_type = 'food') = 1,
  'renaming back reuses the shared product and removes the orphan');
SELECT test.logout();

-- Marking one entry as not packaged / deleting one keeps the product for the rest.
SELECT test.login('authenticated', 'a1111111-1111-1111-1111-111111111111');
UPDATE public.first_foods SET is_packaged = false WHERE id = '9f000003-0000-0000-0000-000000000002';
DELETE FROM public.first_foods WHERE id = '9f000003-0000-0000-0000-000000000003';
SELECT test.logout();
SELECT test.login('service_role');
SELECT test.assert(
  (SELECT product_id FROM public.first_foods WHERE id = '9f000003-0000-0000-0000-000000000001') IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.products p JOIN public.first_foods f ON f.product_id = p.id
              WHERE f.id = '9f000003-0000-0000-0000-000000000001'),
  'remaining entry is still recall-tracked');
SELECT test.logout();

-- Deleting the last entry removes the mirrored product.
SELECT test.login('authenticated', 'a1111111-1111-1111-1111-111111111111');
DELETE FROM public.first_foods WHERE id = '9f000003-0000-0000-0000-000000000001';
SELECT test.logout();
SELECT test.login('service_role');
SELECT test.assert(
  (SELECT count(*) FROM public.products WHERE product_type = 'food') = 0,
  'last entry deleted removes the mirrored product');
SELECT test.logout();

\echo 'food_log_shared_products: all assertions passed'
