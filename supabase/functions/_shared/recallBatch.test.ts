import { describe, it, expect, vi } from "vitest";
import {
  matchCriticalRecall,
  matchProductAgainstCpsc,
  matchProductAgainstFda,
  runRecallBatch,
  type BatchProduct,
} from "./recallBatch";

function jsonResponse(body: unknown, ok = true): Response {
  return { ok, json: async () => body } as Response;
}

function product(overrides: Partial<BatchProduct> = {}): BatchProduct {
  return {
    id: "prod-1",
    user_id: "user-1",
    name: "Widget",
    brand: null,
    category: null,
    model: null,
    ...overrides,
  };
}

describe("matchCriticalRecall", () => {
  it("matches on a keyword in the product name", () => {
    expect(matchCriticalRecall(product({ name: "Nara Organics Infant Formula" }))).toMatchObject({
      id: "nara-organics-infant-formula-2024",
    });
  });

  it("does not match an unrelated product", () => {
    expect(matchCriticalRecall(product({ name: "Similac Advance" }))).toBeNull();
  });
});

describe("matchProductAgainstCpsc (regression: Pipa RX false positive)", () => {
  it("does not match a base-model recall against a variant name missing its distinguishing token", () => {
    const recall = {
      RecallID: 1,
      Title: "Nuna Recalls Pipa Infant Car Seats",
      Products: [{ Name: "Nuna Pipa", Model: "PIPA-001", Type: "Infant Car Seat" }],
      Manufacturers: [{ Name: "Nuna" }],
      Description: "This recall does not include the Pipa RX.",
    };
    expect(matchProductAgainstCpsc(product({ name: "Pipa RX", brand: "Nuna" }), recall)).toBe(
      false,
    );
  });

  it("matches the genuine variant recall", () => {
    const recall = {
      RecallID: 2,
      Title: "Nuna Recalls Pipa RX Infant Car Seats",
      Products: [{ Name: "Nuna Pipa RX", Model: "PIPARX-001", Type: "Infant Car Seat" }],
      Manufacturers: [{ Name: "Nuna" }],
    };
    expect(matchProductAgainstCpsc(product({ name: "Pipa RX", brand: "Nuna" }), recall)).toBe(true);
  });
});

describe("matchProductAgainstFda", () => {
  it("matches against product_description, not reason_for_recall", () => {
    expect(
      matchProductAgainstFda("Bobbie Gentle Formula", {
        product_description: "Bobbie Gentle Formula 12.7oz",
      }),
    ).toBe(true);
    expect(
      matchProductAgainstFda("Bobbie Gentle Formula", {
        reason_for_recall: "Bobbie Gentle Formula contamination",
      }),
    ).toBe(false);
  });
});

