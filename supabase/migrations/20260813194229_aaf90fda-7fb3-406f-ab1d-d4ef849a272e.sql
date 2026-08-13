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

DROP POLICY IF EXISTS "Inviter can view own caregiver_invites" ON public.caregiver_invites;
CREATE POLICY "Inviter can view own caregiver_invites"
  ON public.caregiver_invites FOR SELECT TO authenticated
  USING (inviter_user_id = auth.uid());

DROP POLICY IF EXISTS "Inviter can create invites for own children" ON public.caregiver_invites;
CREATE POLICY "Inviter can create invites for own children"
  ON public.caregiver_invites FOR INSERT TO authenticated
  WITH CHECK (
    inviter_user_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM unnest(child_ids) AS cid
      WHERE NOT EXISTS (SELECT 1 FROM public.children c WHERE c.id = cid AND c.user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Inviter can revoke own caregiver_invites" ON public.caregiver_invites;
CREATE POLICY "Inviter can revoke own caregiver_invites"
  ON public.caregiver_invites FOR DELETE TO authenticated
  USING (inviter_user_id = auth.uid());
