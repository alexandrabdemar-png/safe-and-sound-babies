import { describe, expect, it } from "vitest";
import { ROOMS } from "./checklistsData";
import { isItemRelevantForAge } from "./checklistAgeFilter";

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

  it("nursery items are untagged (relevant from birth) — none of the newborn safe-sleep basics should be hidden from a day-1 parent", () => {
    const nursery = ROOMS.find((r) => r.id === "nursery");
    expect(nursery).toBeDefined();
    for (const item of nursery!.items) {
      expect(item.minAgeMonths).toBeUndefined();
    }
  });

  it("a newborn (age 0) sees the mobility-gated hazards hidden, and the always-relevant ones shown", () => {
    const cabinetLocks = allItems.find((i) => i.key === "kitchen_cabinet_locks")!;
    const waterHeaterTemp = allItems.find((i) => i.key === "bath_water_temp_120")!;
    expect(isItemRelevantForAge(cabinetLocks, 0)).toBe(false);
    expect(isItemRelevantForAge(waterHeaterTemp, 0)).toBe(true);
  });

  it("a 9-month-old (crawling/cruising) sees the mobility-gated hazards", () => {
    const cabinetLocks = allItems.find((i) => i.key === "kitchen_cabinet_locks")!;
    const toiletLock = allItems.find((i) => i.key === "bath_toilet_lock")!;
    expect(isItemRelevantForAge(cabinetLocks, 9)).toBe(true);
    expect(isItemRelevantForAge(toiletLock, 9)).toBe(true);
  });

  it("with no active child (ageMonths null) every item is shown, matching the pre-age-filter behavior", () => {
    for (const item of allItems) {
      expect(isItemRelevantForAge(item, null)).toBe(true);
    }
  });
});
