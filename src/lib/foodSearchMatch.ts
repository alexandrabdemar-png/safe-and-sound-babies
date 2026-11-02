// Pure matching helpers for the Food Log search box. Kept separate from the
// server function so they can be unit-tested without network access.

export type FoodSearchHit = { barcode: string | null; name: string; brand: string | null };

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokens(s: string): string[] {
  return norm(s).split(" ").filter(Boolean);
}

/** Levenshtein distance, capped — only used on short single words. */
function editDistance(a: string, b: string, cap = 2): number {
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(
        prev[j]! + 1,
        cur[j - 1]! + 1,
        prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      rowMin = Math.min(rowMin, cur[j]!);
    }
    if (rowMin > cap) return cap + 1;
    prev = cur;
  }
  return prev[b.length]!;
}

/** A typed word matches a product word exactly, as a prefix ("tract"), or with one typo ("trator"). */
function wordMatches(q: string, w: string): boolean {
  if (w === q || w.startsWith(q)) return true;
  if (q.length >= 4 && editDistance(q, w.slice(0, q.length + 1), 1) <= 1) return true;
  return q.length >= 4 && editDistance(q, w, 1) <= 1;
}

/** Share of typed words found in the hit's name + brand (0..1). */
export function matchScore(query: string, hit: FoodSearchHit): number {
  const q = tokens(query);
  if (q.length === 0) return 0;
  const words = tokens(`${hit.brand ?? ""} ${hit.name}`);
  const found = q.filter((t) => words.some((w) => wordMatches(t, w))).length;
  return found / q.length;
}

/** De-duplicates and puts the hits that match the most typed words first. */
export function rankFoodHits(query: string, hits: FoodSearchHit[], limit = 8): FoodSearchHit[] {
  const seen = new Set<string>();
  const unique = hits.filter((h) => {
    const k = h.barcode || `${norm(h.name)}|${norm(h.brand ?? "")}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return unique
    .map((h, i) => ({ h, i, s: matchScore(query, h) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .slice(0, limit)
    .map((x) => x.h);
}

/**
 * Shorter fallback queries for when the full text finds nothing (e.g. the
 * product isn't in the database under that exact name, or has a typo):
 * drop words from the end, keeping at least two.
 */
export function fallbackQueries(query: string): string[] {
  const words = query.trim().split(/\s+/).filter(Boolean);
  const out: string[] = [];
  for (let n = words.length - 1; n >= 2 && out.length < 2; n--)
    out.push(words.slice(0, n).join(" "));
  return out;
}

/**
 * The parent typed "Once Upon a Farm Tractor Wheels": if it starts with a
 * brand we know (from search results or their own log), split it into
 * brand + product name so both fields are filled for recall matching.
 */
export function splitBrandFromQuery(
  query: string,
  knownBrands: (string | null | undefined)[],
): { brand: string | null; name: string } {
  const typed = query.trim().replace(/\s+/g, " ");
  const typedNorm = norm(typed);
  const brands = [...new Set(knownBrands.filter((b): b is string => !!b && !!norm(b)))].sort(
    (a, b) => norm(b).length - norm(a).length,
  );
  for (const brand of brands) {
    const b = norm(brand);
    if (typedNorm === b || !typedNorm.startsWith(`${b} `)) continue;
    // Walk the original text word-by-word so the product name keeps the
    // parent's own capitalisation.
    const typedWords = typed.split(" ");
    for (let n = 1; n < typedWords.length; n++) {
      if (norm(typedWords.slice(0, n).join(" ")) !== b) continue;
      const rest = typedWords
        .slice(n)
        .join(" ")
        .replace(/^[\s\-–—:,]+/, "");
      if (rest) return { brand: brand.trim(), name: rest };
    }
  }
  return { brand: null, name: typed };
}

/**
 * Common US baby / toddler food brands, so "Brand Product" typed into the
 * search or the name field can be split even when the food databases return
 * nothing. Longest match wins in splitBrandFromQuery, so "Gerber Organic"
 * beats "Gerber".
 */
export const COMMON_BABY_FOOD_BRANDS = [
  "Once Upon a Farm",
  "Gerber",
  "Gerber Organic",
  "Happy Baby",
  "Happy Tot",
  "Earth's Best",
  "Plum Organics",
  "Sprout Organics",
  "Serenity Kids",
  "Little Spoon",
  "Beech-Nut",
  "Cerebelly",
  "Yumi",
  "Mama Bear",
  "Parent's Choice",
  "up&up",
  "Good & Gather",
  "Square Baby",
  "Tiny Organics",
  "Stonyfield",
  "Little Journey",
  "Amara",
  "Lil Gourmets",
  "Peter Rabbit Organics",
  "Ella's Kitchen",
  "GoGo SqueeZ",
  "Annie's",
  "Cheerios",
  "Mum-Mum",
  "Baby Mum-Mum",
  "Bitsy's",
  "Nurture Life",
  "Little Bellies",
  "Kendamil",
  "Similac",
  "Enfamil",
  "Bobbie",
  "ByHeart",
  "Kirkland Signature",
  "365 by Whole Foods Market",
  "Simply Balanced",
] as const;
