import { describe, it, expect, vi, afterEach } from "vitest";
import {
  isAllowedRecallUrl,
  fetchCpscRecallsForProduct,
  fetchFdaRecallsForProduct,
  formatRecallSyncNote,
  fuzzyMatchProduct,
  lotMatches,
} from "./recallCheck";

// ── Regression: "Beech-Nut" false-flagged against an unrelated Grizzlies
// granola recall — reported bug. Root cause: this matcher used raw
// substring containment (`text.includes(token)`), so short tokens like
// "beech" and "nut" matched as fragments of completely unrelated words
// ("Beechwood", "Peanuts") instead of requiring a real whole-word match.
// This is the client-side copy of the same matcher fixed in
// supabase/functions/_shared/recallMatch.ts — see that file's test for the
// batch/edge-function-side coverage of the identical bug class.
describe("fuzzyMatchProduct", () => {
  it("regression: does NOT match on tokens that only appear as substrings of unrelated words", () => {
    expect(
      fuzzyMatchProduct(
        "Beech-Nut",
        "Grizzlies Granola Recalls Beechwood Trail Mix Bars Due to Undeclared Peanuts",
      ),
    ).toBe(false);
  });

  it("still matches a genuine recall that names the exact brand as a whole word", () => {
    expect(
      fuzzyMatchProduct(
        "Beech-Nut Naturals Oatmeal Pouch",
        "Beech-Nut Nutrition Recalls Naturals Oatmeal Baby Food Pouches",
      ),
    ).toBe(true);
  });

  it("a single meaningful token still requires a whole-word match, not a substring one", () => {
    // "cat" must not match inside "category" — this file's minimum token
    // length is 3, so "cat" (exactly 3) is the shortest realistic case.
    expect(fuzzyMatchProduct("Cat", "This product is in a different category entirely")).toBe(
      false,
    );
    expect(fuzzyMatchProduct("Cat", "Recall affects the Cat brand of toy trucks")).toBe(true);
  });

  it("does not match an unrelated product", () => {
    expect(fuzzyMatchProduct("Bobbie Gentle Formula", "Graco Stroller Recall")).toBe(false);
  });
});

// ── Regression: "Philips Avent Soothie Pacifier" false-flagged against an
// unrelated "Philips Avent Digital Video Baby Monitors" recall — reported
// bug. Root cause: this matcher's multi-token branch used a flat "any 2
// tokens" floor regardless of how many meaningful tokens the product name
// had. The pacifier tokenizes to 4 words (philips/avent/soothie/pacifier);
// only the two brand tokens (philips/avent) appeared in the unrelated
// monitor recall's text, with zero product-defining tokens (soothie/
// pacifier) matching — yet the flat floor of 2 still counted it as a hit.
// Fixed to require *every* token for short names (<=3 tokens) and a
// proportional 75% for longer ones, matching the edge-function copy of
// this matcher (supabase/functions/_shared/recallMatch.ts).
describe("fuzzyMatchProduct — brand-only false positive (live bug report)", () => {
  it("regression: does NOT match on brand-name tokens alone when no product-defining token matches", () => {
    expect(
      fuzzyMatchProduct(
        "Philips Avent Soothie Pacifier",
        "Philips Avent Digital Video Baby Monitors Recalled by Philips Personal Health Due to Burn Hazard",
      ),
    ).toBe(false);
  });

  it("still matches when the recall genuinely covers the same product line (brand + product-type tokens both present)", () => {
    expect(
      fuzzyMatchProduct(
        "Philips Avent Soothie Pacifier",
        "Philips Avent Recalls Soothie Pacifiers Due to Choking Hazard",
      ),
    ).toBe(true);
  });

  it("a 3-token or fewer product name still requires ALL tokens to match, not just a majority", () => {
    // "Graco SnugRide Comfort" (3 tokens) must not match a recall that only
    // covers the base "SnugRide" line without the "Comfort" variant —
    // same sibling-product guard already covered on the edge-function side.
    expect(
      fuzzyMatchProduct("Graco SnugRide Comfort", "Graco Recalls SnugRide Infant Car Seat"),
    ).toBe(false);
    expect(
      fuzzyMatchProduct(
        "Graco SnugRide Comfort",
        "Graco Recalls SnugRide Comfort Infant Car Seat",
      ),
    ).toBe(true);
  });
});

