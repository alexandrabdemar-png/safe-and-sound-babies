import { describe, it, expect } from "vitest";
import { ageSafetyTip, weekendReminder, growthCheckTip, monthsFromDob, dayOfYear } from "./dailyContent";

describe("ageSafetyTip", () => {
  it("regression: does NOT return the same text every day for a fixed age — the reported bug", () => {
    // 10-month-old, same age all year; only dayNumber changes.
    const seen = new Set<string>();
    for (let day = 1; day <= 6; day++) {
      seen.add(ageSafetyTip(10, day));
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it("cycles back to the same text after a full lap of the variant pool (deterministic, not random)", () => {
    const first = ageSafetyTip(10, 1);
    const poolSize = new Set([1, 2, 3, 4, 5, 6].map((d) => ageSafetyTip(10, d))).size;
    expect(ageSafetyTip(10, 1 + poolSize)).toBe(first);
  });

  it("stays within the correct AAP-appropriate age bracket across all days", () => {
    // A 2-month-old should only ever see 0-4mo sleep-safety content, never
    // the crawling/gate content meant for older babies.
    for (let day = 1; day <= 10; day++) {
      const tip = ageSafetyTip(2, day);
      expect(tip).not.toMatch(/staircase|crawling/i);
    }
  });

  it("falls back to a rotating (not fixed) set of tips when no DOB is known", () => {
    const seen = new Set<string>();
    for (let day = 1; day <= 6; day++) {
      seen.add(ageSafetyTip(null, day));
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it("is a pure function: same age + same day always returns the same tip", () => {
    expect(ageSafetyTip(7, 23)).toBe(ageSafetyTip(7, 23));
  });

  // ── Regression coverage using real mocked dates via dayOfYear(), matching
  // the actual home.tsx call site: ageSafetyTip(months, dayOfYear(new Date())) ──
  it("shows a different tip on two different days", () => {
    const dayA = dayOfYear(new Date("2026-03-01T12:00:00Z"));
    const dayB = dayOfYear(new Date("2026-03-02T12:00:00Z"));
    expect(ageSafetyTip(10, dayA)).not.toBe(ageSafetyTip(10, dayB));
  });

  it("shows the identical tip when checked twice on the same day (stable within a day)", () => {
    const day = dayOfYear(new Date("2026-03-01T09:00:00Z"));
    const dayAgainLater = dayOfYear(new Date("2026-03-01T23:59:00Z"));
    expect(ageSafetyTip(10, day)).toBe(ageSafetyTip(10, dayAgainLater));
  });

  it("changes at UTC midnight — the last moment of one day differs in dayOfYear from the first moment of the next", () => {
    const lastMomentOfDay = dayOfYear(new Date("2026-03-01T23:59:59Z"));
    const firstMomentOfNextDay = dayOfYear(new Date("2026-03-02T00:00:00Z"));
    expect(firstMomentOfNextDay).toBe(lastMomentOfDay + 1);
  });
});

// ── Regression: stair-gate tip shown to a family with no stairs ───────────
//
// Reported bug: a user answered "no stairs" on the home_profile setup card
// but Monday/Tuesday's "Quick safety tip" still showed the 6-13mo
// bracket's stair-gate variant. home.tsx's AgeJumpCard already filtered
// its own stair-related actions by home_profile.has_stairs — this daily
// rotation didn't get the same treatment until now.
describe("ageSafetyTip with hasStairs === false", () => {
  it("never returns the stair-gate variant across a full lap of the 6-13mo bracket, where it would otherwise appear", () => {
    for (let day = 1; day <= 10; day++) {
      const tip = ageSafetyTip(10, day, false);
      expect(tip).not.toMatch(/staircase|stair/i);
    }
  });

  it("still rotates through the remaining (non-stair) variants rather than getting stuck on one", () => {
    const seen = new Set<string>();
    for (let day = 1; day <= 10; day++) {
      seen.add(ageSafetyTip(10, day, false));
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it("can still return the stair-gate variant when hasStairs is true or unset (unchanged default behavior)", () => {
    const seenWithStairs = new Set<string>();
    const seenUnset = new Set<string>();
    for (let day = 1; day <= 10; day++) {
      seenWithStairs.add(ageSafetyTip(10, day, true));
      seenUnset.add(ageSafetyTip(10, day));
    }
    expect([...seenWithStairs].some((t) => /staircase/i.test(t))).toBe(true);
    expect([...seenUnset].some((t) => /staircase/i.test(t))).toBe(true);
  });

  it("has no effect on age brackets that never mention stairs in the first place", () => {
    for (let day = 1; day <= 10; day++) {
      expect(ageSafetyTip(2, day, false)).toBe(ageSafetyTip(2, day, true));
    }
  });
});

describe("dayOfYear", () => {
  it("returns 1 for January 1st", () => {
    expect(dayOfYear(new Date("2026-01-01T00:00:00Z"))).toBe(1);
  });

  it("is monotonically increasing day to day", () => {
    expect(dayOfYear(new Date("2026-06-15T00:00:00Z"))).toBe(
      dayOfYear(new Date("2026-06-14T00:00:00Z")) + 1,
    );
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
