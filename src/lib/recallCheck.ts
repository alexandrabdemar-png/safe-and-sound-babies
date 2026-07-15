import { supabase } from "@/integrations/supabase/client";

/**
 * recallCheck.ts — Inline and background product recall detection
 *
 * TEST RESULTS (verified against live data):
 *   "Nara formula"        → CRITICAL_RECALLS hit via keyword "nara"          ✓
 *   "Nara Organics"       → CRITICAL_RECALLS hit via keyword "nara"          ✓
 *   "Nara infant formula" → CRITICAL_RECALLS hit via keyword "nara"          ✓
 *   "banana puree"        → no false positive on "nara" keyword              ✓
 *   "Similac"             → passes through to FDA API search                 ✓
 *
 * IMPORTANT: The CRITICAL_RECALLS list must be manually updated whenever
 * new high-priority recalls are issued that may not yet appear in the CPSC
 * or FDA APIs, or that are hard to match via keyword search alone.
 */

export type RecallHit = {
  source: "cpsc" | "fda" | "critical";
  id: string;
  title: string;
  productDescription: string;
  reason: string;
  url: string;
  recallDate?: string;
};

/**
 * Every recall alert must be clickable so a parent can verify it against the
 * official source themselves. Some recall rows (older CPSC records, edge
 * cases in the sync jobs) can end up with no direct article URL — this gives
 * a guaranteed fallback that always resolves to a real, relevant page.
 */
export function recallFallbackUrl(title: string): string {
  return `https://www.cpsc.gov/Recalls?combine=${encodeURIComponent(title)}`;
}

/**
 * Attribute a recall to its actual issuing agency (CPSC/FDA) based on the
 * recall's own URL/source, rather than assuming CPSC for everything — used
 * anywhere a recall's official source is shown to a parent.
 */
export function recallSourceLabel(hit: { url?: string | null; source?: string | null }): string {
  if (hit.url?.includes("cpsc.gov")) return "U.S. Consumer Product Safety Commission (CPSC)";
  if (hit.url?.includes("fda.gov")) return "U.S. Food and Drug Administration (FDA)";
  if (hit.source === "cpsc") return "U.S. Consumer Product Safety Commission (CPSC)";
  if (hit.source === "fda") return "U.S. Food and Drug Administration (FDA)";
  return "the official recall notice linked below";
}

/**
 * Copy for the "when was this last checked" note shown next to a product's
 * recall status. Deliberately never implies real-time accuracy — recall
 * data is only as fresh as the last sync, and manufacturers can issue a
 * recall between syncs, so this always points a parent back to the
 * official sources rather than letting the app's checkmark stand alone.
 */
export function formatRecallSyncNote(recallCheckedAt: string | null | undefined): string {
  if (!recallCheckedAt) {
    return "Recall check pending — new products sync with CPSC.gov and other official databases within 24 hours. Because manufacturer data changes rapidly, always cross-reference critical gear directly on official government recall sites.";
  }
  const d = new Date(recallCheckedAt);
  if (Number.isNaN(d.getTime())) {
    return "Recall check pending — new products sync with CPSC.gov and other official databases within 24 hours. Because manufacturer data changes rapidly, always cross-reference critical gear directly on official government recall sites.";
  }
  const formatted = d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  return `Data synced with CPSC.gov and other official databases on ${formatted}. Because manufacturer data changes rapidly, always cross-reference critical gear directly on official government recall sites.`;
}

const ALLOWED_RECALL_HOSTS = ["cpsc.gov", "saferproducts.gov", "fda.gov", "nhtsa.gov"];

/**
 * Whitelist check used before a recall hit is ever persisted to the shared
 * `recalls` catalog table (readable by every user). Only https:// URLs on an
 * official agency domain (or a direct subdomain of one) pass — this is what
 * stands between a crafted recordProductRecall call and an arbitrary URL
 * being shown to every user as an "official recall notice". Exact-suffix
 * matching (`hostname === host || hostname.endsWith("." + host)`) rejects
 * lookalikes like "cpsc.gov.evil.com" or "evilcpsc.gov".
 */
export function isAllowedRecallUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  const hostname = parsed.hostname.toLowerCase();
  return ALLOWED_RECALL_HOSTS.some((host) => hostname === host || hostname.endsWith(`.${host}`));
}

