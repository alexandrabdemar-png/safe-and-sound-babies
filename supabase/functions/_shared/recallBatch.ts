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
import { fdaSearchClause, fuzzyMatchProduct, meaningfulWords, RecallTokenIndex } from "./recallMatch.ts";
import {
  fetchAllExtraRecallSources,
  getLastSourceStatus,
  recordSourceHealth,
  type NormalizedRecall,
} from "./allRecallSources.ts";
import { classifyRecallSeverity, type SeverityTier } from "./recallSeverity.ts";
import { computeContentHash, hazardFingerprint } from "./recallFreshness.ts";

export type BatchProduct = {
  id: string;
  user_id: string;
  name: string;
  brand: string | null;
  category: string | null;
  model: string | null;
  // Set for rows mirrored from First Foods (product_type 'food'). Foods are
  // matched on brand + product name only (never name alone — "oat puffs"
  // on its own would match any brand's puffs), and a UPC printed in the
  // recall notice is an exact match on its own.
  product_type?: string | null;
  barcode?: string | null;
  /** When the product row was created — used to give brand-new products a
   *  full-history FDA name lookup even without an FDA API key. */
  created_at?: string | null;
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
  content_hash?: string;
  hazard_fingerprint?: string;
  severity_tier?: SeverityTier;
};

/**
 * Enrich a catalog row with computed severity, content hash and hazard
 * fingerprint. Awaits the async hash but never throws — a hashing failure
 * simply skips the fields, and the batch upsert continues.
 */
export async function enrichCatalogRow(row: RecallCatalogRow): Promise<RecallCatalogRow> {
  const severity_tier = classifyRecallSeverity(row);
  const content_hash = await computeContentHash(row);
  const hazard_fp = hazardFingerprint(row);
  return {
    ...row,
    severity_tier,
    content_hash,
    hazard_fingerprint: hazard_fp,
  };
}

export type RecallMatch = {
  user_id: string;
  product_id: string;
  source: string;
  source_id: string;
};

function productDisplayName(p: BatchProduct): string {
  return [p.name, p.brand ?? ""].filter(Boolean).join(" ");
}

function isFood(p: BatchProduct): boolean {
  return p.product_type === "food";
}

/**
 * True when the product's UPC/EAN appears in the recall text. FDA and USDA
 * notices print UPCs with arbitrary spacing ("UPC 0 15000 07418 6"), so this
 * compares digit runs with separators stripped. A 12-digit UPC-A and its
 * 13-digit EAN form (leading 0) are treated as the same code. Codes shorter
 * than 8 digits are ignored — too short to be a reliable identifier.
 */
export function recallTextHasBarcode(barcode: string | null | undefined, text: string): boolean {
  const code = (barcode ?? "").replace(/\D/g, "");
  if (code.length < 8) return false;
  const variants = new Set([code, code.replace(/^0+/, "")]);
  const runs = text.match(/\d[\d -]{6,20}\d/g) ?? [];
  return runs.some((run) => {
    const digits = run.replace(/\D/g, "");
    const trimmed = digits.replace(/^0+/, "");
    for (const v of variants) {
      if (!v) continue;
      if (digits === v || trimmed === v || digits.includes(v)) return true;
    }
    return false;
  });
}

/**
 * The text the FDA search and match use for a product. Foods use brand +
 * name so a recall has to name the same brand; everything else keeps the
 * long-standing name-only query.
 */
export function fdaQueryFor(p: BatchProduct): string {
  return isFood(p) ? [p.brand ?? "", p.name].filter(Boolean).join(" ").trim() : p.name;
}

// ── Critical recalls — manually curated, no network, instant ───────────────
// Copy of src/lib/recallCheck.ts's CRITICAL_RECALLS. Keep in sync manually;
// this list is for recalls that may not reliably surface via CPSC/FDA
// keyword search or that fall outside those feeds' retention windows.
export type CriticalRecall = {
  id: string;
  title: string;
  keywords: string[];
  /** When set, the product text must ALSO contain one of these (e.g. the
   *  brand), so a generic keyword can't flag another brand's product. */
  requireAny?: string[];
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
  {
    id: "once-upon-a-farm-tractor-wheels-2026",
    title: "Once Upon A Farm Recalls All Lots and Varieties of Tractor Wheels Organic Toddler Soft-Baked Bars Due to Potential Choking Hazard",
    keywords: ["tractor wheel", "tractorwheel"],
    requireAny: ["once upon a farm", "once upon farm", "onceuponafarm"],
    reason:
      "All lots and flavors of Once Upon a Farm Tractor Wheels Organic Toddler Soft-Baked Bars are recalled because they can form a sticky mass that may cause choking — do not open or serve them; return them for a refund or throw them away.",
    url: "https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts/once-upon-farm-recalls-all-lots-and-varieties-tractor-wheels-organic-toddler-soft-baked-bars-due",
    date: "2026-10-30",
  },
];

