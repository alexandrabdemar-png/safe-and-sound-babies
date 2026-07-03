import { describe, it, expect, vi } from "vitest";
import {
  firstValid,
  lookupProduct,
  fetchOpenFoodFacts,
  fetchOpenBeautyFacts,
  fetchUpcItemDb,
  fetchGoUpc,
  fetchBarcodeLookup,
  fetchBarcodeSpider,
  buildManualCatalogEntry,
} from "./lookupProduct";

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

function delayed<T>(value: T, ms: number): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

describe("firstValid", () => {
  it("resolves with the first non-null value even if it's not index 0", async () => {
    const result = await firstValid([
      delayed(null, 30),
      delayed("winner", 5),
      delayed("loser (arrives later)", 50),
    ]);
    expect(result).toBe("winner");
  });

  it("resolves null once every promise has settled to null", async () => {
    const result = await firstValid([delayed(null, 5), delayed(null, 15), delayed(null, 1)]);
    expect(result).toBeNull();
  });

  it("resolves null with an empty input array", async () => {
    expect(await firstValid([])).toBeNull();
  });

  it("ignores rejected promises rather than throwing, and still resolves the winner", async () => {
    const result = await firstValid([
      Promise.reject(new Error("network error")),
      delayed("winner", 5),
    ]);
    expect(result).toBe("winner");
  });

  it("resolves null when every promise rejects", async () => {
    const result = await firstValid([
      Promise.reject(new Error("a")),
      Promise.reject(new Error("b")),
    ]);
    expect(result).toBeNull();
  });

  it("a slower valid value arriving after resolution does not override the winner", async () => {
    // Regression guard for the `settled` flag: without it, the promise
    // itself only resolves once, but a naive implementation could still
    // call resolve() a second time silently (a no-op in real Promises, but
    // worth locking down explicitly since a subtly different implementation
    // — e.g. one using an external mutable result variable — could get this
    // wrong and return the wrong winner to an *awaiting* caller downstream).
    const order: string[] = [];
    const p = firstValid([
      delayed("fast", 5).then((v) => {
        order.push("fast settled");
        return v;
      }),
      delayed("slow", 40).then((v) => {
        order.push("slow settled");
        return v;
      }),
    ]);
    const result = await p;
    await delayed(null, 60); // let the slow one settle too
    expect(result).toBe("fast");
    expect(order[0]).toBe("fast settled");
  });
});

