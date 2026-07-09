-- Adversarial coverage for scheduled-recall-check's write pattern
-- (supabase/functions/scheduled-recall-check/index.ts): a daily service-role
-- batch job that loads EVERY product across EVERY user in one query, then
-- upserts recalls/product_recalls matches for whichever ones match. This is
-- the "checked for recalls constantly" mechanism — it runs regardless of
-- whether a product was added via barcode scan, AI search, or the manual
-- form, since it just sweeps the products table.
--
-- The property under test: a single batch run touching products belonging
-- to MULTIPLE different users must not leak one user's recall match to
-- another — RLS still applies per-row even though the write itself came
-- from one bulk service-role operation covering everyone at once.
\set ON_ERROR_STOP on

INSERT INTO auth.users (id) VALUES
  ('a1111111-1111-1111-1111-111111111111'),
  ('b2222222-2222-2222-2222-222222222222');

SELECT test.login('service_role');
INSERT INTO public.children (id, user_id, name) VALUES
  ('ca111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 'Alice Baby'),
  ('cb222222-2222-2222-2222-222222222222', 'b2222222-2222-2222-2222-222222222222', 'Bob Baby');
-- Two products, one scanned (has a barcode), one manually added (no
-- barcode) — the batch job's product SELECT doesn't distinguish, matching
-- src/routes/_authenticated/products_.scan.tsx and products_.new.tsx both
-- feeding the same `products` table it sweeps.
INSERT INTO public.products (id, user_id, child_id, name, category, barcode) VALUES
  ('da111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 'ca111111-1111-1111-1111-111111111111', 'Scanned Stroller', 'stroller', '012345678905'),
  ('db222222-2222-2222-2222-222222222222', 'b2222222-2222-2222-2222-222222222222', 'cb222222-2222-2222-2222-222222222222', 'Manually Added Crib', 'crib', NULL);

-- Simulates one run of scheduled-recall-check matching BOTH products at
-- once against two different recalls (one CPSC, one NHTSA — proving the
-- newly-added "nhtsa" source works end to end, not just "cpsc").
INSERT INTO public.recalls (id, source, source_id, title, url) VALUES
  ('ea111111-1111-1111-1111-111111111111', 'cpsc', 'cpsc-batch-1', 'Scanned Stroller Recalled', 'https://www.cpsc.gov/Recalls/batch-1'),
  ('eb222222-2222-2222-2222-222222222222', 'nhtsa', 'nhtsa-batch-1', 'Manually Added Crib Recalled', 'https://www.nhtsa.gov/recalls?nhtsaId=batch-1');
INSERT INTO public.product_recalls (user_id, product_id, recall_id, acknowledged) VALUES
  ('a1111111-1111-1111-1111-111111111111', 'da111111-1111-1111-1111-111111111111', 'ea111111-1111-1111-1111-111111111111', false),
  ('b2222222-2222-2222-2222-222222222222', 'db222222-2222-2222-2222-222222222222', 'eb222222-2222-2222-2222-222222222222', false);
UPDATE public.products SET recalled = true
  WHERE id IN ('da111111-1111-1111-1111-111111111111', 'db222222-2222-2222-2222-222222222222');
SELECT test.logout();

-- ── Alice (scanned product) sees her own match, not Bob's ───────────────
SELECT test.login('authenticated', 'a1111111-1111-1111-1111-111111111111');
SELECT test.assert(
  (SELECT count(*) FROM public.product_recalls pr JOIN public.recalls r ON r.id = pr.recall_id
     WHERE pr.product_id = 'da111111-1111-1111-1111-111111111111' AND r.source = 'cpsc') = 1,
  'Alice: sees the CPSC match on her scanned product after the batch write'
);
SELECT test.assert(
  (SELECT count(*) FROM public.product_recalls WHERE product_id = 'db222222-2222-2222-2222-222222222222') = 0,
  'Alice: adversarial — cannot see Bob''s recall match on his manually-added product'
);
SELECT test.logout();

-- ── Bob (manually-added product, NHTSA match) sees his own, not Alice's ──
SELECT test.login('authenticated', 'b2222222-2222-2222-2222-222222222222');
SELECT test.assert(
  (SELECT count(*) FROM public.product_recalls pr JOIN public.recalls r ON r.id = pr.recall_id
     WHERE pr.product_id = 'db222222-2222-2222-2222-222222222222' AND r.source = 'nhtsa') = 1,
  'Bob: sees the NHTSA match on his manually-added product after the batch write'
);
SELECT test.assert(
  (SELECT count(*) FROM public.product_recalls WHERE product_id = 'da111111-1111-1111-1111-111111111111') = 0,
  'Bob: adversarial — cannot see Alice''s recall match on her scanned product'
);
SELECT test.logout();

-- ── A stranger to both sees neither, even though the recalls table itself is shared/readable ──
INSERT INTO auth.users (id) VALUES ('55555555-5555-5555-5555-555555555555');
SELECT test.login('authenticated', '55555555-5555-5555-5555-555555555555');
SELECT test.assert(
  (SELECT count(*) FROM public.recalls WHERE id IN ('ea111111-1111-1111-1111-111111111111', 'eb222222-2222-2222-2222-222222222222')) = 2,
  'Stranger: CAN see the shared recalls catalog rows themselves (by design — Recall Radar is global)'
);
SELECT test.assert(
  (SELECT count(*) FROM public.product_recalls WHERE product_id IN ('da111111-1111-1111-1111-111111111111', 'db222222-2222-2222-2222-222222222222')) = 0,
  'Stranger: still cannot see either product-to-recall LINK — knowing a recall exists globally does not reveal whose product matched it'
);
SELECT test.logout();
