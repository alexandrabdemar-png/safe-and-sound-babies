// Regression: "Once Upon a Farm Tractor Wheels" logged in the Food Log never
// produced a recall alert (FDA recall announced Oct 30 2026, posted Nov 2).
// Causes found: FDA name lookups were capped at 100 unique names per scan,
// the scan loaded at most 1,000 products, CPSC kept only 500 records, the
// openFDA query was loose (limit 5), and FDA press releases — which appear
// well before the enforcement data — weren't read at all.
import { describe, it, expect, vi } from "vitest";
import { fuzzyMatchProduct, fdaSearchClause, RecallTokenIndex } from "./recallMatch";
import {
  fdaQueryFor,
  matchCriticalRecall,
  parseFdaPressRss,
  runRecallBatch,
  type BatchProduct,
} from "./recallBatch";

const FDA_DESC =
  "Once Upon a Farm Tractor Wheels Organic Toddler Soft-Baked Bars, Apple, Sweet Potato & Spinach, " +
  "5 bars x 0.7 oz (20g), UPC 8 10017 39012 4";

const PRESS_RSS = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0"><channel><title>Recalls</title>
<item>
  <title>Once Upon A Farm Recalls All Lots and Varieties of Tractor Wheels Organic Toddler Soft-Baked Bars Due to Potential Choking Hazard</title>
  <link>https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts/once-upon-farm-recalls-all-lots-and-varieties-tractor-wheels-organic-toddler-soft-baked-bars-due</link>
  <description><![CDATA[<p>Once Upon a Farm, PBC is voluntarily recalling all lots &amp; flavors.</p>]]></description>
  <pubDate>Thu, 30 Oct 2026 20:00:00 EDT</pubDate>
</item>
<item>
  <title>Acme Foods Issues Allergy Alert on Undeclared Milk in Cookies</title>
  <link>https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts/acme-cookies</link>
  <description>Acme cookies</description>
  <pubDate>Wed, 29 Oct 2026 10:00:00 EDT</pubDate>
