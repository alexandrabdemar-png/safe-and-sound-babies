// Batch (all-products-at-once) recall detection — the logic behind the
// consolidated scheduled-recall-check edge function. This replaces the two
// TanStack Start hooks it retires (check-recalls.ts, check-extra-recalls.ts),
// reusing the same structured-field-only matching rule (fuzzyMatchProduct
// from recallMatch.ts) so this pipeline doesn't regress the sibling-product
// false-positive fix that logic already has.
//
// Deliberately DB-agnostic: returns catalog rows to upsert and match keys
// (source + source_id, not a resolved DB id) — the Deno entrypoint upserts
// the catalog rows, maps source_id -> uuid, then resolves these matches
// against that map. This split is what makes the matching logic itself
// testable under Vitest without a live Supabase connection.
import { fuzzyMatchProduct } from "./recallMatch.ts";
import { fetchAllExtraRecallSources, type NormalizedRecall } from "./allRecallSources.ts";

export type BatchProduct = {
  id: string;
  user_id: string;
  name: string;
  brand: string | null;
  category: string | null;
  model: string | null;
};

export type RecallCatalogRow = {
  source: string;
  source_id: string;
  title: string;
  brand: string | null;
  product_name: string | null;
  category: string | null;
  description: string | null;
  hazard: string | null;
  remedy: string | null;
  url: string | null;
  image_url: string | null;
  recall_date: string | null;
  model: string | null;
  affected_date_start: string | null;
  affected_date_end: string | null;
  official: boolean;
};

export type RecallMatch = {
  user_id: string;
  product_id: string;
  source: string;
  source_id: string;
};

function productDisplayName(p: BatchProduct): string {
  return [p.name, p.brand ?? ""].filter(Boolean).join(" ");
}

// ── Critical recalls — manually curated, no network, instant ───────────────
// Copy of src/lib/recallCheck.ts's CRITICAL_RECALLS. Keep in sync manually;
// this list is for recalls that may not reliably surface via CPSC/FDA
// keyword search or that fall outside those feeds' retention windows.
export type CriticalRecall = {
  id: string;
  title: string;
  keywords: string[];
  reason: string;
  url: string;
  date: string;
};

export const CRITICAL_RECALLS: CriticalRecall[] = [
  {
    id: "nara-organics-infant-formula-2024",
    title: "Nara Organics Recalls All Lots of Nara Infant Formula",
    keywords: ["nara", "nara organics", "nara formula", "nara infant"],
    reason:
      "All lots of Nara infant formula have been recalled due to a possible health risk — stop using immediately and do not feed to your baby.",
    url: "https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts/nara-organics-recalls-all-lots-nara-infant-formula-because-possible-health-risk",
    date: "2024",
  },
];

export function matchCriticalRecall(product: BatchProduct): CriticalRecall | null {
  const name = productDisplayName(product).toLowerCase();
  for (const critical of CRITICAL_RECALLS) {
    if (critical.keywords.some((kw) => name.includes(kw.toLowerCase()))) return critical;
  }
  return null;
}

export function criticalRecallToCatalogRow(c: CriticalRecall): RecallCatalogRow {
  return {
    source: "critical",
    source_id: c.id,
    title: c.title,
    brand: null,
    product_name: null,
    category: null,
    description: c.reason,
    hazard: null,
    remedy: null,
    url: c.url,
    image_url: null,
    recall_date: null,
    model: null,
    affected_date_start: null,
    affected_date_end: null,
    official: true,
  };
}

// ── CPSC (bulk fetch, all-products matching) ────────────────────────────────

export type CpscRawRecall = {
  RecallID?: number | string;
  RecallNumber?: string;
  Title?: string;
  RecallHeading?: string;
  URL?: string;
  RecallDate?: string;
  Description?: string;
  Products?: Array<{ Name?: string; Model?: string; Type?: string }>;
  Manufacturers?: Array<{ Name?: string }>;
  Hazards?: Array<{ Name?: string }>;
  Remedies?: Array<{ Name?: string }>;
  Images?: Array<{ URL?: string }>;
};

export async function fetchCpscBulkRecalls(fetchImpl: typeof fetch): Promise<CpscRawRecall[]> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const url = `https://www.saferproducts.gov/RestWebServices/Recall?format=json&DateRecalledEnd=${today}`;
    const res = await fetchImpl(url, { headers: { Accept: "application/json" } });
    if (!res.ok) {
      console.warn(`[recallBatch] CPSC returned ${res.status}`);
      return [];
    }
    const data = (await res.json()) as CpscRawRecall[];
    if (!Array.isArray(data)) return [];
    return data.filter((r) => r.RecallID && (r.Title || r.RecallHeading)).slice(0, 500);
  } catch (err) {
    console.warn(
      "[recallBatch] CPSC fetch failed:",
      err instanceof Error ? err.message : "unknown",
    );
    return [];
  }
}

