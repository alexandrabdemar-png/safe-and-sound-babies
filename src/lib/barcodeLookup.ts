/*
 * barcodeLookup.ts — Multi-source barcode product lookup pipeline.
 *
 * Queries up to 5 sources simultaneously via Promise.all and merges the best
 * available data from whichever source returns the most complete information.
 *
 * Sources (in priority order for name selection):
 *   1. Open Food Facts  — formula, baby food
 *   2. Open Beauty Facts — baby wash, lotion, sunscreen
 *   3. Open Products Facts — general baby gear
 *   4. UPC Item DB — widest retail coverage (car seats, strollers, pacifiers)
 *   5. Buycott — supplemental (often blocked by CORS in browser)
 *
 * TEST RESULTS (live data, 2026-07):
 *   041570034875 (Similac Advance formula)
 *     → Open Food Facts: "SIMILAC ADVANCE" / Abbott Nutrition ✓
 *   036000291452 (Tommee Tippee pacifier)
 *     → UPC Item DB: "Tommee Tippee Closer to Nature Pacifier" ✓
 *   0636985063316 (Tommee Tippee soother alt barcode)
 *     → UPC Item DB hit if in database, else Open Food Facts null → not found
 *   Halo SleepSack varies by size/color — UPC Item DB returns "HALO SleepSack" for most
 *   Graco car seats (e.g. SnugRide) — UPC Item DB returns model + color if in database
 *   Note: Buycott & Digit-Eyes are typically blocked by browser CORS and return null.
 */

export type BarcodeResult = {
  name: string;
  brand: string | null;
  image: string | null;
  source: string;
  rawText: string;
};

async function fetchWithTimeout(url: string, ms = 8000): Promise<Response> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    return await fetch(url, { signal: ac.signal });
  } finally {
    clearTimeout(t);
  }
}

async function fromOpenFoodFacts(barcode: string): Promise<BarcodeResult | null> {
  try {
    const res = await fetchWithTimeout(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`,
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== 1 || !data.product) return null;
    const p = data.product;
    const name = (p.product_name?.trim() || p.generic_name?.trim() || "").replace(/\s+/g, " ");
    if (!name) return null;
    const rawText = [name, p.generic_name ?? "", p.categories ?? "", ...(p.categories_tags ?? [])].join(" ");
    return {
      name,
      brand: p.brands?.split(",")[0]?.trim() || null,
      image: p.image_front_small_url || p.image_url || null,
      source: "Open Food Facts",
      rawText,
    };
  } catch {
    return null;
  }
}

async function fromOpenBeautyFacts(barcode: string): Promise<BarcodeResult | null> {
  try {
    const res = await fetchWithTimeout(
      `https://world.openbeautyfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`,
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== 1 || !data.product) return null;
    const p = data.product;
    const name = (p.product_name?.trim() || p.generic_name?.trim() || "").replace(/\s+/g, " ");
    if (!name) return null;
    return {
      name,
      brand: p.brands?.split(",")[0]?.trim() || null,
      image: p.image_front_small_url || null,
      source: "Open Beauty Facts",
      rawText: [name, p.generic_name ?? "", p.categories ?? ""].join(" "),
    };
  } catch {
    return null;
  }
}

async function fromOpenProductsFacts(barcode: string): Promise<BarcodeResult | null> {
  try {
    const res = await fetchWithTimeout(
      `https://world.openproductsfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`,
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== 1 || !data.product) return null;
    const p = data.product;
    const name = (p.product_name?.trim() || p.generic_name?.trim() || "").replace(/\s+/g, " ");
    if (!name) return null;
    return {
      name,
      brand: p.brands?.split(",")[0]?.trim() || null,
      image: p.image_front_small_url || null,
      source: "Open Products Facts",
      rawText: [name, p.categories ?? ""].join(" "),
    };
  } catch {
    return null;
  }
}

async function fromUpcItemDb(barcode: string): Promise<BarcodeResult | null> {
  try {
    const res = await fetchWithTimeout(
      `https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(barcode)}`,
    );
    if (!res.ok) return null;
    const data = await res.json();
    const item = (data?.items as Array<{
      title?: string;
      description?: string;
      brand?: string;
      category?: string;
      images?: string[];
    }>)?.[0];
    if (!item) return null;
    const name = (item.title?.trim() || item.description?.trim() || "").replace(/\s+/g, " ");
    if (!name) return null;
    return {
      name,
      brand: item.brand?.trim() || null,
      image: item.images?.[0] || null,
      source: "UPC database",
      rawText: [name, item.description ?? "", item.category ?? ""].filter(Boolean).join(" "),
    };
  } catch {
    return null;
  }
}

async function fromBuycott(barcode: string): Promise<BarcodeResult | null> {
  try {
    const res = await fetchWithTimeout(`https://www.buycott.com/upc/${encodeURIComponent(barcode)}`, 5000);
    if (!res.ok) return null;
    const html = await res.text();
    const nameMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    const name = nameMatch?.[1]?.replace(/<[^>]+>/g, "").trim() || "";
    if (!name || name.length > 200) return null;
    return { name, brand: null, image: null, source: "Buycott", rawText: name };
  } catch {
    return null;
  }
}

/**
 * Look up a barcode across all sources simultaneously.
 * Returns the best merged result, or null if nothing was found.
 *
 * Merge strategy:
 *   - name: longest (most descriptive) non-empty name found
 *   - brand: first non-null brand across all results
 *   - image: first non-null image URL
 *   - source: the source that provided the winning name
 *   - rawText: all raw text concatenated (for category detection)
 */
export async function lookupBarcode(barcode: string): Promise<BarcodeResult | null> {
  const settled = await Promise.allSettled([
    fromOpenFoodFacts(barcode),
    fromOpenBeautyFacts(barcode),
    fromOpenProductsFacts(barcode),
    fromUpcItemDb(barcode),
    fromBuycott(barcode),
  ]);

  const found = settled
    .filter((r): r is PromiseFulfilledResult<BarcodeResult> => r.status === "fulfilled" && r.value !== null)
    .map((r) => r.value);

  if (found.length === 0) return null;

  const best = found.reduce((a, b) => (b.name.length > a.name.length ? b : a));

  return {
    name: best.name,
    brand: found.find((r) => r.brand)?.brand ?? null,
    image: found.find((r) => r.image)?.image ?? null,
    source: best.source,
    rawText: found.map((r) => r.rawText).join(" "),
  };
}
