import { logError } from "@/lib/sanitize-error";
import { isSchemaMissingTableError } from "@/lib/errors";

// Single source of truth for which Terms of Service version is currently
// in force — this is what /legal-consent writes to
// user_agreements.terms_version, and what the "Last updated" date on
// /terms is derived from.
//
// IMPORTANT — this does NOT by itself re-prompt existing users. Despite
// what an earlier version of this comment claimed, needsLegalConsent()
// below is a one-time gate (true only when a user has zero recorded
// acceptances, regardless of version) — bumping this constant changes the
// version a brand-new acceptance is recorded under and the displayed
// date, but an existing user who already has any row in user_agreements
// is never routed back to /legal-consent just because this changed. If a
// future Terms change is significant enough that existing users need to
// see and accept it again (e.g. the 2026-08-21 subscriptions/billing
// section, added when Apple In-App Purchase was introduced), that
// requires an actual code change to needsLegalConsent/checkNeedsLegalConsent
// — bumping this string alone will not do it. See COMPLIANCE_REPORT.md
// §5's re-consent item, which flags this as a decision to make
// deliberately rather than assume.
//
// Bumped 2026-08-21 to add the Subscriptions & Billing section (Apple
// In-App Purchase on iOS, alongside the existing Stripe web billing) —
// existing users will NOT be automatically re-prompted per the note
// above.
export const CURRENT_TERMS_VERSION = "2026-08-21";

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
