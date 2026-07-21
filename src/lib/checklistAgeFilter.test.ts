import { describe, expect, it } from "vitest";
import { isItemRelevantForAge } from "./checklistAgeFilter";

describe("isItemRelevantForAge", () => {
  it("treats every item as relevant when ageMonths is null (no active child / no known DOB)", () => {
    expect(isItemRelevantForAge({}, null)).toBe(true);
    expect(isItemRelevantForAge({ minAgeMonths: 9 }, null)).toBe(true);
    expect(isItemRelevantForAge({ maxAgeMonths: 2 }, null)).toBe(true);
    expect(isItemRelevantForAge({ minAgeMonths: 9, maxAgeMonths: 24 }, null)).toBe(true);
  });

  it("treats an untagged item (no bounds) as relevant at any age", () => {
    expect(isItemRelevantForAge({}, 0)).toBe(true);
    expect(isItemRelevantForAge({}, 6)).toBe(true);
    expect(isItemRelevantForAge({}, 36)).toBe(true);
  });

  describe("minAgeMonths only", () => {
    const item = { minAgeMonths: 6 };
    it("hides the item below the minimum", () => {
      expect(isItemRelevantForAge(item, 0)).toBe(false);
      expect(isItemRelevantForAge(item, 5)).toBe(false);
    });
    it("shows the item at exactly the minimum (inclusive)", () => {
      expect(isItemRelevantForAge(item, 6)).toBe(true);
    });
    it("shows the item above the minimum, with no ceiling", () => {
      expect(isItemRelevantForAge(item, 7)).toBe(true);
      expect(isItemRelevantForAge(item, 240)).toBe(true);
    });
  });

  describe("maxAgeMonths only", () => {
    const item = { maxAgeMonths: 24 };
    it("shows the item at or below the maximum (inclusive)", () => {
      expect(isItemRelevantForAge(item, 0)).toBe(true);
      expect(isItemRelevantForAge(item, 24)).toBe(true);
    });
    it("hides the item above the maximum", () => {
      expect(isItemRelevantForAge(item, 25)).toBe(false);
    });
  });

  describe("both bounds set", () => {
    const item = { minAgeMonths: 6, maxAgeMonths: 9 };
    it("hides below the range", () => {
      expect(isItemRelevantForAge(item, 5)).toBe(false);
    });
    it("shows on both inclusive boundaries and in between", () => {
      expect(isItemRelevantForAge(item, 6)).toBe(true);
      expect(isItemRelevantForAge(item, 7)).toBe(true);
      expect(isItemRelevantForAge(item, 9)).toBe(true);
    });
    it("hides above the range", () => {
      expect(isItemRelevantForAge(item, 10)).toBe(false);
    });
  });
});
