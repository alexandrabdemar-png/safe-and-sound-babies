// Pure helpers for the Home screen's "personalize your reminders" quiz
// (src/routes/_authenticated/home.tsx's HomePersonalizationCard), extracted
// so the step-advancement/save-trigger logic is unit-testable independent
// of React state and Supabase.

export type HomeProfileAnswers = {
  has_stairs: boolean;
  home_type: string;
  has_pet: boolean;
  has_car: boolean;
  in_daycare: "daycare" | "home" | "both";
  has_pool: boolean;
};

// has_stairs, home_type, has_pet, has_car, in_daycare, has_pool
export const HOME_PROFILE_QUESTION_COUNT = 6;

/**
 * True only once the LAST question (has_pool, displayed as "Question 6 of
 * 6") has actually been answered. Previously hardcoded as `step === 5`,
 * which fired the save right as the user answered question 5 (in_daycare)
 * instead of question 6 — since the save also flips homeProfileSetup to
 * "done" (which hides the whole card, gated on === "pending"), that one-off
 * error meant the 6th question was never shown or answered at all, and its
 * value was always persisted as the unanswered default.
 */
export function isLastHomeProfileQuestionStep(step: number): boolean {
  return step === HOME_PROFILE_QUESTION_COUNT;
}

/** Fills in the same defaults the save handler uses for any question the
 * parent skipped past (shouldn't normally happen given the step gating,
 * but keeps the save payload well-typed and complete regardless). */
export function buildHomeProfileAnswers(updated: Partial<HomeProfileAnswers>): HomeProfileAnswers {
  return {
    has_stairs: updated.has_stairs ?? false,
    home_type: updated.home_type ?? "Other",
    has_pet: updated.has_pet ?? false,
    has_car: updated.has_car ?? true,
    in_daycare: updated.in_daycare ?? "home",
    has_pool: updated.has_pool ?? false,
  };
}