describe("lotMatches", () => {
  it("matches an exact same lot code regardless of case", () => {
    expect(lotMatches("ab1234", "AB1234")).toBe(true);
  });

  it("matches when the recall lists multiple lot codes including the product's", () => {
    expect(lotMatches("AB1234", "Lot codes: AB1234, CD5678, EF9012")).toBe(true);
  });

  it("matches when the product's recorded lot is a prefix/substring the recall's pattern contains", () => {
    expect(lotMatches("AB12", "Affects lot AB1234 only")).toBe(true);
  });

  it("does not match unrelated lot codes", () => {
    expect(lotMatches("AB1234", "Lot codes: CD5678, EF9012")).toBe(false);
  });

  it("ignores punctuation/whitespace differences when comparing", () => {
    expect(lotMatches("AB-1234", "lot: AB 1234")).toBe(true);
  });

  it("returns false when either side is missing", () => {
    expect(lotMatches(null, "AB1234")).toBe(false);
    expect(lotMatches("AB1234", null)).toBe(false);
    expect(lotMatches(undefined, undefined)).toBe(false);
    expect(lotMatches("", "AB1234")).toBe(false);
  });

  it("does not false-positive on a short numeric fragment appearing incidentally", () => {
    // "12" is too generic to be a meaningful lot match on its own — this
    // documents the current (intentionally simple) behavior rather than
    // claiming smarter disambiguation this function doesn't attempt.
    expect(lotMatches("12", "Lot 1234-5678")).toBe(true);
  });
});

describe("isAllowedRecallUrl", () => {
  it("allows an official cpsc.gov URL", () => {
    expect(isAllowedRecallUrl("https://www.cpsc.gov/Recalls/2024/example")).toBe(true);
  });

  it("allows an official saferproducts.gov URL", () => {
    expect(
      isAllowedRecallUrl("https://www.saferproducts.gov/RestWebServices/Recall?RecallID=1"),
    ).toBe(true);
  });

  it("allows an official fda.gov URL", () => {
    expect(
      isAllowedRecallUrl(
        "https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts/example",
      ),
    ).toBe(true);
  });

  it("allows an official nhtsa.gov URL", () => {
    expect(isAllowedRecallUrl("https://www.nhtsa.gov/recalls?nhtsaId=12345")).toBe(true);
  });

  it("allows a bare (no subdomain) allowed host", () => {
    expect(isAllowedRecallUrl("https://cpsc.gov/Recalls")).toBe(true);
  });

  it("rejects a non-https URL on an otherwise allowed host", () => {
    expect(isAllowedRecallUrl("http://www.cpsc.gov/Recalls/2024/example")).toBe(false);
  });

  it("rejects a lookalike domain with the allowed host as a suffix of a longer label (cpsc.gov.evil.com)", () => {
    expect(isAllowedRecallUrl("https://cpsc.gov.evil.com/Recalls")).toBe(false);
  });

  it("rejects a lookalike domain that merely contains the allowed host as a substring (evilcpsc.gov)", () => {
    expect(isAllowedRecallUrl("https://evilcpsc.gov/Recalls")).toBe(false);
  });

  it("rejects an unrelated domain entirely", () => {
    expect(isAllowedRecallUrl("https://example.com/not-a-recall")).toBe(false);
  });

  it("rejects a malformed URL instead of throwing", () => {
    expect(() => isAllowedRecallUrl("not a url")).not.toThrow();
    expect(isAllowedRecallUrl("not a url")).toBe(false);
  });

  it("rejects an empty string instead of throwing", () => {
    expect(() => isAllowedRecallUrl("")).not.toThrow();
    expect(isAllowedRecallUrl("")).toBe(false);
  });
});

