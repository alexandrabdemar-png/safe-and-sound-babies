// Portable orchestration logic for the lookup-product edge function.
//
// Deliberately framework-agnostic (only uses global `fetch`, no Deno-only
// APIs) so it can be:
//   - unit tested under Node/Vitest with a mocked `fetch`
//   - imported as-is by the Deno entrypoint (supabase/functions/lookup-product/index.ts)
//
// Order of operations (per spec):
//   1. Caller checks the product_catalog cache first (not this module's job
//      — that's a plain Supabase select the entrypoint does directly).
//   2. Free sources queried in parallel; first one to resolve with a valid
//      match wins (not "wait for all, then pick by priority").
//   3. Only if no free source matched: paid sources queried in parallel,
//      same first-valid-wins semantics. Each paid source is independently
//      togglable by whether its API key is present in `PaidSourceConfig` —
//      no code change needed to turn one on/off.

export type CatalogSource =
  | "openfoodfacts"
  | "openbeautyfacts"
  | "upcitemdb"
  | "go-upc"
  | "barcode-lookup"
  | "barcode-spider"
  | "manual";

export type LookupResult = {
  barcode: string;
  name: string | null;
  brand: string | null;
  category: string | null;
  isBabyProduct: boolean;
  imageUrl: string | null;
  source: CatalogSource;
  raw: unknown;
};

export type PaidSourceConfig = {
  goUpcApiKey?: string;
  barcodeLookupApiKey?: string;
  barcodeSpiderApiKey?: string;
};

type SourceFn = () => Promise<LookupResult | null>;

// Generic secondary signal used across every source (title/brand/category
// text). The Barcode Lookup API's structured Google-taxonomy category field
// is the primary, higher-confidence signal — see fetchBarcodeLookup below —
// this is just a reasonable baseline for sources that only give free text.
const BABY_KEYWORDS = [
  "baby",
  "infant",
  "toddler",
  "newborn",
  "nursery",
  "diaper",
  "nappy",
  "formula",
  "pacifier",
  "stroller",
  "car seat",
  "crib",
  "bassinet",
  "breast pump",
  "breastmilk",
  "teether",
  "onesie",
  "baby food",
  "bottle warmer",
  "baby wipe",
  "swaddle",
  "bib",
  "high chair",
];

function guessIsBaby(...fields: Array<string | null | undefined>): boolean {
  const text = fields.filter(Boolean).join(" ").toLowerCase();
  return BABY_KEYWORDS.some((kw) => text.includes(kw));
}

/**
 * Resolves as soon as the first non-null result arrives (true parallel
 * race — a fast, low-priority source can win over a slow high-priority
 * one). Resolves null only once every input has settled to null/rejected.
 */
export function firstValid<T>(promises: Promise<T | null>[]): Promise<T | null> {
  return new Promise((resolve) => {
    if (promises.length === 0) {
      resolve(null);
      return;
    }
    let remaining = promises.length;
    let settled = false;
    for (const p of promises) {
      p.then((v) => {
        if (settled) return;
        if (v != null) {
          settled = true;
          resolve(v);
        } else if (--remaining === 0 && !settled) {
          settled = true;
          resolve(null);
        }
      }).catch(() => {
        if (settled) return;
        if (--remaining === 0 && !settled) {
          settled = true;
          resolve(null);
        }
      });
    }
  });
}

async function fetchJson(
  fetchImpl: typeof fetch,
  url: string,
  init?: RequestInit,
): Promise<unknown | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    try {
      const res = await fetchImpl(url, { ...init, signal: controller.signal });
      if (!res.ok) return null;
      return await res.json();
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    return null;
  }
}

// ── Free sources ────────────────────────────────────────────────────────────

export function fetchOpenFoodFacts(barcode: string, fetchImpl: typeof fetch): SourceFn {
  return async () => {
    const json = (await fetchJson(
      fetchImpl,
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`,
    )) as { status?: number; product?: Record<string, unknown> } | null;
    if (!json || json.status !== 1 || !json.product) return null;
    const p = json.product;
    const name = (p.product_name as string) || (p.generic_name as string) || null;
    const brand = (p.brands as string)?.split(",")[0]?.trim() || null;
    if (!name && !brand) return null;
    const category = (p.categories as string) || null;
    return {
      barcode,
      name,
      brand,
      category,
      isBabyProduct: guessIsBaby(
        name,
        category,
        ...(Array.isArray(p.categories_tags) ? (p.categories_tags as string[]) : []),
      ),
      imageUrl: (p.image_front_small_url as string) || null,
      source: "openfoodfacts",
      raw: p,
    };
  };
}

export function fetchOpenBeautyFacts(barcode: string, fetchImpl: typeof fetch): SourceFn {
  return async () => {
    const json = (await fetchJson(
      fetchImpl,
      `https://world.openbeautyfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`,
    )) as { status?: number; product?: Record<string, unknown> } | null;
    if (!json || json.status !== 1 || !json.product) return null;
    const p = json.product;
    const name = (p.product_name as string) || (p.generic_name as string) || null;
    const brand = (p.brands as string)?.split(",")[0]?.trim() || null;
    if (!name && !brand) return null;
    const category = (p.categories as string) || null;
    return {
      barcode,
      name,
      brand,
      category,
      isBabyProduct: guessIsBaby(name, category),
      imageUrl: (p.image_front_small_url as string) || null,
      source: "openbeautyfacts",
      raw: p,
    };
  };
}

