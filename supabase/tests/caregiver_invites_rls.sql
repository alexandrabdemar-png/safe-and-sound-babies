-- Adversarial RLS tests for public.caregiver_invites (migration
-- 20260711000000_caregiver_invites.sql) — the table backing the "Share
-- access with a co-parent or caregiver" invite flow.
--
-- IMPORTANT: an INSERT blocked by RLS's WITH CHECK genuinely raises (used
-- via test.assert_raises below). A SELECT/DELETE blocked by USING just
-- matches zero rows / silently no-ops — verified via a privileged
-- service_role read afterward, same pattern as caregiver_access_rls.sql.
--
-- Cast of characters:
--   Alice (user A)    — owns two children, sends an invite
--   Stranger (user S) — no relationship to Alice's children at all
--   Mallory (user M)  — owns one child of her own, used to prove she can't
--                       piggyback her own child onto an invite for Alice's
--                       children by naming it alongside Alice's real ones
\set ON_ERROR_STOP on

INSERT INTO auth.users (id) VALUES
  ('a1111111-1111-1111-1111-111111111111'),
  ('55555555-5555-5555-5555-555555555555'),
  ('aa311111-1111-1111-1111-111111111111');

SELECT test.login('service_role');
INSERT INTO public.children (id, user_id, name) VALUES
  ('c1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 'Alice Kid 1'),
  ('c2222222-2222-2222-2222-222222222222', 'a1111111-1111-1111-1111-111111111111', 'Alice Kid 2'),
  ('ca911111-1111-1111-1111-111111111111', 'aa311111-1111-1111-1111-111111111111', 'Mallory Kid');
SELECT test.logout();

-- ── 1. Owner can create an invite naming only their own children ────────
SELECT test.login('authenticated', 'a1111111-1111-1111-1111-111111111111');
INSERT INTO public.caregiver_invites (inviter_user_id, child_ids, invitee_email, role, token_hash, expires_at)
  VALUES (
    'a1111111-1111-1111-1111-111111111111',
    ARRAY['c1111111-1111-1111-1111-111111111111', 'c2222222-2222-2222-2222-222222222222']::uuid[],
    'coparent@example.com', 'editor', 'hash-of-good-token-1', now() + interval '7 days'
  );
SELECT test.assert(
  (SELECT count(*) FROM public.caregiver_invites WHERE token_hash = 'hash-of-good-token-1') = 1,
  'Owner: can create an invite for children they own'
);
SELECT test.logout();

-- ── 2. Adversarial: a stranger cannot create an invite naming a child they don't own ──
SELECT test.login('authenticated', '55555555-5555-5555-5555-555555555555');
SELECT test.assert_raises(
  $$INSERT INTO public.caregiver_invites (inviter_user_id, child_ids, invitee_email, role, token_hash, expires_at)
    VALUES ('55555555-5555-5555-5555-555555555555',
            ARRAY['c1111111-1111-1111-1111-111111111111']::uuid[],
            'attacker-target@example.com', 'editor', 'hash-of-bad-token-1', now() + interval '7 days')$$,
  'Stranger cannot create an invite naming a child they do not own'
);
SELECT test.logout();

-- ── 3. Adversarial: a stranger cannot fake inviter_user_id to be someone else ──
SELECT test.login('authenticated', '55555555-5555-5555-5555-555555555555');
SELECT test.assert_raises(
  $$INSERT INTO public.caregiver_invites (inviter_user_id, child_ids, invitee_email, role, token_hash, expires_at)
    VALUES ('a1111111-1111-1111-1111-111111111111',
            ARRAY['c1111111-1111-1111-1111-111111111111']::uuid[],
            'attacker-target@example.com', 'editor', 'hash-of-bad-token-2', now() + interval '7 days')$$,
  'Stranger cannot impersonate another user as inviter_user_id, even naming that user''s own child'
);
SELECT test.logout();

-- ── 4. Adversarial: owner can't smuggle someone else's child into a multi-child invite ──
-- Mallory tries to invite for her own real child PLUS Alice's child in the
-- same array — the whole insert must be rejected, not just the bad element.
SELECT test.login('authenticated', 'aa311111-1111-1111-1111-111111111111');
SELECT test.assert_raises(
  $$INSERT INTO public.caregiver_invites (inviter_user_id, child_ids, invitee_email, role, token_hash, expires_at)
    VALUES ('aa311111-1111-1111-1111-111111111111',
            ARRAY['ca911111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111']::uuid[],
            'attacker-target@example.com', 'editor', 'hash-of-bad-token-3', now() + interval '7 days')$$,
  'Owner cannot smuggle a child they do not own into a multi-child invite by mixing it with one they do own'
);
SELECT test.logout();

-- ── 5. Only the inviter can SELECT their own invite — not the invitee, not a stranger ──
SELECT test.login('authenticated', '55555555-5555-5555-5555-555555555555');
SELECT test.assert(
  (SELECT count(*) FROM public.caregiver_invites WHERE token_hash = 'hash-of-good-token-1') = 0,
  'Stranger cannot SELECT another user''s caregiver_invites row (the accept flow must use supabaseAdmin, not RLS)'
);
SELECT test.logout();

SELECT test.login('authenticated', 'a1111111-1111-1111-1111-111111111111');
SELECT test.assert(
  (SELECT count(*) FROM public.caregiver_invites WHERE token_hash = 'hash-of-good-token-1') = 1,
  'Owner (inviter) can SELECT their own invite'
);
SELECT test.logout();

-- ── 6. Adversarial: a stranger cannot revoke (DELETE) another user's invite ──
SELECT test.login('authenticated', '55555555-5555-5555-5555-555555555555');
DELETE FROM public.caregiver_invites WHERE token_hash = 'hash-of-good-token-1';
SELECT test.logout();

SELECT test.login('service_role');
SELECT test.assert(
  (SELECT count(*) FROM public.caregiver_invites WHERE token_hash = 'hash-of-good-token-1') = 1,
  'Stranger DELETE of another user''s invite silently affected 0 rows — the invite still exists'
);
SELECT test.logout();

-- ── 7. Owner can revoke (DELETE) their own invite ────────────────────────
SELECT test.login('authenticated', 'a1111111-1111-1111-1111-111111111111');
DELETE FROM public.caregiver_invites WHERE token_hash = 'hash-of-good-token-1';
SELECT test.logout();

SELECT test.login('service_role');
SELECT test.assert(
  (SELECT count(*) FROM public.caregiver_invites WHERE token_hash = 'hash-of-good-token-1') = 0,
  'Owner: revoking their own invite actually deletes it'
);
SELECT test.logout();

-- ── 8. End-to-end: accepting an invite (service-role, mirroring
--      acceptCaregiverInvite) actually produces a working caregiver_access
--      grant the new caregiver can use, per Feature 4's existing policies ──
INSERT INTO auth.users (id) VALUES ('9a111111-1111-1111-1111-111111111111');
SELECT test.login('service_role');
INSERT INTO public.caregiver_invites (inviter_user_id, child_ids, invitee_email, role, token_hash, expires_at)
  VALUES (
    'a1111111-1111-1111-1111-111111111111',
    ARRAY['c1111111-1111-1111-1111-111111111111']::uuid[],
    'newcaregiver@example.com', 'editor', 'hash-of-accept-token', now() + interval '7 days'
  );
-- Mirrors acceptCaregiverInvite's grant-then-mark-accepted sequence.
INSERT INTO public.caregiver_access (child_id, caregiver_user_id, role)
  VALUES ('c1111111-1111-1111-1111-111111111111', '9a111111-1111-1111-1111-111111111111', 'editor');
UPDATE public.caregiver_invites SET accepted_at = now() WHERE token_hash = 'hash-of-accept-token';
SELECT test.logout();

SELECT test.login('authenticated', '9a111111-1111-1111-1111-111111111111');
SELECT test.assert(
  (SELECT count(*) FROM public.children WHERE id = 'c1111111-1111-1111-1111-111111111111') = 1,
  'New caregiver: can now see the child after accept — the grant genuinely took effect'
);
SELECT test.logout();

-- ── 9. Adversarial: a stranger still cannot see the accepted invite's row, or the child ──
SELECT test.login('authenticated', '55555555-5555-5555-5555-555555555555');
SELECT test.assert(
  (SELECT count(*) FROM public.caregiver_invites WHERE token_hash = 'hash-of-accept-token') = 0,
  'Stranger still cannot SELECT the (now-accepted) invite row'
);
SELECT test.assert(
  (SELECT count(*) FROM public.children WHERE id = 'c1111111-1111-1111-1111-111111111111') = 0,
  'Stranger still has no access to the child even after someone else accepted an invite for it'
);
SELECT test.logout();
