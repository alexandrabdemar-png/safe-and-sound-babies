// adjustedAge.ts — corrected-age math for babies born early.
//
// Why this exists: the American Academy of Pediatrics recommends timing
// developmental and safety milestones (rolling, sitting, solids introduction,
// crib mattress lowering) against a preemie's *adjusted* age — chronological
// age minus the number of weeks born early — until roughly 24 months
// chronological. Firing an 8-week-early baby's "start solids" reminder at
// 6 months chronological is ~2 months too soon.
//
// Inputs the app can supply:
//   • dateOfBirth (always known once a child is added)
//   • dueDate     (original expected delivery date; optional)
//   • birthWeek   (completed weeks of gestation at birth; optional fallback)
//
// If neither dueDate nor birthWeek is present, adjusted age === chronological
// age (safe fallback for term babies where the correction is a no-op anyway).

const FULL_TERM_WEEKS = 40;
const CORRECTION_STOPS_AT_MONTHS = 24; // per AAP guidance

export type AdjustedAgeInput = {
  dateOfBirth: string | Date | null | undefined;
  dueDate?: string | Date | null | undefined;
  birthWeek?: number | null | undefined;
  now?: Date; // testable clock
};

export type AdjustedAgeResult = {
  chronologicalDays: number;
  adjustedDays: number;
  correctionDays: number;
  chronologicalMonths: number;
  adjustedMonths: number;
  chronologicalWeeks: number;
  adjustedWeeks: number;
  isPreemie: boolean;
  correctionActive: boolean;
  weeksEarly: number | null;
};

function toDate(v: string | Date | null | undefined): Date | null {
  if (!v) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  const d = new Date(v.length === 10 ? v + "T00:00:00" : v);
  return isNaN(d.getTime()) ? null : d;
}

function diffDays(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / 86_400_000);
}

/**
 * Weeks early. Positive means born early (correction applies), zero or
 * negative means term/late (no correction). Prefers due date; falls back to
 * gestational-age-at-birth if only birthWeek is available.
 */
export function weeksEarly(input: AdjustedAgeInput): number | null {
  const dob = toDate(input.dateOfBirth);
  if (!dob) return null;

  const due = toDate(input.dueDate);
  if (due) {
    const days = diffDays(due, dob);
    if (days <= 0) return 0;
    return Math.round(days / 7);
  }
  if (typeof input.birthWeek === "number" && input.birthWeek > 0 && input.birthWeek < FULL_TERM_WEEKS) {
    return FULL_TERM_WEEKS - input.birthWeek;
  }
  return null;
}

export function computeAdjustedAge(input: AdjustedAgeInput): AdjustedAgeResult | null {
  const dob = toDate(input.dateOfBirth);
  if (!dob) return null;
  const now = input.now ?? new Date();

  const chronologicalDays = Math.max(0, diffDays(now, dob));
  const chronologicalMonths = Math.floor(chronologicalDays / 30.4375);

  const early = weeksEarly(input);
  const isPreemie = (early ?? 0) >= 3; // clinical shorthand: <=37 weeks
  const correctionActive = isPreemie && chronologicalMonths < CORRECTION_STOPS_AT_MONTHS;
  const correctionDays = correctionActive ? Math.max(0, (early ?? 0) * 7) : 0;
  const adjustedDays = Math.max(0, chronologicalDays - correctionDays);

  return {
    chronologicalDays,
    adjustedDays,
    correctionDays,
    chronologicalMonths,
    adjustedMonths: Math.floor(adjustedDays / 30.4375),
    chronologicalWeeks: Math.floor(chronologicalDays / 7),
    adjustedWeeks: Math.floor(adjustedDays / 7),
    isPreemie,
    correctionActive,
    weeksEarly: early,
  };
}

/**
 * Convenience: which age to use for milestone-reminder timing. Adjusted if
 * correction is currently active, chronological otherwise.
 */
export function reminderAgeWeeks(input: AdjustedAgeInput): number | null {
  const res = computeAdjustedAge(input);
  return res ? res.adjustedWeeks : null;
}

/**
 * Human-readable disclaimer suffix. Rendered under any age-derived reminder
 * for a preemie so it's transparent that the app is using adjusted age.
 */
export function adjustedAgeDisclaimer(input: AdjustedAgeInput): string | null {
  const res = computeAdjustedAge(input);
  if (!res || !res.correctionActive || res.weeksEarly == null) return null;
  return `Based on your baby's adjusted age (${res.weeksEarly} weeks early). General guidance — not a substitute for your pediatrician.`;
}
