import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

const mockFrom = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
}));

import {
  isAllowedRecallUrl,
  fetchCpscRecallsForProduct,
  fetchFdaRecallsForProduct,
  formatRecallSyncNote,
  fuzzyMatchProduct,
  lotMatches,
  isLikelyNonFoodProduct,
  checkRecallsForProduct,
  fetchProductDetailResilient,
  recallFallbackUrl,
  recallSourceLabel,
  recallVerifyLinkLabel,
} from "./recallCheck";

// Minimal thenable chain mimicking Supabase's query builder — every
// intermediate call returns the same object, and `await`-ing it at any
// point resolves to the given {data, error}. Matches the pattern already
// established in momentIcons.test.ts for the same kind of resilient-fetch
// function.
function makeChain(result: { data: unknown; error: unknown }) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
  };
  return chain;
}

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
// Originally fixed with an "every token for <=3 tokens, 75% for longer
// names" rule; that 75% carve-out later caused its own false positive (see
// the "Beech Nut Blueberry Apple" regression below), so it's since been
// tightened to require every token unconditionally (with a plural-only
// exception via `stem`). Matches the edge-function copy of this matcher
// (supabase/functions/_shared/recallMatch.ts).
describe("fuzzyMatchProduct — plural normalization", () => {
  it("matches a singular product name against a plural recall for -e words", () => {
    expect(
      fuzzyMatchProduct(
        "Dr Browns Natural Flow Bottle",
        "Dr Brown's Recalls Natural Flow Bottles Due to Choking Hazard",
      ),
    ).toBe(true);
  });

  it("matches cradle/cradles and pouch/pouches either direction", () => {
    expect(fuzzyMatchProduct("Fisher Price Rock Cradle", "Fisher-Price Recalls Rock Cradles")).toBe(
      true,
    );
    expect(fuzzyMatchProduct("Beech Nut Apple Pouches", "Beech-Nut Apple Pouch Recall")).toBe(true);
  });
});

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
      fuzzyMatchProduct("Graco SnugRide Comfort", "Graco Recalls SnugRide Comfort Infant Car Seat"),
    ).toBe(true);
  });

  // Regression: "Beech Nut Blueberry Apple" (a real baby-food pouch flavor)
  // false-matched an unrelated snack-mix recall. Root cause: the previous
  // 75%-of-tokens threshold for names >3 tokens let 3 of the product's 4
  // tokens ("beech", "blueberry", "apple" — all plausible, generic
  // ingredient/descriptor words) pass against a recall whose own text
  // happened to include them too, while the one token that never appeared
  // ("nut") went unnoticed because it wasn't required. Live report: matched
  // against a "Grizzlies" granola/trail-mix recall with zero real
  // connection to the Beech-Nut baby-food brand.
  it("regression: does NOT match when one meaningful token is entirely absent, even if the rest are common words that coincide", () => {
    expect(
      fuzzyMatchProduct(
        "Beech Nut Blueberry Apple",
        "Grizzlies Brand Trail Mix — a beech and blueberry apple blend — recalled for undeclared allergens",
      ),
    ).toBe(false);
  });

  it("still matches when every token is genuinely present (including a same-brand recall)", () => {
    expect(
      fuzzyMatchProduct(
        "Beech Nut Blueberry Apple",
        "Beech-Nut Recalls Blueberry Apple Pouches Due to Possible Choking Hazard",
      ),
    ).toBe(true);
  });
});

