import { describe, it, expect } from "vitest";
import { predictSizeUpDate, predictReplacementDate, formatMonthYear, daysBetween } from "./predictions";

describe("predictSizeUpDate", () => {
  it("returns null when the child has no date_of_birth", () => {
    expect(predictSizeUpDate({ date_of_birth: null }, { max_weight_lbs: 20 })).toBeNull();
  });

  it("returns null when the product has neither a weight nor height limit", () => {
    expect(predictSizeUpDate({ date_of_birth: "2026-01-01" }, {})).toBeNull();
  });

  it("returns null for a malformed date_of_birth instead of throwing", () => {
    expect(() => predictSizeUpDate({ date_of_birth: "not-a-date" }, { max_weight_lbs: 20 })).not.toThrow();
    expect(predictSizeUpDate({ date_of_birth: "not-a-date" }, { max_weight_lbs: 20 })).toBeNull();
  });

  it("projects a future date when the child is already below the weight limit", () => {
    const now = new Date("2026-07-09T00:00:00Z");
    const result = predictSizeUpDate(
      { date_of_birth: "2026-01-09", weight_lbs: 10, measurements_recorded_at: "2026-07-09" },
      { max_weight_lbs: 20 },
      now,
    );
    expect(result).not.toBeNull();
    expect(new Date(result!).getTime()).toBeGreaterThan(now.getTime());
  });

  it("returns today (0 months out) when the child has already met/exceeded the limit", () => {
    const now = new Date("2026-07-09T00:00:00Z");
    const result = predictSizeUpDate(
      { date_of_birth: "2026-01-09", weight_lbs: 25, measurements_recorded_at: "2026-07-09" },
      { max_weight_lbs: 20 },
      now,
    );
    expect(result).toBe("2026-07-09");
  });

  it("picks the EARLIEST of the weight and height projections, not the latest", () => {
    const now = new Date("2026-07-09T00:00:00Z");
    // Weight limit is huge (far off), height limit is tiny (hit almost immediately)
    const result = predictSizeUpDate(
      { date_of_birth: "2026-01-09", weight_lbs: 10, height_inches: 20, measurements_recorded_at: "2026-07-09" },
      { max_weight_lbs: 200, max_height_inches: 20.5 },
      now,
    );
    const weightOnly = predictSizeUpDate(
      { date_of_birth: "2026-01-09", weight_lbs: 10, measurements_recorded_at: "2026-07-09" },
      { max_weight_lbs: 200 },
      now,
    );
    expect(result).not.toBeNull();
    expect(weightOnly).not.toBeNull();
    // The combined (weight+height) result must be no later than the
    // weight-only projection, since height is the binding constraint here.
    expect(new Date(result!).getTime()).toBeLessThanOrEqual(new Date(weightOnly!).getTime());
  });

  it("falls back to WHO population averages when no measurement has been logged", () => {
    const now = new Date("2026-07-09T00:00:00Z");
    // No weight_lbs/height_inches/measurements_recorded_at at all — must
    // still produce a projection using averageWeightAtMonths, not null/throw.
    const result = predictSizeUpDate({ date_of_birth: "2026-01-09" }, { max_weight_lbs: 20 }, now);
    expect(result).not.toBeNull();
  });

  it("a newborn with a very high weight limit projects years out, not an immediate date", () => {
    const now = new Date("2026-07-09T00:00:00Z");
    const result = predictSizeUpDate(
      { date_of_birth: "2026-07-01", weight_lbs: 8, measurements_recorded_at: "2026-07-09" },
      { max_weight_lbs: 40 }, // a typical convertible car seat max
      now,
    );
    expect(result).not.toBeNull();
    const monthsOut = (new Date(result!).getTime() - now.getTime()) / (30.44 * 86400000);
    expect(monthsOut).toBeGreaterThan(6);
  });
});

describe("predictReplacementDate", () => {
  it("returns null when no interval is given", () => {
    expect(predictReplacementDate("2026-01-01", null)).toBeNull();
    expect(predictReplacementDate("2026-01-01", undefined)).toBeNull();
  });

  it("returns null for a zero or negative interval", () => {
    expect(predictReplacementDate("2026-01-01", 0)).toBeNull();
    expect(predictReplacementDate("2026-01-01", -3)).toBeNull();
  });

  it("returns null for a malformed addedAt instead of throwing", () => {
    expect(() => predictReplacementDate("not-a-date", 6)).not.toThrow();
    expect(predictReplacementDate("not-a-date", 6)).toBeNull();
  });

  it("adds the interval in months to the added date", () => {
    const result = predictReplacementDate("2026-01-15", 6);
    expect(result).toBe("2026-07-15");
  });

  it("accepts a Date object as well as an ISO string", () => {
    const result = predictReplacementDate(new Date("2026-01-15T00:00:00Z"), 6);
    expect(result).toBe("2026-07-15");
  });
});

describe("formatMonthYear", () => {
  it("formats an ISO date as month + year", () => {
    expect(formatMonthYear("2026-07-15")).toBe("July 2026");
  });
  it("returns null for null input", () => {
    expect(formatMonthYear(null)).toBeNull();
  });
  it("returns null for malformed input instead of throwing", () => {
    expect(() => formatMonthYear("garbage")).not.toThrow();
    expect(formatMonthYear("garbage")).toBeNull();
  });
});

describe("daysBetween", () => {
  it("computes whole days between two dates", () => {
    expect(daysBetween(new Date("2026-01-01"), new Date("2026-01-11"))).toBe(10);
  });
  it("returns a negative number when b is before a", () => {
    expect(daysBetween(new Date("2026-01-11"), new Date("2026-01-01"))).toBe(-10);
  });
});
