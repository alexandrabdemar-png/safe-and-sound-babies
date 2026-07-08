-- Adversarial coverage for the recordProductRecall server function
-- (src/lib/recallRecord.functions.ts), added after a live bug report: adding
-- a recalled product showed "flagged for a recall, but details aren't
-- available yet" — product.recalled was true but no product_recalls row
-- existed. Root cause: the browser previously wrote directly to
-- `recalls`/`product_recalls` as the authenticated user; both writes were
-- silently rejected by RLS (Supabase's `.single()` resolves
-- `{data: null, error}` rather than throwing, and the calling code never
-- checked `error`), so nothing was ever actually persisted.
--
-- Covers:
--   1. (Adversarial) An authenticated user CANNOT insert directly into the
--      shared `recalls` catalog — this is the exact rejection that caused
--      the bug, confirmed here so a regression (e.g. someone "fixing" it by
--      opening up client-side INSERT) would be caught immediately. Opening
--      this up would also let any user inject an arbitrary "official
--      recall" row visible to every other user.
--   2. (Adversarial) An authenticated user CANNOT insert directly into
--      `product_recalls`, even for a product they own.
--   3. (Adversarial) An authenticated user cannot flip the `acknowledged`
--      flag on another user's product_recalls row (escalation attempt).
--   4. The service-role write path the server function actually uses (both
--      inserts, exactly as recordProductRecall performs them) succeeds, and
--      the product's owner can then read the full joined detail — proving
--      the fix actually produces visible data, not just "no longer throws".
--   5. (Adversarial) A stranger still gets zero rows from that same query.
\set ON_ERROR_STOP on

INSERT INTO auth.users (id) VALUES
  ('a1111111-1111-1111-1111-111111111111'),
  ('b2222222-2222-2222-2222-222222222222');

SELECT test.login('service_role');
INSERT INTO public.children (id, user_id, name) VALUES
  ('ccccc222-cccc-cccc-cccc-cccccccccccc', 'a1111111-1111-1111-1111-111111111111', 'Baby');
INSERT INTO public.products (id, user_id, child_id, name, category) VALUES
  ('ddddd222-dddd-dddd-dddd-dddddddddddd', 'a1111111-1111-1111-1111-111111111111', 'ccccc222-cccc-cccc-cccc-cccccccccccc', 'Yoyo Stroller', 'stroller');
-- Seed one pre-existing recall + product_recalls row (owned by user A) so
-- test 3 has a real row to attempt to escalate against.
INSERT INTO public.recalls (id, source, source_id, title, url) VALUES
  ('fffff222-ffff-ffff-ffff-ffffffffffff', 'cpsc', 'cpsc-seed-1', 'Seed Recall For Escalation Test', 'https://www.cpsc.gov/Recalls/seed');
INSERT INTO public.product_recalls (user_id, product_id, recall_id, acknowledged) VALUES
  ('a1111111-1111-1111-1111-111111111111', 'ddddd222-dddd-dddd-dddd-dddddddddddd', 'fffff222-ffff-ffff-ffff-ffffffffffff', false);
SELECT test.logout();

-- ── 1. Adversarial: authenticated user cannot write to the shared recalls catalog ──
SELECT test.login('authenticated', 'a1111111-1111-1111-1111-111111111111');
SELECT test.assert_raises(
  $$INSERT INTO public.recalls (source, source_id, title, url) VALUES ('cpsc', 'attacker-1', 'Fake Recall Injected By User', 'https://evil.example.com')$$,
  'Authenticated user cannot INSERT directly into public.recalls (this is exactly what silently failed before the fix)'
);
SELECT test.logout();