describe("runRecallBatch", () => {
  function mockFetch(handlers: Record<string, unknown>) {
    return vi.fn(async (url: string) => {
      for (const [needle, body] of Object.entries(handlers)) {
        if (url.includes(needle)) return jsonResponse(body);
      }
      return jsonResponse([]);
    }) as unknown as typeof fetch;
  }

  it("critical recall match produces one catalog row and one match entry, no network needed", async () => {
    const fetchImpl = mockFetch({
      "saferproducts.gov": [],
      "fsis.usda.gov": [],
      "transportation.gov": [],
      "canada.ca": [],
      "opendatasoft.com": { results: [] },
      "api.fda.gov": { results: [] },
    });
    const result = await runRecallBatch(fetchImpl, [
      product({ id: "p1", name: "Nara Infant Formula" }),
    ]);
    expect(result.matches).toEqual([
      {
        user_id: "user-1",
        product_id: "p1",
        source: "critical",
        source_id: "nara-organics-infant-formula-2024",
      },
    ]);
    expect(result.catalogRows).toHaveLength(1);
  });

  it("dedupes catalog rows when multiple products match the same recall, but records a match per product", async () => {
    const fetchImpl = mockFetch({
      "saferproducts.gov": [
        {
          RecallID: 99,
          Title: "Acme Recalls Widget",
          Products: [{ Name: "Widget" }],
          Manufacturers: [{ Name: "Acme" }],
        },
      ],
      "fsis.usda.gov": [],
      "transportation.gov": [],
      "canada.ca": [],
      "opendatasoft.com": { results: [] },
      "api.fda.gov": { results: [] },
    });
    const products = [
      product({ id: "p1", user_id: "u1", name: "Widget", brand: "Acme" }),
      product({ id: "p2", user_id: "u2", name: "Widget", brand: "Acme" }),
    ];
    const result = await runRecallBatch(fetchImpl, products);
    expect(result.catalogRows).toHaveLength(1);
    expect(result.matches).toHaveLength(2);
    expect(result.matches.map((m) => m.product_id).sort()).toEqual(["p1", "p2"]);
  });

  it("FDA hit links to every product sharing that name, from a single fetch per unique name", async () => {
    const fetchImpl = mockFetch({
      "saferproducts.gov": [],
      "fsis.usda.gov": [],
      "transportation.gov": [],
      "canada.ca": [],
      "opendatasoft.com": { results: [] },
      "api.fda.gov": {
        results: [{ recall_number: "F-1", product_description: "Bobbie Gentle Formula" }],
      },
    });
    const products = [
      product({ id: "p1", user_id: "u1", name: "Bobbie Gentle Formula" }),
      product({ id: "p2", user_id: "u2", name: "Bobbie Gentle Formula" }),
      product({ id: "p3", user_id: "u3", name: "Unrelated Item" }),
    ];
    const fetchSpy = fetchImpl as unknown as ReturnType<typeof vi.fn>;
    const result = await runRecallBatch(fetchImpl, products);
    const fdaMatches = result.matches.filter((m) => m.source === "fda");
    expect(fdaMatches.map((m) => m.product_id).sort()).toEqual(["p1", "p2"]);
    // Exactly one FDA fetch per unique product name (2 unique names here),
    // not one per product.
    const fdaCalls = fetchSpy.mock.calls.filter((c) => String(c[0]).includes("api.fda.gov"));
    expect(fdaCalls).toHaveLength(2);
  });

  it("a source failing entirely doesn't prevent matches from the others", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes("saferproducts.gov")) throw new Error("CPSC down");
      if (url.includes("api.fda.gov")) return jsonResponse({ results: [] });
      return jsonResponse([]);
    }) as unknown as typeof fetch;
    const result = await runRecallBatch(fetchImpl, [product({ name: "Nara Infant Formula" })]);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].source).toBe("critical");
  });

  // ── Regression: reported bug — a Beech-Nut baby food product got flagged
  // with a recall alert for an entirely unrelated Grizzlies granola product.
  // Root cause (fixed in recallMatch.ts's fuzzyMatchProduct): substring
  // matching let "beech" and "nut" match as fragments of "Beechwood" and
  // "Peanuts" in the granola recall's title, with neither word actually
  // present. This test seeds exactly that scenario at the full
  // runRecallBatch level (add a Beech-Nut product, seed the Grizzlies
  // recall via the mocked CPSC feed) and asserts no match is produced. ──
  it("regression: a Beech-Nut product does NOT get matched to an unrelated Grizzlies granola recall", async () => {
    const fetchImpl = mockFetch({
      "saferproducts.gov": [
        {
          RecallID: 555,
          Title: "Grizzlies Granola Recalls Beechwood Trail Mix Bars Due to Undeclared Peanuts",
          Products: [{ Name: "Grizzlies Beechwood Trail Mix Bar", Type: "Granola" }],
          Manufacturers: [{ Name: "Grizzlies Snack Co" }],
          Hazards: [{ Name: "Allergen — undeclared peanuts" }],
        },
      ],
      "fsis.usda.gov": [],
      "transportation.gov": [],
      "canada.ca": [],
      "opendatasoft.com": { results: [] },
      "api.fda.gov": { results: [] },
    });
    const result = await runRecallBatch(fetchImpl, [
      product({ id: "beech-nut-1", user_id: "u1", name: "Beech-Nut", category: "baby_food" }),
    ]);
    expect(result.matches).toEqual([]);
    expect(result.catalogRows).toHaveLength(0);
  });

  it("a genuine Beech-Nut recall (brand actually named in the recall) still matches — true positive", async () => {
    const fetchImpl = mockFetch({
      "saferproducts.gov": [
        {
          RecallID: 556,
          Title: "Beech-Nut Nutrition Recalls Naturals Oatmeal Baby Food Pouches",
          Products: [{ Name: "Beech-Nut Naturals Oatmeal Pouch", Type: "Baby Food" }],
          Manufacturers: [{ Name: "Beech-Nut Nutrition Company" }],
          Hazards: [{ Name: "Possible elevated arsenic levels" }],
        },
      ],
      "fsis.usda.gov": [],
      "transportation.gov": [],
      "canada.ca": [],
      "opendatasoft.com": { results: [] },
      "api.fda.gov": { results: [] },
    });
    const result = await runRecallBatch(fetchImpl, [
      product({ id: "beech-nut-1", user_id: "u1", name: "Beech-Nut", category: "baby_food" }),
    ]);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]).toMatchObject({
      product_id: "beech-nut-1",
      source: "cpsc",
      source_id: "556",
    });
  });
});
