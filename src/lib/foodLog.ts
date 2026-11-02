// Pure helpers for the Food Log (formerly "First Foods"). Every row in
// first_foods is one time the baby ate something — a brand-new food or an
// everyday favourite — so packaged foods stay in the recall scan. "New" is
// derived (first entry for that food), not stored.

import { TOP_ALLERGENS, type Allergen } from "@/lib/topAllergens";

export type FoodLogRow = {
  id: string;
  food_name: string;
  brand?: string | null;
  date_introduced: string;
  created_at?: string;
};

function baseName(name: string): string {
  const match = TOP_ALLERGENS.find((a: Allergen) => name.endsWith(` (${a})`));
  return match ? name.slice(0, -(match.length + 3)) : name;
}

/** Same food = same name (ignoring the allergen tag, case and spacing) and same brand. */
export function foodKey(f: { food_name: string; brand?: string | null }): string {
  const n = baseName(f.food_name).toLowerCase().replace(/\s+/g, " ").trim();
  const b = (f.brand ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  return `${n}|${b}`;
}

function chronological(a: FoodLogRow, b: FoodLogRow): number {
  if (a.date_introduced !== b.date_introduced)
    return a.date_introduced < b.date_introduced ? -1 : 1;
  return (a.created_at ?? "").localeCompare(b.created_at ?? "");
}

/** Ids of the entries that were the first time the baby had that food. */
export function firstTryIds(foods: FoodLogRow[]): Set<string> {
  const seen = new Set<string>();
  const ids = new Set<string>();
  for (const f of [...foods].sort(chronological)) {
    const k = foodKey(f);
    if (seen.has(k)) continue;
    seen.add(k);
    ids.add(f.id);
  }
  return ids;
}

/** True when nothing already logged matches this food — i.e. saving it is a first try. */
export function isNewFood(
  foods: FoodLogRow[],
  food: { food_name: string; brand?: string | null },
  excludeId?: string | null,
): boolean {
  const k = foodKey(food);
  return !foods.some((f) => f.id !== excludeId && foodKey(f) === k);
}

export function uniqueFoodCount(foods: { food_name: string; brand?: string | null }[]): number {
  return new Set(foods.map(foodKey)).size;
}

/** Local YYYY-MM-DD (not UTC, so "today" doesn't flip at 5pm in California). */
export function localISODate(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function daysBefore(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return localISODate(new Date(y!, m! - 1, d! - n));
}

export type FoodPeriod = "today" | "week" | "earlier";

export function foodPeriod(date: string, today: string = localISODate()): FoodPeriod {
  if (date >= today) return "today";
  if (date > daysBefore(today, 7)) return "week";
  return "earlier";
}

/** Splits an already newest-first list into Today / This week / Earlier, keeping order. */
export function groupByPeriod<T extends { date_introduced: string }>(
  foods: T[],
  today: string = localISODate(),
): { period: FoodPeriod; label: string; items: T[] }[] {
  const labels: Record<FoodPeriod, string> = {
    today: "Today",
    week: "This week",
    earlier: "Earlier",
  };
  const buckets: Record<FoodPeriod, T[]> = { today: [], week: [], earlier: [] };
  for (const f of foods) buckets[foodPeriod(f.date_introduced, today)].push(f);
  return (["today", "week", "earlier"] as const)
    .filter((p) => buckets[p].length > 0)
    .map((p) => ({ period: p, label: labels[p], items: buckets[p] }));
}

/**
 * The most recently eaten distinct foods (latest entry of each), newest
 * first — the "Your usual foods" quick picks for logging a daily staple.
 */
export function recentDistinctFoods<T extends FoodLogRow>(foods: T[], limit = 8): T[] {
  const sorted = [...foods].sort((a, b) => chronological(b, a));
  const seen = new Set<string>();
  const out: T[] = [];
  for (const f of sorted) {
    const k = foodKey(f);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(f);
    if (out.length >= limit) break;
  }
  return out;
}

export function weekStats(
  foods: FoodLogRow[],
  today: string = localISODate(),
): { loggedThisWeek: number; newThisWeek: number } {
  const firsts = firstTryIds(foods);
  const thisWeek = foods.filter((f) => foodPeriod(f.date_introduced, today) !== "earlier");
  return {
    loggedThisWeek: thisWeek.length,
    newThisWeek: thisWeek.filter((f) => firsts.has(f.id)).length,
  };
}

/** How many of the top 9 allergens have a tagged " (Allergen)" entry in the log. */
export function allergensTriedCount(foods: { food_name: string }[]): number {
  const tried = new Set<Allergen>();
  for (const f of foods) {
    const match = TOP_ALLERGENS.find((a: Allergen) => f.food_name.endsWith(` (${a})`));
    if (match) tried.add(match);
  }
  return tried.size;
}
