// recallSources.ts — fetch + normalize recalls from USDA FSIS, NHTSA,
// Health Canada, and the EU Safety Gate (in addition to the existing
// CPSC/FDA sources in cpscSearch.ts / recallCheck.ts).
//
// IMPORTANT — these four integrations were built against publicly documented
// API shapes (official docs + real sample URLs) but could NOT be live-tested
// from the development sandbox this was built in (the outbound proxy
// returned 403 for every government/open-data domain tried, including ones
// already proven working in production like saferproducts.gov). Field-name
// guesses for USDA FSIS and Health Canada are hedged with a tolerant
// "try several candidate keys" helper; NHTSA and EU Safety Gate field names
// were confirmed against real documentation/URLs. Every fetch function fails
// closed (returns [] and logs a warning) rather than throwing, so a bad or
// changed upstream shape can't take down the other three sources or the
// existing CPSC/FDA sync.
//
// None of these four sources publish UPC/barcode fields for recalled units —
// recalls track manufacture date/lot/serial ranges, not retail barcodes.
import { BABY_KEYWORDS } from "@/lib/cpscSearch";

export type NormalizedRecall = {
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

/** First non-empty string value among the candidate keys, tolerant of unknown exact field names. */
function pick(obj: Record<string, unknown>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim().length > 0) return v.trim();
    if (typeof v === "number") return String(v);
  }
  return null;
}

function isBabyRelevant(text: string): boolean {
  const t = text.toLowerCase();
  return BABY_KEYWORDS.some((kw) => t.includes(kw));
}

