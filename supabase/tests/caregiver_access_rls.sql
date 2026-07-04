-- Adversarial RLS tests for Feature 4
-- (20260708000000_caregiver_access_rls_hardening.sql): the caregiver_access
-- sharing model and its use across children/products/milestones/etc.
--
-- Run against the full migration chain (needs growth_logs, first_foods,
-- bottles, product_recalls, emergency_info, etc. to all exist) — see the
-- -m list this is invoked with.
--
-- IMPORTANT: an UPDATE/DELETE blocked by RLS's USING clause does not raise
-- an error — it just matches zero rows. test.assert_raises is only used
-- below for cases that genuinely raise (INSERT policy violations). Every
-- blocked UPDATE/DELETE is instead run directly, then verified via a
-- separate service_role (or otherwise-privileged) read that the target
-- row is unchanged / still present — the same pattern used in
-- emergency_info_rls.sql.
--
-- Cast of characters:
--   Alice (user A)   — owns the child, is never a caregiver_access grantee
--   Viewer (user V)  — granted 'viewer' access to Alice's child
--   Editor (user E)  — granted 'editor' access to Alice's child
--   Stranger (user S)— no relationship to Alice's child at all
\set ON_ERROR_STOP on

INSERT INTO auth.users (id) VALUES
  ('a1111111-1111-1111-1111-111111111111'),
  ('11111111-1111-1111-1111-111111111111'),
  ('e2222222-2222-2222-2222-222222222222'),
  ('55555555-5555-5555-5555-555555555555');

SELECT test.login('service_role');
INSERT INTO public.children (id, user_id, name) VALUES
  ('ccccc111-cccc-cccc-cccc-cccccccccccc', 'a1111111-1111-1111-1111-111111111111', 'Alice''s Baby');
SELECT test.logout();

-- ── Before any grant exists: nobody but the owner can see the child ─────
SELECT test.login('authenticated', '11111111-1111-1111-1111-111111111111');
SELECT test.assert(
  (SELECT count(*) FROM public.children WHERE id = 'ccccc111-cccc-cccc-cccc-cccccccccccc') = 0,
  'a stranger sees nothing for a child with no grant at all'
);
SELECT test.logout();

