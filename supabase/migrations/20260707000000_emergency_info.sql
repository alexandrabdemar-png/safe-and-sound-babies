-- Feature 3: emergency info card + shareable link.
--
-- emergency_info: one row per child with the medical/contact details a
-- babysitter or grandparent needs in a stressful moment. RLS restricts it
-- to the owning user only — same as every other per-child table in this
-- app. There is deliberately NO policy granting anon/public access here:
-- the "shareable link" feature does NOT work by relaxing RLS. Instead,
-- emergency_share_links stores a SHA-256 hash of a server-issued random
-- token (never the raw token) with an expiry, and the public read path
-- (src/routes/api/public/emergency-share.ts) uses the service-role client
-- to look up a row by hashing the token clients present — a stolen DB
-- dump reveals no usable tokens, and a link stops working once expired or
-- revoked regardless of who has the URL.

CREATE TABLE IF NOT EXISTS public.emergency_info (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  child_id uuid NOT NULL UNIQUE REFERENCES public.children(id) ON DELETE CASCADE,
  allergies text,
  medications text,
  blood_type text,
  pediatrician_name text,
  pediatrician_phone text,
  emergency_contact_name text,
  emergency_contact_phone text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.emergency_info TO authenticated;
GRANT ALL ON public.emergency_info TO service_role;
ALTER TABLE public.emergency_info ENABLE ROW LEVEL SECURITY;
-- WITH CHECK verifies child ownership, not just user_id = auth.uid() — a
-- check of user_id alone would let a user attach (and, via the UNIQUE
-- constraint on child_id, permanently squat on) an emergency_info row for
-- a child they don't own, as long as they claimed it under their own
-- user_id. Same pattern as emergency_share_links below.
CREATE POLICY "Users manage own emergency_info" ON public.emergency_info
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.children c WHERE c.id = child_id AND c.user_id = auth.uid())
  );
CREATE TRIGGER trg_emergency_info_updated_at
  BEFORE UPDATE ON public.emergency_info
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.emergency_share_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  child_id uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.emergency_share_links TO authenticated;
GRANT ALL ON public.emergency_share_links TO service_role;
ALTER TABLE public.emergency_share_links ENABLE ROW LEVEL SECURITY;

-- A user may only create a share link for a child they actually own — this
-- is enforced in the WITH CHECK itself (not just user_id = auth.uid(),
-- which alone wouldn't stop someone inserting a row with someone else's
-- child_id while claiming ownership via their own user_id).
CREATE POLICY "Users manage own emergency_share_links" ON public.emergency_share_links
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.children c WHERE c.id = child_id AND c.user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_emergency_share_links_child ON public.emergency_share_links(child_id, created_at DESC);
