import { isSchemaMissingTableError } from "@/lib/errors";

// Single source of truth for which Terms of Service version is currently
// in force. Bump this (to today's date) whenever terms.tsx changes in a
// way that needs a fresh explicit acceptance — every user, new or
// returning, gets routed to /legal-consent again until they accept the
// new version. Old acceptances are never overwritten (see
// supabase/migrations/20260716000000_legal_consent_wall.sql), so this is
// also what /legal-consent writes to user_agreements.terms_version.
export const CURRENT_TERMS_VERSION = "2026-07-16";

/**
 * True when the user has NEVER accepted the terms. Once a user has any
 * recorded acceptance in user_agreements, we never prompt them again —
 * the wall is strictly a one-time gate, not a per-version re-consent.
 */
export function needsLegalConsent(acceptedVersions: string[]): boolean {
  return acceptedVersions.length === 0;
}

type AgreementsClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (
        column: string,
        value: string,
      ) => PromiseLike<{ data: { terms_version: string }[] | null; error: { message: string; code?: string | null } | null }>;
    };
  };
};

/**
 * The single source of truth for "does this user need to see the consent
 * wall right now" — shared by _authenticated/route.tsx's beforeLoad and
 * by tests, so the two can never drift the way a duplicated inline query
 * would. Fails OPEN (returns false — don't prompt) when the table itself
 * isn't reachable, since this gate wraps every authenticated route and a
 * missing table shouldn't lock every user out over an infra issue. A
 * genuine "you haven't agreed yet" (query succeeds, zero/stale rows)
 * still returns true as normal.
 */
export async function checkNeedsLegalConsent(
  // Typed as `any` at the boundary rather than the real SupabaseClient type
  // — assigning that fully-generic client type to any simplified structural
  // interface trips TS2589 ("type instantiation excessively deep") because
  // of how large the generated Database type is. Cast to AgreementsClient
  // internally, where a plain test double (see legalConsent.test.ts) still
  // gets full structural checking.
  supabase: unknown,
  userId: string,
): Promise<boolean> {
  const client = supabase as AgreementsClient;
  const { data, error } = await client.from("user_agreements").select("terms_version").eq("user_id", userId);
  if (error) {
    if (!isSchemaMissingTableError(error)) {
      console.error("[legal-consent] couldn't check agreements — letting the user through:", error.message);
    }
    return false;
  }
  const acceptedVersions = (data ?? []).map((row) => row.terms_version);
  return needsLegalConsent(acceptedVersions);
}