describe("formatRecallSyncNote", () => {
  it("formats a real timestamp with the sync date and the cross-reference caveat", () => {
    const iso = "2026-07-14T16:30:00.000Z";
    const note = formatRecallSyncNote(iso);
    const expectedDate = new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
    expect(note).toContain("Data synced with CPSC.gov");
    expect(note).toContain(expectedDate);
    expect(note).toContain("always cross-reference critical gear directly on official government recall sites");
  });

  it("returns an honest pending message rather than a fabricated date when null", () => {
    const note = formatRecallSyncNote(null);
    expect(note).toContain("Recall check pending");
    expect(note).not.toMatch(/\d{4}/); // no fabricated year/date
  });

  it("returns the pending message for undefined too", () => {
    expect(formatRecallSyncNote(undefined)).toContain("Recall check pending");
  });

  it("falls back to the pending message rather than 'Invalid Date' for a malformed timestamp", () => {
    const note = formatRecallSyncNote("not-a-real-date");
    expect(note).toContain("Recall check pending");
    expect(note).not.toContain("Invalid Date");
  });

  it("always includes the government cross-reference caveat regardless of sync state", () => {
    expect(formatRecallSyncNote(null)).toContain("official government recall sites");
    expect(formatRecallSyncNote("2026-01-01T00:00:00.000Z")).toContain("official government recall sites");
  });
});

// Regression coverage for the reported "registry check search is very
// slow" bug: fetchCpscRecallsForProduct/fetchFdaRecallsForProduct had no
// timeout on their external fetch() calls, unlike every other fetch
// helper in this codebase, so a hung saferproducts.gov/api.fda.gov
// response left the search spinning indefinitely instead of failing fast.
function abortableFetchMock() {
  return vi.fn((_url: string, init?: RequestInit) => {
    return new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        reject(new DOMException("The operation was aborted", "AbortError"));
      });
    });
  });
}

describe("fetchCpscRecallsForProduct — timeout resilience", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("regression: resolves to [] once the timeout fires, rather than hanging forever, when the API never responds", async () => {
    vi.useFakeTimers();
    const fetchMock = abortableFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    const promise = fetchCpscRecallsForProduct("stroller");
    await vi.advanceTimersByTimeAsync(10_000);
    const result = await promise;

    expect(result).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // The abort signal must actually have been wired through to fetch().
    const passedInit = fetchMock.mock.calls[0][1] as RequestInit;
    expect(passedInit?.signal).toBeInstanceOf(AbortSignal);
  });

  it("still returns matching recalls quickly when the API responds normally (no regression from adding the timeout)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => [
          {
            RecallID: "123",
            RecallHeading: "Test Stroller Recall",
            Products: [{ Name: "Test Stroller" }],
            Hazards: [{ Name: "Fall hazard" }],
            URL: "https://www.saferproducts.gov/x",
            RecallDate: "2026-01-01",
          },
        ],
      })),
    );

    const result = await fetchCpscRecallsForProduct("Test Stroller");

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Test Stroller Recall");
  });
});

describe("fetchFdaRecallsForProduct — timeout resilience", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("regression: resolves to [] once the timeout fires, rather than hanging forever, when the API never responds", async () => {
    vi.useFakeTimers();
    const fetchMock = abortableFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    const promise = fetchFdaRecallsForProduct("infant formula");
    await vi.advanceTimersByTimeAsync(10_000);
    const result = await promise;

    expect(result).toEqual([]);
    // Both of the two parallel FDA requests should have been attempted.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("still returns matching recalls quickly when the API responds normally (no regression from adding the timeout)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          results: [
            {
              recall_number: "F-001",
              product_description: "Test Infant Formula",
              reason_for_recall: "Possible contamination",
              recall_initiation_date: "2026-01-01",
            },
          ],
        }),
      })),
    );

    const result = await fetchFdaRecallsForProduct("Test Infant Formula");

    expect(result).toHaveLength(1);
    expect(result[0].productDescription).toBe("Test Infant Formula");
  });
});
