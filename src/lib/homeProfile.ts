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

/**
 * Given the row (if any) returned from the DB for the current user, decide
 * which UI state the personalize-reminders card should be in. Extracted so
 * the "don't ever prompt again once the user has interacted" rule can be
 * unit tested without React/Supabase.
 *
 * Rules (in priority order):
 *   - Row with `dismissed_at` set → user tapped "Skip" before → "skipped".
 *   - Row exists at all (any answered questions) → "done".
 *   - No row → "pending" (first-time user; show the card).
 */
export type HomeProfileSetupState = "pending" | "done" | "skipped";
export function resolveHomeProfileSetupState(
  hp: { dismissed_at?: string | null } | null | undefined,
): HomeProfileSetupState {
  if (!hp) return "pending";
  if (hp.dismissed_at) return "skipped";
  return "done";
}

/**
 * Whether the "Help us personalize your reminders" card should actually be
 * rendered right now. We only prompt when (a) the user is in the pending
 * state AND (b) we've finished checking the DB — otherwise a new device
 * (empty localStorage) briefly flashes the card on every login, even though
 * the answers are already saved server-side, which reads as "keeps prompting
 * me every time I log in".
 */
export function shouldShowHomeProfileCard(
  state: HomeProfileSetupState,
  loaded: boolean,
): boolean {
  return state === "pending" && loaded;
}

