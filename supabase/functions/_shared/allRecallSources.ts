// Ported from src/lib/recallSources.ts (copy, not import — see
// recallMatch.ts's header comment for why). Fetches + normalizes recalls
// from USDA FSIS, NHTSA, Health Canada, and the EU Safety Gate.
//
// IMPORTANT — these four integrations were built against publicly documented
// API shapes but could not be live-tested from this development sandbox
// (the outbound proxy returns 403 for every government/open-data domain
// tried). Every fetch function fails closed (returns [] and logs a warning)
// rather than throwing, so a bad or changed upstream shape can't take down
// the other sources or the rest of the batch job.
//
// None of these four sources publish UPC/barcode fields for recalled units —
// recalls track manufacture date/lot/serial ranges, not retail barcodes.
import { BABY_KEYWORDS } from "./babyKeywords.ts";

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

// ── Per-source health, for honest recall_source_status reporting ──────────
// The fetch functions below deliberately fail closed (return []), which makes
// "0 records" ambiguous: it can mean "source is healthy, nothing baby-related
// today" or "source is down". Every failure path records itself here so the
// pipeline can write a truthful last_success_at / last_error per source
// instead of inferring health from the record count.
// USDA FSIS and NHTSA (Socrata) reject requests with no Accept/User-Agent —
// both answered HTTP 403 in production until these headers were sent.
const FEED_HEADERS: Record<string, string> = {
  Accept: "application/json",
  "User-Agent": "PeaceOfMine-RecallMonitor/1.0 (+https://peace-of-mine.lovable.app)",
};

// USDA FSIS (meat/poultry recalls) sits behind Akamai, which blocks this
// backend's whole network range — every request, including the plain web page,
// returns HTTP 403 regardless of headers. Rather than report a permanent
// failure on every run, the source is explicitly disabled and reported as
// such. Coverage impact is small: packaged baby food is covered by the FDA
// food-enforcement feed, and CPSC covers non-food baby products. Re-enable if
// a reachable mirror becomes available.
const USDA_FSIS_ENABLED = false;

export type SourceHealth = { ok: boolean; error: string | null; disabled?: boolean };

const lastStatus: Record<string, SourceHealth> = {};

function markOk(source: string) {
  lastStatus[source] = { ok: true, error: null };
}

function markFailed(source: string, error: string) {
  lastStatus[source] = { ok: false, error: error.slice(0, 500) };
}

function markDisabled(source: string) {
  lastStatus[source] = { ok: true, error: "disabled: upstream blocks this network", disabled: true };
}

/** Lets sibling fetchers (CPSC, FDA — implemented in recallBatch.ts) report
 *  into the same per-source health map. */
export function recordSourceHealth(source: string, ok: boolean, error?: string) {
  if (ok) markOk(source);
  else markFailed(source, error ?? "unknown error");
}

export function getLastSourceStatus(): Record<string, SourceHealth> {
  return { ...lastStatus };
}

/**
 * Fetch with a timeout plus bounded retries. Retries only transient failures
 * (network error / timeout / 5xx / 429), with fixed backoff — never an
 * unbounded retry loop, so a provider outage can't turn into rate-limit abuse.
 */
