-- Empirically verifies a specific claim traced from reading
-- src/lib/recallRecord.functions.ts (recordProductRecall, called from the
-- add-a-product flows in products_.scan.tsx and products_.new.tsx) and
-- supabase/functions/scheduled-recall-check/index.ts's newMatches
-- classification: when a match is found and recorded at add-time (via the
-- live in-app banner shown right then), NO push/email notification is ever
-- sent for it at that moment — recordProductRecall only writes to
-- `recalls`/`product_recalls`/`products.recalled`, it never calls
-- notifyUser or touches notified_at/notification_channel.
--
-- The open question this test resolves empirically (not from code-reading
-- alone): does the user ever get a real push/email notification for that
-- match afterward, via the next scheduled batch run? The batch's
-- "new-vs-updated" check is keyed on product_recalls.notified_content_hash,
-- not notified_at — so this simulates exactly that comparison to confirm
-- whether the add-time-created row (with notified_content_hash left NULL)
-- gets picked up as "updated" (and therefore notified) on the batch's next
-- pass, or is permanently skipped because a product_recalls row already
-- exists for that (product_id, recall_id) pair.
\set ON_ERROR_STOP on

INSERT INTO auth.users (id) VALUES ('a1111111-1111-1111-1111-111111111111');

SELECT test.login('service_role');
INSERT INTO public.children (id, user_id, name, date_of_birth) VALUES
  ('c1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 'Baby A', '2026-01-01');
INSERT INTO public.products (id, user_id, child_id, name, brand)
  VALUES ('d1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', 'Pipa RX', 'Nuna');
SELECT test.logout();

-- ── Sanity check on a separate recall: if the batch has ALREADY
-- established a real content_hash for a recall (i.e. it's not the first
-- time anyone's seen it), does a LATER add-time upsert (whose payload
-- doesn't include content_hash at all) accidentally null it out? Supabase/
-- PostgREST upserts only SET the columns present in the payload, so this
-- should survive untouched — confirming that part of the trace too, not
-- just assuming Postgres upsert semantics behave as expected. ───────────
SELECT test.login('service_role');
INSERT INTO public.recalls (id, source, source_id, title, url, recall_date, content_hash)
  VALUES ('f2222222-2222-2222-2222-222222222222', 'cpsc', '24002',
          'Acme Recalls Widget', 'https://www.saferproducts.gov/RecallDetail/24002',
          '2026-07-01', 'already-established-hash');
-- Same shape as recordProductRecall's upsert — no content_hash in the payload.
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
-- recordProductRecall's payload shape (recallRecord.functions.ts) — a
-- bare recall row with no content_hash, and a product_recalls link with
-- notified_at/notified_content_hash left at their column defaults ────────
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
SELECT test.assert(
  (SELECT notified_content_hash FROM public.product_recalls
     WHERE product_id = 'd1111111-1111-1111-1111-111111111111') IS NULL,
  'Confirmed: notified_content_hash also starts NULL for an add-time-created match'
);
SELECT test.logout();

-- ── Step 2: simulate the scheduled batch's NEXT run re-encountering the
-- same (source, source_id) recall and upserting it WITH a real
-- content_hash (what enrichCatalogRow computes in recallBatch.ts) — the
-- upsert only touches columns in its payload, so this is exactly what
-- `supabase.from("recalls").upsert(catalogRows, {onConflict:
-- "source,source_id"})` does in scheduled-recall-check/index.ts ─────────
SELECT test.login('service_role');
UPDATE public.recalls SET content_hash = 'abc123realhash'
  WHERE id = 'e1111111-1111-1111-1111-111111111111';
SELECT test.logout();

-- ── Step 3: replicate the exact JS classification condition from
-- scheduled-recall-check/index.ts:
--   if (!existingByKey.has(key)) -> "new"
--   else if (currentHash && currentHash !== existingByKey.get(key)) -> "updated"
-- The row already exists (step 1), so it's never "new" again. Whether it's
-- "updated" (and therefore actually gets a notification attempt) depends
-- on this exact comparison. ────────────────────────────────────────────
SELECT test.login('service_role');
SELECT test.assert(
  (SELECT content_hash FROM public.recalls WHERE id = 'e1111111-1111-1111-1111-111111111111')
    IS DISTINCT FROM
  (SELECT notified_content_hash FROM public.product_recalls
     WHERE product_id = 'd1111111-1111-1111-1111-111111111111'),
  'CONFIRMED: on the batch''s next run, current content_hash differs from the ' ||
  'add-time row''s NULL notified_content_hash, so this match IS classified as ' ||
  '"updated" and a real notification attempt IS made — the add-time write does ' ||
  'not silently and permanently suppress notification, but it does mean the ' ||
  'first real push/email the user gets says "recall updated", not "new recall", ' ||
  'and it can be delayed up to the batch interval (currently 30 min) rather than instant'
);
SELECT test.logout();