</item>
</channel></rss>`;

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
    created_at: "2020-01-01T00:00:00Z", // old: no per-name lookup without a key
  };
}

type Feeds = { fdaBulk?: unknown[]; fdaName?: unknown[]; rss?: string; cpsc?: unknown[] };

function fetchMock(feeds: Feeds) {
  return vi.fn(async (url: string) => {
    const u = decodeURIComponent(url);
    const json = (body: unknown) => ({ ok: true, status: 200, json: async () => body, text: async () => "" }) as unknown as Response;
    if (u.includes("api.fda.gov")) {
      if (u.includes("report_date:[")) return json({ meta: { results: { total: feeds.fdaBulk?.length ?? 0 } }, results: feeds.fdaBulk ?? [] });
      return json({ results: feeds.fdaName ?? [] });
    }
    if (u.includes("www.fda.gov") && u.endsWith("rss.xml")) {
      return { ok: true, status: 200, text: async () => feeds.rss ?? "<rss></rss>" } as unknown as Response;
    }
    if (u.includes("saferproducts.gov")) return json(feeds.cpsc ?? []);
    return json([]);
  }) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
}

const NOW = new Date("2026-11-05T12:00:00Z");
const fdaHit = { recall_number: "F-0001-2027", product_description: FDA_DESC };

describe("name matching against the FDA notice", () => {
  for (const name of ["tractor wheel", "Tractor Wheels", "Tractor Wheels Apple Sweet Potato Spinach"]) {
    it(`"${name}" matches`, () => {
      expect(fuzzyMatchProduct(fdaQueryFor(food(name)), FDA_DESC)).toBe(true);
    });
  }
});

describe("critical recall list", () => {
  it("flags any Once Upon a Farm Tractor Wheels product, any flavor or wording", () => {
    for (const name of ["Tractor Wheels", "tractor wheel", "Tractor Wheels Oat Bites", "Tractor Wheels Bars - Banana"]) {
      expect(matchCriticalRecall(food(name))?.id).toBe("once-upon-a-farm-tractor-wheels-2026");
    }
  });
  it("does not flag another brand's tractor wheel or another Once Upon a Farm product", () => {
    expect(matchCriticalRecall(food("Toy Tractor Wheel", 0, "Green Toys"))).toBeNull();
    expect(matchCriticalRecall(food("Wild Rumpus Avocado"))).toBeNull();
  });
});

describe("runRecallBatch — FDA coverage for every product", () => {
  it("matches via the bulk enforcement feed even with 150 other products ahead of it", async () => {
    const others = Array.from({ length: 150 }, (_, i) => food(`Other Product ${i}`, i + 1, "Brand"));
    const f = fetchMock({ fdaBulk: [fdaHit] });
    const r = await runRecallBatch(f, [...others, food("Some Snack", 999)], { now: NOW });
    // (Some Snack doesn't match; now the real product, last in line)
    const r2 = await runRecallBatch(f, [...others, food("tractor wheel", 999)], { now: NOW });
    expect(r.matches.filter((m) => m.source === "fda")).toHaveLength(0);
    expect(r2.matches.some((m) => m.product_id === "p999" && m.source === "fda" && m.source_id === "F-0001-2027")).toBe(true);
  });

  it("matches via the FDA press-release feed before the enforcement data has it", async () => {
    const f = fetchMock({ fdaBulk: [], rss: PRESS_RSS });
    const r = await runRecallBatch(f, [food("Tractor Wheels Apple Sweet Potato Spinach", 7)], { now: NOW });
    const press = r.matches.filter((m) => m.product_id === "p7" && m.source_id.startsWith("press:"));
    expect(press).toHaveLength(1);
    const row = r.catalogRows.find((c) => c.source_id === press[0].source_id)!;
    expect(row.url).toContain("fda.gov/safety/recalls-market-withdrawals-safety-alerts/once-upon-farm");
    expect(row.recall_date).toBe("2026-10-30");
  });

  it("runs a per-name FDA lookup for EVERY unique product when an API key is set (no 100 cap)", async () => {
    const others = Array.from({ length: 150 }, (_, i) => food(`Other Product ${i}`, i + 1, "Brand"));
    const f = fetchMock({ fdaName: [fdaHit] });
    const r = await runRecallBatch(f, [...others, food("tractor wheel", 999)], { now: NOW, fdaApiKey: "k" });
    const nameCalls = f.mock.calls.map((c) => decodeURIComponent(String(c[0]))).filter((u) => u.includes("product_description:("));
    expect(nameCalls).toHaveLength(151);
    expect(nameCalls.every((u) => u.includes("api_key=k"))).toBe(true);
    expect(r.matches.some((m) => m.product_id === "p999" && m.source === "fda")).toBe(true);
  });

  it("without a key, runs per-name lookups only for products added in the last 48h", async () => {
    const f = fetchMock({ fdaName: [fdaHit] });
    const fresh = { ...food("tractor wheel", 1), created_at: "2026-11-05T09:00:00Z" };
    const r = await runRecallBatch(f, [fresh, food("Other", 2, "Brand")], { now: NOW });
    const nameCalls = f.mock.calls.map((c) => decodeURIComponent(String(c[0]))).filter((u) => u.includes("product_description:("));
    expect(nameCalls).toHaveLength(1);
    expect(r.matches.some((m) => m.product_id === "p1" && m.source === "fda")).toBe(true);
  });

  it("falls back to per-name lookups for every product when the bulk feed is down", async () => {
    const base = fetchMock({ fdaName: [fdaHit] });
    const f = vi.fn(async (url: string) =>
      decodeURIComponent(url).includes("report_date:[")
        ? ({ ok: false, status: 500, json: async () => ({}) } as Response)
        : base(url),
    ) as unknown as typeof fetch;
    const r = await runRecallBatch(f, [food("tractor wheel", 1)], { now: NOW });
    expect(r.matches.some((m) => m.product_id === "p1" && m.source === "fda")).toBe(true);
  });

  it("records one match per product per recall even if several FDA paths find it", async () => {
    const f = fetchMock({ fdaBulk: [fdaHit], fdaName: [fdaHit] });
    const r = await runRecallBatch(f, [food("tractor wheel", 1)], { now: NOW, fdaApiKey: "k" });
    expect(r.matches.filter((m) => m.source_id === "F-0001-2027")).toHaveLength(1);
  });
});

describe("runRecallBatch — press-release product-line matching", () => {
  it("does not match a different product line from the same brand", async () => {
    const f = fetchMock({ fdaBulk: [], rss: PRESS_RSS });
    const r = await runRecallBatch(f, [food("Wild Rumpus Avocado Pouch", 3)], { now: NOW });
    expect(r.matches.filter((m) => m.source_id.startsWith("press:"))).toHaveLength(0);
  });
  it("does not match the same product line from a different brand", async () => {
    const f = fetchMock({ fdaBulk: [], rss: PRESS_RSS });
    const r = await runRecallBatch(f, [food("Tractor Wheels Bars", 4, "Little Farmer")], { now: NOW });
    expect(r.matches.filter((m) => m.source_id.startsWith("press:"))).toHaveLength(0);
  });
});

describe("runRecallBatch — CPSC coverage", () => {
  it("checks every CPSC recall, not just the first 500", async () => {
    const cpsc = Array.from({ length: 900 }, (_, i) => ({
      RecallID: i + 1,
      RecallDate: `20${String(10 + (i % 15)).padStart(2, "0")}-01-01`,
      Title: `Filler Corp Recalls Gadget ${i}`,
      Products: [{ Name: `Gadget ${i}` }],
    }));
    cpsc.push({ RecallID: 5000, RecallDate: "2001-01-01", Title: "Acme Recalls Snuggle Swing", Products: [{ Name: "Snuggle Swing" }] });
    const f = fetchMock({ cpsc });
    const gear: BatchProduct = { id: "g1", user_id: "u1", name: "Snuggle Swing", brand: "Acme", category: null, model: null };
    const r = await runRecallBatch(f, [gear], { now: NOW });
    expect(r.matches).toContainEqual({ user_id: "u1", product_id: "g1", source: "cpsc", source_id: "5000" });
  });
});

describe("openFDA query", () => {
  it("scopes every word to product_description and includes plural forms", () => {
    expect(fdaSearchClause("Once Upon a Farm tractor wheel")).toBe(
      "product_description:(once+onces+upon+upons+farm+farms+tractor+tractors+wheel+wheels)",
    );
  });
  it("still searches a name made only of generic words", () => {
    expect(fdaSearchClause("infant formula")).not.toBeNull();
  });
});

describe("parseFdaPressRss", () => {
  it("parses titles, links, CDATA/HTML descriptions and entities", () => {
    const items = parseFdaPressRss(PRESS_RSS);
    expect(items).toHaveLength(2);
    expect(items[0].title).toMatch(/^Once Upon A Farm Recalls All Lots/);
    expect(items[0].description).toBe("Once Upon a Farm, PBC is voluntarily recalling all lots & flavors.");
  });
});

describe("RecallTokenIndex", () => {
  it("returns exactly what fuzzyMatchProduct would", () => {
    const texts = [FDA_DESC, "Beechwood Trail Mix with Peanuts", "Beech-Nut Oatmeal Pouches", "Pipa Lite car seat", "Nuna Pipa RX"];
    const idx = new RecallTokenIndex(texts, (t) => t);
    for (const q of ["Beech-Nut", "Once Upon a Farm tractor wheel", "Pipa RX", "Pipa", "pouch", "infant formula"]) {
      expect(idx.match(q)).toEqual(texts.filter((t) => fuzzyMatchProduct(q, t)));
    }
  });
});
