-- Coverage for migration 20260813200000_recall_radar_dismissals.sql (the
-- per-user "mark as done" behind the Recall Radar page's RecallCard).
-- Verifies: a user can record and read back their own dismissal, the
-- (user_id, recall_id) uniqueness constraint rejects a duplicate for a
-- re-submitted click, a user cannot record a dismissal on another user's
-- behalf, and RLS hides one user's dismissals from another (adversarial).
\set ON_ERROR_STOP on

INSERT INTO auth.users (id) VALUES
  ('a1111111-1111-1111-1111-111111111111'),
  ('b2222222-2222-2222-2222-222222222222');

-- ── A user can record their own dismissal and read it back ───────────────
SELECT test.login('authenticated', 'a1111111-1111-1111-1111-111111111111');
INSERT INTO public.recall_radar_dismissals (user_id, recall_id)
  VALUES ('a1111111-1111-1111-1111-111111111111', 'cpsc-12345');
SELECT test.assert(
  (SELECT count(*) FROM public.recall_radar_dismissals
     WHERE user_id = 'a1111111-1111-1111-1111-111111111111' AND recall_id = 'cpsc-12345') = 1,
  'A user can record and read back their own recall dismissal'
);
SELECT test.logout();

-- ── Adversarial: a user cannot record a dismissal on someone else's behalf ──
SELECT test.login('authenticated', 'a1111111-1111-1111-1111-111111111111');
SELECT test.assert_raises(
  $$INSERT INTO public.recall_radar_dismissals (user_id, recall_id)
    VALUES ('b2222222-2222-2222-2222-222222222222', 'cpsc-99999')$$,
  'RLS WITH CHECK blocks a user from inserting a dismissal row for a different user_id'
);
SELECT test.logout();

-- ── The (user_id, recall_id) unique constraint rejects a duplicate ───────
SELECT test.login('authenticated', 'a1111111-1111-1111-1111-111111111111');
SELECT test.assert_raises(
  $$INSERT INTO public.recall_radar_dismissals (user_id, recall_id)
    VALUES ('a1111111-1111-1111-1111-111111111111', 'cpsc-12345')$$,
  'A duplicate (user_id, recall_id) row is rejected — one dismissal per recall, per user'
);
SELECT test.logout();

-- ── Adversarial: RLS hides one user's dismissals from another ────────────
SELECT test.login('authenticated', 'b2222222-2222-2222-2222-222222222222');
INSERT INTO public.recall_radar_dismissals (user_id, recall_id)
  VALUES ('b2222222-2222-2222-2222-222222222222', 'critical-rocknplay');
SELECT test.assert(
  (SELECT count(*) FROM public.recall_radar_dismissals WHERE user_id = 'a1111111-1111-1111-1111-111111111111') = 0,
  'Adversarial: a stranger cannot see another user''s recorded recall dismissals'
);
SELECT test.logout();

-- ── A user can dismiss multiple different recalls independently ──────────
SELECT test.login('authenticated', 'a1111111-1111-1111-1111-111111111111');
INSERT INTO public.recall_radar_dismissals (user_id, recall_id)
  VALUES ('a1111111-1111-1111-1111-111111111111', 'fda-555');
SELECT test.assert(
  (SELECT count(*) FROM public.recall_radar_dismissals WHERE user_id = 'a1111111-1111-1111-1111-111111111111') = 2,
  'A different recall_id for the same user is a new row, not a conflict'
);
SELECT test.logout();
