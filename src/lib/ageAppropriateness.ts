// Pure age-range describer extracted from products_.scan.tsx so it can be
// unit-tested independently of React.
//
// This used to compare a category's recommended age window against the
// child's DOB (adjusted for prematurity) and return a personalized
// "too-early"/"outgrown" verdict. Per a deliberate product/privacy
// decision, the app no longer collects or stores a child's birthdate — so
// this now just states the category's typical age range as plain,
// unpersonalized information. The parent compares it against their own
// child themselves.
export type AgeAppropriatenessCategory = {
  label: string;
  minAgeMonths?: number;
  maxAgeMonths?: number;
};

export type AgeRangeInfo = null | {
  label: string;
  minAgeMonths?: number;
  maxAgeMonths?: number;
};

/**
 * Returns the category's typical age range for display, or null when the
 * category has no meaningful range to show (no min/max at all, or a
 * min of 0 with no max — "appropriate from birth onward" isn't worth a banner).
 */
export function describeAgeRange(
  category: AgeAppropriatenessCategory | null | undefined,
): AgeRangeInfo {
  if (!category) return null;
  const { minAgeMonths, maxAgeMonths } = category;
  const hasMin = typeof minAgeMonths === "number" && minAgeMonths > 0;
  const hasMax = typeof maxAgeMonths === "number";
  if (!hasMin && !hasMax) return null;
  return { label: category.label, minAgeMonths, maxAgeMonths };
}