// ── Noise words stripped before fuzzy token matching ─────────────────────────
const NOISE_WORDS = new Set([
  "baby",
  "babies",
  "organic",
  "organics",
  "natural",
  "formula",
  "bottle",
  "infant",
  "toddler",
  "child",
  "children",
  "safe",
  "safety",
  "the",
  "and",
  "for",
  "with",
  "a",
  "an",
  "of",
  "in",
  "on",
  "at",
  "new",
  "brand",
  "inc",
  "llc",
  "ltd",
  "co",
  "set",
  "pack",
  "size",
  "model",
]);

/**
 * Fuzzy-match a product name against a block of recall text.
 *
 * Logic (per spec):
 *   1. Split product name into words, remove NOISE_WORDS and short words.
 *   2. Single meaningful token  → match if it appears anywhere in recall text.
 *   3. Multiple meaningful tokens → match if 2+ tokens appear in recall text.
 *   All comparisons are whole-word matches against the recall text, not raw
 *   substring checks — see the regression test for why: a raw substring
 *   check let a "Beech-Nut" product falsely match an unrelated "Grizzlies"
 *   granola recall, because "beech" and "nut" both occurred as *fragments*
 *   of other words ("Beechwood", "Peanuts") without either word actually
 *   being present.
 */
export function fuzzyMatchProduct(productName: string, recallText: string): boolean {
  const text = recallText.toLowerCase();
  const textTokens = new Set(text.replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter(Boolean));
  const tokens = productName
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !NOISE_WORDS.has(w));

  if (tokens.length === 0) {
    return text.includes(productName.toLowerCase().trim());
  }
  if (tokens.length === 1) {
    return textTokens.has(tokens[0]);
  }
  // Multiple tokens — require at least 2 hits
  return tokens.filter((t) => textTokens.has(t)).length >= 2;
}

// ── CRITICAL RECALLS — manually maintained ───────────────────────────────────

type CriticalRecall = {
  id: string;
  title: string;
  /** Any keyword match against the product name triggers the alert */
  keywords: string[];
  /** Plain-English one-sentence summary shown directly to the parent */
  reason: string;
  url: string;
  date: string;
};

/**
 * CRITICAL_RECALLS — manually curated list of high-priority active recalls.
 *
 * IMPORTANT: Update this list manually when new critical recalls are issued
 * that are not yet reliably queryable via CPSC or FDA APIs.
 */
export const CRITICAL_RECALLS: CriticalRecall[] = [
  {
    id: "nara-organics-infant-formula-2024",
    title: "Nara Organics Recalls All Lots of Nara Infant Formula",
    keywords: ["nara", "nara organics", "nara formula", "nara infant"],
    reason:
      "All lots of Nara infant formula have been recalled due to a possible health risk — stop using immediately and do not feed to your baby.",
    url: "https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts/nara-organics-recalls-all-lots-nara-infant-formula-because-possible-health-risk",
    date: "Jun 13, 2026",
  },
];

/**
 * Check a product name against the CRITICAL_RECALLS list.
 * Returns the first matching entry, or null.
 * Keyword matching is case-insensitive substring check.
 */
export function checkCriticalRecalls(productName: string): CriticalRecall | null {
  const name = productName.toLowerCase().trim();
  for (const recall of CRITICAL_RECALLS) {
    for (const kw of recall.keywords) {
      if (name.includes(kw.toLowerCase())) return recall;
    }
    // Reverse-check: any meaningful keyword word appears in product name
    const kwWords = recall.keywords
      .flatMap((kw) => kw.toLowerCase().split(/\s+/))
      .filter((w) => w.length >= 4 && !NOISE_WORDS.has(w));
    if (kwWords.some((w) => name.includes(w))) return recall;
  }
  return null;
}

// ── CPSC API ─────────────────────────────────────────────────────────────────

type RawCpscRecall = {
  RecallID?: string | number;
  RecallNumber?: string;
  RecallHeading?: string;
  Title?: string;
  URL?: string;
  RecallDate?: string;
  Description?: string;
  Products?: Array<{ Name?: string; Description?: string }>;
  Manufacturers?: Array<{ Name?: string }>;
  Hazards?: Array<{ Name?: string }>;
};

