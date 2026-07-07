-- Verifies the product detail page's recall-info query
-- (src/routes/_authenticated/products_.$id.tsx): a join from product_recalls
-- to recalls selecting (title, url, description, recall_date, source) —
-- expanded from title-only so the page can render a clickable "View
-- official recall notice" link plus description/date/source attribution.
--
-- Covers:
--   1. The product's owner can read the full joined recall detail.
--   2. A stranger (no access to the product) gets zero rows back from the
--      exact same query — product_recalls' existing "Users view own
--      product recalls" policy already restricts by user_id; this proves
--      selecting the additional columns doesn't change that.
--   3. Regression: the query must NOT filter on acknowledged. A user-
--      reported bug showed the recall banner (product.recalled = true)
--      with no clickable link/details once the recall had been
--      acknowledged (dismissed) via the Alerts tab elsewhere — the
--      original query filtered `.eq("acknowledged", false)`, so an
--      acknowledged row silently vanished from this page too, even
--      though the product is still flagged recalled.
\set ON_ERROR_STOP on

INSERT INTO auth.users (id) VALUES
  ('a1111111-1111-1111-1111-111111111111'),
  ('b2222222-2222-2222-2222-222222222222');

SELECT test.login('service_role');
INSERT INTO public.children (id, user_id, name) VALUES
  ('ccccc111-cccc-cccc-cccc-cccccccccccc', 'a1111111-1111-1111-1111-111111111111', 'Baby');
INSERT INTO public.products (id, user_id, child_id, name, category) VALUES
  ('ddddd111-dddd-dddd-dddd-dddddddddddd', 'a1111111-1111-1111-1111-111111111111', 'ccccc111-cccc-cccc-cccc-cccccccccccc', 'BabyBjorn Bouncer Bliss', 'bouncer');
INSERT INTO public.recalls (id, source, source_id, title, url, description, recall_date) VALUES
  ('eeeee111-eeee-eeee-eeee-eeeeeeeeeeee', 'cpsc', 'cpsc-12345', 'BabySwede LLC Recalls Bouncer Chairs Due to Laceration Hazard',
   'https://www.cpsc.gov/Recalls/2024/babyswede-recalls-bouncer', 'Small sharp metal objects found in the padded area can protrude, posing a laceration hazard.', '2024-07-01');
INSERT INTO public.product_recalls (user_id, product_id, recall_id, acknowledged) VALUES
  ('a1111111-1111-1111-1111-111111111111', 'ddddd111-dddd-dddd-dddd-dddddddddddd', 'eeeee111-eeee-eeee-eeee-eeeeeeeeeeee', false);
SELECT test.logout();

-- ── 1. Owner sees the full joined recall detail ─────────────────────────
SELECT test.login('authenticated', 'a1111111-1111-1111-1111-111111111111');
SELECT test.assert(
  (SELECT count(*) FROM public.product_recalls pr
     JOIN public.recalls r ON r.id = pr.recall_id
     WHERE pr.product_id = 'ddddd111-dddd-dddd-dddd-dddddddddddd' AND pr.acknowledged = false) = 1,
  'Owner: exactly one unacknowledged recall row joins successfully'
);
SELECT test.assert(
  (SELECT r.url FROM public.product_recalls pr
     JOIN public.recalls r ON r.id = pr.recall_id
     WHERE pr.product_id = 'ddddd111-dddd-dddd-dddd-dddddddddddd') = 'https://www.cpsc.gov/Recalls/2024/babyswede-recalls-bouncer',
  'Owner: the recall url column is readable (powers the clickable link)'
);
SELECT test.assert(
  (SELECT r.description FROM public.product_recalls pr
     JOIN public.recalls r ON r.id = pr.recall_id
     WHERE pr.product_id = 'ddddd111-dddd-dddd-dddd-dddddddddddd') LIKE '%laceration hazard%',
  'Owner: the recall description column is readable'
);
SELECT test.logout();

-- ── 2. Stranger gets zero rows from the identical query ─────────────────
SELECT test.login('authenticated', 'b2222222-2222-2222-2222-222222222222');
SELECT test.assert(
  (SELECT count(*) FROM public.product_recalls pr
     JOIN public.recalls r ON r.id = pr.recall_id
     WHERE pr.product_id = 'ddddd111-dddd-dddd-dddd-dddddddddddd') = 0,
  'Stranger: sees zero product_recalls rows for a product they do not own'
);
SELECT test.logout();

-- ── 3. Regression: acknowledged recalls must still show full detail ─────
SELECT test.login('service_role');
UPDATE public.product_recalls SET acknowledged = true
  WHERE product_id = 'ddddd111-dddd-dddd-dddd-dddddddddddd';
SELECT test.logout();

SELECT test.login('authenticated', 'a1111111-1111-1111-1111-111111111111');
SELECT test.assert(
  (SELECT count(*) FROM public.product_recalls pr
     JOIN public.recalls r ON r.id = pr.recall_id
     WHERE pr.product_id = 'ddddd111-dddd-dddd-dddd-dddddddddddd') = 1,
  'Owner: an acknowledged recall still returns a row (the product detail page query has no acknowledged filter)'
);
SELECT test.assert(
  (SELECT r.url FROM public.product_recalls pr
     JOIN public.recalls r ON r.id = pr.recall_id
     WHERE pr.product_id = 'ddddd111-dddd-dddd-dddd-dddddddddddd') = 'https://www.cpsc.gov/Recalls/2024/babyswede-recalls-bouncer',
  'Owner: the url is still readable even once acknowledged — this is the exact bug that made the link disappear'
);
SELECT test.logout();
