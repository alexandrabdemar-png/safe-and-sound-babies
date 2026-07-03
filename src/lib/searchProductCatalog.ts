// Product search — separate from barcode scanning. Searches the shared
// product_catalog cache by name/brand, plus a live call to UPCitemdb's own
// search-by-keyword endpoint (the one configured free source whose API
// actually supports text search rather than only barcode lookup), and
// merges the two into one result list.

export type CatalogSearchResult = {
  barcode: string | null;
  name: string;
  brand: string | null;
  category: string | null;
  imageUrl: string | null;
  source: string;
};

// Minimal shape of what we need from the supabase-js client, so this stays
// unit-testable with a hand-rolled mock instead of a real Supabase client.
// (The real client's builder is thenable but not a plain Promise — `await`
// works on it either way, so a plain Promise-returning function still
// structurally satisfies call sites that just `await` the result.)
type SupabaseLike = {
  from: (table: string) => {
    select: (columns: string) => {
      ilike: (
        column: string,
        pattern: string,
      ) => PromiseLike<{ data: unknown[] | null; error: unknown }>;
    };
  };
};

// Escapes ILIKE wildcard metacharacters so a query containing a literal "%"
// or "_" (e.g. searching for "50% off" or "under_5") is matched literally
// rather than being interpreted as a Postgres LIKE wildcard.
export function escapeIlikePattern(query: string): string {
  return query.replace(/[\\%_]/g, (c) => `\\${c}`);
}

async function searchCatalogTable(
  supabase: SupabaseLike,
  query: string,
): Promise<CatalogSearchResult[]> {
  const pattern = `%${escapeIlikePattern(query)}%`;
  // Two separate single-column .ilike() calls (not a hand-built .or() filter
  // string) — .or() takes a raw PostgREST filter expression that user input
  // would be interpolated into, which is unnecessary filter-syntax injection
  // surface for something a plain parameterized column filter already covers.
  const [nameRes, brandRes] = await Promise.all([
    supabase
      .from("product_catalog")
      .select("barcode, name, brand, category, image_url, source")
      .ilike("name", pattern),
    supabase
      .from("product_catalog")
      .select("barcode, name, brand, category, image_url, source")
      .ilike("brand", pattern),
  ]);
  const rows = [...(nameRes.data ?? []), ...(brandRes.data ?? [])] as Array<{
    barcode: string;
    name: string | null;
    brand: string | null;
    category: string | null;
    image_url: string | null;
    source: string;
  }>;
  return rows
    .filter((r) => r.name)
    .map((r) => ({
      barcode: r.barcode,
      name: r.name as string,
      brand: r.brand,
      category: r.category,
      imageUrl: r.image_url,
      source: r.source,
    }));
}

async function searchUpcItemDbLive(
  query: string,
  fetchImpl: typeof fetch,
): Promise<CatalogSearchResult[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetchImpl(
        `https://api.upcitemdb.com/prod/trial/search?s=${encodeURIComponent(query)}`,
        {
          signal: controller.signal,
        },
      );
      if (!res.ok) return [];
      const json = (await res.json()) as { items?: Array<Record<string, unknown>> };
      const items = Array.isArray(json.items) ? json.items : [];
      return items
        .filter((item) => typeof item.title === "string" && item.title)
        .slice(0, 15)
        .map((item) => ({
          barcode: typeof item.upc === "string" ? item.upc : null,
          name: item.title as string,
          brand: typeof item.brand === "string" ? item.brand : null,
          category: typeof item.category === "string" ? item.category : null,
          imageUrl:
            Array.isArray(item.images) && typeof item.images[0] === "string"
              ? (item.images[0] as string)
              : null,
          source: "upcitemdb",
        }));
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    return [];
  }
}

/**
 * Merges catalog + live results, deduping by barcode (catalog/cached
 * entries win over a live duplicate, since the cached one may already carry
 * a curated is_baby_product/category from a fuller lookup), then by
 * name+brand for barcode-less rows. Caps the combined list at 20.
 */
export function mergeSearchResults(
  catalogResults: CatalogSearchResult[],
  liveResults: CatalogSearchResult[],
): CatalogSearchResult[] {
  const seenBarcodes = new Set<string>();
  const seenNameBrand = new Set<string>();
  const merged: CatalogSearchResult[] = [];

  for (const r of [...catalogResults, ...liveResults]) {
    const key = r.barcode
      ? `b:${r.barcode}`
      : `nb:${r.name.toLowerCase()}|${(r.brand ?? "").toLowerCase()}`;
    if (r.barcode) {
      if (seenBarcodes.has(r.barcode)) continue;
      seenBarcodes.add(r.barcode);
    } else {
      if (seenNameBrand.has(key)) continue;
      seenNameBrand.add(key);
    }
    merged.push(r);
    if (merged.length >= 20) break;
  }
  return merged;
}

export async function searchProductCatalog(
  query: string,
  deps: { supabase: SupabaseLike; fetchImpl: typeof fetch },
): Promise<CatalogSearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const [catalogResults, liveResults] = await Promise.all([
    searchCatalogTable(deps.supabase, trimmed).catch(() => []),
    searchUpcItemDbLive(trimmed, deps.fetchImpl),
  ]);
  return mergeSearchResults(catalogResults, liveResults);
}
