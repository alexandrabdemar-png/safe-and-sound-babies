// Category guard for recall matching — keeps a recall from being shown
// against a product in an unrelated category. Reported bug: a parent added
// a "MAM" pacifier (category: Pacifier) and got an FDA food recall for a
// "MAM'S ... Strawberry Creme Cake Muffin" — the brand token matched, but a
// food recall can never apply to a pacifier.
//
// Copy of src/lib/recallCategory.ts for the edge functions (they can't import
// from src/). Keep the two identical — src/lib/recallCategory.test.ts fails
// if they drift apart.

export type RecallCategoryKey =
  | "car_seat"
  | "crib"
  | "bassinet"
  | "stroller"
  | "carrier"
  | "high_chair"
  | "swing"
  | "bouncer"
  | "activity_center"
  | "sleep_sack"
  | "baby_gate"
  | "pacifier"
  | "formula"
  | "breast_milk"
  | "baby_food"
  | "toothbrush"
  | "baby_monitor"
  | "play_yard"
  | "toys"
  | "bottle"
  | "bath"
  | "diaper"
  | "teether"
  | "vitamins";

// Same patterns as guessCategoryFromText (src/lib/productCategories.ts), but
// every one is tested — a recall naming "bassinets and play yards" counts as
// both, so a play yard isn't dropped just because "bassinet" came first.
const CATEGORY_PATTERNS: [RecallCategoryKey, RegExp][] = [
  ["car_seat", /car ?seat/],
  ["bassinet", /bassinet/],
  ["crib", /crib|\bcot\b/],
  ["stroller", /stroller|pram|buggy/],
  ["carrier", /carrier|baby wrap|baby sling|ring sling/],
  ["high_chair", /high ?chair/],
  ["swing", /baby swing|infant swing|\bswing\b/],
  ["bouncer", /bouncer/],
  ["activity_center", /activity ?center|jumperoo|exersaucer/],
  ["sleep_sack", /sleep ?sack|swaddle|wearable blanket/],
  ["baby_gate", /baby ?gate|safety gate/],
  ["play_yard", /pack ?n ?play|play ?yard|playard|travel crib/],
  ["baby_monitor", /baby monitor|video monitor/],
  ["pacifier", /pacifier|soother|binky|dummy/],
  ["formula", /formula/],
  ["breast_milk", /breast ?milk/],
  ["baby_food", /baby food|puree|stage [1-4]/],
  ["toothbrush", /toothbrush|tooth ?brush/],
  [
    "vitamins",
    /\bvitamins?\b|\bprenatals?\b|pre-?natal|\bsupplements?\b|\bprobiotics?\b|\bmultivitamins?\b|vitamin ?d ?drops?|\bdha\b|\bgripe water\b|\bfolic acid\b|\biron drops?\b/,
  ],
  ["bottle", /baby ?bottle|bottle ?(warmer|brush)|\bbottles?\b|sippy ?cup/],
  ["bath", /\bbath\b|bathtub|bath ?(tub|seat|toy)|baby ?(soap|shampoo|wash|lotion)|shampoo/],
  ["diaper", /\bdiapers?\b|\bwipes?\b|diaper ?(bag|pail|cream|rash)/],
  ["teether", /teether|teething/],
  ["toys", /\btoys?\b|\bblocks?\b|\brattle\b/],
];

const CATEGORY_LABELS: Record<RecallCategoryKey, string> = {
  car_seat: "car seat",
  crib: "crib",
  bassinet: "bassinet",
  stroller: "stroller",
  carrier: "baby carrier",
  high_chair: "high chair",
  swing: "swing",
  bouncer: "bouncer",
  activity_center: "activity center",
  sleep_sack: "sleep sack",
  baby_gate: "baby gate",
  pacifier: "pacifier",
  formula: "formula",
  breast_milk: "breast milk",
  baby_food: "baby food",
  toothbrush: "toothbrush",
  baby_monitor: "baby monitor",
  play_yard: "pack 'n play",
  toys: "toys",
  bottle: "baby bottle",
  bath: "bath",
  diaper: "diapers & wipes",
  teether: "teether",
  vitamins: "vitamins & supplements",
};

// Categories close enough that one recall notice can legitimately cover
// both (a teething pacifier, a bassinet that converts to a play yard).
const RELATED_CATEGORIES: Partial<Record<RecallCategoryKey, RecallCategoryKey[]>> = {
  crib: ["bassinet", "play_yard"],
  bassinet: ["crib", "play_yard"],
  play_yard: ["crib", "bassinet"],
  pacifier: ["teether"],
  teether: ["pacifier", "toys", "toothbrush"],
  toys: ["teether"],
  toothbrush: ["teether"],
  swing: ["bouncer"],
  bouncer: ["swing", "activity_center"],
  activity_center: ["bouncer"],
  carrier: ["sleep_sack"],
};

const FOOD_CATEGORIES = new Set<RecallCategoryKey>(["formula", "breast_milk", "baby_food"]);

/** Sources whose feeds only ever contain food (and, for FDA, supplements). */
const FOOD_ONLY_SOURCES = new Set(["fda", "usda_fsis"]);

/**
 * Turns whatever is stored in products.category — a key ("pacifier"), a
 * display label ("Pacifier", "Baby food"), or older free text — into a
 * category key. Returns null for "other"/unknown, meaning "don't filter".
 */
export function normalizeRecallCategory(raw: string | null | undefined): RecallCategoryKey | null {
  const value = (raw ?? "").trim().toLowerCase();
  if (!value || value === "other") return null;
  for (const [key] of CATEGORY_PATTERNS) {
    if (key === value || CATEGORY_LABELS[key] === value) return key;
  }
  if (value === "food") return "baby_food";
  const mentioned = categoriesInText(value);
  return mentioned.size === 1 ? [...mentioned][0] : null;
}

/** Every product category a block of recall text names. */
export function categoriesInText(text: string): Set<RecallCategoryKey> {
  const hay = text.toLowerCase().replace(/_/g, " ");
  const found = new Set<RecallCategoryKey>();
  for (const [key, re] of CATEGORY_PATTERNS) {
    if (re.test(hay)) found.add(key);
  }
  return found;
}

export function isFoodCategory(category: RecallCategoryKey | null): boolean {
  return category !== null && FOOD_CATEGORIES.has(category);
}

/**
 * Whether a recall from `source` can apply to a product the parent filed
 * under `category`. Rules:
 *   - No category / "other" → allowed (nothing to filter on).
 *   - Food-only feeds (FDA food enforcement, USDA FSIS) → food products and
 *     vitamins/supplements only. This is the MAM pacifier vs muffin fix.
 *   - Otherwise, if the recall's own structured text names any product
 *     categories, the product's category (or a closely related one) must
 *     be among them. Recall text naming no category at all is allowed, so
 *     a brand-only notice isn't silently dropped.
 */
export function recallFitsCategory(input: {
  category: string | null | undefined;
  source: string;
  recallText: string;
}): boolean {
  const category = normalizeRecallCategory(input.category);
  if (!category) return true;

  if (FOOD_ONLY_SOURCES.has(input.source)) {
    return isFoodCategory(category) || category === "vitamins";
  }
  const mentioned = categoriesInText(input.recallText);
  if (mentioned.size === 0) return true;
  const accepted = [category, ...(RELATED_CATEGORIES[category] ?? [])];
  return accepted.some((c) => mentioned.has(c));
}