export function fetchUpcItemDb(barcode: string, fetchImpl: typeof fetch): SourceFn {
  return async () => {
    const json = (await fetchJson(
      fetchImpl,
      `https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(barcode)}`,
    )) as { items?: Array<Record<string, unknown>> } | null;
    const item = json?.items?.[0];
    if (!item || (!item.title && !item.brand)) return null;
    const category = (item.category as string) || null;
    return {
      barcode,
      name: (item.title as string) || null,
      brand: (item.brand as string) || null,
      category,
      isBabyProduct: guessIsBaby(item.title as string, category),
      imageUrl: Array.isArray(item.images) ? (item.images[0] as string) : null,
      source: "upcitemdb",
      raw: item,
    };
  };
}

// ── Paid sources (each independently toggled by API-key presence) ─────────

export function fetchGoUpc(barcode: string, fetchImpl: typeof fetch, apiKey: string): SourceFn {
  return async () => {
    const json = (await fetchJson(
      fetchImpl,
      `https://go-upc.com/api/v1/code/${encodeURIComponent(barcode)}`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
      },
    )) as { product?: Record<string, unknown> } | null;
    const p = json?.product;
    if (!p || !p.name) return null;
    const category = (p.category as string) || null;
    return {
      barcode,
      name: (p.name as string) || null,
      brand: (p.brand as string) || null,
      category,
      isBabyProduct: guessIsBaby(p.name as string, category),
      imageUrl: (p.imageUrl as string) || null,
      source: "go-upc",
      raw: p,
    };
  };
}

// Category taxonomy is Google's product taxonomy — a " > "-delimited
// hierarchy (e.g. "Baby & Toddler > Feeding > Bottles"). This is the
// highest-confidence baby-category signal we have, per spec.
export function fetchBarcodeLookup(
  barcode: string,
  fetchImpl: typeof fetch,
  apiKey: string,
): SourceFn {
  return async () => {
    const json = (await fetchJson(
      fetchImpl,
      `https://api.barcodelookup.com/v3/products?barcode=${encodeURIComponent(barcode)}&formatted=y&key=${encodeURIComponent(apiKey)}`,
    )) as { products?: Array<Record<string, unknown>> } | null;
    const p = json?.products?.[0];
    if (!p || !p.title) return null;
    const category = (p.category as string) || null;
    return {
      barcode,
      name: (p.title as string) || null,
      brand: (p.brand as string) || null,
      category,
      isBabyProduct:
        (typeof category === "string" && /\bbaby\b|\btoddler\b|\binfant\b/i.test(category)) ||
        guessIsBaby(p.title as string, category),
      imageUrl: Array.isArray(p.images) ? (p.images[0] as string) : null,
      source: "barcode-lookup",
      raw: p,
    };
  };
}

export function fetchBarcodeSpider(
  barcode: string,
  fetchImpl: typeof fetch,
  apiKey: string,
): SourceFn {
  return async () => {
    const json = (await fetchJson(
      fetchImpl,
      `https://api.barcodespider.com/v1/lookup?token=${encodeURIComponent(apiKey)}&upc=${encodeURIComponent(barcode)}`,
    )) as { item_attributes?: Record<string, unknown> } | null;
    const a = json?.item_attributes;
    if (!a || !a.title) return null;
    const category = (a.category as string) || null;
    return {
      barcode,
      name: (a.title as string) || null,
      brand: (a.brand as string) || null,
      category,
      isBabyProduct: guessIsBaby(a.title as string, category),
      imageUrl: (a.image as string) || null,
      source: "barcode-spider",
      raw: a,
    };
  };
}

export function raceFreeSources(
  barcode: string,
  fetchImpl: typeof fetch,
): Promise<LookupResult | null> {
  return firstValid([
    fetchOpenFoodFacts(barcode, fetchImpl)(),
    fetchOpenBeautyFacts(barcode, fetchImpl)(),
    fetchUpcItemDb(barcode, fetchImpl)(),
  ]);
}

/** Returns [] instead of running anything if no paid source is configured. */
export function racePaidSources(
  barcode: string,
  fetchImpl: typeof fetch,
  paidConfig: PaidSourceConfig,
): Promise<LookupResult | null> {
  const paidSources: SourceFn[] = [];
  if (paidConfig.goUpcApiKey)
    paidSources.push(fetchGoUpc(barcode, fetchImpl, paidConfig.goUpcApiKey));
  if (paidConfig.barcodeLookupApiKey)
    paidSources.push(fetchBarcodeLookup(barcode, fetchImpl, paidConfig.barcodeLookupApiKey));
  if (paidConfig.barcodeSpiderApiKey)
    paidSources.push(fetchBarcodeSpider(barcode, fetchImpl, paidConfig.barcodeSpiderApiKey));
  if (paidSources.length === 0) return Promise.resolve(null);
  return firstValid(paidSources.map((fn) => fn()));
}

export async function lookupProduct(
  barcode: string,
  fetchImpl: typeof fetch,
  paidConfig: PaidSourceConfig,
): Promise<LookupResult | null> {
  const freeResult = await raceFreeSources(barcode, fetchImpl);
  if (freeResult) return freeResult;
  return racePaidSources(barcode, fetchImpl, paidConfig);
}