export function matchCriticalRecall(product: BatchProduct): CriticalRecall | null {
  const name = productDisplayName(product).toLowerCase();
  for (const critical of CRITICAL_RECALLS) {
    if (critical.requireAny && !critical.requireAny.some((kw) => name.includes(kw.toLowerCase())))
      continue;
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
      recordSourceHealth("cpsc", false, `HTTP ${res.status}`);
      return [];
    }
    const data = (await res.json()) as CpscRawRecall[];
    if (!Array.isArray(data)) {
      recordSourceHealth("cpsc", false, "unexpected response shape");
      return [];
    }
    recordSourceHealth("cpsc", true);
    // Every recall, newest first. This used to keep only the first 500 rows
    // of the full CPSC history, so most recalls (often the recent ones,
    // depending on the API's ordering) were never compared to any product.
    return data
      .filter((r) => r.RecallID && (r.Title || r.RecallHeading))
      .sort((a, b) => (b.RecallDate ?? "").localeCompare(a.RecallDate ?? ""));
  } catch (err) {
    console.warn(
      "[recallBatch] CPSC fetch failed:",
      err instanceof Error ? err.message : "unknown",
    );
    recordSourceHealth("cpsc", false, err instanceof Error ? err.message : "unknown");
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
 *
 * Includes the product's own model field in the match text, same as
 * matchProductAgainstExtra already does — this was previously
 * name+brand-only here, an inconsistency with the extra-sources matcher
 * that made CPSC (the highest-volume source) slightly less precise than
 * it could be for products with a distinguishing model number.
 */
function cpscRecallText(recall: CpscRawRecall): string {
  return [
    recall.Title ?? recall.RecallHeading ?? "",
    ...(recall.Products ?? []).flatMap((p) => [p.Name ?? "", p.Model ?? "", p.Type ?? ""]),
    ...(recall.Manufacturers ?? []).map((m) => m.Name ?? ""),
  ].join(" ");
}

function cpscProductText(product: BatchProduct): string {
  return [productDisplayName(product), product.model ?? ""].filter(Boolean).join(" ");
}

export function matchProductAgainstCpsc(product: BatchProduct, recall: CpscRawRecall): boolean {
  return fuzzyMatchProduct(cpscProductText(product), cpscRecallText(recall));
}

// ── FDA ─────────────────────────────────────────────────────────────────────
// Two openFDA lookups, plus the FDA press-release feed further down:
//   * bulk: every food enforcement report from the last FDA_BULK_YEARS
//     years, matched locally against EVERY product (constant API cost no
//     matter how many products there are);
//   * per-name: a full-history search per unique product query — for every
//     product when an FDA API key is configured, otherwise for products added
//     in the last NEW_PRODUCT_HOURS (keyless openFDA allows ~1,000 calls/day).

export type FdaRawRecall = {
  recall_number?: string;
  product_description?: string;
  reason_for_recall?: string;
  recall_initiation_date?: string;
};

export const FDA_BULK_YEARS = 3;
export const NEW_PRODUCT_HOURS = 48;
const FDA_PAGE = 1000;
const FDA_MAX_SKIP = 25000; // openFDA's hard pagination limit

function fdaKeyParam(apiKey?: string | null): string {
  return apiKey ? `&api_key=${encodeURIComponent(apiKey)}` : "";
}

function yyyymmdd(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

/**
 * Every FDA food enforcement report with a report_date in the last
 * FDA_BULK_YEARS years. Returns null when the feed could not be read, so the
 * caller can fall back to per-name lookups for every product.
 */
export async function fetchFdaBulkRecalls(
  fetchImpl: typeof fetch,
  now: Date = new Date(),
  apiKey?: string | null,
): Promise<FdaRawRecall[] | null> {
  const start = new Date(now);
  start.setUTCFullYear(start.getUTCFullYear() - FDA_BULK_YEARS);
  const range = `report_date:[${yyyymmdd(start)}+TO+${yyyymmdd(now)}]`;
  const out: FdaRawRecall[] = [];
  try {
    for (let skip = 0; skip <= FDA_MAX_SKIP; skip += FDA_PAGE) {
      const res = await fetchImpl(
        `https://api.fda.gov/food/enforcement.json?search=${range}&limit=${FDA_PAGE}&skip=${skip}${fdaKeyParam(apiKey)}`,
      );
      if (res.status === 404) break; // no (more) results
      if (!res.ok) {
        recordSourceHealth("fda", false, `bulk HTTP ${res.status}`);
        return out.length ? out : null;
      }
      const data = await res.json().catch(() => null);
      const page: FdaRawRecall[] = Array.isArray(data?.results) ? data.results : [];
      out.push(...page);
      const total = Number(data?.meta?.results?.total ?? 0);
      if (page.length < FDA_PAGE || out.length >= total) break;
    }
    recordSourceHealth("fda", true);
    return out;
  } catch (err) {
    recordSourceHealth("fda", false, err instanceof Error ? err.message : "unknown");
    return out.length ? out : null;
  }
}

export function fdaNameQueryUrl(productName: string, apiKey?: string | null): string | null {
  const clause = fdaSearchClause(productName);
  if (!clause) return null;
  return `https://api.fda.gov/food/enforcement.json?search=${clause}&limit=100${fdaKeyParam(apiKey)}`;
}

export async function fetchFdaRecallsForName(
  fetchImpl: typeof fetch,
  productName: string,
  apiKey?: string | null,
): Promise<FdaRawRecall[]> {
  try {
    const url = fdaNameQueryUrl(productName, apiKey);
    if (!url) return [];
    const res = await fetchImpl(url);
    // openFDA answers 404 when a search simply has no hits — that's a healthy
    // "nothing recalled with this name", not a source failure.
    if (res.status === 404) {
      recordSourceHealth("fda", true);
      return [];
    }
    if (!res.ok) {
      recordSourceHealth("fda", false, `HTTP ${res.status}`);
      return [];
    }
    const data = await res.json().catch(() => null);
    recordSourceHealth("fda", true);
    return Array.isArray(data?.results) ? data.results : [];
  } catch (err) {
    recordSourceHealth("fda", false, err instanceof Error ? err.message : "unknown");
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

// ── FDA press releases (Recalls, Market Withdrawals & Safety Alerts) ────────
// FDA posts a company's recall announcement days to weeks before the recall
// shows up in the openFDA enforcement data (Once Upon a Farm Tractor Wheels:
// announced Oct 30 2026, not in the enforcement feed days later). This RSS
// feed is the fast lane.

export const FDA_PRESS_RSS_URL =
  "https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/recalls/rss.xml";

export type FdaPressRelease = {
  title: string;
  link: string;
  description: string;
  pubDate: string | null;
};

function decodeXml(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseFdaPressRss(xml: string): FdaPressRelease[] {
  const items = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];
  const tag = (item: string, name: string) => {
    const m = item.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}>`, "i"));
    return m ? decodeXml(m[1]) : "";
  };
  return items
    .map((item) => ({
      title: tag(item, "title"),
      link: tag(item, "link"),
      description: tag(item, "description"),
      pubDate: tag(item, "pubDate") || null,
    }))
    .filter((r) => r.title && r.link);
}

export async function fetchFdaPressReleases(fetchImpl: typeof fetch): Promise<FdaPressRelease[]> {
  try {
    const res = await fetchImpl(FDA_PRESS_RSS_URL, {
      headers: { Accept: "application/rss+xml, application/xml, text/xml" },
    });
    if (!res.ok) {
      recordSourceHealth("fda_press", false, `HTTP ${res.status}`);
      return [];
    }
    const items = parseFdaPressRss(await res.text());
    recordSourceHealth("fda_press", true);
    return items;
  } catch (err) {
    recordSourceHealth("fda_press", false, err instanceof Error ? err.message : "unknown");
    return [];
  }
}

export function fdaPressSourceId(r: FdaPressRelease): string {
  const slug = r.link.replace(/[?#].*$/, "").replace(/\/+$/, "").split("/").pop() ?? r.link;
  return `press:${slug}`.slice(0, 300);
}

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

/** The calendar date as FDA published it ("Thu, 30 Oct 2026 20:00:00 EDT" →
 *  2026-10-30), not shifted into UTC. */
export function pressReleaseDate(pubDate: string | null): string | null {
  const m = pubDate?.match(/(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{4})/);
  if (m && MONTHS[m[2].toLowerCase()]) {
    return `${m[3]}-${MONTHS[m[2].toLowerCase()]}-${m[1].padStart(2, "0")}`;
  }
  const d = pubDate ? new Date(pubDate) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : null;
}

function fdaPressToCatalogRow(r: FdaPressRelease): RecallCatalogRow {
  return {
    source: "fda",
    source_id: fdaPressSourceId(r),
    title: r.title.slice(0, 500),
    brand: null,
    product_name: null,
    category: null,
    description: r.description.slice(0, 2000) || null,
    hazard: null,
    remedy: null,
    url: r.link,
    image_url: null,
    recall_date: pressReleaseDate(r.pubDate),
    model: null,
    affected_date_start: null,
    affected_date_end: null,
    official: true,
  };
}

/** The press-release title names the firm and product ("Once Upon A Farm
 *  Recalls All Lots ... of Tractor Wheels ..."); the summary often adds it. */
function fdaPressText(r: FdaPressRelease): string {
  return `${r.title} ${r.description}`;
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
  if (
    isFood(product) &&
    recallTextHasBarcode(
      product.barcode,
      [recall.title, recall.product_name, recall.description].filter(Boolean).join(" "),
    )
  )
    return true;
  const recallText = [recall.title, recall.brand, recall.product_name, recall.model]
    .filter(Boolean)
    .join(" ");
  return fuzzyMatchProduct(
    [product.name, product.brand ?? "", product.model ?? ""].filter(Boolean).join(" "),
    recallText,
  );
}

// ── Orchestration ────────────────────────────────────────────────────────

export type SourceStat = { ok: boolean; error: string | null; records: number };

export type RecallBatchResult = {
  sourceStats: Record<string, SourceStat>;
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
 * Every product is compared with every CPSC recall, every FDA enforcement
 * report from the last FDA_BULK_YEARS years, every current FDA recall press
 * release and the extra sources. FDA name lookups run once per unique query,
 * never capped by count (see the FDA section above for which queries).
 */
export type RecallBatchOptions = {
  /** openFDA API key (FDA_API_KEY secret). With it, every product also gets
   *  a full-history FDA name lookup on every run. */
  fdaApiKey?: string | null;
  now?: Date;
  /** Parallel openFDA name lookups. */
  fdaConcurrency?: number;
};

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

export async function runRecallBatch(
  fetchImpl: typeof fetch,
  products: BatchProduct[],
  options: RecallBatchOptions = {},
): Promise<RecallBatchResult> {
  const now = options.now ?? new Date();
  const fdaApiKey = options.fdaApiKey ?? null;
  const [cpscRecalls, extraRecalls, fdaBulk, pressReleases] = await Promise.all([
    fetchCpscBulkRecalls(fetchImpl),
    fetchAllExtraRecallSources(fetchImpl),
    fetchFdaBulkRecalls(fetchImpl, now, fdaApiKey),
    fetchFdaPressReleases(fetchImpl),
  ]);
  const cpscIndex = new RecallTokenIndex(cpscRecalls, cpscRecallText);
  const fdaBulkIndex = new RecallTokenIndex(fdaBulk ?? [], (r) => r.product_description ?? "");
  const pressIndex = new RecallTokenIndex(pressReleases, fdaPressText);

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

    // 2. CPSC — every product against every CPSC recall
    for (const recall of cpscIndex.match(cpscProductText(product))) {
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

  // 4. FDA. The query is the product name, or brand + name for foods (see
  // fdaQueryFor). Every product is matched against the bulk enforcement
  // window and the press-release feed; per-name lookups add full history.
  const seenMatch = new Set<string>();
  function addFdaMatch(product: BatchProduct, row: RecallCatalogRow) {
    const key = `${product.id}:${row.source_id}`;
    if (seenMatch.has(key)) return;
    seenMatch.add(key);
    addCatalogRow(row);
    matches.push({
      user_id: product.user_id,
      product_id: product.id,
      source: "fda",
      source_id: row.source_id,
    });
  }

  const productsByQuery = new Map<string, BatchProduct[]>();
  for (const p of products) {
    const q = fdaQueryFor(p);
    const arr = productsByQuery.get(q) ?? [];
    arr.push(p);
    productsByQuery.set(q, arr);
  }

  const barcodeFoods = products.filter((p) => isFood(p) && (p.barcode ?? "").replace(/\D/g, "").length >= 8);
  for (const [query, group] of productsByQuery) {
    for (const hit of fdaBulkIndex.match(query)) {
      const row = fdaRecallToCatalogRow(hit);
      for (const product of group) addFdaMatch(product, row);
    }
    for (const release of pressIndex.match(query)) {
      const row = fdaPressToCatalogRow(release);
      for (const product of group) addFdaMatch(product, row);
    }
  }
  // Press-release headlines name the brand and product line, usually not
  // every flavor ("... Recalls All Lots and Varieties of Tractor Wheels ..."),
  // so a food whose saved name adds a flavor would never match in full.
  // For foods: the whole brand plus the first two words of the product name.
  for (const product of products) {
    if (!isFood(product) || !product.brand) continue;
    const lead = meaningfulWords(product.name).slice(0, 2);
    if (!lead.length || !meaningfulWords(product.brand).length) continue;
    for (const release of pressIndex.match(product.brand)) {
      if (fuzzyMatchProduct(lead.join(" "), fdaPressText(release))) {
        addFdaMatch(product, fdaPressToCatalogRow(release));
      }
    }
  }
  for (const product of barcodeFoods) {
    for (const hit of fdaBulk ?? []) {
      if (recallTextHasBarcode(product.barcode, hit.product_description ?? "")) {
        addFdaMatch(product, fdaRecallToCatalogRow(hit));
      }
    }
    for (const release of pressReleases) {
      if (recallTextHasBarcode(product.barcode, fdaPressText(release))) {
        addFdaMatch(product, fdaPressToCatalogRow(release));
      }
    }
  }

  // Per-name, full-history lookups: every unique query when an API key is
  // set or the bulk feed failed; otherwise only queries with a product
  // added in the last NEW_PRODUCT_HOURS. Never capped by count.
  const newCutoff = now.getTime() - NEW_PRODUCT_HOURS * 3600_000;
  const isNew = (p: BatchProduct) => {
    const t = p.created_at ? Date.parse(p.created_at) : NaN;
    return Number.isFinite(t) && t >= newCutoff;
  };
  const lookupAll = Boolean(fdaApiKey) || fdaBulk === null;
  const nameQueries = [...productsByQuery.entries()]
    .filter(([, group]) => lookupAll || group.some(isNew))
    .map(([q]) => q);
  const perName = await mapWithConcurrency(nameQueries, options.fdaConcurrency ?? 4, async (q) => ({
    query: q,
    hits: await fetchFdaRecallsForName(fetchImpl, q, fdaApiKey),
  }));
  for (const { query, hits: fdaHits } of perName) {
    for (const hit of fdaHits) {
      const nameMatch = matchProductAgainstFda(query, hit);
      const group = (productsByQuery.get(query) ?? []).filter(
        (p) =>
          nameMatch ||
          (isFood(p) && recallTextHasBarcode(p.barcode, hit.product_description ?? "")),
      );
      if (!group.length) continue;
      const row = fdaRecallToCatalogRow(hit);
      for (const product of group) addFdaMatch(product, row);
    }
  }

  // Enrich every catalog row with severity, content_hash, and
  // hazard_fingerprint so downstream consumers can (a) key UI on severity
  // tier, (b) re-notify when the material text changes, and (c) dedup the
  // same physical recall appearing in multiple upstream feeds.
  const enrichedCatalogRows = await Promise.all(catalogRows.map(enrichCatalogRow));

  // Per-source health + record counts. Health comes from the fetch layer
  // (HTTP status / network outcome), NOT from "did this source return rows",
  // so a healthy-but-quiet feed is no longer indistinguishable from an outage.
  const health = getLastSourceStatus();
  const extraCounts: Record<string, number> = {};
  for (const r of extraRecalls) extraCounts[r.source] = (extraCounts[r.source] ?? 0) + 1;
  const sourceStats: Record<string, SourceStat> = {};
  for (const source of [
    "cpsc",
    "fda",
    "fda_press",
    "usda_fsis",
    "nhtsa",
    "health_canada",
    "eu_safety_gate",
  ] as const) {
    const h = health[source];
    sourceStats[source] = {
      ok: h ? h.ok : false,
      error: h ? h.error : "source not attempted this run",
      records:
        source === "cpsc"
          ? cpscRecalls.length
          : source === "fda"
            ? (fdaBulk?.length ?? 0)
            : source === "fda_press"
              ? pressReleases.length
              : (extraCounts[source] ?? 0),
    };
  }

  return {
    sourceStats,
    catalogRows: enrichedCatalogRows,
    matches,
    fetchCounts: {
      cpsc: cpscRecalls.length,
      extra: extraRecalls.length,
      fda_bulk: fdaBulk?.length ?? 0,
      fda_press: pressReleases.length,
    },
  };
}
