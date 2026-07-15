// Portable recall-matching logic for the check-recalls edge function.
// Framework-agnostic (only `fetch`), so it's unit-testable under Vitest and
// runnable as-is under Deno.
//
// This is a copy, not an import, of the matching approach already proven in
// src/lib/recallCheck.ts (same file the rest of the app's recall pipeline
// uses) — edge functions are a separate deploy target from the main app, so
// cross-directory imports into src/ aren't used here. Keeping the matching
// rule identical is what matters: fuzzy-match against structured identifier
// fields only (title, product name, model, manufacturer), never free-text
// description/hazard fields, because recall notices routinely name sibling
// products specifically to say they're NOT affected ("this recall does not
// include the Pipa, Pipa Lite, or Pipa RX") — naive substring matching
// against that text can't tell the difference from an actual match.

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
  // Common short stopwords — needed now that the minimum token length is 2
  // (see below) instead of 3, so short-but-meaningful tokens like model
  // suffixes ("RX", "LX") survive without also letting ordinary short
  // English words through as "meaningful" tokens.
  "to",
  "is",
  "it",
  "we",
  "us",
  "by",
  "or",
  "as",
  "be",
  "if",
  "so",
  "no",
  "up",
  "my",
  "he",
]);

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export function fuzzyMatchProduct(productName: string, recallText: string): boolean {
  const text = recallText.toLowerCase();
  // Word-boundary set, not a raw string — checking token membership here
  // (rather than `text.includes(token)`) is what stops a short token from
  // matching as a *substring* of an unrelated word. Regression: a product
  // named "Beech-Nut" tokenizes to ["beech", "nut"], and a completely
  // unrelated recall for "Grizzlies Granola... Beechwood Trail Mix...
  // Undeclared Peanuts" contains "beech" (inside "Beechwood") and "nut"
  // (inside "Peanuts") as pure substrings, with neither word actually
  // present — substring matching flagged that recall against Beech-Nut
  // baby food, a false positive with no real connection between the
  // products. Matching on whole tokens instead closes this off.
  const textTokens = new Set(tokenize(text));

  const tokens = [
    ...new Set(
      tokenize(productName)
        // Minimum length 2 (not 3) so short distinguishing suffixes like a
        // trim-level code ("RX", "LX") aren't silently dropped — dropping
        // exactly this kind of token is what let a sibling-product false
        // positive slip through in an earlier version of this matcher (see
        // the Pipa RX regression test above).
        .filter((w) => w.length >= 2 && !NOISE_WORDS.has(w)),
    ),
  ];

  if (tokens.length === 0) return text.includes(productName.toLowerCase().trim());
  if (tokens.length === 1) return textTokens.has(tokens[0]);

  const matchCount = tokens.filter((t) => textTokens.has(t)).length;
  // Short/specific product names (<=3 meaningful tokens, which is the
  // common case: brand + model + variant) must match *every* token — a
  // recall for the base model must not flag a variant that's the same
  // brand and model but a different trim ("Pipa" matching "Pipa RX" on
  // brand+model alone, while missing "RX", is exactly the bug class this
  // guards against). Longer, more free-form names get a slightly fuzzier
  // proportional threshold so minor wording differences don't block a
  // real match.
  const required = tokens.length <= 3 ? tokens.length : Math.ceil(tokens.length * 0.75);
  return matchCount >= required;
}

export type RecallHit = {
  source: "cpsc" | "nhtsa";
  id: string;
  title: string;
  reason: string;
  url: string;
  recallDate: string | null;
};

async function fetchJson(fetchImpl: typeof fetch, url: string): Promise<unknown | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetchImpl(url, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      if (!res.ok) return null;
      return await res.json();
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    return null;
  }
}

type CpscRecallRaw = {
  RecallID?: number | string;
  RecallNumber?: string;
  Title?: string;
  RecallHeading?: string;
  URL?: string;
  RecallDate?: string;
  Products?: Array<{ Name?: string; Model?: string; Type?: string }>;
  Manufacturers?: Array<{ Name?: string }>;
  Hazards?: Array<{ Name?: string }>;
};

