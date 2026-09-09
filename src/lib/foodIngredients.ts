// Helpers for the First Foods scanner: turning a packaged product's
// ingredient list (as returned by Open Food Facts) into something a parent
// can read, and rolling every logged food up into a single "ingredients
// your child has tried" list.

import { TOP_ALLERGENS, type Allergen } from "@/lib/topAllergens";

/**
 * Splits a printed ingredient list into individual ingredients.
 *
 * Package ingredient text is messy: commas inside parentheses ("vitamin
 * blend (b1, b2)"), semicolons, trailing periods, "contains 2% or less of"
 * preambles, and ALL CAPS. We split only on top-level separators so
 * sub-ingredients stay attached to their parent, then tidy each piece.
 */
export function parseIngredients(text: string | null | undefined): string[] {
  if (!text) return [];
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of text) {
    if (ch === "(" || ch === "[") depth++;
    else if (ch === ")" || ch === "]") depth = Math.max(0, depth - 1);
    if ((ch === "," || ch === ";") && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  parts.push(current);

  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of parts) {
    const cleaned = tidyIngredient(raw);
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cleaned);
  }
  return out;
}

function tidyIngredient(raw: string): string {
  let s = raw
    .replace(/^[\s.*_•\-–]+|[\s.*_•\-–]+$/g, "")
    .replace(/\s+/g, " ")
    // Order matters: strip the "contains 2% or less of" preamble as a whole
    // before the plain "contains"/"and" prefix rule, otherwise the shorter
    // rule eats "contains" and leaves "2% or less of salt" behind.
    .replace(/^contains\s+\d+%?\s*(or less)?\s*(of)?\s*/i, "")
    .replace(/^(and|contains|including)\s+/i, "")
    .replace(/\.$/, "")
    .trim();
  if (!s || s.length > 80) return s.slice(0, 80).trim();
  // "SWEET POTATO" reads better as "Sweet potato"; leave mixed-case text alone.
  if (s === s.toUpperCase() && /[a-z]/i.test(s)) s = s.toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Unique, alphabetised ingredients across every logged food entry. */
export function collectIngredients(
  foods: { ingredients?: string | null; food_name?: string }[],
): { name: string; foods: string[] }[] {
  const map = new Map<string, { name: string; foods: Set<string> }>();
  for (const f of foods) {
    for (const ing of parseIngredients(f.ingredients)) {
      const key = ing.toLowerCase();
      const entry = map.get(key) ?? { name: ing, foods: new Set<string>() };
      if (f.food_name) entry.foods.add(f.food_name);
      map.set(key, entry);
    }
  }
  return [...map.values()]
    .map((e) => ({ name: e.name, foods: [...e.foods] }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

const ALLERGEN_TAG_MAP: Record<string, Allergen> = {
  milk: "Milk",
  eggs: "Eggs",
  egg: "Eggs",
  fish: "Fish",
  crustaceans: "Shellfish",
  molluscs: "Shellfish",
  shellfish: "Shellfish",
  nuts: "Tree nuts",
  "tree-nuts": "Tree nuts",
  peanuts: "Peanuts",
  gluten: "Wheat",
  wheat: "Wheat",
  soybeans: "Soy",
  soy: "Soy",
  sesame: "Sesame",
  "sesame-seeds": "Sesame",
};

/**
 * Maps Open Food Facts allergen tags ("en:milk", "fr:lait") onto the top 9
 * allergens the First Foods form tracks, so a scan can pre-tick the right
 * allergen instead of asking the parent to spot it in the ingredient list.
 */
export function allergensFromTags(tags: string[] | undefined): Allergen[] {
  const found = new Set<Allergen>();
  for (const tag of tags ?? []) {
    const bare = tag.includes(":") ? tag.slice(tag.indexOf(":") + 1) : tag;
    const hit = ALLERGEN_TAG_MAP[bare.toLowerCase()];
    if (hit) found.add(hit);
  }
  return TOP_ALLERGENS.filter((a) => found.has(a));
}
