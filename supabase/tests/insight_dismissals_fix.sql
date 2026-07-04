-- Regression test for 20260709000000_fix_insight_dismissals_constraint.sql.
-- Run against the full migration chain (needs the table's original
-- creation migration, the later insight_dismissals migration, the Feature 4
-- caregiver_access migration, AND this fix, in that order).
--
-- Covers:
--   1. The exact upsert home.tsx's snoozeInsight()/dismissInsight() perform
--      (onConflict: "child_id,rule_id") now succeeds instead of throwing.
--   2. Re-responding to the same insight updates in place (no duplicate row).
--   3. The home page's own read-back filter logic (dismissed/done always
--      blocked; snoozed blocked only while `until` is in the future).
--   4. The old, real (correctly-named) permissive policy is gone — a user
--      can no longer insert a dismissal row for a child they don't own by
--      stamping their own user_id.
--   5. A different, unrelated user still can't see these rows at all.
\set ON_ERROR_STOP on

INSERT INTO auth.users (id) VALUES
  ('a1111111-1111-1111-1111-111111111111'),
  ('b2222222-2222-2222-2222-222222222222');

SELECT test.login('service_role');
INSERT INTO public.children (id, user_id, name) VALUES
  ('ccccc111-cccc-cccc-cccc-cccccccccccc', 'a1111111-1111-1111-1111-111111111111', 'Baby');
SELECT test.logout();

SELECT test.login('authenticated', 'a1111111-1111-1111-1111-111111111111');

-- ── 1. "Done" (dismiss) — the exact upsert dismissInsight() performs ────
INSERT INTO public.insight_dismissals (user_id, child_id, rule_id, action, until)
VALUES ('a1111111-1111-1111-1111-111111111111', 'ccccc111-cccc-cccc-cccc-cccccccccccc', 'tummy_time_tip', 'dismissed', null)
ON CONFLICT (child_id, rule_id) DO UPDATE SET action = EXCLUDED.action, until = EXCLUDED.until;

SELECT test.assert(
  (SELECT action FROM public.insight_dismissals WHERE child_id = 'ccccc111-cccc-cccc-cccc-cccccccccccc' AND rule_id = 'tummy_time_tip') = 'dismissed',
  'Done: the app''s upsert (onConflict child_id,rule_id) succeeds against the fixed constraint'
);

-- ── 1b. "Snooze 1 week" — the exact upsert snoozeInsight() performs ─────
INSERT INTO public.insight_dismissals (user_id, child_id, rule_id, action, until)
VALUES ('a1111111-1111-1111-1111-111111111111', 'ccccc111-cccc-cccc-cccc-cccccccccccc', 'car_seat_check', 'snoozed', now() + interval '7 days')
ON CONFLICT (child_id, rule_id) DO UPDATE SET action = EXCLUDED.action, until = EXCLUDED.until;

SELECT test.assert(
  (SELECT action FROM public.insight_dismissals WHERE child_id = 'ccccc111-cccc-cccc-cccc-cccccccccccc' AND rule_id = 'car_seat_check') = 'snoozed',
  'Snooze: the app''s upsert succeeds and stores a ~7-day until'
);
SELECT test.assert(
  (SELECT until FROM public.insight_dismissals WHERE child_id = 'ccccc111-cccc-cccc-cccc-cccccccccccc' AND rule_id = 'car_seat_check') > now() + interval '6 days 23 hours',
  'Snoozed until is approximately 7 days out'
);

-- ── 2. Re-responding to the same insight updates in place ───────────────
INSERT INTO public.insight_dismissals (user_id, child_id, rule_id, action, until)
VALUES ('a1111111-1111-1111-1111-111111111111', 'ccccc111-cccc-cccc-cccc-cccccccccccc', 'car_seat_check', 'dismissed', null)
ON CONFLICT (child_id, rule_id) DO UPDATE SET action = EXCLUDED.action, until = EXCLUDED.until;

SELECT test.assert(
  (SELECT count(*) FROM public.insight_dismissals WHERE child_id = 'ccccc111-cccc-cccc-cccc-cccccccccccc' AND rule_id = 'car_seat_check') = 1,
  'responding again to the same insight updates in place, does not duplicate'
);
SELECT test.assert(
  (SELECT action FROM public.insight_dismissals WHERE child_id = 'ccccc111-cccc-cccc-cccc-cccccccccccc' AND rule_id = 'car_seat_check') = 'dismissed',
  'a later "Done" correctly overwrites an earlier "Snooze"'
);

-- ── 3. Read-back filter (mirrors home.tsx lines ~380-385) ────────────────
SELECT test.assert(
  (SELECT count(*) FROM public.insight_dismissals
     WHERE child_id = 'ccccc111-cccc-cccc-cccc-cccccccccccc'
       AND (action IN ('dismissed','done') OR (action = 'snoozed' AND until > now()))
  ) = 2,
  'both responses are correctly counted as currently-blocked by the read-back filter'
);

SELECT test.logout();

-- ── 4. The old permissive policy is gone: cannot insert for an unowned child ─
SELECT test.login('authenticated', 'b2222222-2222-2222-2222-222222222222');
SELECT test.assert_raises(
  $$INSERT INTO public.insight_dismissals (user_id, child_id, rule_id, action)
    VALUES ('b2222222-2222-2222-2222-222222222222', 'ccccc111-cccc-cccc-cccc-cccccccccccc', 'fake_rule', 'dismissed')$$,
  'a user cannot insert a dismissal for a child they don''t own, even stamping their own user_id (old permissive policy is gone)'
);

-- ── 5. A different user cannot see these rows at all ────────────────────
SELECT test.assert(
  (SELECT count(*) FROM public.insight_dismissals WHERE child_id = 'ccccc111-cccc-cccc-cccc-cccccccccccc') = 0,
  'a different, unrelated user cannot see this child''s dismissal responses'
);
SELECT test.logout();

-- ── Sanity: the old 3-column constraint is really gone ──────────────────
SELECT test.assert(
  NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'insight_dismissals_user_id_child_id_rule_id_key'
  ),
  'the old 3-column UNIQUE(user_id, child_id, rule_id) constraint no longer exists'
);
SELECT test.assert(
  EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'insight_dismissals_child_id_rule_id_key'
  ),
  'the correct 2-column UNIQUE(child_id, rule_id) constraint exists, matching the app''s onConflict target'
);
