-- Regression test for 20260710000000_restore_growth_logs_first_foods_sharing.sql.
--
-- Proves the exact bug that existed before Feature 4's original fix, and
-- that Lovable's migration squash (commit fb174c4) silently reintroduced:
-- growth_logs/first_foods had RLS + a policy but no GRANT to `authenticated`,
-- so every read/write failed regardless of the policy (with this bug, the
-- INSERT statements below would raise "permission denied for table", which
-- \set ON_ERROR_STOP on turns into a hard script failure). Also proves
-- caregiver_access sharing (has_child_access) works on both tables, and
-- that a stranger gets neither rows nor write access (RLS blocks silently
-- rather than raising, so that case is checked via a privileged read).
\set ON_ERROR_STOP on

INSERT INTO auth.users (id) VALUES
  ('a1111111-1111-1111-1111-111111111111'),
  ('b2222222-2222-2222-2222-222222222222'),
  ('c3333333-3333-3333-3333-333333333333');

SELECT test.login('service_role');
INSERT INTO public.children (id, user_id, name) VALUES
  ('ccccc111-cccc-cccc-cccc-cccccccccccc', 'a1111111-1111-1111-1111-111111111111', 'Baby');
INSERT INTO public.caregiver_access (child_id, caregiver_user_id, role) VALUES
  ('ccccc111-cccc-cccc-cccc-cccccccccccc', 'b2222222-2222-2222-2222-222222222222', 'editor');
SELECT test.logout();

-- ── Owner: growth_logs + first_foods ─────────────────────────────────────
-- If the GRANT is missing, these INSERTs raise "permission denied for
-- table ..." and — because of \set ON_ERROR_STOP on — abort the whole
-- script, which is itself the regression signal.
SELECT test.login('authenticated', 'a1111111-1111-1111-1111-111111111111');

INSERT INTO public.growth_logs (child_id, weight_lbs, height_inches, recorded_at)
  VALUES ('ccccc111-cccc-cccc-cccc-cccccccccccc', 20.5, 29.0, now());
SELECT test.assert(
  (SELECT count(*) FROM public.growth_logs WHERE child_id = 'ccccc111-cccc-cccc-cccc-cccccccccccc') = 1,
  'Owner can insert and read back their own growth_logs row'
);

INSERT INTO public.first_foods (child_id, food_name, is_allergen)
  VALUES ('ccccc111-cccc-cccc-cccc-cccccccccccc', 'Banana', false);
SELECT test.assert(
  (SELECT count(*) FROM public.first_foods WHERE child_id = 'ccccc111-cccc-cccc-cccc-cccccccccccc') = 1,
  'Owner can insert and read back their own first_foods row'
);
SELECT test.logout();

-- ── Editor caregiver: can also read and write both tables ───────────────
SELECT test.login('authenticated', 'b2222222-2222-2222-2222-222222222222');
SELECT test.assert(
  (SELECT count(*) FROM public.growth_logs WHERE child_id = 'ccccc111-cccc-cccc-cccc-cccccccccccc') = 1,
  'Editor caregiver can view the owner-logged growth_logs row'
);
INSERT INTO public.growth_logs (child_id, weight_lbs, height_inches, recorded_at)
  VALUES ('ccccc111-cccc-cccc-cccc-cccccccccccc', 21.0, 29.5, now());
INSERT INTO public.first_foods (child_id, food_name, is_allergen)
  VALUES ('ccccc111-cccc-cccc-cccc-cccccccccccc', 'Peanut butter', true);
SELECT test.assert(
  (SELECT count(*) FROM public.growth_logs WHERE child_id = 'ccccc111-cccc-cccc-cccc-cccccccccccc') = 2,
  'Editor caregiver successfully inserted a second growth_logs row for the shared child'
);
SELECT test.assert(
  (SELECT count(*) FROM public.first_foods WHERE child_id = 'ccccc111-cccc-cccc-cccc-cccccccccccc') = 2,
  'Editor caregiver successfully inserted a second first_foods row for the shared child'
);
SELECT test.logout();

-- ── Stranger: no read access, and a write attempt silently affects 0 rows ─
SELECT test.login('authenticated', 'c3333333-3333-3333-3333-333333333333');
SELECT test.assert(
  (SELECT count(*) FROM public.growth_logs WHERE child_id = 'ccccc111-cccc-cccc-cccc-cccccccccccc') = 0,
  'Stranger sees zero growth_logs rows for a child they have no access to'
);
SELECT test.assert(
  (SELECT count(*) FROM public.first_foods WHERE child_id = 'ccccc111-cccc-cccc-cccc-cccccccccccc') = 0,
  'Stranger sees zero first_foods rows for a child they have no access to'
);
-- A stranger's INSERT WITH CHECK (has_child_access(child_id, 'editor')) is
-- rejected by Postgres as a WITH CHECK violation (raises), so this is
-- expected to error — wrapped in assert_raises.
SELECT test.assert_raises(
  $$INSERT INTO public.growth_logs (child_id, weight_lbs, height_inches, recorded_at)
    VALUES ('ccccc111-cccc-cccc-cccc-cccccccccccc', 99, 99, now())$$,
  'Stranger cannot insert a growth_logs row for a child they do not own or share'
);
SELECT test.logout();

-- ── Privileged confirmation: exactly 2 rows in each table, no stray inserts ─
SELECT test.login('service_role');
SELECT test.assert(
  (SELECT count(*) FROM public.growth_logs WHERE child_id = 'ccccc111-cccc-cccc-cccc-cccccccccccc') = 2,
  'Final state: exactly 2 growth_logs rows (owner + editor caregiver), stranger insert did not land'
);
SELECT test.assert(
  (SELECT count(*) FROM public.first_foods WHERE child_id = 'ccccc111-cccc-cccc-cccc-cccccccccccc') = 2,
  'Final state: exactly 2 first_foods rows (owner + editor caregiver)'
);
SELECT test.logout();
