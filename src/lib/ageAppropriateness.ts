// Pure age-appropriateness evaluator extracted from products_.scan.tsx so it
// can be unit-tested independently of React.
//
// Given a child's DOB (and optional due date for preemie correction) and a
// category with min/max recommended ages, returns:
//   • null                  — no applicable warning (fits current age, or DOB unknown)
//   • { kind: "too-early" } — scanned before the recommended start age;
//                             the app still lets them save (may be prepping ahead)
//                             but shows a "Wait until X" banner
//   • { kind: "outgrown" }  — past the soft ceiling for this category
import { computeAdjustedAge } from "./adjustedAge";

export type AgeAppropriatenessCategory = {
  label: string;
  minAgeMonths?: number;
  maxAgeMonths?: number;
};

export type AgeAppropriatenessInput = {
  category: AgeAppropriatenessCategory | undefined | null;
  dateOfBirth: string | null | undefined;
  dueDate?: string | null | undefined;
  now?: Date;
};

export type AgeAppropriatenessResult =
  | null
  | {
      kind: "too-early";
      label: string;
      minAgeMonths: number;
      currentAgeMonths: number;
      startDate: Date;
      adjusted: boolean;
    }
  | {
      kind: "outgrown";
      label: string;
      maxAgeMonths: number;
      currentAgeMonths: number;
      adjusted: boolean;
    };

export function evaluateAgeAppropriateness(
  input: AgeAppropriatenessInput,
): AgeAppropriatenessResult {
  const cat = input.category;
  if (!cat) return null;
  if (!input.dateOfBirth) return null;
  const age = computeAdjustedAge({
    dateOfBirth: input.dateOfBirth,
    dueDate: input.dueDate,
    now: input.now,
  });
  if (!age) return null;
  const ageMonths = age.adjustedMonths;
  if (typeof cat.minAgeMonths === "number" && ageMonths < cat.minAgeMonths) {
    const dob = new Date(input.dateOfBirth);
    const startDate = new Date(dob);
    startDate.setMonth(
      startDate.getMonth() +
        cat.minAgeMonths +
        (age.correctionActive ? Math.ceil(age.correctionDays / 30.4375) : 0),
    );
    return {
      kind: "too-early",
      label: cat.label,
      minAgeMonths: cat.minAgeMonths,
      currentAgeMonths: ageMonths,
      startDate,
      adjusted: age.correctionActive,
    };
  }
  if (typeof cat.maxAgeMonths === "number" && ageMonths > cat.maxAgeMonths) {
    return {
      kind: "outgrown",
      label: cat.label,
      maxAgeMonths: cat.maxAgeMonths,
      currentAgeMonths: ageMonths,
      adjusted: age.correctionActive,
    };
  }
  return null;
}