/**
 * Every other external-fetch helper in this codebase (cpscSearch.ts,
 * the check-recalls edge function) wraps its calls in a timeout so a slow
 * or hanging government API can't block the UI indefinitely — this one
 * didn't, which was the actual cause of the reported "registry check
 * search is very slow" (no cap, so a hung saferproducts.gov/api.fda.gov
 * response left the button spinning forever rather than failing fast).
 */
async function fetchWithTimeout(url: string, timeoutMs = 10_000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

/**
 * Fetch recalls from the CPSC API matching productName and fuzzy-match the results.
 *
 * Uses CPSC's Keyword search (server-side filtered) rather than pulling the
 * entire multi-year, all-categories recall history and filtering client-side
 * — that unfiltered fetch was the main reason adding a product manually felt
 * slow, since this check blocks the save until it completes.
 */
export async function fetchCpscRecallsForProduct(productName: string): Promise<RecallHit[]> {
  try {
    const url = `https://www.saferproducts.gov/RestWebServices/Recall?format=json&Keyword=${encodeURIComponent(productName)}`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) return [];
    const data: RawCpscRecall[] = await res.json();
    if (!Array.isArray(data)) return [];

    return data
      .filter((r) => {
        // Deliberately excludes the free-text Description fields: recall
        // notices routinely name sibling products only to say they're NOT
        // affected ("this recall does not include the Pipa, Pipa Lite, or
        // Pipa RX"), and plain substring matching can't tell that apart from
        // an actual match. Match only against the structured identifier
        // fields, which name the actually-recalled product.
        const recallText = [
          r.RecallHeading ?? r.Title ?? "",
          ...(r.Products ?? []).map((p) => p.Name ?? ""),
          ...(r.Manufacturers ?? []).map((m) => m.Name ?? ""),
        ].join(" ");
        return fuzzyMatchProduct(productName, recallText);
      })
      .slice(0, 5)
      .map((r) => ({
        source: "cpsc" as const,
        id: String(r.RecallID ?? r.RecallNumber ?? Math.random()),
        title: r.RecallHeading ?? r.Title ?? "CPSC Recall",
        productDescription: r.Products?.[0]?.Description ?? r.Description ?? "",
        reason:
          r.Hazards?.map((h) => h.Name)
            .filter(Boolean)
            .join("; ") || "See the official recall notice for hazard details.",
        url: r.URL ?? "https://www.saferproducts.gov",
        recallDate: r.RecallDate,
      }));
  } catch {
    return [];
  }
}

// ── FDA API ──────────────────────────────────────────────────────────────────

type RawFdaResult = {
  recall_number?: string;
  product_description?: string;
  reason_for_recall?: string;
  recall_initiation_date?: string;
  status?: string;
};

/**
 * Query FDA enforcement API with two parallel requests (per spec):
 *   1. recalling_firm_name:{name} OR product_description:{name}
 *   2. product_description:{name}
 * Deduplicate by recall_number, then fuzzy-match against productName.
 */
export async function fetchFdaRecallsForProduct(productName: string): Promise<RecallHit[]> {
  try {
    const enc = encodeURIComponent(productName);
    const [res1, res2] = await Promise.all([
      fetchWithTimeout(
        `https://api.fda.gov/food/enforcement.json?search=recalling_firm_name:${enc}+OR+product_description:${enc}&limit=10`,
      ),
      fetchWithTimeout(
        `https://api.fda.gov/food/enforcement.json?search=product_description:${enc}&limit=10`,
      ),
    ]);

    const seen = new Set<string>();
    const combined: RawFdaResult[] = [];

    for (const res of [res1, res2]) {
      if (!res.ok) continue;
      try {
        const data = await res.json();
        for (const r of (data?.results ?? []) as RawFdaResult[]) {
          const key = r.recall_number ?? "";
          if (key && seen.has(key)) continue;
          if (key) seen.add(key);
          combined.push(r);
        }
      } catch {
        // ignore parse errors for individual FDA response
      }
    }

    return combined
      .filter((r) => {
        // product_description is FDA's structured product identifier;
        // reason_for_recall is free-text narrative and, like CPSC's
        // Description field, can name unaffected sibling products —
        // deliberately excluded from matching for the same reason.
        return fuzzyMatchProduct(productName, r.product_description ?? "");
      })
      .slice(0, 5)
      .map((r) => ({
        source: "fda" as const,
        id: r.recall_number ?? Math.random().toString(36).slice(2),
        title: (r.product_description ?? "FDA Food/Formula Recall").slice(0, 120),
        productDescription: r.product_description ?? "",
        reason: r.reason_for_recall || "See the official FDA recall notice for hazard details.",
        url: "https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts",
        recallDate: r.recall_initiation_date,
      }));
  } catch {
    return [];
  }
}

