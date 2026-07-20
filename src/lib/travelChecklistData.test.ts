import { describe, expect, it } from "vitest";
import { TRAVEL_SECTIONS } from "./travelChecklistData";
import { isItemRelevantForAge } from "./checklistAgeFilter";

describe("TRAVEL_SECTIONS", () => {
  const allItems = TRAVEL_SECTIONS.flatMap((s) => s.items);
  const allKeys = allItems.map((i) => i.key);

  it("has at least one section, each with at least one item", () => {
    expect(TRAVEL_SECTIONS.length).toBeGreaterThan(0);
    for (const section of TRAVEL_SECTIONS) {
      expect(section.items.length).toBeGreaterThan(0);
    }
  });

  it("has no duplicate item keys across sections", () => {
    const seen = new Set<string>();
    const duplicates: string[] = [];
    for (const key of allKeys) {
      if (seen.has(key)) duplicates.push(key);
      seen.add(key);
    }
    expect(duplicates).toEqual([]);
  });

  it("has no duplicate section ids", () => {
    const ids = TRAVEL_SECTIONS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every item and section has non-empty label text", () => {
    for (const section of TRAVEL_SECTIONS) {
      expect(section.label.trim().length).toBeGreaterThan(0);
      for (const item of section.items) {
        expect(item.label.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("every age bound is a finite number within a plausible 0-18yr range, and min never exceeds max", () => {
    for (const item of allItems) {
      if (item.minAgeMonths !== undefined) {
        expect(Number.isFinite(item.minAgeMonths)).toBe(true);
        expect(item.minAgeMonths).toBeGreaterThanOrEqual(0);
        expect(item.minAgeMonths).toBeLessThanOrEqual(216);
      }
      if (item.maxAgeMonths !== undefined) {
        expect(Number.isFinite(item.maxAgeMonths)).toBe(true);
        expect(item.maxAgeMonths).toBeLessThanOrEqual(216);
      }
      if (item.minAgeMonths !== undefined && item.maxAgeMonths !== undefined) {
        expect(item.minAgeMonths).toBeLessThanOrEqual(item.maxAgeMonths);
      }
    }
  });

  it("the forward-facing tether item is hidden for a rear-facing-only infant (under 24 months) and shown at 24+", () => {
    const tether = allItems.find((i) => i.key === "travel_cs_tether")!;
    expect(isItemRelevantForAge(tether, 0)).toBe(false);
    expect(isItemRelevantForAge(tether, 12)).toBe(false);
    expect(isItemRelevantForAge(tether, 23)).toBe(false);
    expect(isItemRelevantForAge(tether, 24)).toBe(true);
    expect(isItemRelevantForAge(tether, 36)).toBe(true);
  });

  it("before-you-leave essentials (car seat prep, health records, safe sleep surface) are untagged and always shown", () => {
    const beforeYouLeave = TRAVEL_SECTIONS.find((s) => s.id === "before_you_leave")!;
    for (const item of beforeYouLeave.items) {
      expect(item.minAgeMonths).toBeUndefined();
      expect(item.maxAgeMonths).toBeUndefined();
    }
  });

  it("with no active child (ageMonths null) every item is shown, matching the pre-age-filter behavior", () => {
    for (const item of allItems) {
      expect(isItemRelevantForAge(item, null)).toBe(true);
    }
  });
});
