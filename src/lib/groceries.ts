// Grocery Recall Watch: packaged foods the family buys (snacks, pouches,
// pantry staples) stored as `products` rows (product_type 'food', category
// GROCERY_CATEGORY), so the existing recall scan checks them against FDA
// food recalls and alerts the same way it does for baby gear.
//
// Each food is one row. Buying it again moves its purchased_at to today
// instead of adding a duplicate, so the list stays short and a recall
// alerts once per food, not once per shopping trip.

export const GROCERY_CATEGORY = "Groceries";

/** Items not bought for this many weeks are grouped as "older". */
export const OLDER_AFTER_WEEKS = 8;

export type GroceryItem = {
  id: string;
  name: string;
  brand: string | null;
  barcode: string | null;
  purchased_at: string | null;
  created_at: string;
  recalled: boolean;
  recall_checked_at: string | null;
};

export function boughtAt(item: GroceryItem): Date {
  return new Date(item.purchased_at ?? item.created_at);
}

/** Monday 00:00 (local time) of the week containing `d`. */
export function startOfWeek(d: Date): Date {
  const s = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  s.setDate(s.getDate() - ((s.getDay() + 6) % 7));
  return s;
}

export type GroceryWeek = { key: string; label: string; items: GroceryItem[] };

/**
 * Groups items by the week they were last bought, newest week first:
 * "This week", "Last week", "Week of Oct 6", then a single "Older" group
 * for anything not bought in OLDER_AFTER_WEEKS weeks.
 */
export function groupByWeek(items: GroceryItem[], now: Date = new Date()): GroceryWeek[] {
  const thisWeek = startOfWeek(now).getTime();
  const WEEK = 7 * 86_400_000;
  const groups = new Map<string, GroceryWeek & { sort: number }>();
  for (const item of items) {
    const weekStart = startOfWeek(boughtAt(item));
    // Rounded: a daylight-saving change makes a week 1 hour short or long.
    const weeksAgo = Math.max(0, Math.round((thisWeek - weekStart.getTime()) / WEEK));
    let key: string, label: string, sort: number;
    if (weeksAgo >= OLDER_AFTER_WEEKS) {
      key = "older";
      label = "Older";
      sort = OLDER_AFTER_WEEKS;
    } else {
      key = `w${weeksAgo}`;
      sort = weeksAgo;
      label =
        weeksAgo === 0
          ? "This week"
          : weeksAgo === 1
            ? "Last week"
            : `Week of ${weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
    }
    const g = groups.get(key) ?? { key, label, items: [], sort };
    g.items.push(item);
    groups.set(key, g);
  }
  return [...groups.values()]
    .sort((a, b) => a.sort - b.sort)
    .map(({ key, label, items }) => ({
      key,
      label,
      items: [...items].sort((a, b) => boughtAt(b).getTime() - boughtAt(a).getTime()),
    }));
}

function norm(s: string | null | undefined): string {
  return (s ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** An item already on the list for the same food: same barcode, or same name + brand. */
export function findExisting(
  items: GroceryItem[],
  food: { name: string; brand: string | null; barcode: string | null },
): GroceryItem | undefined {
  const code = (food.barcode ?? "").replace(/\D/g, "");
  if (code) {
    const byCode = items.find((i) => (i.barcode ?? "").replace(/\D/g, "") === code);
    if (byCode) return byCode;
  }
  return items.find((i) => norm(i.name) === norm(food.name) && norm(i.brand) === norm(food.brand));
}

export type GroceryStatus = { label: string; tone: "alert" | "ok" | "pending" | "warn" };

export function groceryStatus(item: GroceryItem): GroceryStatus {
  if (item.recalled)
    return { label: "Possible recall match — tap to see the alert", tone: "alert" };
  // Recall notices name the brand; matching on the product name alone
  // ("Chocolate Chips") would flag every brand's recall.
  if (!item.brand?.trim())
    return { label: "Add the brand so we can check for recalls", tone: "warn" };
  if (!item.recall_checked_at)
    return { label: "Waiting for the first recall check", tone: "pending" };
  const when = new Date(item.recall_checked_at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  return { label: `No recall found · checked ${when}`, tone: "ok" };
}
