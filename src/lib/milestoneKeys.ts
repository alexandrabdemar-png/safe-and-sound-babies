// Shared developmental-milestone taxonomy. Used by moments_.new.tsx (to tag
// which safety-tip entries correspond to a real developmental milestone) and
// by insights.ts (to drive "Up next" guidance off milestones the parent has
// actually logged, rather than the child's age).
export type MilestoneKey =
  | "rolling"
  | "sitting"
  | "crawling"
  | "pulling_to_stand"
  | "standing"
  | "first_steps"
  | "first_tooth"
  | "first_food";

// Rough developmental order for the mobility-related milestones — lets
// callers ask "has this child reached at least X" without requiring every
// earlier stage to have been individually logged (a parent may log
// "crawling" without ever having logged "rolling").
export const MOBILITY_STAGE_ORDER: MilestoneKey[] = [
  "rolling",
  "sitting",
  "crawling",
  "pulling_to_stand",
  "standing",
  "first_steps",
];

/** True when `logged` contains `atLeast` or any later mobility stage. */
export function reachedMobilityStage(
  logged: ReadonlySet<MilestoneKey>,
  atLeast: MilestoneKey,
): boolean {
  const idx = MOBILITY_STAGE_ORDER.indexOf(atLeast);
  if (idx === -1) return logged.has(atLeast);
  return MOBILITY_STAGE_ORDER.slice(idx).some((k) => logged.has(k));
}
