-- Coverage for migration 20260714000000_milestones_icon_reduce_options.sql
-- (narrows milestones.icon from 7 options down to 4: star/smiley/heart/
-- target — bear/feet/waving removed per live user feedback, shipped right
-- after the icon column itself). Verifies the now-removed values are
-- rejected, the 4 kept values still work, and NULL (pre-migration /
-- schema-cache-lag rows) is still allowed.
\set ON_ERROR_STOP on

INSERT INTO auth.users (id) VALUES ('a1111111-1111-1111-1111-111111111111');

SELECT test.login('service_role');
INSERT INTO public.children (id, user_id, name, date_of_birth) VALUES
  ('c1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 'Baby A', '2026-01-01');
SELECT test.logout();

-- ── The three removed options are now rejected ───────────────────────────
SELECT test.login('authenticated', 'a1111111-1111-1111-1111-111111111111');
SELECT test.assert_raises(
  $$INSERT INTO public.milestones (child_id, title, logged_at, icon, completed)
    VALUES ('c1111111-1111-1111-1111-111111111111', 'x', '2026-07-08', 'bear', true)$$,
  '''bear'' is rejected now that the icon set has been narrowed to 4 options'
);
SELECT test.assert_raises(
  $$INSERT INTO public.milestones (child_id, title, logged_at, icon, completed)
    VALUES ('c1111111-1111-1111-1111-111111111111', 'x', '2026-07-08', 'feet', true)$$,
  '''feet'' is rejected now that the icon set has been narrowed to 4 options'
);
SELECT test.assert_raises(
  $$INSERT INTO public.milestones (child_id, title, logged_at, icon, completed)
    VALUES ('c1111111-1111-1111-1111-111111111111', 'x', '2026-07-08', 'waving', true)$$,
  '''waving'' is rejected now that the icon set has been narrowed to 4 options'
);
SELECT test.logout();

-- ── The 4 kept options still work ────────────────────────────────────────
SELECT test.login('authenticated', 'a1111111-1111-1111-1111-111111111111');
INSERT INTO public.milestones (child_id, title, logged_at, icon, completed) VALUES
  ('c1111111-1111-1111-1111-111111111111', 'Star moment', '2026-07-08', 'star', true),
  ('c1111111-1111-1111-1111-111111111111', 'Smiley moment', '2026-07-08', 'smiley', true),
  ('c1111111-1111-1111-1111-111111111111', 'Heart moment', '2026-07-08', 'heart', true),
  ('c1111111-1111-1111-1111-111111111111', 'Target moment', '2026-07-08', 'target', true);
SELECT test.assert(
  (SELECT count(*) FROM public.milestones
     WHERE child_id = 'c1111111-1111-1111-1111-111111111111'
       AND icon IN ('star', 'smiley', 'heart', 'target')) = 4,
  'All 4 kept icon options still insert and read back correctly'
);
SELECT test.logout();

-- ── NULL is still allowed (the schema-cache-lag fallback path) ──────────
SELECT test.login('authenticated', 'a1111111-1111-1111-1111-111111111111');
INSERT INTO public.milestones (child_id, title, logged_at, completed)
  VALUES ('c1111111-1111-1111-1111-111111111111', 'No-icon moment', '2026-07-08', true);
SELECT test.assert(
  (SELECT icon FROM public.milestones WHERE child_id = 'c1111111-1111-1111-1111-111111111111' AND title = 'No-icon moment') IS NULL,
  'A moment saved without an icon (e.g. the schema-cache-lag fallback path) still succeeds with icon NULL'
);
SELECT test.logout();