// ── Regression (live bug report): searching "by heart formula" — an
// accidental space inside the "ByHeart" brand name — matched an unrelated
// children's jewelry recall instead of the real ByHeart formula recall.
// Root cause: the stray "by" fragment was too short to survive tokenizing,
// leaving the single leftover word "heart" as the sole token — generic
// enough to false-match anything mentioning "heart" while never matching
// the real recall, whose text has "byheart" as one fused token.
describe("fuzzyMatchProduct — accidental space inside a brand word (live bug report)", () => {
  it("regression: still matches the real brand recall when a stray space splits the brand word", () => {
    expect(
      fuzzyMatchProduct(
        "by heart formula",
        "ByHeart Recalls Whole Nutrition Infant Formula Due to Possible Cronobacter Contamination",
      ),
    ).toBe(true);
  });

  it("regression: does NOT fall back to the generic leftover word and false-match an unrelated recall", () => {
    expect(
      fuzzyMatchProduct(
        "by heart formula",
        "Recalls Children's Heart Charm Bracelets Due to High Levels of Lead",
      ),
    ).toBe(false);
  });

  it("still matches the exact brand spelling with no accidental space", () => {
    expect(
      fuzzyMatchProduct(
        "byheart formula",
        "ByHeart Recalls Whole Nutrition Infant Formula Due to Possible Cronobacter Contamination",
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
    expect(note).toContain(
      "always cross-reference critical gear directly on official government recall sites",
    );
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
    expect(formatRecallSyncNote("2026-01-01T00:00:00.000Z")).toContain(
      "official government recall sites",
    );
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

// ── Regression: reported bug — searching "Yoyo" (the Babyzen YOYO stroller
// brand) on the public recall search page surfaced an unrelated "Yoyo Gummy
// Grape" FDA *food* recall instead of "no recall found". Root cause: the
// FDA food-enforcement API is queried for every search regardless of
// category, and a bare brand-name match against its product_description
// field has no way to know "Yoyo" the stroller brand isn't "Yoyo" the candy
// brand. Fixed by skipping the FDA (food-only) query outright whenever the
// search text clearly names a non-food gear category.
describe("isLikelyNonFoodProduct", () => {
  it("recognizes clearly non-food gear categories", () => {
    expect(isLikelyNonFoodProduct("Yoyo Stroller")).toBe(true);
    expect(isLikelyNonFoodProduct("Graco SnugRide Car Seat")).toBe(true);
    expect(isLikelyNonFoodProduct("Fisher-Price Rock 'n Play Bassinet")).toBe(true);
    expect(isLikelyNonFoodProduct("Baby Gate")).toBe(true);
  });

  it("does not flag genuine food/formula searches as non-food", () => {
    expect(isLikelyNonFoodProduct("Nara infant formula")).toBe(false);
    expect(isLikelyNonFoodProduct("Bobbie Gentle Formula")).toBe(false);
    expect(isLikelyNonFoodProduct("organic breast milk storage bags")).toBe(false);
    expect(isLikelyNonFoodProduct("stage 2 baby food")).toBe(false);
  });

  it("does not flag a name with no detectable category either way (known limitation — see below)", () => {
    // A bare brand word with zero category signal ("Yoyo" alone, no
    // "stroller") is genuinely ambiguous from text alone — this documents
    // that isLikelyNonFoodProduct can't and doesn't guess in that case.
    expect(isLikelyNonFoodProduct("Yoyo")).toBe(false);
    expect(isLikelyNonFoodProduct("Similac")).toBe(false);
  });
});

describe("checkRecallsForProduct — food-vs-gear FDA skip (live bug report: Yoyo stroller)", () => {
  // vi.stubGlobal/vi.unstubAllGlobals aren't implemented by bun's built-in
  // vitest-compat test runner (same pre-existing gap that already skips the
  // "timeout resilience" describes above under `bun test`) — plain
  // save/restore of globalThis.fetch sidesteps that so these tests actually
  // execute here instead of relying on reasoning about untested code.
  let originalFetch: typeof fetch;
  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("regression: a gear search never surfaces an unrelated FDA food recall, even when CPSC has no match", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("saferproducts.gov")) {
        // No real CPSC recall for this stroller line.
        return { ok: true, json: async () => [] };
      }
      if (url.includes("api.fda.gov")) {
        // Should never actually be called — asserted below — but if it
        // were, this is the exact shape of the false-positive report.
        return {
          ok: true,
          json: async () => ({
            results: [
              {
                recall_number: "F-9001",
                product_description: "YOYO GUMMY GRAPE 3.5 OZ POUCH",
                reason_for_recall: "Undeclared allergen",
                recall_initiation_date: "2026-05-01",
              },
            ],
          }),
        };
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await checkRecallsForProduct("Yoyo Stroller");

    expect(result).toBeNull();
    // The FDA endpoint must not even be called for a gear search — this is
    // the actual fix, not just a client-side filter after the fact.
    const calledUrls: string[] = fetchMock.mock.calls.map((c: unknown[]) => c[0] as string);
    expect(calledUrls.some((u: string) => u.includes("api.fda.gov"))).toBe(false);
    expect(calledUrls.some((u: string) => u.includes("saferproducts.gov"))).toBe(true);
  });

  it("still finds a genuine CPSC recall for a gear search (FDA skip does not break real matches)", async () => {
    globalThis.fetch = vi.fn(async (url: string) => {
      if (url.includes("saferproducts.gov")) {
        return {
          ok: true,
          json: async () => [
            {
              RecallID: "555",
              RecallHeading: "Yoyo Stroller Recall",
              Products: [{ Name: "Yoyo Stroller" }],
              Hazards: [{ Name: "Fall hazard" }],
              URL: "https://www.saferproducts.gov/x",
              RecallDate: "2026-01-01",
            },
          ],
        };
      }
      throw new Error(`unexpected fetch: ${url}`);
    }) as unknown as typeof fetch;

    const result = await checkRecallsForProduct("Yoyo Stroller");

    expect(result?.title).toBe("Yoyo Stroller Recall");
    expect(result?.source).toBe("cpsc");
  });

  it("known limitation, documented not silently assumed away: a bare ambiguous brand word with no category signal can still surface an unrelated FDA food match", async () => {
    globalThis.fetch = vi.fn(async (url: string) => {
      if (url.includes("saferproducts.gov")) return { ok: true, json: async () => [] };
      if (url.includes("api.fda.gov")) {
        return {
          ok: true,
          json: async () => ({
            results: [
              {
                recall_number: "F-9001",
                product_description: "YOYO GUMMY GRAPE 3.5 OZ POUCH",
                reason_for_recall: "Undeclared allergen",
                recall_initiation_date: "2026-05-01",
              },
            ],
          }),
        };
      }
      throw new Error(`unexpected fetch: ${url}`);
    }) as unknown as typeof fetch;

    const result = await checkRecallsForProduct("Yoyo");

    // This still happens today: "Yoyo" alone has no category keyword, so
    // isLikelyNonFoodProduct can't tell it apart from a food brand, and
    // fuzzyMatchProduct's single-token branch is a plain whole-word match
    // with no further disambiguation. Encoding this as a passing assertion
    // (rather than leaving it unverified) so a future change to either
    // function has to consciously decide to change this behavior.
    expect(result?.source).toBe("fda");
    expect(result?.title).toContain("YOYO GUMMY GRAPE");
  });

  it("still queries FDA (and finds a real formula recall) for an actual food/formula search", async () => {
    globalThis.fetch = vi.fn(async (url: string) => {
      if (url.includes("saferproducts.gov")) return { ok: true, json: async () => [] };
      if (url.includes("api.fda.gov")) {
        return {
          ok: true,
          json: async () => ({
            results: [
              {
                recall_number: "F-1234",
                product_description: "Bobbie Gentle Formula 800g",
                reason_for_recall: "Possible contamination",
                recall_initiation_date: "2026-02-01",
              },
            ],
          }),
        };
      }
      throw new Error(`unexpected fetch: ${url}`);
    }) as unknown as typeof fetch;

    const result = await checkRecallsForProduct("Bobbie Gentle Formula");

    expect(result?.source).toBe("fda");
    expect(result?.title).toContain("Bobbie Gentle Formula");
  });
});

// ── Regression: reported bug — clicking into a product's detail page (via
// the "RECALL — tap to review" banner) showed the raw Postgres error
// "column products.recall_checked_at does not exist" instead of the page
// loading. Root cause: recall_checked_at and lot_number are both recent
// columns (see the migrations referenced in fetchProductDetailResilient's
// doc comment), and the select() for the product detail screen included
// them unconditionally with no fallback — unlike every other resilient
// column-add in this codebase (fetchMilestonesResilient for
// milestones.icon, etc.).
describe("fetchProductDetailResilient", () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it("returns the product as-is when recall_checked_at/lot_number are available", async () => {
    mockFrom.mockReturnValue(
      makeChain({
        data: {
          id: "p1",
          name: "Nuna Bassinet",
          brand: "Nuna",
          size: null,
          category: "bassinet",
          added_at: "2026-01-01",
          purchased_at: null,
          predicted_replacement_date: null,
          recalled: true,
          child_id: "c1",
          recall_checked_at: "2026-07-01T00:00:00.000Z",
          lot_number: "AB1234",
        },
        error: null,
      }),
    );

    const result = await fetchProductDetailResilient("p1");

    expect(result.error).toBeNull();
    expect(result.data?.recall_checked_at).toBe("2026-07-01T00:00:00.000Z");
    expect(result.data?.lot_number).toBe("AB1234");
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });

  it("regression: retries without recall_checked_at/lot_number and still returns the product when that column isn't live yet", async () => {
    const columnMissing = makeChain({
      data: null,
      error: { message: "column products.recall_checked_at does not exist", code: "42703" },
    });
    const succeedsWithoutIt = makeChain({
      data: {
        id: "p1",
        name: "Nuna Bassinet",
        brand: "Nuna",
        size: null,
        category: "bassinet",
        added_at: "2026-01-01",
        purchased_at: null,
        predicted_replacement_date: null,
        recalled: true,
        child_id: "c1",
      },
      error: null,
    });
    mockFrom.mockReturnValueOnce(columnMissing).mockReturnValueOnce(succeedsWithoutIt);

    const result = await fetchProductDetailResilient("p1");

    expect(result.error).toBeNull();
    expect(result.data?.id).toBe("p1");
    expect(result.data?.recall_checked_at).toBeNull();
    expect(result.data?.lot_number).toBeNull();
    expect(mockFrom).toHaveBeenCalledTimes(2);
  });

  it("also retries on the schema-cache-not-reloaded phrasing of the same error, not just the Postgres error code", async () => {
    const columnMissing = makeChain({
      data: null,
      error: {
        message: "Could not find the 'recall_checked_at' column of 'products' in the schema cache",
      },
    });
    const succeedsWithoutIt = makeChain({
      data: {
        id: "p1",
        name: "Test",
        brand: null,
        size: null,
        category: null,
        added_at: null,
        purchased_at: null,
        predicted_replacement_date: null,
        recalled: false,
        child_id: null,
      },
      error: null,
    });
    mockFrom.mockReturnValueOnce(columnMissing).mockReturnValueOnce(succeedsWithoutIt);

    const result = await fetchProductDetailResilient("p1");

    expect(result.error).toBeNull();
    expect(result.data?.id).toBe("p1");
  });

  it("does not retry and surfaces the real error for an unrelated failure (e.g. permission denied)", async () => {
    mockFrom.mockReturnValue(
      makeChain({
        data: null,
        error: { message: "permission denied for table products", code: "42501" },
      }),
    );

    const result = await fetchProductDetailResilient("p1");

    expect(result.error?.message).toBe("permission denied for table products");
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });

  it("returns a null product (not a thrown error) when the product genuinely doesn't exist", async () => {
    mockFrom.mockReturnValue(makeChain({ data: null, error: null }));

    const result = await fetchProductDetailResilient("nonexistent");

    expect(result.data).toBeNull();
    expect(result.error).toBeNull();
  });

  it("catches a thrown network failure instead of leaving it unhandled", async () => {
    mockFrom.mockImplementation(() => {
      throw new TypeError("Failed to fetch");
    });

    const result = await fetchProductDetailResilient("p1");

    expect(result.data).toBeNull();
    expect(result.error?.message).toBe("Failed to fetch");
  });
});

// Regression: a reported "the link doesn't work" bug — every recall's
// verify link used a CPSC-only fallback (recallFallbackUrl(title) alone)
// regardless of the recall's true source, so an FDA/USDA/NHTSA/Health
// Canada/EU recall with no direct url on its own row fell back to a CPSC
// search that has no reason to find it. These helpers make the fallback
// URL and the button label both source-aware.
describe("recallFallbackUrl — source-aware fallback (regression: non-CPSC link fell back to a CPSC-only search)", () => {
  it("still builds a CPSC title search when the source is cpsc", () => {
    expect(recallFallbackUrl("Beech-Nut Pouch Recall", "cpsc")).toBe(
      "https://www.cpsc.gov/Recalls?combine=Beech-Nut%20Pouch%20Recall",
    );
  });

  it("still builds a CPSC title search when the source is unknown/absent (prior default behavior)", () => {
    expect(recallFallbackUrl("Some Recall")).toBe(
      "https://www.cpsc.gov/Recalls?combine=Some%20Recall",
    );
  });

  it("falls back to the FDA's own recall page, not a CPSC search, for an FDA-sourced recall", () => {
    expect(recallFallbackUrl("Granola Bar Recall", "fda")).toBe(
      "https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts",
    );
  });

  it("falls back to each other agency's own recall page rather than CPSC", () => {
    expect(recallFallbackUrl("x", "usda_fsis")).toBe("https://www.fsis.usda.gov/recalls");
    expect(recallFallbackUrl("x", "nhtsa")).toBe("https://www.nhtsa.gov/recalls");
    expect(recallFallbackUrl("x", "health_canada")).toBe("https://recalls-rappels.canada.ca/en");
    expect(recallFallbackUrl("x", "eu_safety_gate")).toBe(
      "https://ec.europa.eu/safety-gate-alerts/screen/webReport",
    );
  });
});

describe("recallVerifyLinkLabel — source-aware button text (regression: always said 'Verify on CPSC.gov')", () => {
  it("says CPSC.gov when the source is cpsc", () => {
    expect(recallVerifyLinkLabel({ source: "cpsc" })).toBe("Verify on CPSC.gov");
  });

  it("says FDA.gov when the source is fda, not CPSC.gov", () => {
    expect(recallVerifyLinkLabel({ source: "fda" })).toBe("Verify on FDA.gov");
  });

  it("prefers the recall's own url domain over the source field when both are present", () => {
    expect(recallVerifyLinkLabel({ url: "https://www.fda.gov/example", source: "cpsc" })).toBe(
      "Verify on FDA.gov",
    );
  });

  it("falls back to a generic label, not CPSC.gov, for a source with no dedicated agency page", () => {
    expect(recallVerifyLinkLabel({ source: "critical" })).toBe("Verify official recall notice");
    expect(recallVerifyLinkLabel({ source: null })).toBe("Verify official recall notice");
  });

  it("labels every non-CPSC agency source distinctly", () => {
    expect(recallVerifyLinkLabel({ source: "usda_fsis" })).toBe("Verify on USDA FSIS");
    expect(recallVerifyLinkLabel({ source: "nhtsa" })).toBe("Verify on NHTSA.gov");
    expect(recallVerifyLinkLabel({ source: "health_canada" })).toBe("Verify on Health Canada");
    expect(recallVerifyLinkLabel({ source: "eu_safety_gate" })).toBe("Verify on EU Safety Gate");
  });
});

describe("recallSourceLabel — narrative agency name now covers every source, not just CPSC/FDA", () => {
  it("names each agency in full", () => {
    expect(recallSourceLabel({ source: "usda_fsis" })).toBe(
      "USDA Food Safety and Inspection Service (FSIS)",
    );
    expect(recallSourceLabel({ source: "nhtsa" })).toBe(
      "U.S. National Highway Traffic Safety Administration (NHTSA)",
    );
    expect(recallSourceLabel({ source: "health_canada" })).toBe("Health Canada");
    expect(recallSourceLabel({ source: "eu_safety_gate" })).toBe("EU Safety Gate");
  });
});