export function cpscRecallSourceId(r: CpscRawRecall): string {
  return String(r.RecallID ?? r.RecallNumber ?? "");
}

export function cpscRecallToCatalogRow(r: CpscRawRecall): RecallCatalogRow {
  return {
    source: "cpsc",
    source_id: cpscRecallSourceId(r),
    title: (r.Title ?? r.RecallHeading ?? "").slice(0, 500),
    brand: r.Manufacturers?.[0]?.Name?.slice(0, 200) ?? null,
    product_name: r.Products?.[0]?.Name?.slice(0, 300) ?? null,
    category: r.Products?.[0]?.Type?.slice(0, 100) ?? null,
    description: r.Description?.slice(0, 2000) ?? null,
    hazard:
      r.Hazards?.map((h) => h.Name)
        .filter(Boolean)
        .join("; ")
        .slice(0, 1000) || null,
    remedy:
      r.Remedies?.map((h) => h.Name)
        .filter(Boolean)
        .join("; ")
        .slice(0, 1000) || null,
    url: r.URL ?? null,
    image_url: r.Images?.[0]?.URL ?? null,
    recall_date: r.RecallDate ? r.RecallDate.slice(0, 10) : null,
    model: r.Products?.[0]?.Model?.slice(0, 200) ?? null,
    affected_date_start: null,
    affected_date_end: null,
    official: true,
  };
}

/**
 * Structured-field-only match (Title/Products.Name+Model+Type/Manufacturers)
 * — deliberately excludes the free-text Description field, since recall
 * notices routinely name sibling products only to say they're NOT affected.
 */
export function matchProductAgainstCpsc(product: BatchProduct, recall: CpscRawRecall): boolean {
  const recallText = [
    recall.Title ?? recall.RecallHeading ?? "",
    ...(recall.Products ?? []).flatMap((p) => [p.Name ?? "", p.Model ?? "", p.Type ?? ""]),
    ...(recall.Manufacturers ?? []).map((m) => m.Name ?? ""),
  ].join(" ");
  return fuzzyMatchProduct(productDisplayName(product), recallText);
}

// ── FDA (per unique product name, capped) ───────────────────────────────────

export type FdaRawRecall = {
  recall_number?: string;
  product_description?: string;
  reason_for_recall?: string;
  recall_initiation_date?: string;
};

export async function fetchFdaRecallsForName(
  fetchImpl: typeof fetch,
  productName: string,
): Promise<FdaRawRecall[]> {
  try {
    const enc = encodeURIComponent(productName);
    const res = await fetchImpl(
      `https://api.fda.gov/food/enforcement.json?search=product_description:${enc}&limit=5`,
    );
    if (!res.ok) return [];
    const data = await res.json().catch(() => null);
    return Array.isArray(data?.results) ? data.results : [];
  } catch {
    return [];
  }
}

export function fdaRecallSourceId(r: FdaRawRecall, productName: string): string {
  return r.recall_number ?? `fda-${productName.slice(0, 20)}`;
}

export function fdaRecallToCatalogRow(r: FdaRawRecall): RecallCatalogRow {
  return {
    source: "fda",
    source_id: r.recall_number ?? `fda-${(r.product_description ?? "").slice(0, 20)}`,
    title: (r.product_description ?? "FDA Food Recall").slice(0, 500),
    brand: null,
    product_name: r.product_description?.slice(0, 300) ?? null,
    category: null,
    description: r.reason_for_recall?.slice(0, 2000) ?? null,
    hazard: null,
    remedy: null,
    url: "https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts",
    image_url: null,
    recall_date: r.recall_initiation_date?.slice(0, 10) ?? null,
    model: null,
    affected_date_start: null,
    affected_date_end: null,
    official: true,
  };
}

export function matchProductAgainstFda(productName: string, r: FdaRawRecall): boolean {
  // product_description is FDA's structured product identifier;
  // reason_for_recall is free-text narrative — same exclusion reasoning as CPSC.
  return fuzzyMatchProduct(productName, r.product_description ?? "");
}

