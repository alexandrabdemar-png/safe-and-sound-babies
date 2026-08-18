import { describe, expect, it } from "vitest";
import { TRAVEL_SECTIONS } from "./travelChecklistData";

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
});
