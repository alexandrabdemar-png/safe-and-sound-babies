import { describe, it, expect } from "vitest";
import { predictReplacementDate, formatMonthYear, daysBetween, isOverdue } from "./predictions";

describe("isOverdue", () => {
  it("is false for a null date", () => {
    expect(isOverdue(null, "2026-08-13")).toBe(false);
  });

  it("is true for a date before today — the actual 'June 2026 replace date, it's August' bug", () => {
    expect(isOverdue("2026-06-01", "2026-08-13")).toBe(true);
  });

  it("is false for today itself", () => {
    expect(isOverdue("2026-08-13", "2026-08-13")).toBe(false);
  });

  it("is false for a future date", () => {
    expect(isOverdue("2026-09-01", "2026-08-13")).toBe(false);
  });

  it("handles a full timestamp, not just a plain date, by comparing only the date portion", () => {
    expect(isOverdue("2026-06-01T23:59:59.000Z", "2026-08-13")).toBe(true);
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