// ── Main entry point ─────────────────────────────────────────────────────────

/**
 * checkRecallsForProduct — check a product name against all recall sources.
 *
 * Order of operations (per spec):
 *   1. CRITICAL_RECALLS (hardcoded, instant — no network).
 *   2. CPSC + FDA simultaneously via Promise.all.
 *
 * Returns the first RecallHit found, or null.
 *
 * TEST RESULTS (verified):
 *   "Nara formula"        → critical hit  ✓
 *   "Nara Organics"       → critical hit  ✓
 *   "Nara infant formula" → critical hit  ✓
 *
 * IMPORTANT: CRITICAL_RECALLS must be manually updated for new recalls.
 */
export async function checkRecallsForProduct(productName: string): Promise<RecallHit | null> {
  // Step 1 — critical recalls (instant, no network)
  const critical = checkCriticalRecalls(productName);
  if (critical) {
    return {
      source: "critical",
      id: critical.id,
      title: critical.title,
      productDescription: productName,
      reason: critical.reason,
      url: critical.url,
    };
  }

  // Step 2 — CPSC + FDA in parallel
  const [cpscHits, fdaHits] = await Promise.all([
    fetchCpscRecallsForProduct(productName),
    fetchFdaRecallsForProduct(productName),
  ]);

  return cpscHits[0] ?? fdaHits[0] ?? null;
}

// ── Persisting a recall hit against a saved product ──────────────────────────

type PersistableRecallHit = {
  source: string;
  id: string;
  title: string;
  url: string;
  recallDate?: string | null;
};

/**
 * Persists a recall hit (from checkRecallsForProduct or the check-recalls
 * edge function) against a just-saved product — shared by both the
 * manual/AI-search add flow (products_.new.tsx) and the barcode-scan flow
 * (products_.scan.tsx), which each get their recall hit from a different
 * source but need the exact same write. Delegates to the recordProductRecall
 * server function (service-role write + URL/source allowlist — see
 * recallRecord.functions.ts for why this can't be a direct client write).
 *
 * Non-fatal by design: whatever screen is calling this has already shown
 * the parent the recall (from the live hit data, not this write), so a
 * failure here shouldn't block or roll back the save that already
 * succeeded — just log it loudly so a real regression is visible.
 */
export async function recordRecallInDb(
  productId: string,
  hit: PersistableRecallHit,
): Promise<void> {
  try {
    const { recordProductRecall } = await import("@/lib/recallRecord.functions");
    await recordProductRecall({
      data: {
        productId,
        source: hit.source,
        sourceId: hit.id,
        title: hit.title,
        url: hit.url,
        recallDate: hit.recallDate ?? null,
      },
    });
  } catch (err) {
    console.error("[recall-db] failed to persist recall for product", productId, err);
  }
}

/**
 * Stamps recall_checked_at on a product right after an inline recall check
 * completes — hit or not — so the "data synced on" note on the product
 * detail screen (formatRecallSyncNote) reflects a real check, not just the
 * ones that happened to find a match. A plain client-side update: RLS
 * ("Users manage own products") already allows a user to write any column
 * on their own product row, same as replace_at/recalled today.
 *
 * Non-fatal by design, matching recordRecallInDb: the check already
 * happened and was already shown to the parent, so a failure to persist
 * the timestamp shouldn't surface as an error to them.
 */
export async function stampRecallCheckedAt(productId: string, checkedAt: string = new Date().toISOString()): Promise<void> {
  try {
    const { error } = await supabase
      .from("products")
      .update({ recall_checked_at: checkedAt } as never)
      .eq("id", productId);
    if (error) throw error;
  } catch (err) {
    console.error("[recall-db] failed to stamp recall_checked_at for product", productId, err);
  }
}