export async function checkCpscRecalls(
  productName: string,
  fetchImpl: typeof fetch,
): Promise<RecallHit[]> {
  const url = `https://www.saferproducts.gov/RestWebServices/Recall?format=json&Keyword=${encodeURIComponent(productName)}`;
  const data = (await fetchJson(fetchImpl, url)) as CpscRecallRaw[] | null;
  if (!Array.isArray(data)) return [];

  return data
    .filter((r) => {
      const recallText = [
        r.Title ?? r.RecallHeading ?? "",
        ...(r.Products ?? []).flatMap((p) => [p.Name ?? "", p.Model ?? "", p.Type ?? ""]),
        ...(r.Manufacturers ?? []).map((m) => m.Name ?? ""),
      ].join(" ");
      return fuzzyMatchProduct(productName, recallText);
    })
    .slice(0, 5)
    .map((r) => ({
      source: "cpsc" as const,
      id: String(r.RecallID ?? r.RecallNumber ?? Math.random()),
      title: r.Title ?? r.RecallHeading ?? "CPSC Recall",
      reason:
        r.Hazards?.map((h) => h.Name)
          .filter(Boolean)
          .join("; ") || "See the official recall notice for hazard details.",
      url: r.URL ?? "https://www.saferproducts.gov",
      recallDate: r.RecallDate ?? null,
    }));
}

type NhtsaRecallRaw = {
  nhtsa_campaign_number?: string;
  campaign_number?: string;
  component?: string;
  manufacturer?: string;
  consequence_summary?: string;
  report_received_date?: string;
};

// Category names that trigger the NHTSA check, in addition to always
// checking when the text itself mentions a car seat / child restraint.
const CAR_SEAT_HINT = /car ?seat|child restraint|booster seat/i;

/**
 * NHTSA's child-restraint recall data (unlike CPSC's) doesn't include a
 * reliable structured model-name field — `component` is a generic string
 * like "CHILD SEAT", not "KeyFit 30". Requiring a full product-name match
 * against that generic text (the same rule CPSC uses) would mean this
 * almost never matches anything, silently defeating the point of checking
 * NHTSA at all. So this matches at brand/manufacturer level instead — a
 * hit means "this manufacturer has an active NHTSA child-seat recall",
 * not "this exact model is confirmed affected". The caller should present
 * that distinction to the parent (see the `reason` text below) rather than
 * implying model-level precision the underlying data doesn't support.
 */
export async function checkNhtsaRecalls(
  productName: string,
  brand: string | null,
  fetchImpl: typeof fetch,
): Promise<RecallHit[]> {
  if (!brand) return [];
  const url =
    "https://data.transportation.gov/resource/aqh3-3rri.json" +
    `?$q=${encodeURIComponent(brand)}&$limit=10&$order=report_received_date%20DESC`;
  const data = (await fetchJson(fetchImpl, url)) as NhtsaRecallRaw[] | null;
  if (!Array.isArray(data)) return [];

  const brandLower = brand.toLowerCase();
  return data
    .filter((r) => (r.manufacturer ?? "").toLowerCase().includes(brandLower))
    .slice(0, 5)
    .map((r) => {
      const campaign = r.nhtsa_campaign_number ?? r.campaign_number ?? null;
      return {
        source: "nhtsa" as const,
        id: campaign ?? `${r.manufacturer ?? "nhtsa"}-${r.component ?? Math.random()}`,
        title: r.component ? `${r.manufacturer ?? "Recall"} — ${r.component}` : "NHTSA Recall",
        reason:
          `${r.manufacturer ?? "This manufacturer"} has an active NHTSA recall for "${productName}"-type products. ` +
          "Confirm your exact model/date range against the official notice — NHTSA's feed doesn't specify individual model names.",
        url: campaign
          ? `https://www.nhtsa.gov/recalls?nhtsaId=${encodeURIComponent(campaign)}`
          : "https://www.nhtsa.gov/recalls",
        recallDate: r.report_received_date ?? null,
      };
    });
}

export type CheckRecallsResult = {
  recalled: boolean;
  recalls: RecallHit[];
};

export async function checkRecalls(
  productName: string,
  brand: string | null,
  category: string | null,
  fetchImpl: typeof fetch,
): Promise<CheckRecallsResult> {
  const query = [brand, productName].filter(Boolean).join(" ").trim();
  const shouldCheckNhtsa =
    category === "car_seat" ||
    CAR_SEAT_HINT.test(`${productName} ${brand ?? ""} ${category ?? ""}`);

  const [cpscHits, nhtsaHits] = await Promise.all([
    checkCpscRecalls(query || productName, fetchImpl),
    shouldCheckNhtsa ? checkNhtsaRecalls(productName, brand, fetchImpl) : Promise.resolve([]),
  ]);

  const recalls = [...cpscHits, ...nhtsaHits];
  return { recalled: recalls.length > 0, recalls };
}
