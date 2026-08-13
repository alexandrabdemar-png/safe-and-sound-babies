-- Adds an explicit 18+ age-eligibility attestation alongside the existing
-- clickwrap terms acceptance in user_agreements (see
-- 20260716000000_legal_consent_wall.sql). Kept as its own boolean, distinct
-- from terms_version, so the audit trail records the age confirmation as a
-- discrete fact rather than folding it silently into "agreed to terms" —
-- see src/routes/legal-consent.tsx for the two separate required checkboxes
-- this backs, and src/lib/legalConsent.ts for the CURRENT_TERMS_VERSION
-- bump that re-prompts every existing user (not just new signups) to
-- record it.
ALTER TABLE public.user_agreements
  ADD COLUMN IF NOT EXISTS is_18_or_older boolean NOT NULL DEFAULT false;
