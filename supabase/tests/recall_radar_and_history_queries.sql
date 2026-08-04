-- Regression coverage for recall-radar.tsx's extra-sources select and
-- alerts.tsx's Recall History (loadHistory()) select against `recalls`.
-- Added while investigating a user report: Recall Radar showed a "Couldn't
-- load the latest from USDA FSIS, NHTSA, Health Canada & EU Safety Gate"
-- degraded banner, and Alerts > Recall History showed "No recalls in the
-- past 90 days".
--
-- Runs against _final_recalls_schema.sql (the FINAL intended `recalls` /
-- `products` shape, reconstructed directly from every migration that
-- touches those tables — see that file for why it doesn't replay the full
-- historical migration chain). Verifies:
--   1. The exact client-side select recall-radar.tsx runs against `recalls`
--      (including lot_pattern, added by 20260719030000_recall_lot_matching)
--      succeeds for an authenticated user with zero rows present.
--   2. The exact client-side select alerts.tsx's loadHistory() runs
--      (including category) also succeeds.
--   3. An authenticated user really can SELECT from `recalls` per RLS (not
--      just as the superuser running the migration).
--   4. loadHistory()'s "no rows in the last 90 days" empty state is not a
--      query bug: recall_date filtering behaves as expected once rows with
--      qualifying/non-qualifying dates exist.
--
-- A clean pass here confirms the CODE and the INTENDED schema are correct
-- together — it can't see the live database's actual migration state. At
-- the time this was written, the most likely explanation for the reported
-- banner was that 20260719030000_recall_lot_matching.sql (which added
-- recalls.lot_pattern, selected explicitly by recall-radar.tsx) had not
-- yet been applied to the live Supabase project, since this repo has no
-- CI/CD step that pushes migrations automatically.
\set ON_ERROR_STOP on

INSERT INTO auth.users (id) VALUES ('11111111-1111-1111-1111-111111111111');
SELECT test.login('authenticated', '11111111-1111-1111-1111-111111111111');

-- ── 1. recall-radar.tsx's exact select, empty table ─────────────────────
SELECT test.assert(
  (SELECT count(*) FROM (
    SELECT id, source, title, description, hazard, url, recall_date, official, lot_pattern
    FROM public.recalls
    WHERE source IN ('usda_fsis', 'nhtsa', 'health_canada', 'eu_safety_gate')
    ORDER BY recall_date DESC
    LIMIT 50
  ) q) = 0,
  'recall-radar.tsx extra-sources select succeeds (0 rows) as authenticated on the fully-migrated schema'
);

-- ── 2. alerts.tsx loadHistory()'s exact select, empty table ─────────────
SELECT test.assert(
  (SELECT count(*) FROM (
    SELECT id, title, hazard, remedy, url, recall_date, category
    FROM public.recalls
    WHERE recall_date >= (CURRENT_DATE - INTERVAL '90 days')
    ORDER BY recall_date DESC
    LIMIT 100
  ) q) = 0,
  'alerts.tsx recall-history select succeeds (0 rows) as authenticated on the fully-migrated schema'
);

-- ── 3. Both required columns genuinely exist in the final schema ────────
SELECT test.assert(
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'recalls' AND column_name = 'lot_pattern'),
  'recalls.lot_pattern exists in the final schema'
);
SELECT test.assert(
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'recalls' AND column_name = 'category'),
  'recalls.category exists in the final schema'
);

SELECT test.logout();

-- ── 4. Seed rows spanning the 90-day cutoff, re-verify as authenticated ──
INSERT INTO public.recalls (id, source, source_id, title, category, recall_date, official)
VALUES
  ('22222222-2222-2222-2222-222222222222', 'usda_fsis', 'USDA-1', 'Recalled infant formula batch', 'feeding', CURRENT_DATE - 10, true),
  ('33333333-3333-3333-3333-333333333333', 'nhtsa', 'NHTSA-1', 'Recalled convertible car seat', 'car_seat', CURRENT_DATE - 200, true);

SELECT test.login('authenticated', '11111111-1111-1111-1111-111111111111');

SELECT test.assert(
  (SELECT count(*) FROM (
    SELECT id, source, title, description, hazard, url, recall_date, official, lot_pattern
    FROM public.recalls
    WHERE source IN ('usda_fsis', 'nhtsa', 'health_canada', 'eu_safety_gate')
    ORDER BY recall_date DESC
    LIMIT 50
  ) q) = 2,
  'recall-radar.tsx extra-sources select returns both seeded rows regardless of age (no date filter on this query)'
);

SELECT test.assert(
  (SELECT count(*) FROM (
    SELECT id, title, hazard, remedy, url, recall_date, category
    FROM public.recalls
    WHERE recall_date >= (CURRENT_DATE - INTERVAL '90 days')
    ORDER BY recall_date DESC
    LIMIT 100
  ) q) = 1,
  'alerts.tsx recall-history select correctly excludes the 200-day-old row and keeps the 10-day-old row'
);

SELECT test.logout();

-- ── 5. Adversarial: anonymous role must not read recalls at all ─────────
SELECT test.login('anon');
SELECT test.assert_raises(
  $$SELECT * FROM public.recalls$$,
  'anon cannot select from recalls (no policy grants anon access; RLS blocks it even with the table enabled)'
);
SELECT test.logout();
