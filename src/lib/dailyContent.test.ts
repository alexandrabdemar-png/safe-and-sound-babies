import { describe, it, expect } from "vitest";
import { ageSafetyTip, weekendReminder, growthCheckTip, monthsFromDob } from "./dailyContent";

describe("ageSafetyTip", () => {
  it("regression: does NOT return the same text every week for a fixed age — the reported bug", () => {
    // 10-month-old, same age all year; only weekNumber changes.
    const seen = new Set<string>();
    for (let week = 1; week <= 6; week++) {
      seen.add(ageSafetyTip(10, week));
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it("cycles back to the same text after a full lap of the variant pool (deterministic, not random)", () => {
    const first = ageSafetyTip(10, 1);
    const poolSize = new Set([1, 2, 3, 4, 5, 6].map((w) => ageSafetyTip(10, w))).size;
    expect(ageSafetyTip(10, 1 + poolSize)).toBe(first);
  });

  it("stays within the correct AAP-appropriate age bracket across all weeks", () => {
    // A 2-month-old should only ever see 0-4mo sleep-safety content, never
    // the crawling/gate content meant for older babies.
    for (let week = 1; week <= 10; week++) {
      const tip = ageSafetyTip(2, week);
      expect(tip).not.toMatch(/staircase|crawling/i);
    }
  });

  it("falls back to a rotating (not fixed) set of tips when no DOB is known", () => {
    const seen = new Set<string>();
    for (let week = 1; week <= 6; week++) {
      seen.add(ageSafetyTip(null, week));
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it("is a pure function: same age + same week always returns the same tip", () => {
    expect(ageSafetyTip(7, 23)).toBe(ageSafetyTip(7, 23));
  });
});

describe("weekendReminder", () => {
  it("regression: does NOT return the same text every week for a fixed age", () => {
    const seen = new Set<string>();
    for (let week = 1; week <= 6; week++) {
      seen.add(weekendReminder(20, week));
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it("stays within the correct age bracket across all weeks", () => {
    // A 3-month-old should only see the rear-facing car seat bracket's
    // content, never the balance-bike-helmet content meant for toddlers.
    for (let week = 1; week <= 10; week++) {
      const tip = weekendReminder(3, week);
      expect(tip).not.toMatch(/balance bike/i);
    }
  });

  it("is a pure function: same age + same week always returns the same reminder", () => {
    expect(weekendReminder(15, 40)).toBe(weekendReminder(15, 40));
  });
});

describe("growthCheckTip", () => {
  it("varies text week to week for a fixed age (Saturday's new rotating tip, alongside the measurements status)", () => {
    const seen = new Set<string>();
    for (let week = 1; week <= 6; week++) {
      seen.add(growthCheckTip(10, week));
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it("stays within the correct age bracket across all weeks", () => {
    for (let week = 1; week <= 10; week++) {
      const tip = growthCheckTip(2, week);
      expect(tip).not.toMatch(/booster seat|convertible car seat/i);
    }
  });

  it("falls back to a rotating (not fixed) set of tips when no DOB is known", () => {
    const seen = new Set<string>();
    for (let week = 1; week <= 6; week++) {
      seen.add(growthCheckTip(null, week));
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it("is a pure function: same age + same week always returns the same tip", () => {
    expect(growthCheckTip(20, 12)).toBe(growthCheckTip(20, 12));
  });

  it("reads distinctly from the Monday/Tuesday and Friday tip pools (no accidental text overlap) for a shared age/week", () => {
    const growth = growthCheckTip(12, 5);
    const quick = ageSafetyTip(12, 5);
    const weekend = weekendReminder(12, 5);
    expect(growth).not.toBe(quick);
    expect(growth).not.toBe(weekend);
  });
});

describe("monthsFromDob", () => {
  it("returns null when no DOB is given", () => {
    expect(monthsFromDob(null)).toBeNull();
  });

  it("returns 0 for a baby born this month", () => {
    const now = new Date();
    const dobStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    expect(monthsFromDob(dobStr)).toBe(0);
  });
});
