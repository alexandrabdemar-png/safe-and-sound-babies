-- Clickwrap legal consent: every user (new or existing) must explicitly
-- accept the current Terms of Service / Privacy Policy (including the
-- Safety Disclaimer, Assumption of Risk, Limitation of Liability, and
-- Class-Action Waiver sections) before using any authenticated part of
-- the app. Enforced client-side in src/routes/_authenticated/route.tsx's
-- beforeLoad, which redirects to /legal-consent when no row exists here
-- for the current terms version (see src/lib/legalConsent.ts).
--
-- Each accepted version gets its own row (never updated in place) so
-- there's a durable, append-only audit trail of exactly which version a
-- user agreed to and when — the evidentiary record a clickwrap agreement
-- is worthless without.
CREATE TABLE IF NOT EXISTS public.user_agreements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  terms_version text NOT NULL,
  agreed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, terms_version)
);

GRANT SELECT, INSERT ON public.user_agreements TO authenticated;
GRANT ALL ON public.user_agreements TO service_role;

ALTER TABLE public.user_agreements ENABLE ROW LEVEL SECURITY;

-- Read-only + insert-only by design: a user can see and record their own
-- acceptances, but never edit or delete one — an editable consent record
-- isn't evidence of anything.
CREATE POLICY "Users view own agreements" ON public.user_agreements
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users record own agreements" ON public.user_agreements
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_agreements_user ON public.user_agreements(user_id);
