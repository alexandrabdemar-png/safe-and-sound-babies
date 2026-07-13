import { describe, it, expect } from "vitest";
import { evaluateAgeAppropriateness } from "./ageAppropriateness";

function dobMonthsAgo(months: number, extraDays = 0): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  d.setDate(d.getDate() - extraDays);
  return d.toISOString().slice(0, 10);
}

const highChair = { label: "High chair", minAgeMonths: 6 };
const bassinet = { label: "Bassinet", minAgeMonths: 0, maxAgeMonths: 6 };
const babyGate = { label: "Baby gate", minAgeMonths: 6 };
const noBounds = { label: "Car seat", minAgeMonths: 0 };

describe("evaluateAgeAppropriateness", () => {
  it("returns null when there is no child DOB", () => {
    expect(evaluateAgeAppropriateness({ category: highChair, dateOfBirth: null })).toBeNull();
  });

  it("returns null when there is no category", () => {
    expect(
      evaluateAgeAppropriateness({ category: null, dateOfBirth: dobMonthsAgo(3) }),
    ).toBeNull();
  });

  it("flags 'too-early' when the child is under the min age (2mo vs 6mo high chair)", () => {
    const r = evaluateAgeAppropriateness({
      category: highChair,
      dateOfBirth: dobMonthsAgo(2),
    });
    expect(r?.kind).toBe("too-early");
    if (r?.kind === "too-early") {
      expect(r.label).toBe("High chair");
      expect(r.minAgeMonths).toBe(6);
      expect(r.startDate.getTime()).toBeGreaterThan(Date.now());
    }
  });

  it("returns null when the child is exactly at the min age", () => {
    // Use ~6 months + a couple days to make the boundary safe against
    // 30.4375-day month rounding.
    expect(
      evaluateAgeAppropriateness({
        category: highChair,
        dateOfBirth: dobMonthsAgo(6, 5),
      }),
    ).toBeNull();
  });

  it("flags 'outgrown' when a 10mo child is scanned against a bassinet (max 6mo)", () => {
    const r = evaluateAgeAppropriateness({
      category: bassinet,
      dateOfBirth: dobMonthsAgo(10),
    });
    expect(r?.kind).toBe("outgrown");
    if (r?.kind === "outgrown") {
      expect(r.maxAgeMonths).toBe(6);
    }
  });

  it("returns null for a category with only minAgeMonths=0 (no meaningful bounds)", () => {
    expect(
      evaluateAgeAppropriateness({
        category: noBounds,
        dateOfBirth: dobMonthsAgo(3),
      }),
    ).toBeNull();
  });

  it("uses adjusted age for preemies: 5mo chronological, 8 weeks early → still too early for a 6mo gate", () => {
    // 5 chronological months = ~5mo; minus 8 weeks (2mo) = ~3 adjusted months.
    const dob = dobMonthsAgo(5);
    const due = new Date(dob);
    due.setDate(due.getDate() + 56); // 8 weeks late relative to DOB = 8 weeks early
    const r = evaluateAgeAppropriateness({
      category: babyGate,
      dateOfBirth: dob,
      dueDate: due.toISOString().slice(0, 10),
    });
    expect(r?.kind).toBe("too-early");
    if (r?.kind === "too-early") {
      expect(r.adjusted).toBe(true);
      // start date should be pushed out by the correction (past chronological 6mo)
      expect(r.startDate.getTime()).toBeGreaterThan(Date.now());
    }
  });

  it("term baby at 7mo chronological is NOT too early for a 6mo gate (adjusted = chronological)", () => {
    expect(
      evaluateAgeAppropriateness({
        category: babyGate,
        dateOfBirth: dobMonthsAgo(7, 5),
      }),
    ).toBeNull();
  });
});
