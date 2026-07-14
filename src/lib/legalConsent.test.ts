import { describe, it, expect } from "vitest";
import { needsLegalConsent, checkNeedsLegalConsent, CURRENT_TERMS_VERSION } from "./legalConsent";

describe("needsLegalConsent", () => {
  it("returns true when the user has never accepted anything", () => {
    expect(needsLegalConsent([])).toBe(true);
  });

  it("returns true when the user only accepted an older version", () => {
    expect(needsLegalConsent(["2026-01-01"])).toBe(true);
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
  const client = {
    from: (_table: "user_agreements") => ({
      select: (_columns: "terms_version") => ({
        eq: async (_column: "user_id", value: string) => ({
          data: rows.filter((r) => r.user_id === value).map((r) => ({ terms_version: r.terms_version })),
          error: null,
        }),
      }),
    }),
    insert(row: Row) {
      rows.push(row);
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

  it("re-prompts when the user only accepted an older version", async () => {
    const client = makeFakeAgreementsClient([{ user_id: userId, terms_version: "2026-01-01" }]);
    expect(await checkNeedsLegalConsent(client, userId)).toBe(true);
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