-- ── Only the owner can create a grant ────────────────────────────────────
SELECT test.login('authenticated', '11111111-1111-1111-1111-111111111111');
SELECT test.assert_raises(
  $$INSERT INTO public.caregiver_access (child_id, caregiver_user_id, role)
    VALUES ('ccccc111-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'editor')$$,
  'a stranger cannot grant themselves access to a child they don''t own'
);
SELECT test.logout();

SELECT test.login('authenticated', 'a1111111-1111-1111-1111-111111111111');
INSERT INTO public.caregiver_access (id, child_id, caregiver_user_id, role) VALUES
  ('9a000001-0000-0000-0000-000000000001', 'ccccc111-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'viewer'),
  ('9a000002-0000-0000-0000-000000000002', 'ccccc111-cccc-cccc-cccc-cccccccccccc', 'e2222222-2222-2222-2222-222222222222', 'editor');
SELECT test.assert(
  (SELECT count(*) FROM public.caregiver_access WHERE child_id = 'ccccc111-cccc-cccc-cccc-cccccccccccc') = 2,
  'the owner can grant viewer and editor access'
);
SELECT test.logout();

-- ── A viewer can read the child and its data, but cannot write any of it ─
SELECT test.login('authenticated', '11111111-1111-1111-1111-111111111111');
SELECT test.assert(
  (SELECT name FROM public.children WHERE id = 'ccccc111-cccc-cccc-cccc-cccccccccccc') = 'Alice''s Baby',
  'a viewer caregiver can read the child record'
);
UPDATE public.children SET name = 'Hacked' WHERE id = 'ccccc111-cccc-cccc-cccc-cccccccccccc';
SELECT test.assert_raises(
  $$INSERT INTO public.milestones (child_id, title) VALUES ('ccccc111-cccc-cccc-cccc-cccccccccccc', 'Fake milestone')$$,
  'a viewer caregiver cannot insert a milestone'
);
SELECT test.logout();

SELECT test.login('service_role');
SELECT test.assert(
  (SELECT name FROM public.children WHERE id = 'ccccc111-cccc-cccc-cccc-cccccccccccc') = 'Alice''s Baby',
  'a viewer caregiver''s attempt to rename the child record did not go through (owner-only by design)'
);
SELECT test.logout();

-- Seed a milestone as the owner so the viewer has something to read.
SELECT test.login('authenticated', 'a1111111-1111-1111-1111-111111111111');
INSERT INTO public.milestones (id, child_id, title) VALUES
  ('9a000003-0000-0000-0000-000000000003', 'ccccc111-cccc-cccc-cccc-cccccccccccc', 'First smile');
SELECT test.logout();

SELECT test.login('authenticated', '11111111-1111-1111-1111-111111111111');
SELECT test.assert(
  (SELECT count(*) FROM public.milestones WHERE child_id = 'ccccc111-cccc-cccc-cccc-cccccccccccc') = 1,
  'a viewer caregiver can read a milestone the owner logged'
);
UPDATE public.milestones SET title = 'Hacked' WHERE id = '9a000003-0000-0000-0000-000000000003';
DELETE FROM public.milestones WHERE id = '9a000003-0000-0000-0000-000000000003';
SELECT test.logout();

SELECT test.login('service_role');
SELECT test.assert(
  (SELECT title FROM public.milestones WHERE id = '9a000003-0000-0000-0000-000000000003') = 'First smile',
  'a viewer caregiver''s update/delete attempts on a milestone did not go through'
);
SELECT test.logout();

-- ── An editor can read AND write the child's data ────────────────────────
SELECT test.login('authenticated', 'e2222222-2222-2222-2222-222222222222');
INSERT INTO public.milestones (id, child_id, title) VALUES
  ('9a000004-0000-0000-0000-000000000004', 'ccccc111-cccc-cccc-cccc-cccccccccccc', 'Editor-logged milestone');
SELECT test.assert(
  (SELECT count(*) FROM public.milestones WHERE child_id = 'ccccc111-cccc-cccc-cccc-cccccccccccc') = 2,
  'an editor caregiver can insert a milestone'
);
UPDATE public.milestones SET completed = true WHERE id = '9a000003-0000-0000-0000-000000000003';
SELECT test.assert(
  (SELECT completed FROM public.milestones WHERE id = '9a000003-0000-0000-0000-000000000003') = true,
  'an editor caregiver can update a milestone the owner logged'
);
-- But an editor still cannot touch the child record itself.
UPDATE public.children SET name = 'Hacked By Editor' WHERE id = 'ccccc111-cccc-cccc-cccc-cccccccccccc';
-- ...nor create a new share link for it (deliberately owner-only, per the
-- migration's documented scope).
SELECT test.assert_raises(
  $$INSERT INTO public.emergency_share_links (user_id, child_id, token_hash, expires_at)
    VALUES ('e2222222-2222-2222-2222-222222222222', 'ccccc111-cccc-cccc-cccc-cccccccccccc', 'abc123', now() + interval '1 day')$$,
  'even an editor caregiver cannot create an emergency-info share link (owner-only by design)'
);
SELECT test.logout();

SELECT test.login('service_role');
SELECT test.assert(
  (SELECT name FROM public.children WHERE id = 'ccccc111-cccc-cccc-cccc-cccccccccccc') = 'Alice''s Baby',
  'even an editor caregiver''s attempt to rename the child record did not go through (owner-only by design)'
);
SELECT test.logout();

-- ── A total stranger still sees and can do nothing, even after grants exist ─
SELECT test.login('authenticated', '55555555-5555-5555-5555-555555555555');
SELECT test.assert(
  (SELECT count(*) FROM public.children WHERE id = 'ccccc111-cccc-cccc-cccc-cccccccccccc') = 0,
  'a stranger still sees nothing for the child (existence of other grants does not leak access)'
);
SELECT test.assert(
  (SELECT count(*) FROM public.milestones WHERE child_id = 'ccccc111-cccc-cccc-cccc-cccccccccccc') = 0,
  'a stranger sees none of the child''s milestones either'
);
SELECT test.assert_raises(
  $$INSERT INTO public.milestones (child_id, title) VALUES ('ccccc111-cccc-cccc-cccc-cccccccccccc', 'Injected')$$,
  'a stranger cannot insert a milestone for a child they have no relationship to'
);
SELECT test.logout();

-- ── A viewer cannot escalate their own role to editor ────────────────────
SELECT test.login('authenticated', '11111111-1111-1111-1111-111111111111');
UPDATE public.caregiver_access SET role = 'editor' WHERE id = '9a000001-0000-0000-0000-000000000001';
SELECT test.logout();

SELECT test.login('service_role');
SELECT test.assert(
  (SELECT role FROM public.caregiver_access WHERE id = '9a000001-0000-0000-0000-000000000001') = 'viewer',
  'a viewer caregiver''s attempt to escalate their own grant to editor did not go through'
);
SELECT test.logout();

-- A caregiver also cannot grant a THIRD party access on the owner's behalf.
SELECT test.login('authenticated', 'e2222222-2222-2222-2222-222222222222');
SELECT test.assert_raises(
  $$INSERT INTO public.caregiver_access (child_id, caregiver_user_id, role)
    VALUES ('ccccc111-cccc-cccc-cccc-cccccccccccc', '55555555-5555-5555-5555-555555555555', 'viewer')$$,
  'an editor caregiver cannot grant a third party access — only the owner can'
);
SELECT test.logout();

-- A caregiver CAN remove themselves (leave), but cannot revoke someone else's grant.
SELECT test.login('authenticated', '11111111-1111-1111-1111-111111111111');
DELETE FROM public.caregiver_access WHERE id = '9a000002-0000-0000-0000-000000000002';
DELETE FROM public.caregiver_access WHERE id = '9a000001-0000-0000-0000-000000000001';
SELECT test.assert(
  (SELECT count(*) FROM public.caregiver_access WHERE id = '9a000001-0000-0000-0000-000000000001') = 0,
  'a caregiver can remove their own grant (leave)'
);
SELECT test.logout();

SELECT test.login('service_role');
SELECT test.assert(
  (SELECT count(*) FROM public.caregiver_access WHERE id = '9a000002-0000-0000-0000-000000000002') = 1,
  'a viewer caregiver''s attempt to revoke a different caregiver''s (the editor''s) grant did not go through'
);
SELECT test.logout();

-- ── Revocation actually takes effect immediately ─────────────────────────
SELECT test.login('authenticated', '11111111-1111-1111-1111-111111111111');
SELECT test.assert(
  (SELECT count(*) FROM public.children WHERE id = 'ccccc111-cccc-cccc-cccc-cccccccccccc') = 0,
  'after leaving, the former viewer can no longer see the child at all'
);
SELECT test.logout();

-- ── growth_logs / first_foods: the missing-GRANT bug is fixed, and the
--    sharing model applies to them too ──────────────────────────────────
SELECT test.login('authenticated', 'a1111111-1111-1111-1111-111111111111');
INSERT INTO public.growth_logs (id, child_id, weight_lbs) VALUES
  ('9a000005-0000-0000-0000-000000000005', 'ccccc111-cccc-cccc-cccc-cccccccccccc', 12.5);
INSERT INTO public.first_foods (id, child_id, food_name) VALUES
  ('9a000006-0000-0000-0000-000000000006', 'ccccc111-cccc-cccc-cccc-cccccccccccc', 'Avocado');
SELECT test.assert(
  (SELECT count(*) FROM public.growth_logs WHERE child_id = 'ccccc111-cccc-cccc-cccc-cccccccccccc') = 1,
  'the owner can now write to growth_logs (previously impossible — no GRANT existed at all)'
);
SELECT test.assert(
  (SELECT count(*) FROM public.first_foods WHERE child_id = 'ccccc111-cccc-cccc-cccc-cccccccccccc') = 1,
  'the owner can now write to first_foods (previously impossible — no GRANT existed at all)'
);
SELECT test.logout();

SELECT test.login('authenticated', 'e2222222-2222-2222-2222-222222222222');
SELECT test.assert(
  (SELECT count(*) FROM public.growth_logs WHERE child_id = 'ccccc111-cccc-cccc-cccc-cccccccccccc') = 1,
  'an editor caregiver can read growth_logs for the shared child'
);
INSERT INTO public.growth_logs (child_id, weight_lbs) VALUES ('ccccc111-cccc-cccc-cccc-cccccccccccc', 13.0);
SELECT test.assert(
  (SELECT count(*) FROM public.growth_logs WHERE child_id = 'ccccc111-cccc-cccc-cccc-cccccccccccc') = 2,
  'an editor caregiver can add a growth_logs entry'
);
SELECT test.logout();

SELECT test.login('authenticated', '55555555-5555-5555-5555-555555555555');
SELECT test.assert(
  (SELECT count(*) FROM public.growth_logs WHERE child_id = 'ccccc111-cccc-cccc-cccc-cccccccccccc') = 0,
  'a stranger cannot read growth_logs for a child they have no relationship to'
);
SELECT test.logout();

-- ── product_recalls: reached via has_product_access(product_id) ────────
SELECT test.login('service_role');
INSERT INTO public.products (id, user_id, child_id, name, brand) VALUES
  ('9a000007-0000-0000-0000-000000000007', 'a1111111-1111-1111-1111-111111111111', 'ccccc111-cccc-cccc-cccc-cccccccccccc', 'Shared Car Seat', 'Nuna');
INSERT INTO public.recalls (id, source, source_id, title) VALUES
  ('9a000008-0000-0000-0000-000000000008', 'cpsc', 'RECALL-CG-1', 'Test recall for caregiver access');
INSERT INTO public.product_recalls (user_id, product_id, recall_id) VALUES
  ('a1111111-1111-1111-1111-111111111111', '9a000007-0000-0000-0000-000000000007', '9a000008-0000-0000-0000-000000000008');
SELECT test.logout();

SELECT test.login('authenticated', 'e2222222-2222-2222-2222-222222222222');
SELECT test.assert(
  (SELECT count(*) FROM public.product_recalls WHERE product_id = '9a000007-0000-0000-0000-000000000007') = 1,
  'an editor caregiver can see a recall on the shared child''s product'
);
UPDATE public.product_recalls SET acknowledged = true WHERE product_id = '9a000007-0000-0000-0000-000000000007';
SELECT test.assert(
  (SELECT acknowledged FROM public.product_recalls WHERE product_id = '9a000007-0000-0000-0000-000000000007') = true,
  'an editor caregiver can acknowledge a recall on the shared child''s product'
);
SELECT test.logout();

SELECT test.login('authenticated', '55555555-5555-5555-5555-555555555555');
SELECT test.assert(
  (SELECT count(*) FROM public.product_recalls WHERE product_id = '9a000007-0000-0000-0000-000000000007') = 0,
  'a stranger cannot see the recall at all'
);
SELECT test.logout();

-- ── emergency_info: caregivers extended, unrelated user still blocked ───
-- The viewer (user V) removed their own grant earlier ("leave" test above)
-- — re-grant it here so this section is testing "a current viewer can
-- read emergency_info", not accidentally re-testing revocation.
SELECT test.login('authenticated', 'a1111111-1111-1111-1111-111111111111');
INSERT INTO public.caregiver_access (child_id, caregiver_user_id, role) VALUES
  ('ccccc111-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'viewer');
INSERT INTO public.emergency_info (user_id, child_id, allergies) VALUES
  ('a1111111-1111-1111-1111-111111111111', 'ccccc111-cccc-cccc-cccc-cccccccccccc', 'Peanuts');
SELECT test.logout();

SELECT test.login('authenticated', '11111111-1111-1111-1111-111111111111');
SELECT test.assert(
  (SELECT allergies FROM public.emergency_info WHERE child_id = 'ccccc111-cccc-cccc-cccc-cccccccccccc') = 'Peanuts',
  'a viewer caregiver can read emergency_info for the shared child'
);
UPDATE public.emergency_info SET allergies = 'Hacked' WHERE child_id = 'ccccc111-cccc-cccc-cccc-cccccccccccc';
SELECT test.logout();

SELECT test.login('service_role');
SELECT test.assert(
  (SELECT allergies FROM public.emergency_info WHERE child_id = 'ccccc111-cccc-cccc-cccc-cccccccccccc') = 'Peanuts',
  'a viewer caregiver''s attempt to update emergency_info did not go through'
);
SELECT test.logout();

SELECT test.login('authenticated', 'e2222222-2222-2222-2222-222222222222');
UPDATE public.emergency_info SET blood_type = 'O+' WHERE child_id = 'ccccc111-cccc-cccc-cccc-cccccccccccc';
SELECT test.assert(
  (SELECT blood_type FROM public.emergency_info WHERE child_id = 'ccccc111-cccc-cccc-cccc-cccccccccccc') = 'O+',
  'an editor caregiver can update emergency_info for the shared child'
);
SELECT test.logout();

SELECT test.login('authenticated', '55555555-5555-5555-5555-555555555555');
SELECT test.assert(
  (SELECT count(*) FROM public.emergency_info WHERE child_id = 'ccccc111-cccc-cccc-cccc-cccccccccccc') = 0,
  'a stranger cannot read emergency_info for a child they have no relationship to'
);
SELECT test.logout();