describe("individual source parsers", () => {
  it("fetchOpenFoodFacts parses a valid match", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        status: 1,
        product: {
          product_name: "Bobbie Organic Infant Formula",
          brands: "Bobbie",
          categories: "Baby formula, Infant formula",
          categories_tags: ["en:baby-foods", "en:infant-formulas"],
          image_front_small_url: "https://example.com/img.jpg",
        },
      }),
    );
    const result = await fetchOpenFoodFacts("012345678905", fetchImpl)();
    expect(result).toMatchObject({
      name: "Bobbie Organic Infant Formula",
      brand: "Bobbie",
      source: "openfoodfacts",
      isBabyProduct: true,
    });
  });

  it("fetchOpenFoodFacts returns null on status 0 (barcode not found)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ status: 0 }));
    expect(await fetchOpenFoodFacts("000000000000", fetchImpl)()).toBeNull();
  });

  it("fetchOpenFoodFacts returns null on network failure without throwing", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("network down"));
    await expect(fetchOpenFoodFacts("012345678905", fetchImpl)()).resolves.toBeNull();
  });

  it("fetchOpenFoodFacts returns null on non-ok HTTP status", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, false, 500));
    expect(await fetchOpenFoodFacts("012345678905", fetchImpl)()).toBeNull();
  });

  it("fetchOpenBeautyFacts parses a valid match and tags non-baby items correctly", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        status: 1,
        product: {
          product_name: "Facial Moisturizer",
          brands: "Cetaphil",
          categories: "Skin care",
        },
      }),
    );
    const result = await fetchOpenBeautyFacts("111111111111", fetchImpl)();
    expect(result).toMatchObject({ name: "Facial Moisturizer", isBabyProduct: false });
  });

  it("fetchOpenBeautyFacts tags a baby lotion as a baby product", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        status: 1,
        product: {
          product_name: "Gentle Baby Lotion",
          brands: "Aveeno Baby",
          categories: "Baby care",
        },
      }),
    );
    const result = await fetchOpenBeautyFacts("222222222222", fetchImpl)();
    expect(result?.isBabyProduct).toBe(true);
  });

  it("fetchUpcItemDb parses a valid match", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        items: [
          {
            title: "Graco Pack 'n Play",
            brand: "Graco",
            category: "Baby > Nursery > Play Yards",
            images: ["https://example.com/a.jpg"],
          },
        ],
      }),
    );
    const result = await fetchUpcItemDb("333333333333", fetchImpl)();
    expect(result).toMatchObject({
      name: "Graco Pack 'n Play",
      brand: "Graco",
      source: "upcitemdb",
      isBabyProduct: true,
    });
  });

  it("fetchUpcItemDb returns null when items array is empty", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ items: [] }));
    expect(await fetchUpcItemDb("444444444444", fetchImpl)()).toBeNull();
  });

  it("fetchGoUpc parses a valid match and sends the API key as a bearer token", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        product: {
          name: "Nuna Pipa Car Seat",
          brand: "Nuna",
          category: "Car Seats",
          imageUrl: "https://example.com/nuna.jpg",
        },
      }),
    );
    const result = await fetchGoUpc("555555555555", fetchImpl, "test-key-123")();
    expect(result).toMatchObject({ name: "Nuna Pipa Car Seat", source: "go-upc" });
    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-key-123");
  });

  it("fetchBarcodeLookup tags baby products from the Google taxonomy category field", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        products: [
          {
            title: "Chicco KeyFit 30",
            brand: "Chicco",
            category: "Baby & Toddler > Car Seats",
            images: [],
          },
        ],
      }),
    );
    const result = await fetchBarcodeLookup("666666666666", fetchImpl, "bl-key")();
    expect(result).toMatchObject({
      name: "Chicco KeyFit 30",
      isBabyProduct: true,
      source: "barcode-lookup",
    });
  });

  it("fetchBarcodeLookup does not tag an unrelated product as baby", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        products: [
          {
            title: "Stainless Steel Water Bottle",
            brand: "Hydro Flask",
            category: "Sporting Goods > Hydration",
          },
        ],
      }),
    );
    const result = await fetchBarcodeLookup("777777777777", fetchImpl, "bl-key")();
    expect(result?.isBabyProduct).toBe(false);
  });

  it("fetchBarcodeSpider parses a valid match from item_attributes", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        item_attributes: {
          title: "Baby Bjorn Bouncer",
          brand: "BabyBjorn",
          category: "Baby Gear",
          image: "https://example.com/bjorn.jpg",
        },
      }),
    );
    const result = await fetchBarcodeSpider("888888888888", fetchImpl, "bs-key")();
    expect(result).toMatchObject({
      name: "Baby Bjorn Bouncer",
      source: "barcode-spider",
      isBabyProduct: true,
    });
  });
});

