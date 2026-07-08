-- Caregiver invite flow — the actual mechanism that turns a "Share access"
-- click into a real public.caregiver_access grant (Feature 4, migration
-- 20260708000000, already fully built and RLS-tested). Until now nothing
-- ever created a caregiver_access row: the profile page's "Share access"
-- form called supabase.auth.signInWithOtp() directly, which only sends a
-- generic Supabase sign-in email for the invitee's address — it never wrote
-- a caregiver_access row, and with no emailRedirectTo it relied on the
-- project's default Site URL, which is how a parent could see "sends link
-- but then the link doesn't work".
--
-- Same token pattern as emergency_share_links (migration 20260707000000):
-- a random token is generated client-side, only its SHA-256 hash is ever
-- stored here, and the accept flow (src/lib/caregiverInvite.functions.ts)
-- looks a row up by hashing the token presented — a leaked DB dump reveals
-- no usable invite links. One invite can cover multiple children (the UI
-- shares access to all of the inviter's children in one email) via
-- child_ids, rather than one row per child.

CREATE TABLE IF NOT EXISTS public.caregiver_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  child_ids uuid[] NOT NULL,
  invitee_email text NOT NULL,
  role text NOT NULL CHECK (role IN ('editor', 'viewer')) DEFAULT 'editor',
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (array_length(child_ids, 1) > 0)
);

GRANT SELECT, INSERT, DELETE ON public.caregiver_invites TO authenticated;
GRANT ALL ON public.caregiver_invites TO service_role;
ALTER TABLE public.caregiver_invites ENABLE ROW LEVEL SECURITY;

-- The invitee never reads this table directly (they have no session yet,
-- and even once signed in has no reason to see the token hash or other
-- invites) — the accept flow always goes through supabaseAdmin, mirroring
-- emergency-share.ts. Only the inviter can see/manage their own invites.
CREATE POLICY "Inviter can view own caregiver_invites"
  ON public.caregiver_invites FOR SELECT TO authenticated
  USING (inviter_user_id = auth.uid());

-- WITH CHECK verifies every child_id in the array actually belongs to the
-- inviter — not just inviter_user_id = auth.uid(), which alone wouldn't
-- stop someone inserting a row naming a child they don't own.
CREATE POLICY "Inviter can create invites for own children"
  ON public.caregiver_invites FOR INSERT TO authenticated
  WITH CHECK (
    inviter_user_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM unnest(child_ids) AS cid
      WHERE NOT EXISTS (SELECT 1 FROM public.children c WHERE c.id = cid AND c.user_id = auth.uid())
    )
  );

CREATE POLICY "Inviter can revoke own caregiver_invites"
  ON public.caregiver_invites FOR DELETE TO authenticated
  USING (inviter_user_id = auth.uid());
