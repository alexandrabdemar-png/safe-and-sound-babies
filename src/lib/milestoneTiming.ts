// Pure age-awareness layer for the moment-logging safety tips
// (moments_.new.tsx's MOMENT_SAFETY_MAP / getSafetyTip). Previously that
// matching was purely text-based — getSafetyTip(title) took no age
// information at all, so a milestone reached notably early or late got
// identical treatment to one reached right on schedule.
//
// This deliberately does NOT change which safety actions are shown for a
// given milestone — the babyproofing steps needed once a baby starts
// crawling are the same whether they're 6 months or 10 months old. What
// it adds is a brief, non-alarming timing note alongside the existing
// tips, using the same adjusted-age (preemie-corrected) math the rest of
// the app already uses for age-appropriateness checks (see
// ageAppropriateness.ts, the same pattern this mirrors).
//
// Typical ranges are deliberately wide bands (not single "average" ages),
// drawn from general pediatric developmental milestone guidance (CDC
// "Learn the Signs. Act Early." / AAP) — early/late here means genuinely
// outside a wide normal range, not "a week off the median."
import { computeAdjustedAge } from "./adjustedAge";

export type MilestoneKey =
  | "rolling"
  | "sitting"
  | "crawling"
  | "pulling_to_stand"
  | "standing"
  | "first_steps"
  | "first_tooth"
  | "first_food";

export const MILESTONE_TYPICAL_AGE_MONTHS: Record<MilestoneKey, { min: number; max: number }> = {
  rolling: { min: 3, max: 6 },
  sitting: { min: 5, max: 8 },
  crawling: { min: 6, max: 10 },
  pulling_to_stand: { min: 7, max: 10 },
  standing: { min: 9, max: 12 },
  first_steps: { min: 9, max: 15 },
  first_tooth: { min: 4, max: 10 },
  first_food: { min: 4, max: 7 },
};

export type MilestoneTiming = null | {
  kind: "early" | "typical" | "late";
  ageMonths: number;
  typicalMinMonths: number;
  typicalMaxMonths: number;
  adjusted: boolean;
};

/**
 * null when there's nothing to say: no typical range defined for this
 * milestone (e.g. "lowering the crib mattress" is a parent action, not a
 * developmental milestone with its own typical age), or the child's DOB
 * isn't known.
 */
export function evaluateMilestoneTiming(
  milestoneKey: MilestoneKey | null,
  dateOfBirth: string | null | undefined,
  loggedAt: string | Date,
  dueDate?: string | null | undefined,
): MilestoneTiming {
  if (!milestoneKey) return null;
  const range = MILESTONE_TYPICAL_AGE_MONTHS[milestoneKey];
  if (!range) return null;
  if (!dateOfBirth) return null;

  const age = computeAdjustedAge({
    dateOfBirth,
    dueDate,
    now: typeof loggedAt === "string" ? new Date(loggedAt) : loggedAt,
  });
  if (!age) return null;

  const ageMonths = age.adjustedMonths;
  const kind = ageMonths < range.min ? "early" : ageMonths > range.max ? "late" : "typical";
  return {
    kind,
    ageMonths,
    typicalMinMonths: range.min,
    typicalMaxMonths: range.max,
    adjusted: age.correctionActive,
  };
}

/**
 * Warm, non-alarming copy for the "early"/"late" cases — deliberately
 * says nothing for "typical" (the calling UI should just render no note
 * at all in that case, not a bland "right on schedule" filler line).
 */
export function milestoneTimingNote(timing: MilestoneTiming): string | null {
  if (!timing || timing.kind === "typical") return null;
  const adjustedNote = timing.adjusted ? " (adjusted for your due date)" : "";
  if (timing.kind === "early") {
    return (
      `You logged this a little earlier than the typical range${adjustedNote} — plenty of ` +
      `babies do, and it's not something to worry about. It's still worth acting on the ` +
      `babyproofing steps below now rather than waiting, since your baby's already there.`
    );
  }
  return (
    `You logged this a little later than the typical range${adjustedNote} — every baby ` +
    `develops on their own timeline, and this is well within normal variation. Mention it ` +
    `at your next checkup if you'd like, but it's not a cause for concern on its own.`
  );
}
