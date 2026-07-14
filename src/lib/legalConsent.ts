// Single source of truth for which Terms of Service version is currently
// in force. Bump this (to today's date) whenever terms.tsx changes in a
// way that needs a fresh explicit acceptance — every user, new or
// returning, gets routed to /legal-consent again until they accept the
// new version. Old acceptances are never overwritten (see
// supabase/migrations/20260716000000_legal_consent_wall.sql), so this is
// also what /legal-consent writes to user_agreements.terms_version.
export const CURRENT_TERMS_VERSION = "2026-07-16";

/**
 * True when the given set of already-accepted terms versions does NOT
 * include the current one — i.e. the user must be sent to /legal-consent
 * before using the authenticated app. Pure so the redirect logic in
 * _authenticated/route.tsx's beforeLoad can be unit-tested without a real
 * Supabase round trip.
 */
export function needsLegalConsent(acceptedVersions: string[]): boolean {
  return !acceptedVersions.includes(CURRENT_TERMS_VERSION);
}
