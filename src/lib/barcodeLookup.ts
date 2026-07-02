// Multi-source barcode lookup so the scanner works beyond food items.
// Order: Open Food Facts → Open Products Facts → Open Beauty Facts → UPCitemdb trial.
// All endpoints are free / no-key (UPCitemdb trial is rate-limited but public).

export type BarcodeLookupResult = {
  product_name?: string;
  generic_name?: string;
  brands?: string;
  categories?: string;
  categories_tags?: string[];
  image_front_small_url?: string;
  source: "openfoodfacts" | "openproductsfacts" | "openbeautyfacts" | "upcitemdb";
};

async function tryOpenFacts(
  host: string,
  code: string,
  source: BarcodeLookupResult["source"],
): Promise<BarcodeLookupResult | null> {
  try {
    const res = await fetch(`https://${host}/api/v2/product/${encodeURIComponent(code)}.json`);
    if (!res.ok) return null;
    const json = await res.json();
    if (json.status !== 1 || !json.product) return null;
    const p = json.product;
    if (!p.product_name && !p.generic_name && !p.brands) return null;
    return {
      product_name: p.product_name,
      generic_name: p.generic_name,
      brands: p.brands,
      categories: p.categories,
      categories_tags: p.categories_tags,
      image_front_small_url: p.image_front_small_url,
      source,
    };
  } catch {
    return null;
  }
}

async function tryUpcItemDb(code: string): Promise<BarcodeLookupResult | null> {
  try {
    const res = await fetch(
      `https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(code)}`,
    );
    if (!res.ok) return null;
    const json = await res.json();
    const item = Array.isArray(json.items) ? json.items[0] : null;
    if (!item) return null;
    return {
      product_name: item.title,
      brands: item.brand,
      categories: item.category,
      categories_tags: item.category
        ? String(item.category).split(/[>,/]/).map((s: string) => s.trim().toLowerCase()).filter(Boolean)
        : [],
      image_front_small_url: Array.isArray(item.images) ? item.images[0] : undefined,
      source: "upcitemdb",
    };
  } catch {
    return null;
  }
}

export async function lookupBarcode(code: string): Promise<BarcodeLookupResult | null> {
  const clean = code.trim();
  if (!clean) return null;
  return (
    (await tryOpenFacts("world.openfoodfacts.org", clean, "openfoodfacts")) ??
    (await tryOpenFacts("world.openproductsfacts.org", clean, "openproductsfacts")) ??
    (await tryOpenFacts("world.openbeautyfacts.org", clean, "openbeautyfacts")) ??
    (await tryUpcItemDb(clean))
  );
}