async function fetchWithTimeout(url: string, timeoutMs = 12_000, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

// ── USDA FSIS (meat/poultry/egg — relevant to baby food) ────────────────────

export async function fetchUsdaFsisRecalls(): Promise<NormalizedRecall[]> {
  try {
    const res = await fetchWithTimeout("https://www.fsis.usda.gov/fsis/api/recall/v/1");
    if (!res.ok) {
      console.warn(`[recallSources] USDA FSIS returned ${res.status}`);
      return [];
    }
    const data = await res.json();
    const rows: Record<string, unknown>[] = Array.isArray(data) ? data : (data?.results ?? []);
    const out: NormalizedRecall[] = [];
    for (const r of rows) {
      const title = pick(r, "field_title", "title", "field_recall_reason", "name");
      if (!title) continue;
      const summary = pick(r, "field_summary", "summary", "field_recall_reason");
      const company = pick(r, "field_company", "field_establishment", "company", "establishment");
      const blob = [title, summary, company].filter(Boolean).join(" ");
      if (!isBabyRelevant(blob)) continue;

      const sourceId = pick(r, "field_recall_number", "field_id", "id", "field_year") ?? title;
      out.push({
        source: "usda_fsis",
        source_id: sourceId,
        title,
        brand: company,
        product_name: null,
        category: pick(r, "field_processing", "field_risk_level"),
        description: summary,
        hazard: pick(r, "field_recall_reason", "field_hazard"),
        remedy: null,
        url: pick(r, "field_recall_url", "field_alt_url", "url") ?? "https://www.fsis.usda.gov/recalls",
        image_url: null,
        recall_date: pick(r, "field_recall_date", "field_closed_date", "recall_date"),
        model: null,
        affected_date_start: null,
        affected_date_end: null,
        official: true,
      });
    }
    return out;
  } catch (err) {
    console.warn("[recallSources] USDA FSIS fetch failed:", err instanceof Error ? err.message : "unknown");
    return [];
  }
}

// ── NHTSA (car seats as vehicle equipment) ───────────────────────────────────
// Socrata SODA API on the DOT open-data portal — NHTSA's Office of Defects
// Investigation (ODI) recalls dataset. Uses the documented $q full-text
// search param (safe against uncertainty in exact filterable field names)
// rather than a $where clause, then applies our own baby-brand filter.

export async function fetchNhtsaRecalls(): Promise<NormalizedRecall[]> {
  try {
    const url =
      "https://data.transportation.gov/resource/aqh3-3rri.json" +
      "?$q=child%20restraint%20OR%20car%20seat%20OR%20booster%20seat" +
      "&$limit=200&$order=report_received_date%20DESC";
    const res = await fetchWithTimeout(url);
    if (!res.ok) {
      console.warn(`[recallSources] NHTSA returned ${res.status}`);
      return [];
    }
    const rows = (await res.json()) as Record<string, unknown>[];
    if (!Array.isArray(rows)) return [];

    const out: NormalizedRecall[] = [];
    for (const r of rows) {
      const summary = pick(r, "defect_summary", "recall_description", "summary");
      const component = pick(r, "component");
      const manufacturer = pick(r, "manufacturer");
      const title = component ? `${manufacturer ?? "Recall"} — ${component}` : (summary?.slice(0, 120) ?? null);
      if (!title) continue;
      const blob = [title, summary, component, manufacturer].filter(Boolean).join(" ");
      if (!isBabyRelevant(blob) && !/child restraint|car seat|booster/i.test(blob)) continue;

      const campaign = pick(r, "nhtsa_campaign_number", "campaign_number");
      out.push({
        source: "nhtsa",
        source_id: campaign ?? `${manufacturer ?? "nhtsa"}-${title}`,
        title,
        brand: manufacturer,
        product_name: component,
        category: "car_seat",
        description: summary,
        hazard: pick(r, "consequence_summary"),
        remedy: pick(r, "corrective_action"),
        url: campaign
          ? `https://www.nhtsa.gov/recalls?nhtsaId=${encodeURIComponent(campaign)}`
          : "https://www.nhtsa.gov/recalls",
        image_url: null,
        recall_date: pick(r, "report_received_date"),
        model: pick(r, "component"),
        affected_date_start: null,
        affected_date_end: null,
        official: true,
      });
    }
    return out;
  } catch (err) {
    console.warn("[recallSources] NHTSA fetch failed:", err instanceof Error ? err.message : "unknown");
    return [];
  }
}

// ── Health Canada (daily full-database JSON dump, not a query API) ─────────
// Must be filtered client/server-side after download — there is no keyword
// or date-range query param to ask the source to pre-filter for us.

export async function fetchHealthCanadaRecalls(): Promise<NormalizedRecall[]> {
  try {
    const res = await fetchWithTimeout(
      "https://recalls-rappels.canada.ca/sites/default/files/opendata-donneesouvertes/HCRSAMOpenData.json",
      20_000,
    );
    if (!res.ok) {
      console.warn(`[recallSources] Health Canada returned ${res.status}`);
      return [];
    }
    const data = await res.json();
    const rows: Record<string, unknown>[] = Array.isArray(data) ? data : (data?.results ?? data?.records ?? []);
    const out: NormalizedRecall[] = [];
    for (const r of rows) {
      const title = pick(r, "Title_En", "title_en", "Title", "title");
      if (!title) continue;
      const category = pick(r, "Category_En", "category_en", "Category");
      const summary = pick(r, "Summary_En", "summary_en", "Description_En", "description");
      const blob = [title, category, summary].filter(Boolean).join(" ");
      // Health Canada's own "Toys" / "Health and Safety" categories are a
      // useful signal in addition to our keyword list, since translated
      // category names don't always contain an obvious English baby keyword.
      const categoryHint = category ? /toy|child|infant|nursery|baby/i.test(category) : false;
      if (!isBabyRelevant(blob) && !categoryHint) continue;

      const sourceId = pick(r, "RecallID", "recall_id", "NID", "nid") ?? title;
      out.push({
        source: "health_canada",
        source_id: sourceId,
        title,
        brand: pick(r, "Brand_En", "brand_en", "Brand"),
        product_name: pick(r, "Product_En", "product_en"),
        category,
        description: summary,
        hazard: pick(r, "Hazard_En", "hazard_en"),
        remedy: pick(r, "Remedy_En", "remedy_en"),
        url: pick(r, "URL_En", "url_en", "Link") ?? "https://recalls-rappels.canada.ca/en",
        image_url: null,
        recall_date: pick(r, "Date", "PublishDate", "publish_date"),
        model: null,
        affected_date_start: null,
        affected_date_end: null,
        official: true,
      });
    }
    return out;
  } catch (err) {
    console.warn("[recallSources] Health Canada fetch failed:", err instanceof Error ? err.message : "unknown");
    return [];
  }
}

// ── EU Safety Gate (no official EC API — third-party Opendatasoft mirror) ──
// Marked official: false throughout so the UI can label it as a secondary,
// unverified-freshness source.

export async function fetchEuSafetyGateRecalls(): Promise<NormalizedRecall[]> {
  try {
    const url =
      "https://public.opendatasoft.com/api/explore/v2.1/catalog/datasets/healthref-europe-rapex-en/records" +
      "?order_by=alert_date%20DESC&limit=100";
    const res = await fetchWithTimeout(url);
    if (!res.ok) {
      console.warn(`[recallSources] EU Safety Gate mirror returned ${res.status}`);
      return [];
    }
    const data = await res.json();
    const rows: Record<string, unknown>[] = Array.isArray(data?.results) ? data.results : [];
    const out: NormalizedRecall[] = [];
    for (const r of rows) {
      const brand = pick(r, "product_brand");
      const productType = pick(r, "product_type");
      const category = pick(r, "product_category");
      const defect = pick(r, "technical_defect");
      const blob = [brand, productType, category, defect].filter(Boolean).join(" ");
      if (!isBabyRelevant(blob)) continue;

      const title = [brand, productType].filter(Boolean).join(" — ") || productType || "EU Safety Gate alert";
      const sourceId = pick(r, "alert_number", "id") ?? `${brand ?? ""}-${productType ?? ""}-${pick(r, "alert_date") ?? ""}`;
      out.push({
        source: "eu_safety_gate",
        source_id: sourceId,
        title,
        brand,
        product_name: productType,
        category,
        description: defect,
        hazard: pick(r, "risk_type", "alert_group"),
        remedy: pick(r, "measures_description"),
        url: "https://ec.europa.eu/safety-gate-alerts/screen/webReport",
        image_url: null,
        recall_date: pick(r, "alert_date"),
        model: null,
        affected_date_start: null,
        affected_date_end: null,
        official: false,
      });
    }
    return out;
  } catch (err) {
    console.warn("[recallSources] EU Safety Gate fetch failed:", err instanceof Error ? err.message : "unknown");
    return [];
  }
}

export async function fetchAllExtraRecallSources(): Promise<NormalizedRecall[]> {
  const [usda, nhtsa, healthCanada, euSafetyGate] = await Promise.all([
    fetchUsdaFsisRecalls(),
    fetchNhtsaRecalls(),
    fetchHealthCanadaRecalls(),
    fetchEuSafetyGateRecalls(),
  ]);
  return [...usda, ...nhtsa, ...healthCanada, ...euSafetyGate];
}