-- ── 2. Adversarial: authenticated user cannot write to product_recalls, even for their own product ──
SELECT test.login('authenticated', 'a1111111-1111-1111-1111-111111111111');
SELECT test.assert_raises(
  $$INSERT INTO public.product_recalls (user_id, product_id, recall_id, acknowledged) VALUES ('a1111111-1111-1111-1111-111111111111', 'ddddd222-dddd-dddd-dddd-dddddddddddd', 'fffff222-ffff-ffff-ffff-ffffffffffff', false)$$,
  'Authenticated user cannot INSERT directly into public.product_recalls, even for a product they own'
);
SELECT test.logout();

-- ── 3. Adversarial: authenticated user cannot escalate/tamper with another user's product_recalls row ──
SELECT test.login('authenticated', 'b2222222-2222-2222-2222-222222222222');
UPDATE public.product_recalls SET acknowledged = true
  WHERE product_id = 'ddddd222-dddd-dddd-dddd-dddddddddddd';
SELECT test.logout();

SELECT test.login('service_role');
SELECT test.assert(
  (SELECT acknowledged FROM public.product_recalls WHERE product_id = 'ddddd222-dddd-dddd-dddd-dddddddddddd') = false,
  'Stranger UPDATE of another user''s product_recalls row silently affected 0 rows — acknowledged is still false'
);
SELECT test.logout();

-- ── 4. The actual write path recordProductRecall uses (service role) succeeds ──
SELECT test.login('service_role');
INSERT INTO public.recalls (source, source_id, title, url, recall_date)
  VALUES ('cpsc', 'cpsc-99999', 'Yoyo Strollers Recalled Due to Fall Hazard', 'https://www.cpsc.gov/Recalls/2026/yoyo-stroller', '2026-07-01')
  ON CONFLICT (source, source_id) DO UPDATE SET title = EXCLUDED.title
  RETURNING id \gset recall_
INSERT INTO public.product_recalls (user_id, product_id, recall_id, acknowledged)
  VALUES ('a1111111-1111-1111-1111-111111111111', 'ddddd222-dddd-dddd-dddd-dddddddddddd', :'recall_id', false)
  ON CONFLICT (product_id, recall_id) DO NOTHING;
UPDATE public.products SET recalled = true
  WHERE id = 'ddddd222-dddd-dddd-dddd-dddddddddddd' AND user_id = 'a1111111-1111-1111-1111-111111111111';
SELECT test.logout();

SELECT test.login('authenticated', 'a1111111-1111-1111-1111-111111111111');
SELECT test.assert(
  (SELECT recalled FROM public.products WHERE id = 'ddddd222-dddd-dddd-dddd-dddddddddddd') = true,
  'Owner: product.recalled is true after the service-role write path'
);
SELECT test.assert(
  (SELECT count(*) FROM public.product_recalls pr
     JOIN public.recalls r ON r.id = pr.recall_id
     WHERE pr.product_id = 'ddddd222-dddd-dddd-dddd-dddddddddddd' AND r.source_id = 'cpsc-99999') = 1,
  'Owner: the newly-linked recall is actually joinable and readable — this is the exact data the "details aren''t available yet" fallback was missing'
);
SELECT test.assert(
  (SELECT r.url FROM public.product_recalls pr
     JOIN public.recalls r ON r.id = pr.recall_id
     WHERE pr.product_id = 'ddddd222-dddd-dddd-dddd-dddddddddddd' AND r.source_id = 'cpsc-99999') = 'https://www.cpsc.gov/Recalls/2026/yoyo-stroller',
  'Owner: the recall url is readable (powers the clickable "View official recall notice" link)'
);
SELECT test.logout();

-- ── 5. Adversarial: stranger still gets zero rows for this product's recalls ──
SELECT test.login('authenticated', 'b2222222-2222-2222-2222-222222222222');
SELECT test.assert(
  (SELECT count(*) FROM public.product_recalls pr
     JOIN public.recalls r ON r.id = pr.recall_id
     WHERE pr.product_id = 'ddddd222-dddd-dddd-dddd-dddddddddddd') = 0,
  'Stranger: sees zero product_recalls rows for a product they do not own, even after the service-role write'
);
SELECT test.logout();
