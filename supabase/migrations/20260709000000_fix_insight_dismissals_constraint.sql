-- Fixes a real, currently-live bug in the "Up next" insights section
-- (src/routes/_authenticated/home.tsx: dismissInsight/snoozeInsight).
--
-- Two competing migrations created public.insight_dismissals:
--   - 20260608223145_...sql created it with UNIQUE(user_id, child_id, rule_id)
--     and a policy named "Users manage their own insight dismissals".
--   - 20260625000000_insight_dismissals.sql's CREATE TABLE IF NOT EXISTS /
--     CREATE POLICY statements ran against the table that already existed
--     from the first migration, so they were silent no-ops — the 2-column
--     UNIQUE(child_id, rule_id) and "own dismissals" policy it declared
--     never actually took effect.
--
-- Consequences, both confirmed by reproducing against a real Postgres
-- instance (see supabase/tests/insight_dismissals_fix.sql):
--   1. home.tsx's snoozeInsight()/dismissInsight() upsert with
--      `onConflict: "child_id,rule_id"` has never matched the real
--      3-column constraint — every "Snooze 1 week" / "Done" click has
--      thrown "no unique or exclusion constraint matching the ON CONFLICT
--      specification", silently swallowed by an empty catch{} block. User
--      responses were never persisted; the same insight reappears forever.
--   2. 20260708000000_caregiver_access_rls_hardening.sql's
--      `DROP POLICY IF EXISTS "own dismissals"` targeted a policy name
--      that never actually existed on the live table, so the *real* old
--      policy ("Users manage their own insight dismissals" — WITH CHECK
--      auth.uid() = user_id only, no child-ownership check) is still live
--      alongside the newer has_child_access-based policies. Same class of
--      gap fixed on emergency_info: a user could insert a dismissal row
--      for a child they don't own, as long as they stamp their own
--      user_id.

-- Deduplicate before tightening the constraint: an insight could
-- theoretically have accumulated more than one row per (child_id, rule_id)
-- while only the 3-column constraint was enforced (e.g. two different
-- users interacting with the same child's insights). Keep the most recent.
DELETE FROM public.insight_dismissals a
USING public.insight_dismissals b
WHERE a.child_id = b.child_id
  AND a.rule_id = b.rule_id
  AND (a.created_at, a.id) < (b.created_at, b.id);

ALTER TABLE public.insight_dismissals
  DROP CONSTRAINT IF EXISTS insight_dismissals_user_id_child_id_rule_id_key;
ALTER TABLE public.insight_dismissals
  ADD CONSTRAINT insight_dismissals_child_id_rule_id_key UNIQUE (child_id, rule_id);

-- Drop the real old policy (by its actual name) now that it's superseded
-- by the has_child_access-based policies from 20260708000000.
DROP POLICY IF EXISTS "Users manage their own insight dismissals" ON public.insight_dismissals;
