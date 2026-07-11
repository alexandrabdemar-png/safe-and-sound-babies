import { describe, it, expect } from "vitest";
import {
  estimateCarSeatExpiration,
  resolveCarSeatReplaceAt,
  DEFAULT_CAR_SEAT_LIFESPAN_YEARS,
} from "./carSeatExpiration";

describe("DEFAULT_CAR_SEAT_LIFESPAN_YEARS", () => {
  it("matches the DB trigger's default (6 years) — kept in sync deliberately", () => {
    expect(DEFAULT_CAR_SEAT_LIFESPAN_YEARS).toBe(6);
  });
});

describe("estimateCarSeatExpiration", () => {
  it("adds 6 years to the manufacture date", () => {
    expect(estimateCarSeatExpiration("2020-03-15")).toBe("2026-03-15");
  });

  it("regression: a hand-me-down seat manufactured years ago is flagged as already expired", () => {
    // The exact reported scenario: a car seat received today but
    // manufactured well before the safe-use window.
    const expiration = estimateCarSeatExpiration("2015-01-01");
    expect(new Date(expiration!).getTime()).toBeLessThan(Date.now());
  });

  it("returns null for null/undefined/empty input rather than throwing", () => {
    expect(estimateCarSeatExpiration(null)).toBeNull();
    expect(estimateCarSeatExpiration(undefined)).toBeNull();
    expect(estimateCarSeatExpiration("")).toBeNull();
  });

  it("returns null for a malformed date string rather than throwing or returning 'Invalid Date'", () => {
    expect(() => estimateCarSeatExpiration("not-a-date")).not.toThrow();
    expect(estimateCarSeatExpiration("not-a-date")).toBeNull();
  });

  it("handles a leap-day manufacture date without crashing", () => {
    expect(() => estimateCarSeatExpiration("2020-02-29")).not.toThrow();
    expect(estimateCarSeatExpiration("2020-02-29")).toBeTruthy();
  });
});

describe("resolveCarSeatReplaceAt", () => {
  it("prefers the explicit manufacturer expiry date when given", () => {
    expect(resolveCarSeatReplaceAt("2028-01-01", "2020-01-01")).toBe("2028-01-01");
  });

  it("regression: falls back to the manufacture-date estimate when no explicit expiry is given — the hand-me-down case with no legible sticker", () => {
    expect(resolveCarSeatReplaceAt(null, "2020-01-01")).toBe("2026-01-01");
    expect(resolveCarSeatReplaceAt("", "2020-01-01")).toBe("2026-01-01");
  });

  it("returns null when neither an explicit expiry nor a manufacture date is given", () => {
    expect(resolveCarSeatReplaceAt(null, null)).toBeNull();
    expect(resolveCarSeatReplaceAt("", "")).toBeNull();
  });
});
