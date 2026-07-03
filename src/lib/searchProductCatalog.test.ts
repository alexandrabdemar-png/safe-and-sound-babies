import { describe, it, expect, vi } from "vitest";
import {
  searchProductCatalog,
  mergeSearchResults,
  escapeIlikePattern,
} from "./searchProductCatalog";

function makeSupabaseMock(rowsByColumn: Record<string, unknown[]>) {
  const calls: Array<{ column: string; pattern: string }> = [];
  const supabase = {
    from: () => ({
      select: () => ({
        ilike: async (column: string, pattern: string) => {
          calls.push({ column, pattern });
          return { data: rowsByColumn[column] ?? [], error: null };
        },
      }),
    }),
  };
  return { supabase, calls };
}

function jsonResponse(body: unknown, ok = true): Response {
  return { ok, json: async () => body } as Response;
}

describe("escapeIlikePattern", () => {
  it("escapes % and _ so they're matched literally, not as wildcards", () => {
    expect(escapeIlikePattern("50% off")).toBe("50\\% off");
    expect(escapeIlikePattern("under_5")).toBe("under\\_5");
  });

  it("escapes a literal backslash too, so the escaping itself can't be escaped away", () => {
    expect(escapeIlikePattern("a\\b")).toBe("a\\\\b");
  });

  it("leaves ordinary text untouched", () => {
    expect(escapeIlikePattern("Nuna Pipa")).toBe("Nuna Pipa");
  });
});

describe("mergeSearchResults", () => {
  const catalogHit = {
    barcode: "111",
    name: "Nuna Pipa",
    brand: "Nuna",
    category: "car_seat",
    imageUrl: null,
    source: "openfoodfacts",
  };
  const liveDuplicate = {
    barcode: "111",
    name: "Nuna Pipa (live)",
    brand: "Nuna",
    category: null,
    imageUrl: null,
    source: "upcitemdb",
  };
  const liveUnique = {
    barcode: "222",
    name: "Chicco KeyFit",
    brand: "Chicco",
    category: "car_seat",
    imageUrl: null,
    source: "upcitemdb",
  };

  it("catalog entry wins over a live duplicate with the same barcode", () => {
    const merged = mergeSearchResults([catalogHit], [liveDuplicate, liveUnique]);
    expect(merged).toHaveLength(2);
    expect(merged.find((r) => r.barcode === "111")?.name).toBe("Nuna Pipa");
  });

  it("dedupes barcode-less results by name+brand (case-insensitive)", () => {
    const a = {
      barcode: null,
      name: "Widget",
      brand: "Acme",
      category: null,
      imageUrl: null,
      source: "upcitemdb",
    };
    const b = {
      barcode: null,
      name: "WIDGET",
      brand: "acme",
      category: null,
      imageUrl: null,
      source: "upcitemdb",
    };
    expect(mergeSearchResults([a], [b])).toHaveLength(1);
  });

  it("caps the merged list at 20", () => {
    const many = Array.from({ length: 30 }, (_, i) => ({
      barcode: String(i),
      name: `Product ${i}`,
      brand: null,
      category: null,
      imageUrl: null,
      source: "upcitemdb",
    }));
    expect(mergeSearchResults([], many)).toHaveLength(20);
  });
});

describe("searchProductCatalog orchestration", () => {
  it("returns [] for a too-short query without hitting the network or DB", async () => {
    const { supabase, calls } = makeSupabaseMock({});
    const fetchImpl = vi.fn();
    const result = await searchProductCatalog("a", { supabase, fetchImpl });
    expect(result).toEqual([]);
    expect(calls).toHaveLength(0);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("queries both name and brand columns with the same escaped pattern", async () => {
    const { supabase, calls } = makeSupabaseMock({});
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ items: [] }));
    await searchProductCatalog("50% off", { supabase, fetchImpl });
    expect(calls).toEqual([
      { column: "name", pattern: "%50\\% off%" },
      { column: "brand", pattern: "%50\\% off%" },
    ]);
  });

  it("merges catalog and live UPCitemdb results", async () => {
    const { supabase } = makeSupabaseMock({
      name: [
        {
          barcode: "111",
          name: "Nuna Pipa",
          brand: "Nuna",
          category: "car_seat",
          image_url: null,
          source: "openfoodfacts",
        },
      ],
      brand: [],
    });
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        items: [
          {
            upc: "222",
            title: "Chicco KeyFit",
            brand: "Chicco",
            category: "Car Seats",
            images: [],
          },
        ],
      }),
    );
    const result = await searchProductCatalog("car seat", { supabase, fetchImpl });
    expect(result.map((r) => r.barcode).sort()).toEqual(["111", "222"]);
  });

  it("a failing catalog query doesn't prevent live results from returning", async () => {
    const supabase = {
      from: () => ({
        select: () => ({
          ilike: async () => {
            throw new Error("db down");
          },
        }),
      }),
    };
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ items: [{ upc: "333", title: "Still Works", images: [] }] }),
      );
    const result = await searchProductCatalog("still works", { supabase, fetchImpl });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Still Works");
  });

  it("a failing live search doesn't prevent catalog results from returning", async () => {
    const { supabase } = makeSupabaseMock({
      name: [
        {
          barcode: "444",
          name: "Cached Item",
          brand: null,
          category: null,
          image_url: null,
          source: "manual",
        },
      ],
      brand: [],
    });
    const fetchImpl = vi.fn().mockRejectedValue(new Error("network down"));
    const result = await searchProductCatalog("cached item", { supabase, fetchImpl });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Cached Item");
  });

  it("adversarial: a query designed to look like extra filter syntax is treated as a plain literal string", async () => {
    const { supabase, calls } = makeSupabaseMock({});
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ items: [] }));
    const hostile = 'x"),category.eq.formula,or(name.ilike."%';
    await searchProductCatalog(hostile, { supabase, fetchImpl });
    // Passed through as a single bound .ilike() value on one column at a
    // time (never concatenated into a raw filter-expression string), so
    // there's no OR-clause/column-injection surface here to exploit —
    // confirm the mock received it as an opaque pattern, not parsed apart.
    expect(calls[0].pattern).toContain(hostile.replace(/%/g, "\\%"));
  });
});
