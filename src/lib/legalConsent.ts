import { logError } from "@/lib/sanitize-error";
import { isSchemaMissingTableError } from "@/lib/errors";

// Single source of truth for which Terms of Service version is currently
// in force. Bump this (to today's date) whenever terms.tsx changes in a
// way that needs a fresh explicit acceptance — every user, new or
// returning, gets routed to /legal-consent again until they accept the
// new version. Old acceptances are never overwritten (see
// supabase/migrations/20260716000000_legal_consent_wall.sql), so this is
// also what /legal-consent writes to user_agreements.terms_version.
//
// Bumped 2026-08-13 to add the 18+ eligibility clause and the
// is_18_or_older checkbox (supabase/migrations/20260813000000_...sql) —
// this re-prompts every existing user, not just new signups, so the age
// attestation actually covers the whole user base rather than only
// accounts created after this change shipped.
export const CURRENT_TERMS_VERSION = "2026-08-13";

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
      logError("[legal-consent] couldn't check agreements — letting the user through:", error.message);
    }
    return false;
  }
  const acceptedVersions = (data ?? []).map((row) => row.terms_version);
  return needsLegalConsent(acceptedVersions);
}

// Once a user is confirmed clear for this session, _authenticated's
// beforeLoad shouldn't re-query user_agreements on every single in-app
// navigation — TanStack Router re-runs beforeLoad for every ancestor route
// on every navigation (not just on first entry), and there's no loading
// indicator anywhere in this app for that phase. On a slow or flaky
// connection, that made every tap between authenticated pages look like it
// "did nothing" for however long this one query took, since the whole
// navigation was blocked on it with zero visible feedback. Consent status
// can't become "needed again" mid-session (CURRENT_TERMS_VERSION is fixed
// for the life of a running app instance), so caching a positive result
// for the session is always safe — it can only ever go stale in the
// direction of over-trusting a session that later logs into a different,
// not-yet-consented account, which is why this is keyed by userId rather
// than a single flag.
const clearedForSession = new Set<string>();

/** Called right after /legal-consent records a fresh acceptance, so the very
 * next navigation doesn't have to round-trip the database again to learn
 * what this request already just wrote. */
export function markLegalConsentCleared(userId: string): void {
  clearedForSession.add(userId);
}

/** Test-only escape hatch — production code has no reason to ever forget a
 * cleared user mid-session. */
export function resetLegalConsentCache(): void {
  clearedForSession.clear();
}

/**
 * Cached wrapper around checkNeedsLegalConsent — this is what
 * _authenticated/route.tsx's beforeLoad should call, not the raw function
 * above, so a user who's already cleared the consent wall this session
 * never pays for a repeat query on every click. Still fails open exactly
 * like checkNeedsLegalConsent on an actual "needs consent" or infra-error
 * result — only a confirmed "cleared" result is ever cached.
 */
export async function checkNeedsLegalConsentCached(
  supabase: unknown,
  userId: string,
): Promise<boolean> {
  if (clearedForSession.has(userId)) return false;
  const needsConsent = await checkNeedsLegalConsent(supabase, userId);
  if (!needsConsent) clearedForSession.add(userId);
  return needsConsent;
}