describe("lookupProduct orchestration", () => {
  it("returns the first free source to respond with a valid match, without waiting for the rest", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes("openfoodfacts")) return delayed(jsonResponse({ status: 0 }), 5);
      if (url.includes("openbeautyfacts")) return delayed(jsonResponse({ status: 0 }), 5);
      if (url.includes("upcitemdb")) {
        return delayed(
          jsonResponse({ items: [{ title: "Bobbie Gentle Formula", brand: "Bobbie" }] }),
          5,
        );
      }
      throw new Error(`unexpected url ${url}`);
    });
    const result = await lookupProduct("012345678905", fetchImpl as unknown as typeof fetch, {});
    expect(result).toMatchObject({ name: "Bobbie Gentle Formula", source: "upcitemdb" });
  });

  it("falls back to paid sources only when no free source matches, and only calls configured ones", async () => {
    const calledUrls: string[] = [];
    const fetchImpl = vi.fn(async (url: string) => {
      calledUrls.push(url);
      if (
        url.includes("openfoodfacts") ||
        url.includes("openbeautyfacts") ||
        url.includes("upcitemdb")
      ) {
        return jsonResponse({ status: 0, items: [] });
      }
      if (url.includes("go-upc.com")) {
        return jsonResponse({ product: { name: "Found via Go-UPC" } });
      }
      throw new Error(`unexpected paid-source call: ${url}`);
    });
    const result = await lookupProduct("999999999999", fetchImpl as unknown as typeof fetch, {
      goUpcApiKey: "key-1",
      // barcodeLookupApiKey / barcodeSpiderApiKey intentionally omitted
    });
    expect(result).toMatchObject({ name: "Found via Go-UPC", source: "go-upc" });
    expect(calledUrls.some((u) => u.includes("barcodelookup.com"))).toBe(false);
    expect(calledUrls.some((u) => u.includes("barcodespider.com"))).toBe(false);
  });

  it("does not call any paid source when none are configured", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ status: 0, items: [] }));
    const result = await lookupProduct("000000000001", fetchImpl as unknown as typeof fetch, {});
    expect(result).toBeNull();
    // Only the 3 free sources should have been called.
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("returns null when every free and paid source misses", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ status: 0, items: [], products: [], item_attributes: null, product: null }),
      );
    const result = await lookupProduct("000000000002", fetchImpl as unknown as typeof fetch, {
      goUpcApiKey: "k1",
      barcodeLookupApiKey: "k2",
      barcodeSpiderApiKey: "k3",
    });
    expect(result).toBeNull();
  });

  it("a barcode with no product data anywhere never throws, even under total network failure", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("all networks down"));
    await expect(
      lookupProduct("000000000003", fetchImpl as unknown as typeof fetch, {
        goUpcApiKey: "k1",
        barcodeLookupApiKey: "k2",
        barcodeSpiderApiKey: "k3",
      }),
    ).resolves.toBeNull();
  });
});

describe("buildManualCatalogEntry", () => {
  it("shapes a valid manual submission", () => {
    const entry = buildManualCatalogEntry("012345678905", {
      name: "Bobbie Gentle Formula",
      brand: "Bobbie",
      category: "Baby Formula",
      imageUrl: "https://example.com/photo.jpg",
    });
    expect(entry).toMatchObject({
      barcode: "012345678905",
      name: "Bobbie Gentle Formula",
      brand: "Bobbie",
      source: "manual",
      isBabyProduct: true,
    });
  });

  it("trims whitespace and drops empty optional fields to null", () => {
    const entry = buildManualCatalogEntry("111111111111", { name: "  Widget  ", brand: "  " });
    expect(entry).toMatchObject({ name: "Widget", brand: null, category: null, imageUrl: null });
  });

  it("returns null when name is missing or blank", () => {
    expect(buildManualCatalogEntry("111111111111", { name: "" })).toBeNull();
    expect(buildManualCatalogEntry("111111111111", { name: "   " })).toBeNull();
  });

  it("adversarial: rejects an absurdly long name (bad paste / abuse attempt, not a real product)", () => {
    const entry = buildManualCatalogEntry("111111111111", { name: "x".repeat(500) });
    expect(entry).toBeNull();
  });

  it("adversarial: rejects an absurdly long brand even with a valid name", () => {
    const entry = buildManualCatalogEntry("111111111111", {
      name: "Widget",
      brand: "x".repeat(500),
    });
    expect(entry).toBeNull();
  });
});
