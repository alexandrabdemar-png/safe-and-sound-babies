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

/**
 * Very small plural normalizer — recall text is almost always plural
 * ("Pacifiers", "Car Seats", "Pouches") while a user's own product name is
 * usually singular ("Pacifier", "Pouch"). Not a real stemmer, just enough
 * that this common, legitimate wording difference doesn't count as a token
 * "not matching".
 *
 * Strips a trailing "s" and then a trailing "e" so both spellings collapse to
 * the same stem: bottles→bottle→bottl and bottle→bottl; pouches→pouche→pouch
 * and pouch→pouch. (An earlier "-es" one-step strip mapped bottles→bottl but
 * left bottle→bottle, so a recalled "Bottles" never matched a "Bottle".)
 */
function stem(word: string): string {
  let w = word;
  if (w.length > 3 && w.endsWith("s")) w = w.slice(0, -1);
  if (w.length > 3 && w.endsWith("e")) w = w.slice(0, -1);
  return w;
}


// Minimum length 2 (not 3) so short distinguishing suffixes like a
// trim-level code ("RX", "LX") aren't silently dropped — dropping exactly
// this kind of token is what let a sibling-product false positive slip
// through in an earlier version of this matcher (see the Pipa RX
// regression test above).
function meaningfulTokens(words: string[]): string[] {
  return [...new Set(words.filter((w) => w.length >= 2 && !NOISE_WORDS.has(w)).map(stem))];
}

function tokensMatch(tokens: string[], textTokens: Set<string>, wholeQuery: string, text: string): boolean {
  if (tokens.length === 0) return text.includes(wholeQuery);
  if (tokens.length === 1) return textTokens.has(tokens[0]);
  // Every meaningful token must appear (modulo the plural normalization
  // above) — not just a majority. A prior "75% of tokens for longer names"
  // rule let a product name whose non-brand words happen to be common food/
  // descriptor terms (e.g. a flavor like "Blueberry Apple") pass against a
  // completely unrelated recall that just happens to mention the same
  // generic words in its own ingredient list, with the actual distinguishing
  // token (the brand) never appearing at all — reported bug: "Beech Nut
  // Blueberry Apple" false-matched an unrelated "Grizzlies" trail mix recall
  // on "blueberry"/"apple" alone. Requiring every token closes that off
  // while the plural normalization above still lets real wording
  // differences (recall text says "Pacifiers", product says "Pacifier")
  // through. This also still catches the "Pipa" vs "Pipa RX" sibling-
  // product case — "rx" never appears at all, plural or not.
  return tokens.every((t) => textTokens.has(t));
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
  const textTokens = new Set(tokenize(text).map(stem));
  const rawWords = tokenize(productName);
  const wholeQuery = productName.toLowerCase().trim();
  const tokens = meaningfulTokens(rawWords);

  // A lone surviving token sitting right next to a 1-2 letter fragment is
  // usually the leftover half of a brand word an accidental space split in
  // two (e.g. "by heart formula" typed for "ByHeart formula") — the "by"
  // fragment gets dropped (it's both too short and, here, an explicit
  // NOISE_WORD), leaving "heart" alone as the sole token. That's generic
  // enough to false-match a totally unrelated recall (a "Heart Charm
  // Bracelet") while STILL never matching the real "ByHeart" recall, whose
  // text has "byheart" as one fused token that "heart" alone never equals.
  // Skip trusting the bare fragment in that situation and fall straight
  // through to the glue-back-together attempt below instead of returning
  // here. Mirrors the identical fix in src/lib/recallCheck.ts.
  const survivorIdx =
    tokens.length === 1
      ? rawWords.findIndex((w) => w.length >= 2 && !NOISE_WORDS.has(w) && stem(w) === tokens[0])
      : -1;
  const hasShortNeighbor =
    survivorIdx >= 0 &&
    ((rawWords[survivorIdx - 1]?.length ?? 99) <= 2 || (rawWords[survivorIdx + 1]?.length ?? 99) <= 2);

  if (!hasShortNeighbor && tokensMatch(tokens, textTokens, wholeQuery, text)) {
    return true;
  }

  // Re-glue every 1-2 letter fragment to each of its neighbors and retry —
  // this recovers "byheart" from "by heart" without weakening the
  // every-token-must-match rule for genuinely multi-word product names
  // (glued candidates go through the exact same tokensMatch logic above).
  for (let i = 0; i < rawWords.length; i++) {
    if (rawWords[i].length > 2) continue;
    if (i + 1 < rawWords.length) {
      const glued = [...rawWords.slice(0, i), rawWords[i] + rawWords[i + 1], ...rawWords.slice(i + 2)];
      if (tokensMatch(meaningfulTokens(glued), textTokens, wholeQuery, text)) return true;
    }
    if (i > 0) {
      const glued = [...rawWords.slice(0, i - 1), rawWords[i - 1] + rawWords[i], ...rawWords.slice(i + 1)];
      if (tokensMatch(meaningfulTokens(glued), textTokens, wholeQuery, text)) return true;
    }
  }

  return false;
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
