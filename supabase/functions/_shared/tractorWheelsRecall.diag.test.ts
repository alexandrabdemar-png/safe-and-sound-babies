// Diagnostic: why "Once Upon a Farm Tractor Wheels" logged in the Food Log
// did not produce a recall notification (FDA recall, Oct 30 / Nov 2 2026).
import { describe, it, expect, vi } from "vitest";
import { fuzzyMatchProduct } from "./recallMatch";
import { fdaQueryFor, runRecallBatch, type BatchProduct } from "./recallBatch";

// Realistic openFDA enforcement product_description for this recall.
const FDA_DESC =
  "Once Upon a Farm Tractor Wheels Organic Toddler Soft-Baked Bars, Apple, Sweet Potato & Spinach, " +
  "5 bars x 0.7 oz (20g), UPC 8 10017 39012 4";

function food(name: string, i = 0, brand: string | null = "Once Upon a Farm"): BatchProduct {
  return {
    id: `p${i}`,
    user_id: "u1",
    name,
    brand,
    category: "Baby food",
    model: null,
    product_type: "food",
    barcode: null,
  };
}

function fetchMock(fdaFor: (url: string) => unknown) {
  return vi.fn(async (url: string) => {
    if (url.includes("api.fda.gov")) {
      const body = fdaFor(decodeURIComponent(url));
      return { ok: true, status: 200, json: async () => body } as Response;
    }
    return { ok: true, status: 200, json: async () => [] } as Response;
  }) as unknown as typeof fetch;
}

describe("1. name matching against the FDA notice text", () => {
  const cases: [string, boolean][] = [
    ["tractor wheel", true],
    ["Tractor Wheels", true],
    ["Tractor Wheels Apple Sweet Potato Spinach", true],
    ["Tractor Wheels Oat Bites", false], // "oat"/"bites" not in the notice
    ["Tractor Wheels Strawberry Pumpkin Beet", false], // other flavor's notice
    ["Tractor Wheels Soft Baked Toddler Bar", true],
    ["Tractor Wheels Bars - Banana", false],
  ];
  for (const [name, expected] of cases) {
    it(`"${name}" -> ${expected ? "MATCH" : "NO MATCH"}`, () => {
      const q = fdaQueryFor(food(name));
      expect(fuzzyMatchProduct(q, FDA_DESC)).toBe(expected);
    });
  }
});

describe("2. full batch: the product alone", () => {
  it("is linked to the FDA recall when the feed has it", async () => {
    const f = fetchMock(() => ({ results: [{ recall_number: "F-0001-2027", product_description: FDA_DESC }] }));
    const r = await runRecallBatch(f, [food("tractor wheel")]);
    expect(r.matches.filter((m) => m.source === "fda")).toHaveLength(1);
  });

  it("gets nothing when the FDA enforcement feed has not published the recall yet", async () => {
    const f = fetchMock(() => ({ results: [] }));
    const r = await runRecallBatch(f, [food("tractor wheel")]);
    expect(r.matches).toHaveLength(0);
  });
});

describe("3. full batch: 100-unique-name FDA cap", () => {
  it("never queries FDA for the food when 100+ other unique names come first", async () => {
    const others = Array.from({ length: 150 }, (_, i) => food(`Other Product ${i}`, i + 1, "Brand"));
    const f = fetchMock((url) =>
      url.includes("Tractor") || url.includes("tractor")
        ? { results: [{ recall_number: "F-0001-2027", product_description: FDA_DESC }] }
        : { results: [] },
    );
    const r = await runRecallBatch(f, [...others, food("tractor wheel", 999)]);
    const fdaCalls = (f as unknown as ReturnType<typeof vi.fn>).mock.calls
      .map((c) => decodeURIComponent(String(c[0])))
      .filter((u) => u.includes("api.fda.gov"));
    console.log(`FDA calls: ${fdaCalls.length}; tractor queried: ${fdaCalls.some((u) => /tractor/i.test(u))}`);
    expect(fdaCalls.some((u) => /tractor/i.test(u))).toBe(false);
    expect(r.matches.some((m) => m.product_id === "p999")).toBe(false);
  });
});

describe("4. the query sent to openFDA", () => {
  it("is unquoted, so openFDA treats each word as OR and keeps only the top 5", async () => {
    const f = fetchMock(() => ({ results: [] }));
    await runRecallBatch(f, [food("tractor wheel")]);
    const url = decodeURIComponent(String((f as unknown as ReturnType<typeof vi.fn>).mock.calls.find((c) => String(c[0]).includes("api.fda.gov"))![0]));
    console.log(url);
    expect(url).toContain("product_description:Once Upon a Farm tractor wheel&limit=5");
  });
});