async function fetchWithTimeout(
  fetchImpl: typeof fetch,
  url: string,
  timeoutMs = 12_000,
  init?: RequestInit,
  source?: string,
): Promise<Response> {
  const BACKOFF_MS = [0, 400, 1_200];
  let lastErr: unknown;
  for (let attempt = 0; attempt < BACKOFF_MS.length; attempt++) {
    if (BACKOFF_MS[attempt] > 0) {
      await new Promise((r) => setTimeout(r, BACKOFF_MS[attempt]));
    }
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchImpl(url, { ...init, signal: controller.signal });
      const transient = res.status === 429 || res.status >= 500;
      if (!transient || attempt === BACKOFF_MS.length - 1) {
        if (source) {
          if (res.ok) markOk(source);
          else markFailed(source, `HTTP ${res.status}`);
        }
        return res;
      }
    } catch (err) {
      lastErr = err;
      if (attempt === BACKOFF_MS.length - 1) {
        if (source) markFailed(source, err instanceof Error ? err.message : "network error");
        throw err;
      }
    } finally {
      clearTimeout(id);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("fetch failed");
}

export async function fetchUsdaFsisRecalls(fetchImpl: typeof fetch): Promise<NormalizedRecall[]> {
  try {
    const res = await fetchWithTimeout(
      fetchImpl,
      "https://www.fsis.usda.gov/fsis/api/recall/v/1",
      12_000,
      { headers: FEED_HEADERS },
      "usda_fsis",
    );
    if (!res.ok) {
      console.warn(`[allRecallSources] USDA FSIS returned ${res.status}`);
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
        url:
          pick(r, "field_recall_url", "field_alt_url", "url") ??
          "https://www.fsis.usda.gov/recalls",
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
    console.warn(
      "[allRecallSources] USDA FSIS fetch failed:",
      err instanceof Error ? err.message : "unknown",
    );
    return [];
  }
}

// Child-restraint recalls live in NHTSA's "Equipment" recall type. Matching on
// the free-text summary alone would pull in ordinary vehicle recalls that merely
// mention a child (e.g. an air-bag suppression defect), so relevance is decided
// from the structured subject/component fields plus the recall type.
const CHILD_SEAT_RE = /child (restraint|seat)|car seat|booster seat|infant carrier|cars?eat/i;

export async function fetchNhtsaRecalls(fetchImpl: typeof fetch): Promise<NormalizedRecall[]> {
  try {
    // Dataset 6axg-epim is NHTSA's current recalls resource; the previously
    // used aqh3-3rri returns HTTP 403 ("non-tabular table").
    const url =
      "https://data.transportation.gov/resource/6axg-epim.json" +
      "?$q=child%20seat&$limit=200&$order=report_received_date%20DESC";
    const res = await fetchWithTimeout(fetchImpl, url, 12_000, { headers: FEED_HEADERS }, "nhtsa");
    if (!res.ok) {
      console.warn(`[allRecallSources] NHTSA returned ${res.status}`);
      return [];
    }
    const rows = (await res.json()) as Record<string, unknown>[];
    if (!Array.isArray(rows)) return [];

    const out: NormalizedRecall[] = [];
    for (const r of rows) {
      const summary = pick(r, "defect_summary", "recall_description", "summary");
      const component = pick(r, "component");
      const manufacturer = pick(r, "manufacturer");
      const subject = pick(r, "subject");
      const recallType = pick(r, "recall_type");
      // A whole-vehicle recall is never a child-restraint product recall.
      if (recallType && /vehicle/i.test(recallType)) continue;
      // Relevance from structured fields only — never the free-text summary.
      if (!CHILD_SEAT_RE.test([subject, component].filter(Boolean).join(" "))) continue;
      const title = subject
        ? `${manufacturer ?? "Recall"} — ${subject}`
        : component
          ? `${manufacturer ?? "Recall"} — ${component}`
          : (summary?.slice(0, 120) ?? null);
      if (!title) continue;

      const campaign = pick(r, "nhtsa_id", "nhtsa_campaign_number", "campaign_number");
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
    console.warn(
      "[allRecallSources] NHTSA fetch failed:",
      err instanceof Error ? err.message : "unknown",
    );
    return [];
  }
}

export async function fetchHealthCanadaRecalls(
  fetchImpl: typeof fetch,
): Promise<NormalizedRecall[]> {
  try {
    const res = await fetchWithTimeout(
      fetchImpl,
      "https://recalls-rappels.canada.ca/sites/default/files/opendata-donneesouvertes/HCRSAMOpenData.json",
      20_000,
      undefined,
      "health_canada",
    );
    if (!res.ok) {
      console.warn(`[allRecallSources] Health Canada returned ${res.status}`);
      return [];
    }
    const data = await res.json();
    const rows: Record<string, unknown>[] = Array.isArray(data)
      ? data
      : (data?.results ?? data?.records ?? []);
    const out: NormalizedRecall[] = [];
    for (const r of rows) {
      const title = pick(r, "Title", "Title_En", "title_en", "title");
      if (!title) continue;
      const category = pick(r, "Category", "Category_En", "category_en");
      const productName = pick(r, "Product", "Product_En", "product_en");
      const summary = pick(r, "Product", "Summary_En", "summary_en", "Description_En", "description");
      const blob = [title, category, productName, summary].filter(Boolean).join(" ");
      const categoryHint = category ? /toy|child|infant|nursery|baby/i.test(category) : false;
      if (!isBabyRelevant(blob) && !categoryHint) continue;

      const sourceId = pick(r, "NID", "nid", "RecallID", "recall_id") ?? title;
      // The open-data feed uses plain "URL" (deep link to the specific recall
      // notice). Older code only looked for "URL_En"/"Link", so every Canadian
      // recall fell back to the generic landing page.
      const url = pick(r, "URL", "URL_En", "url_en", "Link");
      out.push({
        source: "health_canada",
        source_id: sourceId,
        title,
        brand: pick(r, "Brand_En", "brand_en", "Brand"),
        product_name: productName,
        category,
        description: summary,
        hazard: pick(r, "Issue", "Hazard_En", "hazard_en"),
        remedy: pick(r, "What you should do", "Remedy_En", "remedy_en"),
        url: url ?? "https://recalls-rappels.canada.ca/en",
        image_url: null,
        recall_date: pick(r, "Last updated", "Date", "PublishDate", "publish_date"),
        model: null,
        affected_date_start: null,
        affected_date_end: null,
        official: true,
      });

    }
    return out;
  } catch (err) {
    console.warn(
      "[allRecallSources] Health Canada fetch failed:",
      err instanceof Error ? err.message : "unknown",
    );
    return [];
  }
}

export async function fetchEuSafetyGateRecalls(
  fetchImpl: typeof fetch,
): Promise<NormalizedRecall[]> {
  try {
    const url =
      "https://public.opendatasoft.com/api/explore/v2.1/catalog/datasets/healthref-europe-rapex-en/records" +
      "?order_by=alert_date%20DESC&limit=100";
    const res = await fetchWithTimeout(fetchImpl, url, 12_000, undefined, "eu_safety_gate");
    if (!res.ok) {
      console.warn(`[allRecallSources] EU Safety Gate mirror returned ${res.status}`);
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

      const title =
        [brand, productType].filter(Boolean).join(" — ") || productType || "EU Safety Gate alert";
      const sourceId =
        pick(r, "alert_number", "id") ??
        `${brand ?? ""}-${productType ?? ""}-${pick(r, "alert_date") ?? ""}`;
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
    console.warn(
      "[allRecallSources] EU Safety Gate fetch failed:",
      err instanceof Error ? err.message : "unknown",
    );
    return [];
  }
}

export async function fetchAllExtraRecallSources(
  fetchImpl: typeof fetch,
): Promise<NormalizedRecall[]> {
  const [usda, nhtsa, healthCanada, euSafetyGate] = await Promise.all([
    USDA_FSIS_ENABLED ? fetchUsdaFsisRecalls(fetchImpl) : Promise.resolve([]),
    fetchNhtsaRecalls(fetchImpl),
    fetchHealthCanadaRecalls(fetchImpl),
    fetchEuSafetyGateRecalls(fetchImpl),
  ]);
  if (!USDA_FSIS_ENABLED) markDisabled("usda_fsis");
  return [...usda, ...nhtsa, ...healthCanada, ...euSafetyGate];
}
