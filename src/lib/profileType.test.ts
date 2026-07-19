import { describe, it, expect } from "vitest";
import {
  PROFILE_TYPES,
  usesAgeRangeFlow,
  validateAgeRange,
  formatAgeMonths,
  formatAgeRange,
  MAX_CARE_AGE_MONTHS,
  type ProfileType,
} from "./profileType";

describe("PROFILE_TYPES", () => {
  it("has exactly the six required options, in order", () => {
    expect(PROFILE_TYPES.map((p) => p.value)).toEqual([
      "parent",
      "parent_to_be",
      "pediatrician",
      "daycare",
      "babysitter_nanny",
      "caregiver",
    ]);
  });

  it("has no duplicate values", () => {
    const values = PROFILE_TYPES.map((p) => p.value);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe("usesAgeRangeFlow", () => {
  it("is false for parent and parent-to-be — they use the single-child flow", () => {
    expect(usesAgeRangeFlow("parent")).toBe(false);
    expect(usesAgeRangeFlow("parent_to_be")).toBe(false);
  });

  it("is true for every caregiving-professional role", () => {
    expect(usesAgeRangeFlow("pediatrician")).toBe(true);
    expect(usesAgeRangeFlow("daycare")).toBe(true);
    expect(usesAgeRangeFlow("babysitter_nanny")).toBe(true);
    expect(usesAgeRangeFlow("caregiver")).toBe(true);
  });

  it("covers every profile type with no gaps (exhaustiveness check)", () => {
    for (const { value } of PROFILE_TYPES) {
      expect(typeof usesAgeRangeFlow(value)).toBe("boolean");
    }
  });
});

describe("validateAgeRange", () => {
  it("rejects null min or max", () => {
    expect(validateAgeRange(null, 24).valid).toBe(false);
    expect(validateAgeRange(0, null).valid).toBe(false);
    expect(validateAgeRange(null, null).valid).toBe(false);
  });

  it("rejects negative ages", () => {
    expect(validateAgeRange(-1, 24).valid).toBe(false);
    expect(validateAgeRange(0, -5).valid).toBe(false);
  });

  it("rejects non-integer ages", () => {
    expect(validateAgeRange(1.5, 24).valid).toBe(false);
    expect(validateAgeRange(0, 24.25).valid).toBe(false);
  });

  it("rejects max < min", () => {
    expect(validateAgeRange(24, 12).valid).toBe(false);
  });

  it("accepts max === min (a caregiver who only cares for one specific age)", () => {
    expect(validateAgeRange(12, 12).valid).toBe(true);
  });

  it("accepts the boundary at 0 months", () => {
    expect(validateAgeRange(0, 0).valid).toBe(true);
  });

  it("accepts a normal range", () => {
    expect(validateAgeRange(0, 24).valid).toBe(true);
  });

  it("accepts exactly the max allowed age", () => {
    expect(validateAgeRange(0, MAX_CARE_AGE_MONTHS).valid).toBe(true);
  });

  it("rejects an age beyond the max allowed", () => {
    expect(validateAgeRange(0, MAX_CARE_AGE_MONTHS + 1).valid).toBe(false);
    expect(validateAgeRange(MAX_CARE_AGE_MONTHS + 1, MAX_CARE_AGE_MONTHS + 1).valid).toBe(false);
  });
});

describe("formatAgeMonths", () => {
  it("formats under a year in months", () => {
    expect(formatAgeMonths(0)).toBe("0 mo");
    expect(formatAgeMonths(6)).toBe("6 mo");
    expect(formatAgeMonths(11)).toBe("11 mo");
  });

  it("formats whole years without a remainder", () => {
    expect(formatAgeMonths(12)).toBe("1 yr");
    expect(formatAgeMonths(24)).toBe("2 yrs");
  });

  it("formats years plus a remainder", () => {
    expect(formatAgeMonths(18)).toBe("1y 6mo");
    expect(formatAgeMonths(30)).toBe("2y 6mo");
  });
});

describe("formatAgeRange", () => {
  it("formats a full range", () => {
    expect(formatAgeRange(0, 24)).toBe("0 mo – 2 yrs");
  });
});

describe("ProfileType exhaustiveness (compile-time)", () => {
  it("the exported type matches every PROFILE_TYPES value", () => {
    const values: ProfileType[] = PROFILE_TYPES.map((p) => p.value);
    expect(values.length).toBe(6);
  });
});
