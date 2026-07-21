// Shared age-relevance filter for checklist items that carry optional
// minAgeMonths/maxAgeMonths bounds (see checklists.tsx, travel-checklist.tsx).
// Mirrors the min/max pattern already used in ageAppropriateness.ts.

export type AgeBoundedItem = {
  minAgeMonths?: number;
  maxAgeMonths?: number;
};

// ageMonths === null means "no active child / no known birth date" — in that
// case every item is treated as relevant since there's nothing to filter by.
export function isItemRelevantForAge(item: AgeBoundedItem, ageMonths: number | null): boolean {
  if (ageMonths == null) return true;
  if (typeof item.minAgeMonths === "number" && ageMonths < item.minAgeMonths) return false;
  if (typeof item.maxAgeMonths === "number" && ageMonths > item.maxAgeMonths) return false;
  return true;
}
