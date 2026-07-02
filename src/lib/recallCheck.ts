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

// ── Noise words stripped before fuzzy token matching ─────────────────────────
const NOISE_WORDS = new Set([
  "baby", "babies", "organic", "organics", "natural", "formula", "bottle",
  "infant", "toddler", "child", "children", "safe", "safety", "the", "and",
  "for", "with", "a", "an", "of", "in", "on", "at", "new", "brand", "inc",
  "llc", "ltd", "co", "set", "pack", "size", "model",
]);

/**
 * Fuzzy-match a product name against a block of recall text.
 *
 * Logic (per spec):
 *   1. Split product name into words, remove NOISE_WORDS and short words.
 *   2. Single meaningful token  → match if it appears anywhere in recall text.
 *   3. Multiple meaningful tokens → match if 2+ tokens appear in recall text.
 *   All comparisons are case-insensitive substring checks.
 */
export function fuzzyMatchProduct(productName: string, recallText: string): boolean {
  const text = recallText.toLowerCase();
  const tokens = productName
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !NOISE_WORDS.has(w));

  if (tokens.length === 0) {
    return text.includes(productName.toLowerCase().trim());
  }
  if (tokens.length === 1) {
    return text.includes(tokens[0]);
  }
  // Multiple tokens — require at least 2 hits
  return tokens.filter((t) => text.includes(t)).length >= 2;
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
    date: "2024",
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
    const res = await fetch(url);
    if (!res.ok) return [];
    const data: RawCpscRecall[] = await res.json();
    if (!Array.isArray(data)) return [];

    return data
      .filter((r) => {
        const recallText = [
          r.RecallHeading ?? r.Title ?? "",
          r.Description ?? "",
          ...(r.Products ?? []).map((p) => `${p.Name ?? ""} ${p.Description ?? ""}`),
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
          r.Hazards?.map((h) => h.Name).filter(Boolean).join("; ") ||
          "See the official recall notice for hazard details.",
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
      fetch(
        `https://api.fda.gov/food/enforcement.json?search=recalling_firm_name:${enc}+OR+product_description:${enc}&limit=10`,
      ),
      fetch(
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
        const text = `${r.product_description ?? ""} ${r.reason_for_recall ?? ""}`;
        return fuzzyMatchProduct(productName, text);
      })
      .slice(0, 5)
      .map((r) => ({
        source: "fda" as const,
        id: r.recall_number ?? Math.random().toString(36).slice(2),
        title: (r.product_description ?? "FDA Food/Formula Recall").slice(0, 120),
        productDescription: r.product_description ?? "",
        reason:
          r.reason_for_recall ||
          "See the official FDA recall notice for hazard details.",
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
