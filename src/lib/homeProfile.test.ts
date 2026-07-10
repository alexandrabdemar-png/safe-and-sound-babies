import { describe, it, expect } from "vitest";
import {
  isLastHomeProfileQuestionStep,
  buildHomeProfileAnswers,
  HOME_PROFILE_QUESTION_COUNT,
} from "./homeProfile";

describe("isLastHomeProfileQuestionStep", () => {
  it("is true only at step 6 (the actual last question, has_pool)", () => {
    expect(isLastHomeProfileQuestionStep(6)).toBe(true);
  });

  it("regression: is NOT true at step 5 (in_daycare) — the original off-by-one bug", () => {
    // The live bug: save fired here, one question early, which hid the
    // whole card (via homeProfileSetup -> "done") before question 6 was
    // ever shown, silently discarding whatever the user would have
    // answered for has_pool.
    expect(isLastHomeProfileQuestionStep(5)).toBe(false);
  });

  it("is false for every step before the last", () => {
    for (let step = 0; step < HOME_PROFILE_QUESTION_COUNT; step++) {
      expect(isLastHomeProfileQuestionStep(step)).toBe(false);
    }
  });

  it("matches HOME_PROFILE_QUESTION_COUNT exactly (6 questions today)", () => {
    expect(HOME_PROFILE_QUESTION_COUNT).toBe(6);
  });
});

describe("buildHomeProfileAnswers", () => {
  it("preserves every answer actually given, including the last one (has_pool)", () => {
    const result = buildHomeProfileAnswers({
      has_stairs: true,
      home_type: "apartment",
      has_pet: true,
      has_car: false,
      in_daycare: "both",
      has_pool: true,
    });
    expect(result).toEqual({
      has_stairs: true,
      home_type: "apartment",
      has_pet: true,
      has_car: false,
      in_daycare: "both",
      has_pool: true,
    });
  });

  it("accepts all three in_daycare options: daycare, home, and both", () => {
    expect(buildHomeProfileAnswers({ in_daycare: "daycare" }).in_daycare).toBe("daycare");
    expect(buildHomeProfileAnswers({ in_daycare: "home" }).in_daycare).toBe("home");
    expect(buildHomeProfileAnswers({ in_daycare: "both" }).in_daycare).toBe("both");
  });

  it("fills in sensible defaults for any answer not yet given", () => {
    const result = buildHomeProfileAnswers({});
    expect(result).toEqual({
      has_stairs: false,
      home_type: "Other",
      has_pet: false,
      has_car: true,
      in_daycare: "home",
      has_pool: false,
    });
  });
});
