import { describe, it, expect, afterEach } from "vitest";
import {
  needsLegalConsent,
  checkNeedsLegalConsent,
  checkNeedsLegalConsentCached,
  markLegalConsentCleared,
  resetLegalConsentCache,
  CURRENT_TERMS_VERSION,
} from "./legalConsent";

describe("needsLegalConsent", () => {
  it("returns true when the user has never accepted anything", () => {
    expect(needsLegalConsent([])).toBe(true);
  });

  it("returns false once the user has accepted any version (one-time gate)", () => {
    expect(needsLegalConsent(["2026-01-01"])).toBe(false);
  });

  it("returns false when the current version is among the accepted ones", () => {
    expect(needsLegalConsent([CURRENT_TERMS_VERSION])).toBe(false);
  });

  it("returns false when the current version is accepted alongside older ones", () => {
    expect(needsLegalConsent(["2026-01-01", CURRENT_TERMS_VERSION])).toBe(false);
  });
});

// ── checkNeedsLegalConsent — the actual persistence-and-reload behavior ────
//
// A minimal in-memory stand-in for the Supabase client, implementing just
// the .from().select().eq() shape checkNeedsLegalConsent depends on. This
// lets the test simulate a real insert (what /legal-consent's "Agree and
// continue" does) followed by a fresh query (what _authenticated's
// beforeLoad does on the next navigation/reload) without a live database.
type Row = { user_id: string; terms_version: string };

function makeFakeAgreementsClient(initialRows: Row[] = []) {
  const rows: Row[] = [...initialRows];
  let queryCount = 0;
  const client = {
    from: (_table: "user_agreements") => ({
      select: (_columns: "terms_version") => ({
        eq: async (_column: "user_id", value: string) => {
          queryCount += 1;
          return {
            data: rows
              .filter((r) => r.user_id === value)
              .map((r) => ({ terms_version: r.terms_version })),
            error: null,
          };
        },
      }),
    }),
    insert(row: Row) {
      rows.push(row);
    },
    get queryCount() {
      return queryCount;
    },
  };
  return client;
}

function makeErroringAgreementsClient(error: { message: string; code?: string | null }) {
  return {
    from: (_table: "user_agreements") => ({
      select: (_columns: "terms_version") => ({
        eq: async (_column: "user_id", _value: string) => ({ data: null, error }),
      }),
    }),
  };
}

describe("checkNeedsLegalConsent", () => {
  const userId = "user-1";

  it("regression: accepting once, then re-checking on the next load/re-auth, does not re-prompt", async () => {
    const client = makeFakeAgreementsClient();

    // First load — nothing accepted yet, should prompt.
    expect(await checkNeedsLegalConsent(client, userId)).toBe(true);

    // User checks the box and clicks "Agree and continue" — this is
    // exactly what legal-consent.tsx's handleContinue does.
    client.insert({ user_id: userId, terms_version: CURRENT_TERMS_VERSION });

    // Simulated reload / re-authentication — a fresh beforeLoad run.
    expect(await checkNeedsLegalConsent(client, userId)).toBe(false);

    // And it stays that way on a second, independent reload.
    expect(await checkNeedsLegalConsent(client, userId)).toBe(false);
  });

  it("does not leak one user's acceptance to another (adversarial)", async () => {
    const client = makeFakeAgreementsClient([{ user_id: "other-user", terms_version: CURRENT_TERMS_VERSION }]);
    expect(await checkNeedsLegalConsent(client, userId)).toBe(true);
  });

  it("does not re-prompt when the user previously accepted an older version (one-time gate)", async () => {
    const client = makeFakeAgreementsClient([{ user_id: userId, terms_version: "2026-01-01" }]);
    expect(await checkNeedsLegalConsent(client, userId)).toBe(false);
  });

  it("fails open (does not prompt) when the table itself is unreachable", async () => {
    const client = makeErroringAgreementsClient({
      message: "Could not find the table 'public.user_agreements' in the schema cache",
      code: undefined,
    });
    expect(await checkNeedsLegalConsent(client, userId)).toBe(false);
  });

  it("fails open on any other unexpected query error too", async () => {
    const client = makeErroringAgreementsClient({ message: "connection reset", code: undefined });
    expect(await checkNeedsLegalConsent(client, userId)).toBe(false);
  });
});

// Regression: a reported "tapping a link did nothing" bug traced back to
// _authenticated's beforeLoad re-running this exact query on every single
// in-app navigation (TanStack Router re-runs an ancestor route's beforeLoad
// on every navigation, not just first entry), with no loading indicator
// anywhere in the app for that phase — so any latency on this one query
// made every tap between authenticated pages look broken. These tests
// cover the caching wrapper that's supposed to fix that.
describe("checkNeedsLegalConsentCached", () => {
  const userId = "user-1";

  afterEach(() => {
    resetLegalConsentCache();
  });

  it("queries the database on the first check for a user", async () => {
    const client = makeFakeAgreementsClient([
      { user_id: userId, terms_version: CURRENT_TERMS_VERSION },
    ]);
    expect(await checkNeedsLegalConsentCached(client, userId)).toBe(false);
    expect(client.queryCount).toBe(1);
  });

  it("does NOT query the database again once a user is confirmed cleared this session", async () => {
    const client = makeFakeAgreementsClient([
      { user_id: userId, terms_version: CURRENT_TERMS_VERSION },
    ]);
    await checkNeedsLegalConsentCached(client, userId);
    await checkNeedsLegalConsentCached(client, userId);
    await checkNeedsLegalConsentCached(client, userId);
    expect(client.queryCount).toBe(1);
  });

  it("keeps querying every time for a user who still needs to consent — never caches a 'needs consent' result", async () => {
    const client = makeFakeAgreementsClient();
    expect(await checkNeedsLegalConsentCached(client, userId)).toBe(true);
    expect(await checkNeedsLegalConsentCached(client, userId)).toBe(true);
    expect(client.queryCount).toBe(2);
  });

  it("markLegalConsentCleared lets the very next check skip the database entirely", async () => {
    const client = makeFakeAgreementsClient();
    markLegalConsentCleared(userId);
    expect(await checkNeedsLegalConsentCached(client, userId)).toBe(false);
    expect(client.queryCount).toBe(0);
  });

  it("does not leak one user's cleared status to another (adversarial)", async () => {
    const client = makeFakeAgreementsClient([
      { user_id: userId, terms_version: CURRENT_TERMS_VERSION },
    ]);
    await checkNeedsLegalConsentCached(client, userId);
    // A different user, never inserted anywhere, still gets a real query
    // and a real "needs consent" answer — not the first user's cached "no".
    expect(await checkNeedsLegalConsentCached(client, "other-user")).toBe(true);
    expect(client.queryCount).toBe(2);
  });

  it("resetLegalConsentCache forces a fresh query again", async () => {
    const client = makeFakeAgreementsClient([
      { user_id: userId, terms_version: CURRENT_TERMS_VERSION },
    ]);
    await checkNeedsLegalConsentCached(client, userId);
    expect(client.queryCount).toBe(1);
    resetLegalConsentCache();
    await checkNeedsLegalConsentCached(client, userId);
    expect(client.queryCount).toBe(2);
  });
});
