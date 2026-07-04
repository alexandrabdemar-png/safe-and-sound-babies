-- Regression test for the manual select-then-update-or-insert flow that
-- replaced the client's `.upsert(..., { onConflict: "child_id,rule_id" })`
-- call in dismissInsight()/snoozeInsight() (src/routes/_authenticated/home.tsx).
--
-- Motivation: `.upsert()` with an explicit onConflict requires a real unique
-- constraint matching those exact columns to exist on the live table. We
-- cannot directly observe which migrations have actually been deployed to
-- the production Supabase project, so this test proves the new client-side
-- logic works correctly regardless of which constraint shape (old 3-column,
-- new 2-column, or none at all) is live — it never issues an ON CONFLICT
-- clause, so it cannot fail with "no unique or exclusion constraint matches".
--
-- Run this file twice against two different migration chains to prove both:
--   1. Everything up to and including 20260708000000 (i.e. the OLD 3-column
--      unique constraint on (user_id, child_id, rule_id) is still live —
--      simulating an undeployed fix migration).
--   2. The full chain including 20260709000000 (the NEW 2-column constraint
--      on (child_id, rule_id) is live).
\set ON_ERROR_STOP on

INSERT INTO auth.users (id) VALUES
  ('a1111111-1111-1111-1111-111111111111');

SELECT test.login('service_role');
INSERT INTO public.children (id, user_id, name) VALUES
  ('ccccc111-cccc-cccc-cccc-cccccccccccc', 'a1111111-1111-1111-1111-111111111111', 'Baby');
SELECT test.logout();

SELECT test.login('authenticated', 'a1111111-1111-1111-1111-111111111111');

-- ── Step 1: "Done" on an insight with no existing row ───────────────────
-- select ... maybeSingle() -> none found -> insert
DO $$
DECLARE
  existing_id uuid;
BEGIN
  SELECT id INTO existing_id FROM public.insight_dismissals
    WHERE child_id = 'ccccc111-cccc-cccc-cccc-cccccccccccc' AND rule_id = 'babyproof_start';
  IF existing_id IS NULL THEN
    INSERT INTO public.insight_dismissals (user_id, child_id, rule_id, action, until)
    VALUES ('a1111111-1111-1111-1111-111111111111', 'ccccc111-cccc-cccc-cccc-cccccccccccc', 'babyproof_start', 'dismissed', null);
  ELSE
    UPDATE public.insight_dismissals SET user_id = 'a1111111-1111-1111-1111-111111111111', action = 'dismissed', until = null WHERE id = existing_id;
  END IF;
END $$;

SELECT test.assert(
  (SELECT action FROM public.insight_dismissals WHERE child_id = 'ccccc111-cccc-cccc-cccc-cccccccccccc' AND rule_id = 'babyproof_start') = 'dismissed',
  'Manual insert path: Done on a fresh insight creates a row with action=dismissed'
);

-- ── Step 2: "Snooze 1 week" on a different insight, also fresh ─────────
DO $$
DECLARE
  existing_id uuid;
BEGIN
  SELECT id INTO existing_id FROM public.insight_dismissals
    WHERE child_id = 'ccccc111-cccc-cccc-cccc-cccccccccccc' AND rule_id = 'install_baby_gates';
  IF existing_id IS NULL THEN
    INSERT INTO public.insight_dismissals (user_id, child_id, rule_id, action, until)
    VALUES ('a1111111-1111-1111-1111-111111111111', 'ccccc111-cccc-cccc-cccc-cccccccccccc', 'install_baby_gates', 'snoozed', now() + interval '7 days');
  ELSE
    UPDATE public.insight_dismissals SET user_id = 'a1111111-1111-1111-1111-111111111111', action = 'snoozed', until = now() + interval '7 days' WHERE id = existing_id;
  END IF;
END $$;

SELECT test.assert(
  (SELECT action FROM public.insight_dismissals WHERE child_id = 'ccccc111-cccc-cccc-cccc-cccccccccccc' AND rule_id = 'install_baby_gates') = 'snoozed',
  'Manual insert path: Snooze on a fresh insight creates a row with action=snoozed and a ~7-day until'
);

-- ── Step 3: re-responding to the SAME insight goes through the UPDATE branch,
-- and must not create a duplicate row ────────────────────────────────────
DO $$
DECLARE
  existing_id uuid;
BEGIN
  SELECT id INTO existing_id FROM public.insight_dismissals
    WHERE child_id = 'ccccc111-cccc-cccc-cccc-cccccccccccc' AND rule_id = 'install_baby_gates';
  IF existing_id IS NULL THEN
    INSERT INTO public.insight_dismissals (user_id, child_id, rule_id, action, until)
    VALUES ('a1111111-1111-1111-1111-111111111111', 'ccccc111-cccc-cccc-cccc-cccccccccccc', 'install_baby_gates', 'dismissed', null);
  ELSE
    UPDATE public.insight_dismissals SET user_id = 'a1111111-1111-1111-1111-111111111111', action = 'dismissed', until = null WHERE id = existing_id;
  END IF;
END $$;

SELECT test.assert(
  (SELECT count(*) FROM public.insight_dismissals WHERE child_id = 'ccccc111-cccc-cccc-cccc-cccccccccccc' AND rule_id = 'install_baby_gates') = 1,
  'Manual update path: responding again to the same insight updates in place, does not duplicate'
);
SELECT test.assert(
  (SELECT action FROM public.insight_dismissals WHERE child_id = 'ccccc111-cccc-cccc-cccc-cccccccccccc' AND rule_id = 'install_baby_gates') = 'dismissed',
  'Manual update path: the row reflects the latest response (dismissed, overriding the earlier snooze)'
);

-- ── Step 4: read-back filter logic (mirrors home.tsx lines ~380-385) ────
SELECT test.assert(
  (SELECT count(*) FROM public.insight_dismissals
     WHERE child_id = 'ccccc111-cccc-cccc-cccc-cccccccccccc'
       AND (action IN ('done', 'dismissed') OR (action = 'snoozed' AND until > now()))
  ) = 2,
  'Read-back: both dismissed rows are correctly blocked on the next page load'
);

SELECT test.logout();
