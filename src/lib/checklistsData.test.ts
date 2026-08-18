import { describe, expect, it } from "vitest";
import { ROOMS } from "./checklistsData";

describe("ROOMS", () => {
  const allItems = ROOMS.flatMap((r) => r.items);
  const allKeys = allItems.map((i) => i.key);

  it("has at least one room, each with at least one item", () => {
    expect(ROOMS.length).toBeGreaterThan(0);
    for (const room of ROOMS) {
      expect(room.items.length).toBeGreaterThan(0);
    }
  });

  it("has no duplicate item keys across rooms (duplicates would make one checkbox silently toggle two unrelated items)", () => {
    const seen = new Set<string>();
    const duplicates: string[] = [];
    for (const key of allKeys) {
      if (seen.has(key)) duplicates.push(key);
      seen.add(key);
    }
    expect(duplicates).toEqual([]);
  });

  it("has no duplicate room ids", () => {
    const ids = ROOMS.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every item and room has non-empty label text", () => {
    for (const room of ROOMS) {
      expect(room.label.trim().length).toBeGreaterThan(0);
      for (const item of room.items) {
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