function extraRecallToCatalogRow(r: NormalizedRecall): RecallCatalogRow {
  return {
    source: r.source,
    source_id: r.source_id.slice(0, 300),
    title: r.title.slice(0, 500),
    brand: r.brand?.slice(0, 200) ?? null,
    product_name: r.product_name?.slice(0, 300) ?? null,
    category: r.category?.slice(0, 100) ?? null,
    description: r.description?.slice(0, 2000) ?? null,
    hazard: r.hazard?.slice(0, 1000) ?? null,
    remedy: r.remedy?.slice(0, 1000) ?? null,
    url: r.url,
    image_url: r.image_url,
    recall_date: r.recall_date,
    model: r.model?.slice(0, 200) ?? null,
    affected_date_start: r.affected_date_start,
    affected_date_end: r.affected_date_end,
    official: r.official,
  };
}

function matchProductAgainstExtra(product: BatchProduct, recall: NormalizedRecall): boolean {
  const recallText = [recall.title, recall.brand, recall.product_name, recall.model]
    .filter(Boolean)
    .join(" ");
  return fuzzyMatchProduct(
    [product.name, product.brand ?? "", product.model ?? ""].filter(Boolean).join(" "),
    recallText,
  );
}

// ── Orchestration ────────────────────────────────────────────────────────

export type RecallBatchResult = {
  catalogRows: RecallCatalogRow[];
  matches: RecallMatch[];
  fetchCounts: Record<string, number>;
};

/**
 * Runs every source, matches every product against every source, and
 * returns normalized catalog rows (for the caller to upsert into `recalls`)
 * plus match keys (source + source_id — the caller resolves these to a
 * recall_id after upserting, then upserts into `product_recalls`).
 *
 * FDA is queried once per unique product name (capped at 100 names) rather
 * than once per product, mirroring the pre-existing check-recalls.ts
 * behavior this replaces.
 */
export async function runRecallBatch(
  fetchImpl: typeof fetch,
  products: BatchProduct[],
): Promise<RecallBatchResult> {
  const [cpscRecalls, extraRecalls] = await Promise.all([
    fetchCpscBulkRecalls(fetchImpl),
    fetchAllExtraRecallSources(fetchImpl),
  ]);

  const catalogRows: RecallCatalogRow[] = [];
  const matches: RecallMatch[] = [];
  const seenCatalogKeys = new Set<string>();
  function addCatalogRow(row: RecallCatalogRow) {
    const key = `${row.source}:${row.source_id}`;
    if (seenCatalogKeys.has(key)) return;
    seenCatalogKeys.add(key);
    catalogRows.push(row);
  }

  for (const product of products) {
    // 1. Critical recalls
    const critical = matchCriticalRecall(product);
    if (critical) {
      addCatalogRow(criticalRecallToCatalogRow(critical));
      matches.push({
        user_id: product.user_id,
        product_id: product.id,
        source: "critical",
        source_id: critical.id,
      });
    }

    // 2. CPSC
    for (const recall of cpscRecalls) {
      if (!matchProductAgainstCpsc(product, recall)) continue;
      addCatalogRow(cpscRecallToCatalogRow(recall));
      matches.push({
        user_id: product.user_id,
        product_id: product.id,
        source: "cpsc",
        source_id: cpscRecallSourceId(recall),
      });
    }

    // 3. Extra sources (USDA/NHTSA/Health Canada/EU Safety Gate)
    for (const recall of extraRecalls) {
      if (!matchProductAgainstExtra(product, recall)) continue;
      addCatalogRow(extraRecallToCatalogRow(recall));
      matches.push({
        user_id: product.user_id,
        product_id: product.id,
        source: recall.source,
        source_id: recall.source_id.slice(0, 300),
      });
    }
  }

  // 4. FDA — once per unique product name (capped), then linked to every
  // product sharing that name.
  const uniqueNames = [...new Set(products.map((p) => p.name))].slice(0, 100);
  const productsByName = new Map<string, BatchProduct[]>();
  for (const p of products) {
    const arr = productsByName.get(p.name) ?? [];
    arr.push(p);
    productsByName.set(p.name, arr);
  }
  for (const name of uniqueNames) {
    const fdaHits = await fetchFdaRecallsForName(fetchImpl, name);
    for (const hit of fdaHits) {
      if (!matchProductAgainstFda(name, hit)) continue;
      const row = fdaRecallToCatalogRow(hit);
      addCatalogRow(row);
      for (const product of productsByName.get(name) ?? []) {
        matches.push({
          user_id: product.user_id,
          product_id: product.id,
          source: "fda",
          source_id: row.source_id,
        });
      }
    }
  }

  return {
    catalogRows,
    matches,
    fetchCounts: {
      cpsc: cpscRecalls.length,
      extra: extraRecalls.length,
    },
  };
}
