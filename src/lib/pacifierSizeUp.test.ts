import { describe, it, expect } from "vitest";
import { nextPacifierSizeUpDate, currentPacifierStage, PACIFIER_SIZE_STAGES } from "./pacifierSizeUp";

describe("nextPacifierSizeUpDate", () => {
  it("returns the 6-month date for a newborn (still in Stage 1)", () => {
    expect(nextPacifierSizeUpDate("2026-01-01", new Date("2026-02-01T00:00:00Z"))).toBe(
      "2026-07-01",
    );
  });

  it("returns the 18-month date for a baby currently in Stage 2 (6-18mo)", () => {
    // Born 2025-01-01, "today" is 2025-08-01 — 7 months old, in Stage 2.
    expect(nextPacifierSizeUpDate("2025-01-01", new Date("2025-08-01T00:00:00Z"))).toBe(
      "2026-07-01",
    );
  });

  it("returns null once a child is already in the last (18mo+) stage — nothing further to size up to", () => {
    expect(nextPacifierSizeUpDate("2024-01-01", new Date("2026-01-01T00:00:00Z"))).toBeNull();
  });

  it("returns null when date of birth is unknown", () => {
    expect(nextPacifierSizeUpDate(null)).toBeNull();
    expect(nextPacifierSizeUpDate(undefined)).toBeNull();
  });

  it("returns null for a malformed date rather than throwing", () => {
    expect(() => nextPacifierSizeUpDate("not-a-date")).not.toThrow();
    expect(nextPacifierSizeUpDate("not-a-date")).toBeNull();
  });

  it("regression: a baby right at the 6-month boundary is treated as already in Stage 2, not Stage 1", () => {
    // Exactly 6 months old — the boundary itself belongs to the next stage,
    // matching "ageMonths < maxAgeMonths" (strict less-than) in the source.
    const sizeUp = nextPacifierSizeUpDate("2026-01-01", new Date("2026-07-01T00:00:00Z"));
    expect(sizeUp).toBe("2027-07-01"); // the 18-month mark, not another 6-month one
  });
});

describe("currentPacifierStage", () => {
  it("identifies Stage 1 for a newborn", () => {
    expect(currentPacifierStage("2026-01-01", new Date("2026-02-01T00:00:00Z"))?.label).toBe(
      "Stage 1 (0–6 months)",
    );
  });

  it("identifies Stage 3 for a toddler with no further size-up ahead", () => {
    expect(currentPacifierStage("2024-01-01", new Date("2026-01-01T00:00:00Z"))?.label).toBe(
      "Stage 3 (18+ months)",
    );
  });

  it("returns null when date of birth is unknown", () => {
    expect(currentPacifierStage(null)).toBeNull();
  });
});

describe("PACIFIER_SIZE_STAGES", () => {
  it("is ordered ascending by maxAgeMonths and ends uncapped", () => {
    for (let i = 1; i < PACIFIER_SIZE_STAGES.length; i++) {
      expect(PACIFIER_SIZE_STAGES[i].maxAgeMonths).toBeGreaterThan(
        PACIFIER_SIZE_STAGES[i - 1].maxAgeMonths,
      );
    }
    expect(PACIFIER_SIZE_STAGES[PACIFIER_SIZE_STAGES.length - 1].maxAgeMonths).toBe(Infinity);
  });
});
