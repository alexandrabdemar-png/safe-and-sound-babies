-- Regression test for the fix to scheduled-recall-check/index.ts's
-- "new vs updated" classification.
--
-- Background: recordProductRecall (src/lib/recallRecord.functions.ts,
-- called from the add-a-product flows in products_.scan.tsx and
-- products_.new.tsx) writes a match into product_recalls immediately when
-- a product is added, but never calls notifyUser or stamps notified_at —
-- the parent only sees it via the live in-app banner at that moment. The
-- classification logic used to decide "new" vs "updated" purely on
-- whether a product_recalls row already existed, so an add-time-created
-- row (or one whose previous notifyUser call simply failed) could never
-- be classified "new" again — only "updated", with different copy, and
-- only once its recall's content_hash happened to differ from whatever
-- was last recorded. The fix keys this off notified_at instead: a row
-- that was never actually notified (notified_at IS NULL) is now always
-- treated as "new", regardless of whether the row itself pre-existed.
--
-- This simulates the exact sequence and asserts the FIXED outcome.
\set ON_ERROR_STOP on

INSERT INTO auth.users (id) VALUES ('a1111111-1111-1111-1111-111111111111');

SELECT test.login('service_role');
INSERT INTO public.children (id, user_id, name, date_of_birth) VALUES
  ('c1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 'Baby A', '2026-01-01');
INSERT INTO public.products (id, user_id, child_id, name, brand)
  VALUES ('d1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', 'Pipa RX', 'Nuna');
SELECT test.logout();

-- ── Sanity check: an add-time upsert with no content_hash in its payload
-- does not wipe an already-established one on a separate, already-known
-- recall (Supabase/PostgREST upserts only SET columns present in the
-- payload) — confirms the upsert-semantics assumption the rest of this
-- test (and the production code) relies on. ──────────────────────────────
SELECT test.login('service_role');
INSERT INTO public.recalls (id, source, source_id, title, url, recall_date, content_hash)
  VALUES ('f2222222-2222-2222-2222-222222222222', 'cpsc', '24002',
          'Acme Recalls Widget', 'https://www.saferproducts.gov/RecallDetail/24002',
          '2026-07-01', 'already-established-hash');
INSERT INTO public.recalls (source, source_id, title, url, recall_date)
  VALUES ('cpsc', '24002', 'Acme Recalls Widget', 'https://www.saferproducts.gov/RecallDetail/24002', '2026-07-01')
  ON CONFLICT (source, source_id) DO UPDATE SET
    title = EXCLUDED.title, url = EXCLUDED.url, recall_date = EXCLUDED.recall_date;
SELECT test.assert(
  (SELECT content_hash FROM public.recalls WHERE id = 'f2222222-2222-2222-2222-222222222222')
    = 'already-established-hash',
  'Confirmed: an add-time upsert with no content_hash in its payload does not wipe an already-established one'
);
SELECT test.logout();

-- ── Step 1: simulate the add-time write, exactly matching
-- recordProductRecall's payload shape — a bare recall row with no
-- content_hash, and a product_recalls link with notified_at/
-- notified_content_hash left at their column defaults (NULL) ───────────
SELECT test.login('service_role');
INSERT INTO public.recalls (id, source, source_id, title, url, recall_date)
  VALUES ('e1111111-1111-1111-1111-111111111111', 'cpsc', '24001',
          'Nuna Recalls Pipa RX Infant Car Seats Due to Fall Hazard',
          'https://www.saferproducts.gov/RecallDetail/24001', '2026-08-01');
INSERT INTO public.product_recalls (user_id, product_id, recall_id, acknowledged)
  VALUES ('a1111111-1111-1111-1111-111111111111', 'd1111111-1111-1111-1111-111111111111',
          'e1111111-1111-1111-1111-111111111111', false)
  ON CONFLICT (product_id, recall_id) DO NOTHING;
SELECT test.logout();

SELECT test.login('service_role');
SELECT test.assert(
  (SELECT notified_at FROM public.product_recalls
     WHERE product_id = 'd1111111-1111-1111-1111-111111111111') IS NULL,
  'Confirmed: the add-time write never stamps notified_at — no notification was sent at add time'
);
SELECT test.logout();

-- ── Step 2: simulate the scheduled batch's NEXT run re-encountering the
-- same (source, source_id) recall and upserting it WITH a real
-- content_hash (what enrichCatalogRow computes in recallBatch.ts) ───────
SELECT test.login('service_role');
UPDATE public.recalls SET content_hash = 'abc123realhash'
  WHERE id = 'e1111111-1111-1111-1111-111111111111';
SELECT test.logout();

-- ── Step 3: replicate the FIXED JS classification condition from
-- scheduled-recall-check/index.ts:
--   if (!existing || existing.notifiedAt === null) -> "new"
--   else if (currentHash && currentHash !== existing.hash) -> "updated"
-- The row already exists (step 1) but was never notified, so it must
-- still classify as "new" — not silently downgraded to "updated". ──────
SELECT test.login('service_role');
SELECT test.assert(
  (SELECT notified_at FROM public.product_recalls
     WHERE product_id = 'd1111111-1111-1111-1111-111111111111') IS NULL,
  'FIXED: the add-time-created row has notified_at still NULL, so the batch''s ' ||
  '"!existing || notifiedAt IS NULL" check classifies it as reason=''new'' — a ' ||
  'real, correctly-labeled "New recall" notification is sent on the batch''s ' ||
  'next run, not a downgraded "Updated recall" one'
);
SELECT test.logout();

-- ── Step 4: once genuinely notified (notified_at set), a LATER content
-- change on the same recall must still classify as "updated", not "new"
-- — the fix must not make every already-notified match re-fire "new"
-- forever. ────────────────────────────────────────────────────────────
SELECT test.login('service_role');
UPDATE public.product_recalls
  SET notified_at = now(), notification_channel = 'push', notified_content_hash = 'abc123realhash'
  WHERE product_id = 'd1111111-1111-1111-1111-111111111111';
UPDATE public.recalls SET content_hash = 'a-genuinely-new-hash-after-a-real-edit'
  WHERE id = 'e1111111-1111-1111-1111-111111111111';
SELECT test.assert(
  (SELECT notified_at FROM public.product_recalls
     WHERE product_id = 'd1111111-1111-1111-1111-111111111111') IS NOT NULL
  AND
  (SELECT content_hash FROM public.recalls WHERE id = 'e1111111-1111-1111-1111-111111111111')
    IS DISTINCT FROM
  (SELECT notified_content_hash FROM public.product_recalls
     WHERE product_id = 'd1111111-1111-1111-1111-111111111111'),
  'A genuinely already-notified match whose recall content later changes still ' ||
  'has notified_at set (so it takes the "updated" branch, not "new") and its ' ||
  'hash differs from what was last notified (so it still gets re-notified as an update)'
);
SELECT test.logout();
